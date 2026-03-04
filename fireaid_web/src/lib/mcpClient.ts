import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

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
    await client.connect(transport);
    _client = client;
    _connecting = null;
    return client;
  })();
  return _connecting;
}

export async function callFireTool(toolName: string, args: Record<string, unknown> = {}): Promise<any> {
  const client = await getMcpClient();
  const result = await client.callTool({ name: toolName, arguments: args });
  const content = result.content as any[]; const textBlock = content?.find((c: any) => c.type === "text");
  if (!textBlock) throw new Error("No text content from MCP");
  try { return JSON.parse(textBlock.text); } catch { return textBlock.text; }
}

export async function listFireTools(): Promise<Array<{ name: string; description: string }>> {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  return tools.map((t) => ({ name: t.name, description: t.description ?? "" }));
}
