export const EVENT_TYPES = [
  "task.started",
  "prompt.submitted",
  "plan.proposed",
  "plan.approved",
  "tool.requested",
  "tool.completed",
  "file.change.proposed",
  "file.changed",
  "verification.completed",
  "risk.detected",
  "approval.requested",
  "approval.resolved",
  "blocker.detected",
  "scope.changed",
  "session.completed",
  "handoff.generated",
  "knowledge.sync.requested",
  "knowledge.sync.completed",
  "knowledge.sync.failed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type ActorType = "human" | "agent" | "service" | "tool";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type ActionStatus =
  | "proposed"
  | "approved"
  | "executing"
  | "executed"
  | "declared"
  | "verified"
  | "failed"
  | "blocked";

export interface MaestroEvent {
  event_id: string;
  event_type: EventType;
  schema_version: "1.0.0";
  occurred_at: string;
  received_at: string;
  organization_id: string | null;
  project_id: string;
  workflow_id: string | null;
  task_id: string | null;
  session_id: string;
  actor: { type: ActorType; id: string; role: string | null };
  source: string;
  correlation_id: string;
  causation_id: string | null;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  sensitivity: Sensitivity;
  consent_scope: string | null;
  evidence_refs: string[];
}

export interface CreateEventInput {
  event_type: EventType;
  project_id: string;
  session_id: string;
  task_id?: string | null;
  actor?: { type: ActorType; id: string; role?: string | null };
  source?: string;
  correlation_id?: string;
  causation_id?: string | null;
  idempotency_key?: string | null;
  payload?: Record<string, unknown>;
  sensitivity?: Sensitivity;
  consent_scope?: string | null;
  evidence_refs?: string[];
  occurred_at?: string;
}

export interface Approval {
  approval_id: string;
  project_id: string;
  session_id: string;
  action: string;
  reason: string;
  required_role: "tech_lead" | "security" | "owner";
  status: "pending" | "approved" | "rejected" | "expired";
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  expires_at: string;
}

export interface ReportFact {
  statement: string;
  evidence_refs: string[];
}

export interface MaestroReport {
  report_id: string;
  schema_version: "1.0.0";
  prompt_version: "1.0.0";
  generated_at: string;
  project_id: string;
  task_id: string | null;
  session_id: string;
  summary: string;
  current_state: string;
  objective: string;
  facts: ReportFact[];
  inferences: Array<ReportFact & { rationale: string; confidence: number }>;
  recommendations: Array<{
    action: string;
    impact: string;
    urgency: "low" | "medium" | "high" | "immediate";
    requires_approval: boolean;
  }>;
  progress: ReportAction[];
  planned_actions: ReportAction[];
  executed_actions: ReportAction[];
  affected_components: string[];
  evidence: Array<{ id: string; type: string; source: string; observed_at: string }>;
  risks: Array<{
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    probability: "unlikely" | "possible" | "likely";
    confidence: number;
    mitigation: string;
    evidence_refs: string[];
  }>;
  blockers: Array<{ description: string; owner: string | null; next_action: string }>;
  scope_changes: ReportFact[];
  decisions: ReportFact[];
  approval_requests: Array<{
    approval_id: string;
    action: string;
    status: Approval["status"];
    required_role: string;
  }>;
  unknowns: string[];
  verification_status: "not_started" | "partial" | "verified" | "failed";
  overall_confidence: number;
}

export interface ReportAction {
  id: string;
  description: string;
  status: ActionStatus;
  evidence_refs: string[];
}

export interface SessionState {
  project_id: string;
  session_id: string;
  task_id: string | null;
  objective: string;
  status: "idle" | "active" | "blocked" | "completed";
  event_count: number;
  events: MaestroEvent[];
  planned_actions: ReportAction[];
  executed_actions: ReportAction[];
  affected_components: string[];
  risks: Array<{ description: string; severity: string; evidence_refs: string[] }>;
  blockers: Array<{ description: string; evidence_refs: string[] }>;
  verification_status: MaestroReport["verification_status"];
  approvals: Approval[];
  latest_report: MaestroReport | null;
  updated_at: string | null;
}
