"""
[rag_eval.py]
Accuracy evaluation of the wildfire_literature RAG service.

Every question is written from one known abstract, so each one carries its own
ground truth: the source paper (to score retrieval) and a reference answer (to
score the generated answer). Each question is answered four ways so the
difference retrieval makes is visible:

    closed_book    the model alone, no context
    rag_truncated  query.py as written: top-3 chunks, each cut to 800 characters
    rag            top-3 chunks in full, as the web agent's rag tool passes them
    oracle         only the source abstract, in full (retrieval made perfect)

Stages are resumable: each writes one JSON line per question under eval/results/
and skips questions already present, so an interrupted run picks up where it stopped.

Run from llm-app/ (the Chroma path is relative):
    .venv/bin/python eval/rag_eval.py generate --csv ~/Downloads/wildfire_literature.csv
    .venv/bin/python eval/rag_eval.py answer
    .venv/bin/python eval/rag_eval.py judge
    .venv/bin/python eval/rag_eval.py report
"""

import argparse
import ast
import csv
import json
import os
import random
import re
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

LLM_APP = Path(__file__).resolve().parent.parent
sys.path.append(str(LLM_APP))

RESULTS = LLM_APP / "eval" / "results"
QUESTIONS = RESULTS / "questions.jsonl"
ANSWERS = RESULTS / "answers.jsonl"
JUDGED = RESULTS / "judged.jsonl"
REPORT = RESULTS / "report.md"

COLLECTION = "wildfire_literature"
RAG_TOP_K = 3  # what api.py serves to the agent
RETRIEVAL_DEPTH = 10  # what the Publication page asks for
MODES = ["closed_book", "rag_truncated", "rag", "oracle"]
TRUNCATE_AT = 800  # query.py's build_prompt keeps only this much of each chunk

FIRE_TERMS = re.compile(
    r"\b(wildfires?|wildland fires?|forest fires?|bush ?fires?|fire regimes?"
    r"|burn severity|prescribed (fire|burn)s?)\b",
    re.I,
)


def load_env():
    """Fill OPENROUTER_* from the repo's .env without overriding the shell."""
    env_file = LLM_APP.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def append_jsonl(path: Path, record: dict):
    with path.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def chat(model: str, prompt: str, as_json: bool = False, retries: int = 4) -> str:
    """One OpenRouter completion at temperature 0, retried on transient failure."""
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
    }
    if as_json:
        body["response_format"] = {"type": "json_object"}
    for attempt in range(retries):
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
                json=body,
                timeout=120,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  retrying {model} after: {e}", flush=True)
            time.sleep(2**attempt * 3)


def parse_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    return json.loads(match.group(0) if match else text)


def first_author(authors: str) -> str:
    try:
        people = ast.literal_eval(authors)
        return people[0]["last"] + (" et al." if len(people) > 1 else "")
    except Exception:
        return authors[:40]


# ---------------------------------------------------------------- generate

GENERATE_PROMPT = """You are building an evaluation set for a wildfire research assistant.
Read the paper below and write ONE question a wildfire researcher might ask that this
paper's abstract answers.

Rules:
- The question must stand alone. Never write "this study", "the authors" or "the paper".
- Make it specific enough to point at this paper's findings: name the region, ecosystem,
  method or variable involved. Do not copy the title.
- It must be answerable from the abstract alone, with a factual answer (a finding,
  quantity, direction of effect or comparison), not an opinion.
- reference_answer: 1-3 sentences, using only what the abstract states.
- key_facts: 1-4 short facts a correct answer must contain.

Return JSON: {{"question": "...", "reference_answer": "...", "key_facts": ["..."]}}

TITLE: {title}
ABSTRACT: {abstract}
"""


def sample_abstracts(csv_path: Path, n: int, seed: int) -> list[dict]:
    """Fire-related abstracts, round-robin across fields so no one field dominates."""
    csv.field_size_limit(10**9)
    counts, candidates = Counter(), []
    with csv_path.open(newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f)):
            abstract = row["abstract"].strip()
            counts[abstract] += 1
            # 9999 chars means the abstract was truncated in the export.
            if 600 <= len(abstract) < 9999 and FIRE_TERMS.search(abstract):
                candidates.append({**row, "row_index": i})
    by_field = defaultdict(list)
    for row in candidates:
        # A duplicated abstract has no single gold row to retrieve.
        if counts[row["abstract"].strip()] == 1:
            by_field[row["field"]].append(row)
    rng = random.Random(seed)
    for pool in by_field.values():
        rng.shuffle(pool)
    fields = sorted(by_field, key=lambda k: -len(by_field[k]))[:12]
    picked = []
    while len(picked) < n:
        for field in fields:
            if by_field[field] and len(picked) < n:
                picked.append(by_field[field].pop())
    return picked


