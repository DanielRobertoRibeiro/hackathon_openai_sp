import { randomUUID } from "node:crypto";
import type { AgentMode } from "@/src/agent/maestro-service";
import { MaestroAgentService } from "@/src/agent/maestro-service";
import { createEvent } from "@/src/core/events";
import { createApproval, evaluateEvent } from "@/src/core/policy-engine";
import { projectSession } from "@/src/core/projector";
import type { MaestroStore } from "@/src/core/store";
import type { Approval, CreateEventInput, MaestroEvent, MaestroReport } from "@/src/core/types";
import type { KnowledgePort } from "@/src/knowledge/port";

export interface IngestResult {
  accepted: boolean;
  duplicate: boolean;
  event: MaestroEvent;
  policy: ReturnType<typeof evaluateEvent>;
  approval: Approval | null;
}

export class MaestroApplication {
  constructor(
    private readonly store: MaestroStore,
    private readonly knowledge: KnowledgePort,
    private readonly notify: (projectId: string, sessionId: string) => void = () => undefined,
    environment: Record<string, string | undefined> = process.env,
  ) {
    this.agent = new MaestroAgentService(
      (environment.MAESTRO_AGENT_MODE ?? "auto") as AgentMode,
      environment.OPENAI_API_KEY,
      environment.OPENAI_MODEL ?? "gpt-5.6-terra",
    );
  }

  private readonly agent: MaestroAgentService;

  async ingest(input: CreateEventInput): Promise<IngestResult> {
    const event = createEvent(input);
    const policy = evaluateEvent(event);
    if (policy.decision === "deny") {
      const riskEvent = createEvent({
        event_type: "risk.detected",
        project_id: event.project_id,
        session_id: event.session_id,
        task_id: event.task_id,
        actor: { type: "service", id: "policy-engine", role: "security" },
        source: "policy-engine",
        correlation_id: event.correlation_id,
        payload: {
          description: policy.reason,
          severity: "critical",
          policy_ids: policy.policy_ids,
          original_event_type: event.event_type,
        },
        evidence_refs: [],
      });
      await this.store.appendEvent(riskEvent);
      this.notify(event.project_id, event.session_id);
      return { accepted: false, duplicate: false, event: riskEvent, policy, approval: null };
    }

    const stored = await this.store.appendEvent(event);
    let approval: Approval | null = null;
    if (!stored.duplicate && policy.decision === "require_approval") {
      approval = createApproval(event, policy);
      await this.store.saveApproval(approval);
      await this.store.appendEvent(
        createEvent({
          event_type: "approval.requested",
          project_id: event.project_id,
          session_id: event.session_id,
          task_id: event.task_id,
          actor: { type: "service", id: "policy-engine", role: "security" },
          source: "policy-engine",
          correlation_id: event.correlation_id,
          causation_id: event.event_id,
          payload: {
            approval_id: approval.approval_id,
            action: approval.action,
            description: approval.reason,
            required_role: approval.required_role,
          },
          evidence_refs: [event.event_id],
        }),
      );
    }
    this.notify(event.project_id, event.session_id);
    return { accepted: true, duplicate: stored.duplicate, event: stored.event, policy, approval };
  }

  async getState(projectId: string, sessionId: string) {
    const [events, approvals, report] = await Promise.all([
      this.store.listEvents(projectId, sessionId),
      this.store.listApprovals(projectId, sessionId),
      this.store.latestReport(projectId, sessionId),
    ]);
    return projectSession(events, expireApprovals(approvals), report);
  }

