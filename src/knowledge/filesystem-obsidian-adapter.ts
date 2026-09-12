import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  IntegrationHealth,
  KnowledgeDocument,
  KnowledgePort,
  KnowledgeResult,
  WriteReceipt,
} from "./port";

export class FilesystemObsidianAdapter implements KnowledgePort {
  private readonly root: string;
  private readonly allowedPrefixes: string[];

  constructor(root: string, allowedPrefixes: string[]) {
    this.root = path.resolve(root);
    this.allowedPrefixes = allowedPrefixes.map(normalizeRelative);
  }

  async search(query: string): Promise<KnowledgeResult[]> {
    const files = await listMarkdown(this.root);
    const normalized = query.toLowerCase();
    const results: KnowledgeResult[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (!content.toLowerCase().includes(normalized)) continue;
      results.push({
        id: extractId(content) ?? path.basename(file, ".md"),
        path: path.relative(this.root, file).replaceAll(path.sep, "/"),
        excerpt: content.slice(0, 500),
        version: hash(content),
      });
      if (results.length >= 25) break;
    }
    return results;
  }

  async get(id: string): Promise<KnowledgeResult | null> {
    const files = await listMarkdown(this.root);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (extractId(content) !== id) continue;
      return {
        id,
        path: path.relative(this.root, file).replaceAll(path.sep, "/"),
        excerpt: content,
        version: hash(content),
      };
    }
    return null;
  }

  async upsert(document: KnowledgeDocument): Promise<WriteReceipt> {
    const target = await this.resolveWriteTarget(document.path);
    let current: string | null = null;
    try {
      current = await readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (document.expected_version && hash(current ?? "") !== document.expected_version) {
      throw new Error("Knowledge document version conflict");
    }

    const content = `${serializeFrontmatter({ ...document.frontmatter, id: document.id })}\n\n${document.content.trim()}\n`;
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
    return {
      id: document.id,
      path: path.relative(this.root, target).replaceAll(path.sep, "/"),
      version: hash(content),
      written_at: new Date().toISOString(),
    };
  }

  async link(sourceId: string, targetId: string, relation: string): Promise<WriteReceipt> {
    const source = await this.get(sourceId);
    if (!source) throw new Error(`Knowledge document not found: ${sourceId}`);
    const content = `${source.excerpt.trim()}\n\n- ${relation}: [[${targetId}]]`;
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/, "");
    return this.upsert({
      id: sourceId,
      path: source.path,
      frontmatter: { tipo: "nota", status: "atualizado", relacionados: [targetId] },
      content: withoutFrontmatter,
      expected_version: source.version,
    });
  }

  async health(): Promise<IntegrationHealth> {
    try {
      const root = await realpath(this.root);
      return { status: "ok", adapter: "filesystem", detail: `Vault disponível em ${root}` };
    } catch {
      return { status: "degraded", adapter: "filesystem", detail: "Vault não está acessível" };
    }
  }

  private async resolveWriteTarget(relativePath: string): Promise<string> {
    const normalized = normalizeRelative(relativePath);
    if (!normalized.endsWith(".md")) throw new Error("Knowledge documents must use .md files");
    if (
      this.allowedPrefixes.length > 0 &&
      !this.allowedPrefixes.some(
        (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
      )
    ) {
      throw new Error("Knowledge path is outside the configured allowed prefixes");
    }

    const target = path.resolve(this.root, normalized);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error("Knowledge path escapes the vault");
    const parent = path.dirname(target);
    await mkdir(parent, { recursive: true });
    const [realRoot, realParent] = await Promise.all([realpath(this.root), realpath(parent)]);
    if (realParent !== realRoot && !realParent.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error("Knowledge path traverses a link outside the vault");
    }
    try {
      if ((await lstat(target)).isSymbolicLink()) throw new Error("Symbolic-link notes are not allowed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return target;
  }
}

function normalizeRelative(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === ".")) {
    throw new Error("Invalid relative knowledge path");
  }
  return normalized;
}

async function listMarkdown(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdown(item)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(item);
  }
  return files;
}

function extractId(content: string): string | null {
  return content.match(/^id:\s*["']?([^\r\n"']+)/m)?.[1]?.trim() ?? null;
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function serializeFrontmatter(values: KnowledgeDocument["frontmatter"]): string {
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  return ["---", ...lines, "---"].join("\n");
}
