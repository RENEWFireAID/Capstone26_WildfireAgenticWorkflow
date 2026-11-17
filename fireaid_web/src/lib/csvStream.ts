import type { FindCursor } from "mongodb";

/** One CSV cell: quoted when it holds a comma, quote or line break. */
export function csvCell(v: unknown): string {
  if (v == null) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString().slice(0, 10);
  else if (typeof v === "object") s = String((v as { toString(): string }).toString());
  else s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Stream a Mongo cursor as a CSV download, a row at a time, so a full export
 * never sits in memory.
 */
export function csvResponse<T>(
  filename: string,
  header: string[],
  cursor: FindCursor<T>,
  toRow: (doc: T) => unknown[],
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(header.map(csvCell).join(",") + "\n"));
        let batch: string[] = [];
        for await (const doc of cursor) {
          batch.push(toRow(doc).map(csvCell).join(","));
          if (batch.length === 500) {
            controller.enqueue(encoder.encode(batch.join("\n") + "\n"));
            batch = [];
          }
        }
        if (batch.length) controller.enqueue(encoder.encode(batch.join("\n") + "\n"));
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        await cursor.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
