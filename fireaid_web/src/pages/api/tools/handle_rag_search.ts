
export async function retrieveRagContext(query: string) {
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
        return JSON.stringify(data.chunks);
    } catch (e) {
        console.error("Failed to retrieve context:", e);
        return "Failed to retrieve context.";
    }
}