import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FilesystemObsidianAdapter } from "@/src/knowledge/filesystem-obsidian-adapter";

describe("filesystem Obsidian adapter", () => {
  it("writes inside an allowed prefix and rejects traversal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "maestro-vault-"));
    await mkdir(path.join(root, "01 Projeto Maestro"));
    const adapter = new FilesystemObsidianAdapter(root, ["01 Projeto Maestro"]);
    const receipt = await adapter.upsert({
      id: "handoff-1",
      path: "01 Projeto Maestro/18 Handoffs/handoff-1.md",
      frontmatter: { tipo: "handoff" },
      content: "# Handoff",
    });
    expect(receipt.path).toContain("18 Handoffs/handoff-1.md");
    await expect(
      adapter.upsert({
        id: "escape",
        path: "../escape.md",
        frontmatter: {},
        content: "no",
      }),
    ).rejects.toThrow("Invalid relative knowledge path");
  });
});