def check_alignment(rows: list[dict]):
    """The CSV must be the one Chroma was built from, or gold row ids mean nothing."""
    import chromadb

    col = chromadb.PersistentClient(path=str(LLM_APP / "chroma_db")).get_collection(COLLECTION)
    ids = [f"{COLLECTION}:{r['row_index']}::chunk-0" for r in rows]
    stored = dict(zip(*[col.get(ids=ids)[k] for k in ("ids", "documents")]))
    bad = [i for i, r in zip(ids, rows) if stored.get(i, "").strip() != r["abstract"].strip()]
    if bad:
        sys.exit(f"CSV does not match chroma_db for {len(bad)} rows, e.g. {bad[:3]}")
    print(f"CSV rows match chroma_db ({len(rows)} checked)")


def cmd_generate(args):
    rows = sample_abstracts(Path(args.csv).expanduser(), args.n, args.seed)
    check_alignment(rows)
    done = {q["row_index"] for q in read_jsonl(QUESTIONS)}
    todo = [r for r in rows if r["row_index"] not in done]
    print(f"Generating {len(todo)} questions with {args.gen_model}")

    def work(row):
        out = parse_json(
            chat(args.gen_model, GENERATE_PROMPT.format(title=row["title"], abstract=row["abstract"]), as_json=True)
        )
        return {
            "row_index": row["row_index"],
            "question": out["question"],
            "reference_answer": out["reference_answer"],
            "key_facts": out["key_facts"],
            "title": row["title"],
            "authors": first_author(row["authors"]),
            "year": row["year"].split(".")[0],
            "field": row["field"],
            "abstract": row["abstract"],
            "gen_model": args.gen_model,
        }

    with ThreadPoolExecutor(args.workers) as pool:
        for q in pool.map(work, todo):
            append_jsonl(QUESTIONS, q)
            print(f"  [{q['row_index']}] {q['question']}", flush=True)
    # Stable ids in sampling order, whatever order the threads finished in.
    order = {r["row_index"]: k for k, r in enumerate(rows)}
    qs = sorted(read_jsonl(QUESTIONS), key=lambda q: order.get(q["row_index"], 1e9))
    QUESTIONS.write_text("".join(json.dumps({**q, "qid": f"Q{k + 1:02d}"}, ensure_ascii=False) + "\n" for k, q in enumerate(qs)))


# ------------------------------------------------------------------ answer

CLOSED_BOOK_PROMPT = """You are an engineering research assistant.
Answer the question concisely from your own knowledge, citing any studies you rely on.
If you do not know, say "Insufficient evidence."

QUESTION: {query}

ANSWER:
"""


def full_context_prompt(query: str, chunks: list) -> str:
    """query.py's prompt, but with every chunk passed whole instead of cut short."""
    from query import build_prompt

    head, _, _ = build_prompt(query, []).partition("CONTEXT:")
    context = ""
    for chunk in chunks:
        m = chunk.metadata
        context += (
            f"[Title: {m.get('title', 'Unknown Title')} | Author: {m.get('authors', 'Unknown Author')} "
            f"| Year: {m.get('year', 'Unknown Year')}]\n{re.sub(r'\s+', ' ', chunk.text)}\n\n"
        )
    return f"{head}CONTEXT:\n{context}\nANSWER:\n"


