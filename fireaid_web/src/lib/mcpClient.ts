import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const MCP_BASE = process.env.MCP_HTTP_BASE || "http://firemcp:8081";

let _client: Client | null = null;
let _connecting: Promise<Client> | null = null;

export async function getMcpClient(): Promise<Client> {
  if (_client) return _client;
  if (_connecting) return _connecting;
  _connecting = (async () => {
    const url = new URL(`${MCP_BASE}/mcp`);
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: { "host": "firemcp:8081" },
      },
    });
    const client = new Client({ name: "fireaid-web", version: "1.0.0" });
    try {
      await client.connect(transport);
      _client = client;
      return client;
    } finally {
      // Clear on failure too, or one failed connect would be returned forever.
      _connecting = null;
    }
  })();
  return _connecting;
}

/**
 * Run fn with the shared client, reconnecting once if the session is gone.
 * FireMCP restarts on its own (restart: always), which leaves the cached
 * session dead; without this every MCP feature fails until the web restarts.
 */
async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  try {
    return await fn(await getMcpClient());
  } catch (e) {
    // A slow tool is not a dead session, and retrying would double the wait.
    if (e instanceof McpError && e.code === ErrorCode.RequestTimeout) throw e;
    _client = null;
    return fn(await getMcpClient());
  }
}

export async function callFireTool(
  toolName: string,
  args: Record<string, unknown> = {},
  options?: { timeoutMs?: number },
): Promise<any> {
  const result = await withClient((client) =>
    client.callTool({ name: toolName, arguments: args }, undefined, { timeout: options?.timeoutMs }),
  );
  const content = result.content as any[]; const textBlock = content?.find((c: any) => c.type === "text");
  if (!textBlock) throw new Error("No text content from MCP");
  try { return JSON.parse(textBlock.text); } catch { return textBlock.text; }
}

export async function listFireTools(): Promise<Array<{ name: string; description: string }>> {
  const { tools } = await withClient((client) => client.listTools());
  return tools.map((t) => ({ name: t.name, description: t.description ?? "" }));
}

export type FireToolSchema = { name: string; description: string; inputSchema: Record<string, unknown> };

export async function listFireToolSchemas(): Promise<FireToolSchema[]> {
  const { tools } = await withClient((client) => client.listTools());
  return tools.map((t) => ({ name: t.name, description: t.description ?? "", inputSchema: t.inputSchema }));
}
