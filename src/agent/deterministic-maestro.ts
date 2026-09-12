import { randomUUID } from "node:crypto";
import type { MaestroReport, SessionState } from "@/src/core/types";

function severity(value: string): "low" | "medium" | "high" | "critical" {
  return ["low", "medium", "high", "critical"].includes(value)
    ? (value as "low" | "medium" | "high" | "critical")
    : "medium";
}

export function generateDeterministicReport(state: SessionState): MaestroReport {
  const facts = state.events.slice(-25).map((event) => ({
    statement: `${event.event_type} registrado por ${event.actor.id}`,
    evidence_refs: [event.event_id],
  }));
  const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending");
  const unknowns: string[] = [];
  if (state.verification_status === "not_started") {
    unknowns.push("Não há verificação independente registrada para esta sessão.");
  }
  if (state.events.length === 0) unknowns.push("A sessão ainda não possui eventos.");

  return {
    report_id: randomUUID(),
    schema_version: "1.0.0",
    prompt_version: "1.0.0",
    generated_at: new Date().toISOString(),
    project_id: state.project_id,
    task_id: state.task_id,
    session_id: state.session_id,
    summary:
      state.events.length === 0
        ? "A sessão ainda não possui atividade observável."
        : `Sessão ${state.status} com ${state.event_count} eventos, ${pendingApprovals.length} aprovações pendentes e verificação ${state.verification_status}.`,
    current_state: state.status,
    objective: state.objective,
    facts,
    inferences: pendingApprovals.map((approval) => ({
      statement: `O fluxo está aguardando decisão para ${approval.action}.`,
      rationale: "Existe uma aprovação pendente e válida no estado operacional.",
      confidence: 0.98,
      evidence_refs: [approval.approval_id],
    })),
    recommendations: [
      ...(pendingApprovals.length > 0
        ? [
            {
              action: "Revisar as aprovações pendentes antes de continuar a execução.",
              impact: "Evita que o fluxo permaneça bloqueado ou contorne um gate.",
              urgency: "high" as const,
              requires_approval: true,
            },
          ]
        : []),
      ...(state.verification_status !== "verified"
        ? [
            {
              action: "Executar os critérios de verificação definidos para a tarefa.",
              impact: "Permite distinguir conclusão declarada de resultado comprovado.",
              urgency: "medium" as const,
              requires_approval: false,
            },
          ]
        : []),
    ],
    progress: [...state.planned_actions, ...state.executed_actions],
    planned_actions: state.planned_actions,
    executed_actions: state.executed_actions,
    affected_components: state.affected_components,
    evidence: state.events.map((event) => ({
      id: event.event_id,
      type: event.event_type,
      source: event.source,
      observed_at: event.received_at,
    })),
    risks: state.risks.map((risk) => ({
      description: risk.description,
      severity: severity(risk.severity),
      probability: "possible",
      confidence: 0.9,
      mitigation: "Revisar a evidência e aplicar o controle indicado antes de prosseguir.",
      evidence_refs: risk.evidence_refs,
    })),
    blockers: state.blockers.map((blocker) => ({
      description: blocker.description,
      owner: null,
      next_action: "Designar responsável e registrar a resolução como novo evento.",
    })),
    scope_changes: state.events
      .filter((event) => event.event_type === "scope.changed")
      .map((event) => ({
        statement: String(event.payload.description ?? "Mudança de escopo registrada"),
        evidence_refs: [event.event_id],
      })),
    decisions: state.events
      .filter((event) => event.event_type === "approval.resolved")
      .map((event) => ({
        statement: String(event.payload.description ?? "Aprovação resolvida"),
        evidence_refs: [event.event_id],
      })),
    approval_requests: state.approvals.map((approval) => ({
      approval_id: approval.approval_id,
      action: approval.action,
      status: approval.status,
      required_role: approval.required_role,
    })),
    unknowns,
    verification_status: state.verification_status,
    overall_confidence: state.events.length > 0 ? 0.92 : 0.5,
  };
}