  async analyze(projectId: string, sessionId: string): Promise<MaestroReport> {
    const state = await this.getState(projectId, sessionId);
    let knowledgeContext: Array<{ path: string; excerpt: string; version: string }> = [];
    let knowledgeUnavailable = false;
    try {
      const references = state.events.filter((event) => event.source === "workflow-gateway" && event.event_type === "plan.proposed")
        .flatMap((event) => Array.isArray(event.payload.context_refs) ? event.payload.context_refs : []).filter((ref): ref is string => typeof ref === "string");
      for (const ref of [...new Set(references)].slice(0, 5)) {
        const note = await this.knowledge.get(ref);
        if (note) knowledgeContext.push({ path: note.path, excerpt: note.excerpt.slice(0, 4000), version: note.version });
      }
    } catch { knowledgeUnavailable = true; knowledgeContext = []; }
    const report = await this.agent.analyze({ ...state, knowledge_context: knowledgeContext });
    if (knowledgeUnavailable) report.unknowns.push("Consulta ao Obsidian indisponível; não há conclusão sobre políticas ou conhecimento atual.");
    await this.store.saveReport(report);
    await this.persistHandoff(report);
    this.notify(projectId, sessionId);
    return report;
  }

  async resolveApproval(
    approvalId: string,
    decision: "approved" | "rejected",
    resolvedBy: string,
    role: Approval["required_role"],
  ): Promise<Approval> {
    const approval = await this.store.getApproval(approvalId);
    if (!approval) throw new Error("Approval not found");
    if (approval.status !== "pending") throw new Error(`Approval is already ${approval.status}`);
    if (new Date(approval.expires_at).getTime() <= Date.now()) {
      const expired = { ...approval, status: "expired" as const };
      await this.store.saveApproval(expired);
      throw new Error("Approval has expired");
    }
    if (approval.required_role !== role && role !== "owner") {
      throw new Error(`Approval requires role ${approval.required_role}`);
    }
    const resolved: Approval = {
      ...approval,
      status: decision,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    };
    await this.store.saveApproval(resolved);
    await this.store.appendEvent(
      createEvent({
        event_type: "approval.resolved",
        project_id: approval.project_id,
        session_id: approval.session_id,
        actor: { type: "human", id: resolvedBy, role },
        source: "approval-service",
        correlation_id: approval.approval_id,
        payload: {
          approval_id: approval.approval_id,
          decision,
          description: `${approval.action}: ${decision}`,
        },
        evidence_refs: [approval.approval_id],
      }),
    );
    this.notify(approval.project_id, approval.session_id);
    return resolved;
  }

  async resetSession(projectId: string, sessionId: string): Promise<void> {
    await this.store.clearSession(projectId, sessionId);
    this.notify(projectId, sessionId);
  }

  knowledgeHealth() {
    return this.knowledge.health();
  }

  private async persistHandoff(report: MaestroReport): Promise<void> {
    const content = [
      `# Handoff — sessão ${report.session_id}`,
      "",
      "## Resultado",
      report.summary,
      "",
      "## Fatos",
      ...report.facts.map((fact) => `- ${fact.statement} (${fact.evidence_refs.join(", ")})`),
      "",
      "## Riscos",
      ...report.risks.map((risk) => `- **${risk.severity}** — ${risk.description}`),
      "",
      "## Próximas ações",
      ...report.recommendations.map((item) => `- ${item.action}`),
    ].join("\n");

    try {
      await this.knowledge.upsert({
        id: `handoff-${report.report_id}`,
        path: `01 Projeto Maestro/18 Handoffs/${report.session_id}-${report.report_id}.md`,
        frontmatter: {
          tipo: "handoff",
          status: "pronto",
          data_criacao: report.generated_at,
          origem: "maestro",
          autor: "maestro",
          confianca: report.overall_confidence,
          tags: ["handoff", "maestro"],
        },
        content,
      });
    } catch (error) {
      await this.store.appendEvent(
        createEvent({
          event_type: "knowledge.sync.failed",
          project_id: report.project_id,
          session_id: report.session_id,
          task_id: report.task_id,
          actor: { type: "service", id: "knowledge-sync", role: null },
          source: "knowledge-port",
          correlation_id: randomUUID(),
          payload: { description: error instanceof Error ? error.message : "Knowledge sync failed" },
          evidence_refs: [report.report_id],
        }),
      );
    }
  }
}

function expireApprovals(approvals: Approval[]): Approval[] {
  const now = Date.now();
  return approvals.map((approval) =>
    approval.status === "pending" && new Date(approval.expires_at).getTime() <= now
      ? { ...approval, status: "expired" }
      : approval,
  );
}
