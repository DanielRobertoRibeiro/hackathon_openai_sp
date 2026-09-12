import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "visual-brain/data/knowledge-graph.json");
const sourceRoots = ["README.md", "docs", "obsidian-vault"];

async function markdownFiles(path) {
  const fullPath = resolve(root, path);
  const entries = await readdir(fullPath, { withFileTypes: true }).catch(() => []);
  if (!entries.length && extname(path) === ".md") return [path];
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) =>
        entry.isDirectory()
          ? markdownFiles(`${path}/${entry.name}`)
          : extname(entry.name) === ".md"
            ? [`${path}/${entry.name}`]
            : [],
      ),
  );
  return nested.flat();
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---", 4);
  if (end < 0) return {};
  return Object.fromEntries(
    content
      .slice(4, end)
      .split("\n")
      .map((line) => line.match(/^([\w_]+):\s*["']?(.*?)["']?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function groupFor(path, metadata) {
  const value = `${metadata.tipo ?? ""} ${path}`.toLowerCase();
  if (value.includes("politic")) return "policy";
  if (value.includes("segur") || value.includes("cyber")) return "security";
  if (value.includes("arquitet")) return "architecture";
  if (value.includes("prompt") || value.includes("agente")) return "agent";
  if (value.includes("evid") || value.includes("audit")) return "evidence";
  if (path.startsWith("obsidian-vault")) return "knowledge";
  return "project";
}

function titleOf(content, fallback) {
  return content.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallback.replace(/\.md$/, "");
}

const files = (await Promise.all(sourceRoots.map(markdownFiles))).flat().sort();
const nodes = [];
const edges = [];
const paths = new Map();

for (const path of files) {
  const content = await readFile(resolve(root, path), "utf8");
  const metadata = parseFrontmatter(content);
  const id = `document:${slug(path)}`;
  const group = groupFor(path, metadata);
  const title = titleOf(content, path);
  paths.set(path, id);
  nodes.push({
    id,
    label: title,
    type: "document",
    group,
    status: metadata.status || "documented",
    path,
    summary: content
      .replace(/^---[\s\S]*?---\s*/, "")
      .replace(/^#+\s+/gm, "")
      .replace(/[`*_>#-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220),
  });

  const headings = [...content.matchAll(/^(##|###)\s+(.+)$/gm)].slice(0, 18);
  for (const [headingIndex, [, depth, heading]] of headings.entries()) {
    const headingId = `concept:${slug(path)}:${headingIndex + 1}:${slug(heading)}`;
    nodes.push({
      id: headingId,
      label: heading.trim(),
      type: depth === "##" ? "concept" : "detail",
      group,
      status: "documented",
      path: `${path}#${slug(heading)}`,
      summary: `Seção de “${title}”.`,
    });
    edges.push({ id: `edge:${id}:${headingId}`, source: id, target: headingId, relation: "CONTAINS" });
  }
}

for (const path of files) {
  const content = await readFile(resolve(root, path), "utf8");
  const source = paths.get(path);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    const rawTarget = decodeURIComponent(match[1]);
    if (/^[a-z]+:/i.test(rawTarget)) continue;
    const targetPath = relative(root, resolve(dirname(resolve(root, path)), rawTarget)).replaceAll("\\", "/");
    const target = paths.get(targetPath);
    if (target && target !== source) {
      const id = `edge:${source}:${target}`;
      if (!edges.some((edge) => edge.id === id)) edges.push({ id, source, target, relation: "REFERENCES" });
    }
  }
}

const payload = {
  project_id: "maestro",
  projection_version: "1.0.0",
  generated_at: "generated-at-build-time",
  nodes,
  edges,
  source_count: files.length,
};
payload.integrity = createHash("sha256").update(JSON.stringify({ nodes, edges })).digest("hex");
const serialized = `${JSON.stringify(payload, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(output, "utf8").catch(() => "");
  if (current !== serialized) {
    console.error("knowledge-graph.json is stale; run npm run build:graph");
    process.exitCode = 1;
  } else {
    console.log(`Graph is current: ${nodes.length} nodes, ${edges.length} edges`);
  }
} else {
  await writeFile(output, serialized);
  console.log(`Wrote ${relative(root, output)}: ${nodes.length} nodes, ${edges.length} edges`);
}
