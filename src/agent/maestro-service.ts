import type { MaestroReport, SessionState } from "@/src/core/types";
import { generateDeterministicReport } from "./deterministic-maestro";
import { OpenAIMaestro } from "./openai-maestro";

export type AgentMode = "auto" | "deterministic" | "openai";

export class MaestroAgentService {
  constructor(
    private readonly mode: AgentMode,
    private readonly apiKey: string | undefined,
    private readonly model: string,
  ) {}

  async analyze(state: SessionState): Promise<MaestroReport> {
    if (this.mode === "deterministic" || (this.mode === "auto" && !this.apiKey)) {
      return generateDeterministicReport(state);
    }
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required when MAESTRO_AGENT_MODE=openai");
    }
    return new OpenAIMaestro(this.apiKey, this.model).analyze(state);
  }
}
