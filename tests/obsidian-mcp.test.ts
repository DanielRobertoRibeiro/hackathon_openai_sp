import { describe, it, expect } from "vitest";
import { HttpMcpToolClient, safeNotePath } from "@/src/knowledge/obsidian-mcp";
import { createKnowledgeAdapter } from "@/src/knowledge/factory";
describe("Obsidian MCP boundary", () => {
  it("rejects traversal, hidden files, absolute paths and unsafe URLs", () => {
    for (const path of ["../a.md", "/a.md", ".obsidian/a.md", "a/../b.md", "C:\\a.md", "a//b.md", "a.md\n"]) {
      expect(() => safeNotePath(path)).toThrow();
    }
    expect(safeNotePath("01 Projeto Maestro/a.md")).toBe("01 Projeto Maestro/a.md");
    expect(() => new HttpMcpToolClient("http://example.com/mcp", "token")).toThrow("HTTPS");
    expect(() => new HttpMcpToolClient("https://user:pass@example.com/mcp", "token")).toThrow();
  });
  it("fails closed when MCP credentials are missing", async () => {
    const adapter = createKnowledgeAdapter({ KNOWLEDGE_ADAPTER: "mcp" });
    expect((await adapter.health()).status).toBe("not_configured");
    await expect(adapter.get("anything")).rejects.toThrow("not configured");
  });
});
