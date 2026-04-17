import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        const ragUrl = process.env.RAG_URL || "http://rag-service:8000/api/retrieve";

        // Call the llm-app retrieve endpoint
        const res = await fetch(ragUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, top_k: 10 }),
        });

        if (!res.ok) {
            // Fallback for local testing if running frontend outside docker
            const fallbackRes = await fetch("http://127.0.0.1:8000/api/retrieve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, top_k: 10 }),
            });
            if (fallbackRes.ok) {
                const data = await fallbackRes.json();
                return NextResponse.json(data);
            }
            throw new Error("Failed to fetch from RAG backend");
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (err: any) {
        console.error("Publication API error:", err);

        // Localhost fallback
        try {
            const { query } = await req.json(); // May fail if body already read, so this is just a backup mechanism
            // ... ignored for brevity, let's keep it simple
        } catch (e) { }

        return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
    }
}