def cmd_answer(args):
    os.chdir(LLM_APP)  # retrieve.py opens ./chroma_db
    from query import build_prompt
    from services.rag_service.pipeline.workflow import RAGPipeline, RAGPipelineConfig
    from shared.types import Chunk

    pipeline = RAGPipeline(RAGPipelineConfig(default_top_k=RAG_TOP_K))
    questions = read_jsonl(QUESTIONS)
    done = {a["qid"] for a in read_jsonl(ANSWERS)}
    todo = [q for q in questions if q["qid"] not in done]
    print(f"Answering {len(todo)} questions with {args.answer_model}")

    # Retrieval is local and single-threaded; do it up front.
    retrieved = {}
    for q in todo:
        chunks = pipeline.retrieve(query=q["question"], collection=COLLECTION, top_k=RETRIEVAL_DEPTH)
        retrieved[q["qid"]] = chunks

    def work(q):
        chunks = retrieved[q["qid"]]
        gold = Chunk(
            chunk_id=f"{COLLECTION}:{q['row_index']}::chunk-0",
            doc_id=f"{COLLECTION}:{q['row_index']}",
            text=q["abstract"],
            metadata={"title": q["title"], "authors": q["authors"], "year": q["year"], "chunk_index": 0},
        )
        prompts = {
            "closed_book": CLOSED_BOOK_PROMPT.format(query=q["question"]),
            "rag_truncated": build_prompt(q["question"], chunks[:RAG_TOP_K]),
            "rag": full_context_prompt(q["question"], chunks[:RAG_TOP_K]),
            "oracle": full_context_prompt(q["question"], [gold]),
        }
        return {
            "qid": q["qid"],
            "answer_model": args.answer_model,
            "retrieved": [
                {
                    "rank": k + 1,
                    "row_index": c.metadata.get("row_index"),
                    "title": c.metadata.get("title"),
                    "year": str(c.metadata.get("year", "")).split(".")[0],
                    "authors": first_author(str(c.metadata.get("authors", ""))),
                    "is_gold": c.metadata.get("row_index") == q["row_index"],
                    "text": c.text,
                }
                for k, c in enumerate(chunks)
            ],
            "answers": {m: chat(args.answer_model, p) for m, p in prompts.items()},
        }

    with ThreadPoolExecutor(args.workers) as pool:
        for a in pool.map(work, todo):
            append_jsonl(ANSWERS, a)
            ranks = [r["rank"] for r in a["retrieved"] if r["is_gold"]]
            print(f"  {a['qid']} gold rank: {ranks[0] if ranks else '>10'}", flush=True)


# ------------------------------------------------------------------- judge

JUDGE_PROMPT = """You are grading an answer from a wildfire research assistant.

QUESTION: {question}

REFERENCE ANSWER (from the source paper): {reference}
KEY FACTS: {facts}
{context_block}
CANDIDATE ANSWER:
{answer}

Grade the candidate against the reference.
- correctness: 2 = contains the key facts and nothing contradicting them;
  1 = partially correct or vague but not wrong; 0 = wrong, missing the key facts, or abstains.
- abstained: true if it declines to answer (e.g. "Insufficient evidence").
- contradicts_reference: true if it states something the reference contradicts.
{grounded_rule}
Return JSON: {{"correctness": 0|1|2, "abstained": bool, "contradicts_reference": bool, {grounded_key}"rationale": "one sentence"}}
"""


def judge_prompt(q: dict, answer: str, context: list[str] | None) -> str:
    if context is None:
        block, rule, key = "", "", ""
    else:
        joined = "\n---\n".join(context)
        block = f"\nCONTEXT THE ASSISTANT WAS GIVEN:\n{joined}\n"
        rule = "- grounded: true if every factual claim in the candidate is supported by the CONTEXT.\n"
        key = '"grounded": bool, '
    return JUDGE_PROMPT.format(
        question=q["question"],
        reference=q["reference_answer"],
        facts="; ".join(q["key_facts"]),
        context_block=block,
        answer=answer,
        grounded_rule=rule,
        grounded_key=key,
    )


def cmd_judge(args):
    questions = {q["qid"]: q for q in read_jsonl(QUESTIONS)}
    done = {j["qid"] for j in read_jsonl(JUDGED)}
    todo = [a for a in read_jsonl(ANSWERS) if a["qid"] not in done]
    print(f"Judging {len(todo)} answer sets with {args.judge_model}")

    def work(a):
        q = questions[a["qid"]]
        contexts = {
            "closed_book": None,
            "rag_truncated": [re.sub(r"\s+", " ", r["text"])[:TRUNCATE_AT] for r in a["retrieved"][:RAG_TOP_K]],
            "rag": [r["text"] for r in a["retrieved"][:RAG_TOP_K]],
            "oracle": [q["abstract"]],
        }
        grades = {
            m: parse_json(chat(args.judge_model, judge_prompt(q, a["answers"][m], contexts[m]), as_json=True))
            for m in MODES
        }
        return {"qid": a["qid"], "judge_model": args.judge_model, "grades": grades}

    with ThreadPoolExecutor(args.workers) as pool:
        for j in pool.map(work, todo):
            append_jsonl(JUDGED, j)
            print(f"  {j['qid']} " + " ".join(f"{m}={j['grades'][m]['correctness']}" for m in MODES), flush=True)


# ------------------------------------------------------------------ report


def pct(x: float) -> str:
    return f"{100 * x:.0f}%"


