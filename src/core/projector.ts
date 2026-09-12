import type { Approval, MaestroEvent, MaestroReport, ReportAction, SessionState } from "./types";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function evidenceFor(event: MaestroEvent): string[] {
  return event.evidence_refs.length > 0 ? event.evidence_refs : [event.event_id];
}

export function projectSession(
  events: MaestroEvent[],
  approvals: Approval[],
  latestReport: MaestroReport | null,
): SessionState {
  const first = events[0];
  const latest = events.at(-1);
  const objectiveEvent = events.find((event) => event.event_type === "task.started");
  const plannedActions: ReportAction[] = [];
  const executedActions: ReportAction[] = [];
  const affectedComponents = new Set<string>();
  const risks: SessionState["risks"] = [];
  const blockers: SessionState["blockers"] = [];
  let verificationStatus: SessionState["verification_status"] = "not_started";

  for (const event of events) {
    const description = stringValue(event.payload.description, event.event_type);
    const actionId = stringValue(event.payload.action_id, event.correlation_id);
    if (event.event_type === "plan.proposed" || event.event_type === "file.change.proposed") {
      plannedActions.push({
        id: actionId,
        description,
        status: "proposed",
        evidence_refs: evidenceFor(event),
      });
    }
    if (event.event_type === "tool.completed" || event.event_type === "file.changed") {
      const succeeded = event.payload.status !== "failed";
      executedActions.push({
        id: actionId,
        description,
        status: succeeded ? "executed" : "failed",
        evidence_refs: evidenceFor(event),
      });
    }
    if (event.event_type === "verification.completed") {
      verificationStatus = event.payload.status === "passed" ? "verified" : "failed";
    }
    if (event.event_type === "risk.detected") {
      risks.push({
        description,
        severity: stringValue(event.payload.severity, "medium"),
        evidence_refs: evidenceFor(event),
      });
    }
    if (event.event_type === "blocker.detected") {
      blockers.push({ description, evidence_refs: evidenceFor(event) });
    }
    const component = stringValue(event.payload.component || event.payload.path);
    if (component) affectedComponents.add(component);
  }

  const hasCompletion = events.some((event) => event.event_type === "session.completed");
  const hasPendingApproval = approvals.some((approval) => approval.status === "pending");
  const status: SessionState["status"] =
    blockers.length > 0 || hasPendingApproval
      ? "blocked"
      : hasCompletion && verificationStatus === "verified"
        ? "completed"
        : events.length > 0
          ? "active"
          : "idle";

  return {
    project_id: first?.project_id ?? "",
    session_id: first?.session_id ?? "",
    task_id: first?.task_id ?? null,
    objective: stringValue(objectiveEvent?.payload.objective, "Objetivo ainda não registrado"),
    status,
    event_count: events.length,
    events,
    planned_actions: plannedActions,
    executed_actions: executedActions,
    affected_components: [...affectedComponents],
    risks,
    blockers,
    verification_status: verificationStatus,
    approvals,
    latest_report: latestReport,
    updated_at: latest?.received_at ?? null,
  };
}
