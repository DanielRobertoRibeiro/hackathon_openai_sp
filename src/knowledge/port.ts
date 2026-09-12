export interface KnowledgeDocument {
  id: string;
  path: string;
  frontmatter: Record<string, string | number | boolean | string[] | null>;
  content: string;
  expected_version?: string | null;
}

export interface KnowledgeResult {
  id: string;
  path: string;
  excerpt: string;
  version: string;
}

export interface WriteReceipt {
  id: string;
  path: string;
  version: string;
  written_at: string;
}

export interface IntegrationHealth {
  status: "ok" | "degraded" | "not_configured";
  adapter: string;
  detail: string;
}

export interface KnowledgePort {
  search(query: string): Promise<KnowledgeResult[]>;
  get(id: string): Promise<KnowledgeResult | null>;
  upsert(document: KnowledgeDocument): Promise<WriteReceipt>;
  link(sourceId: string, targetId: string, relation: string): Promise<WriteReceipt>;
  health(): Promise<IntegrationHealth>;
}
