import path from "node:path";
import { FilesystemObsidianAdapter } from "./filesystem-obsidian-adapter";
import { MemoryKnowledgeAdapter } from "./memory-adapter";
import { UnconfiguredMcpKnowledgeAdapter } from "./mcp-adapter";
import { HttpMcpToolClient, ObsidianMcpAdapter } from "./obsidian-mcp";
import type { KnowledgePort } from "./port";

export function createKnowledgeAdapter(environment: Record<string, string | undefined> = process.env): KnowledgePort {
  const adapter = environment.KNOWLEDGE_ADAPTER ?? "memory";
  if (adapter === "memory") return new MemoryKnowledgeAdapter();
  if (adapter === "mcp") {
    if (!environment.OBSIDIAN_MCP_SERVER || !environment.OBSIDIAN_MCP_TOKEN) return new UnconfiguredMcpKnowledgeAdapter();
    const prefixes = (environment.OBSIDIAN_ALLOWED_PREFIXES ?? "01 Projeto Maestro").split(",").map((s) => s.trim()).filter(Boolean);
    return new ObsidianMcpAdapter(new HttpMcpToolClient(environment.OBSIDIAN_MCP_SERVER, environment.OBSIDIAN_MCP_TOKEN), prefixes);
  }
  if (adapter === "filesystem") {
    const vaultPath = path.resolve(/* turbopackIgnore: true */
      process.cwd(),
      environment.OBSIDIAN_VAULT_PATH ?? "obsidian-vault",
    );
    const prefixes = (environment.OBSIDIAN_ALLOWED_PREFIXES ?? "01 Projeto Maestro")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return new FilesystemObsidianAdapter(vaultPath, prefixes);
  }
  throw new Error(`Unsupported KNOWLEDGE_ADAPTER: ${adapter}`);
}
