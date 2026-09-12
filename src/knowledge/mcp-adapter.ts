import type {
  IntegrationHealth,
  KnowledgeDocument,
  KnowledgePort,
  KnowledgeResult,
  WriteReceipt,
} from "./port";

export interface McpToolClient {
  callTool<T>(name: string, input: Record<string, unknown>): Promise<T>;
}

export class McpKnowledgeAdapter implements KnowledgePort {
  constructor(private readonly client: McpToolClient) {}

  search(query: string): Promise<KnowledgeResult[]> {
    return this.client.callTool("knowledge_search", { query });
  }

  get(id: string): Promise<KnowledgeResult | null> {
    return this.client.callTool("knowledge_get", { id });
  }

  upsert(document: KnowledgeDocument): Promise<WriteReceipt> {
    return this.client.callTool("knowledge_upsert", { document });
  }

  link(sourceId: string, targetId: string, relation: string): Promise<WriteReceipt> {
    return this.client.callTool("knowledge_link", { sourceId, targetId, relation });
  }

  health(): Promise<IntegrationHealth> {
    return this.client.callTool("knowledge_health", {});
  }
}

export class UnconfiguredMcpKnowledgeAdapter implements KnowledgePort {
  async search(): Promise<KnowledgeResult[]> {
    throw new Error("MCP knowledge transport is not configured");
  }
  async get(): Promise<KnowledgeResult | null> {
    throw new Error("MCP knowledge transport is not configured");
  }
  async upsert(): Promise<WriteReceipt> {
    throw new Error("MCP knowledge transport is not configured");
  }
  async link(): Promise<WriteReceipt> {
    throw new Error("MCP knowledge transport is not configured");
  }
  async health(): Promise<IntegrationHealth> {
    return {
      status: "not_configured",
      adapter: "mcp",
      detail: "Injete um McpToolClient quando o servidor Obsidian MCP for escolhido.",
    };
  }
}
