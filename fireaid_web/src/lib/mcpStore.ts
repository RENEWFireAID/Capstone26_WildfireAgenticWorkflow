export const MCP_RESULT_KEY = "mcp:last_result";

export function writeMcpResult(result: any) {
  localStorage.setItem(MCP_RESULT_KEY, JSON.stringify(result));
  window.dispatchEvent(new Event("mcp:updated"));
}

export function readMcpResult(): any | null {
  try {
    const s = localStorage.getItem(MCP_RESULT_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export type McpPoint = { lat: number; lon: number; label?: string; meta?: any };

export function extractPoints(result: any): McpPoint[] {
  if (!result) return [];
  if (Array.isArray(result.points)) return result.points;

  const rows =
    result.results ??
    result.items ??
    result.raw?.results ??
    result.raw?.items ??
    result.data?.results ??
    result.data?.items;

  if (Array.isArray(rows)) {
    return rows
      .map((r: any) => {
        const lat = r.lat ?? r.latitude ?? r.y;
        const lon = r.lon ?? r.lng ?? r.longitude ?? r.x;
        if (typeof lat === "number" && typeof lon === "number") {
          return { lat, lon, label: r.name ?? r.label ?? r.title, meta: r };
        }
        return null;
      })
      .filter(Boolean) as McpPoint[];
  }
  return [];
}
