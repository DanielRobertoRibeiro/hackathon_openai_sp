import { createHash } from "node:crypto";
import type {
  IntegrationHealth,
  KnowledgeDocument,
  KnowledgePort,
  KnowledgeResult,
  WriteReceipt,
} from "./port";

export class MemoryKnowledgeAdapter implements KnowledgePort {
  private readonly documents = new Map<string, KnowledgeDocument & { version: string }>();

  async search(query: string): Promise<KnowledgeResult[]> {
    const normalized = query.toLowerCase();
    return [...this.documents.values()]
      .filter((document) => `${document.path}\n${document.content}`.toLowerCase().includes(normalized))
      .map(toResult);
  }

  async get(id: string): Promise<KnowledgeResult | null> {
    const document = this.documents.get(id);
    return document ? toResult(document) : null;
  }

  async upsert(document: KnowledgeDocument): Promise<WriteReceipt> {
    const current = this.documents.get(document.id);
    if (document.expected_version && current?.version !== document.expected_version) {
      throw new Error("Knowledge document version conflict");
    }
    const version = hash(`${JSON.stringify(document.frontmatter)}\n${document.content}`);
    this.documents.set(document.id, { ...document, version });
    return { id: document.id, path: document.path, version, written_at: new Date().toISOString() };
  }

  async link(sourceId: string, targetId: string, relation: string): Promise<WriteReceipt> {
    const source = this.documents.get(sourceId);
    if (!source) throw new Error(`Knowledge document not found: ${sourceId}`);
    return this.upsert({
      ...source,
      content: `${source.content}\n\n- ${relation}: [[${targetId}]]`,
      expected_version: source.version,
    });
  }

  async health(): Promise<IntegrationHealth> {
    return { status: "ok", adapter: "memory", detail: "Ephemeral in-process knowledge adapter" };
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toResult(document: KnowledgeDocument & { version: string }): KnowledgeResult {
  return {
    id: document.id,
    path: document.path,
    excerpt: document.content.slice(0, 500),
    version: document.version,
  };
}