def cmd_report(args):
    qs = {q["qid"]: q for q in read_jsonl(QUESTIONS)}
    ans = {a["qid"]: a for a in read_jsonl(ANSWERS)}
    jud = {j["qid"]: j for j in read_jsonl(JUDGED)}
    qids = [k for k in qs if k in ans and k in jud]
    n = len(qids)

    def gold_rank(qid):
        ranks = [r["rank"] for r in ans[qid]["retrieved"] if r["is_gold"]]
        return ranks[0] if ranks else None

    ranks = [gold_rank(k) for k in qids]
    hit = lambda k: sum(1 for r in ranks if r and r <= k) / n
    mrr = sum(1 / r for r in ranks if r) / n

    lines = [
        "# RAG accuracy evaluation: wildfire_literature",
        "",
        f"{n} questions, each written from one abstract in the {COLLECTION} collection "
        f"(101,856 abstracts, all-MiniLM-L6-v2, Chroma).",
        f"Questions by `{qs[qids[0]]['gen_model']}`, answers by `{ans[qids[0]]['answer_model']}`, "
        f"grading by `{jud[qids[0]]['judge_model']}`. Temperature 0 throughout.",
        "",
        "## Retrieval: did the source paper come back?",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Hit@1 | {pct(hit(1))} |",
        f"| Hit@3 (what the agent sees) | {pct(hit(3))} |",
        f"| Hit@10 (what the Publication page shows) | {pct(hit(10))} |",
        f"| MRR@10 | {mrr:.2f} |",
        "",
        "## Answers: closed book vs RAG vs oracle",
        "",
        "Correctness is graded 0/1/2 against the reference answer; *accuracy* counts a 2 as correct.",
        "",
        "| Mode | Accuracy (score 2) | Mean score (0-2) | Abstained | Contradicts reference | Grounded in context |",
        "|---|---|---|---|---|---|",
    ]
    for m in MODES:
        g = [jud[k]["grades"][m] for k in qids]
        grounded = [x["grounded"] for x in g if "grounded" in x]
        lines.append(
            f"| {m} | {pct(sum(x['correctness'] == 2 for x in g) / n)} "
            f"| {sum(x['correctness'] for x in g) / n:.2f} "
            f"| {pct(sum(bool(x['abstained']) for x in g) / n)} "
            f"| {pct(sum(bool(x['contradicts_reference']) for x in g) / n)} "
            f"| {pct(sum(grounded) / len(grounded)) if grounded else '-'} |"
        )

    # RAG accuracy split by whether retrieval found the source.
    found = [k for k, r in zip(qids, ranks) if r and r <= RAG_TOP_K]
    missed = [k for k in qids if k not in found]
    acc = lambda ks, m: pct(sum(jud[k]["grades"][m]["correctness"] == 2 for k in ks) / len(ks)) if ks else "-"
    lines += [
        "",
        "## Where RAG loses accuracy",
        "",
        "| Source paper in top 3? | Questions | RAG (truncated) | RAG (full) | Oracle |",
        "|---|---|---|---|---|",
        f"| yes | {len(found)} | {acc(found, 'rag_truncated')} | {acc(found, 'rag')} | {acc(found, 'oracle')} |",
        f"| no | {len(missed)} | {acc(missed, 'rag_truncated')} | {acc(missed, 'rag')} | {acc(missed, 'oracle')} |",
        "",
        "## Per question",
        "",
        "| # | Question | Gold rank | Closed book | RAG (truncated) | RAG (full) | Oracle |",
        "|---|---|---|---|---|---|---|",
    ]
    for k, r in zip(qids, ranks):
        g = jud[k]["grades"]
        lines.append(
            f"| {k} | {qs[k]['question']} | {r or '>10'} | "
            + " | ".join(str(g[m]["correctness"]) for m in MODES)
            + " |"
        )
    REPORT.write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:30]))
    print(f"\nWrote {REPORT}")


def main():
    load_env()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("generate")
    g.add_argument("--csv", required=True)
    g.add_argument("--n", type=int, default=50)
    g.add_argument("--seed", type=int, default=26)
    g.add_argument("--gen-model", default="openai/gpt-4o")
    a = sub.add_parser("answer")
    a.add_argument("--answer-model", default=os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4-5"))
    j = sub.add_parser("judge")
    # A different family from the answering model, so no model grades its own output.
    j.add_argument("--judge-model", default="openai/gpt-4o")
    sub.add_parser("report")
    for s in (g, a, j):
        s.add_argument("--workers", type=int, default=6)
    args = p.parse_args()
    RESULTS.mkdir(parents=True, exist_ok=True)
    {"generate": cmd_generate, "answer": cmd_answer, "judge": cmd_judge, "report": cmd_report}[args.cmd](args)


if __name__ == "__main__":
    main()
