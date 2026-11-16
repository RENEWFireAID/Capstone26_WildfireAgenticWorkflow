export type RagChunk = { text: string; metadata: Record<string, unknown> };

/** Top abstracts for a query from the RAG service, or null if it could not be reached. */
export async function retrieveRagChunks(query: string): Promise<RagChunk[] | null> {
    try {
        const url = process.env.RAG_API_URL || "http://host.docker.internal:8000/api/retrieve";
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, top_k: 3 })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data.chunks) ? data.chunks : [];
    } catch (e) {
        console.error("Failed to retrieve context:", e);
        return null;
    }
}
