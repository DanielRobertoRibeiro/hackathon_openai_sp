import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const graph = JSON.parse(await readFile(new URL("../visual-brain/data/knowledge-graph.json", import.meta.url)));
const nodeIds = new Set(graph.nodes.map((node) => node.id));

test("projection contains unique and internally connected records", () => {
  assert.equal(nodeIds.size, graph.nodes.length, "node IDs must be unique");
  assert.equal(new Set(graph.edges.map((edge) => edge.id)).size, graph.edges.length, "edge IDs must be unique");
  for (const edge of graph.edges) {
    assert(nodeIds.has(edge.source), `missing source node: ${edge.source}`);
    assert(nodeIds.has(edge.target), `missing target node: ${edge.target}`);
    assert.notEqual(edge.source, edge.target, "self-references are not useful in this projection");
  }
});

test("projection includes only allowlisted repository sources", () => {
  for (const node of graph.nodes) {
    assert(
      node.path === "README.md" || node.path.startsWith("README.md#") || node.path.startsWith("docs/") || node.path.startsWith("obsidian-vault/"),
      `source escaped the allowlist: ${node.path}`,
    );
    assert(!node.path.includes(".."), `path traversal found: ${node.path}`);
  }
});

test("every rendered value has a safe primitive shape", () => {
  for (const node of graph.nodes) {
    assert.equal(typeof node.label, "string");
    assert(node.label.length > 0 && node.label.length < 200);
    assert.equal(typeof node.summary, "string");
    assert(node.summary.length <= 220);
    assert.match(node.group, /^(project|architecture|policy|security|agent|evidence|knowledge)$/);
  }
});
