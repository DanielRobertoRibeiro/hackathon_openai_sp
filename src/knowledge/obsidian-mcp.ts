import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpToolClient } from "./mcp-adapter";
import type { KnowledgeDocument, KnowledgePort, KnowledgeResult, WriteReceipt } from "./port";

export class HttpMcpToolClient implements McpToolClient {
  constructor(private readonly url: string, private readonly token: string) {
    const endpoint = new URL(url);
    if (endpoint.username || endpoint.password || !token) throw new Error("Invalid MCP credentials");
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))) {
      throw new Error("MCP requires HTTPS or loopback HTTP over a private tunnel");
    }
  }
  async callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
    const client = new Client({ name: "maestro-knowledge", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: { headers: { Authorization: `Bearer ${this.token}` }, redirect: "error" },
    });
    try {
      await client.connect(transport, { timeout: 10_000 });
      const result = await client.callTool({ name, arguments: input }, undefined, { timeout: 15_000 });
      if (result.isError) throw new Error(`Obsidian rejected ${name}`);
      const text = (result.content as Array<{ type: string; text?: string }>).find((item) => item.type === "text")?.text;
      if (!text || text.length > 2_000_000) throw new Error("Invalid MCP response");
      return JSON.parse(text) as T;
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

interface Note { path: string; content: string; frontmatter: Record<string, unknown> }
export const contentHash = (text: string) => createHash("sha256").update(text).digest("hex");

export function safeNotePath(path: string): string {
  if (!path.endsWith(".md") || path.length > 500 || /[\\\u0000-\u001f:]/.test(path) ||
      path.split("/").some((part) => !part || part.startsWith("."))) throw new Error("Invalid knowledge path");
  return path;
}

export class ObsidianMcpAdapter implements KnowledgePort {
  constructor(private readonly client: McpToolClient, private readonly writePrefixes = ["01 Projeto Maestro"]) {}

  async search(query: string): Promise<KnowledgeResult[]> {
    if (!query.trim() || query.length > 500) throw new Error("Invalid search query");
    const found = await this.client.callTool<Array<{ filename: string }>>("search_simple", { query });
    const notes = [];
    for (const entry of found.slice(0, 25)) {
      try { safeNotePath(entry.filename); } catch { continue; }
      notes.push(await this.read(entry.filename));
    }
    return notes.map((note) => ({ ...this.result(note), excerpt: note.content.slice(0, 1000) }));
  }

  async get(id: string): Promise<KnowledgeResult | null> {
    if (id.endsWith(".md")) return this.result(await this.read(safeNotePath(id)));
    if (!id || id.length > 256) throw new Error("Invalid knowledge id");
    const found = await this.client.callTool<Array<{ filename: string }>>("search_query", {
      query: { "==": [{ var: "frontmatter.id" }, id] },
    });
    if (found.length > 1) throw new Error("Ambiguous knowledge id");
    return found.length ? this.result(await this.read(safeNotePath(found[0].filename))) : null;
  }

  async upsert(document: KnowledgeDocument): Promise<WriteReceipt> {
    const path = safeNotePath(document.path);
    if (!this.writePrefixes.some((prefix) => path.startsWith(prefix + "/"))) throw new Error("Knowledge write outside allowed prefixes");
    if (!document.id || document.id.length > 256 || document.content.length > 100_000 ||
        Object.keys(document.frontmatter).some((key) => !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key))) throw new Error("Invalid knowledge document");
    const frontmatter = Object.entries({ ...document.frontmatter, id: document.id }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    const content = `---\n${frontmatter.join("\n")}\n---\n\n${document.content.trim()}\n`;
    // Exact path search distinguishes missing notes from authentication/network errors.
    const found = await this.client.callTool<Array<{ filename: string }>>("search_query", { query: { "==": [{ var: "path" }, path] } });
    if (found.length) {
      const map = await this.client.callTool<{ version: string }>("vault_get_document_map", { path });
      const current = await this.read(path);
      if (current.content === content) return this.receipt(document.id, path, content);
      if (!document.expected_version || contentHash(current.content) !== document.expected_version) throw new Error("Knowledge document version conflict");
      await this.client.callTool("vault_patch", { path, targetType: "heading", target: null,
        operation: "replace", scope: "content", content, ifMatch: map.version });
    } else {
      if (document.expected_version) throw new Error("Knowledge document version conflict");
      await this.client.callTool("vault_write", { path, content });
    }
    const written = await this.read(path);
    if (written.content !== content) throw new Error("Knowledge write verification failed");
    return this.receipt(document.id, path, content);
  }

  async link(sourceId: string, targetId: string, relation: string): Promise<WriteReceipt> {
    const source = await this.get(sourceId), target = await this.get(targetId);
    if (!source || !target || !/^[\p{L}\p{N} _-]{1,80}$/u.test(relation)) throw new Error("Invalid knowledge link");
    const note = await this.read(source.path);
    const line = `- ${relation}: [[${target.path}]]`;
    if (note.content.includes(line)) return this.receipt(source.id, source.path, note.content);
    const data = note.frontmatter as KnowledgeDocument["frontmatter"];
    return this.upsert({ id: source.id, path: source.path, frontmatter: data,
      content: note.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim() + "\n\n" + line,
      expected_version: source.version });
  }
  async health() {
    try {
      await this.client.callTool("vault_list", {});
      return { status: "ok" as const, adapter: "mcp", detail: "Obsidian MCP authenticated" };
    } catch {
      return { status: "degraded" as const, adapter: "mcp", detail: "Obsidian MCP unavailable; check tunnel and credentials" };
    }
  }
  private read(path: string) { return this.client.callTool<Note>("vault_read", { path }); }
  private result(note: Note): KnowledgeResult {
    return { id: String(note.frontmatter.id ?? note.path), path: note.path, excerpt: note.content, version: contentHash(note.content) };
  }
  private receipt(id: string, path: string, content: string): WriteReceipt {
    return { id, path, version: contentHash(content), written_at: new Date().toISOString() };
  }
}
