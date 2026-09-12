import { randomUUID } from "node:crypto";
import type { Approval, MaestroEvent } from "./types";

export interface PolicyDecision {
  decision: "allow" | "require_approval" | "deny";
  reason: string;
  policy_ids: string[];
  required_role: Approval["required_role"] | null;
}

const PROTECTED_ACTIONS = new Set([
  "write_file",
  "delete_file",
  "install_dependency",
  "network_access",
  "shell_command",
  "git_commit",
  "git_push",
  "merge",
  "deploy",
  "change_scope",
]);

const INJECTION_PATTERNS = [
  /ignore (all|any|the|previous) (instructions|policies)/i,
  /reveal (the )?(secret|password|api key|system prompt)/i,
  /bypass (approval|policy|guardrail)/i,
  /ignore todas? as instruções/i,
  /revele (o )?(segredo|senha|prompt do sistema)/i,
];

const SECRET_PATTERNS = [
  /sk-[a-z0-9_-]{20,}/i,
  /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/,
];

export function evaluateEvent(event: MaestroEvent): PolicyDecision {
  const serialized = JSON.stringify(event.payload);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(serialized))) {
    return {
      decision: "deny",
      reason: "Potential secret detected in event payload",
      policy_ids: ["SEC-001"],
      required_role: "security",
    };
  }

  if (INJECTION_PATTERNS.some((pattern) => pattern.test(serialized))) {
    return {
      decision: "deny",
      reason: "Potential prompt injection detected in untrusted content",
      policy_ids: ["AGT-002"],
      required_role: "security",
    };
  }

  const action = String(event.payload.action ?? event.payload.tool ?? "").toLowerCase();
  if (
    event.sensitivity === "restricted" ||
    event.event_type === "file.change.proposed" ||
    PROTECTED_ACTIONS.has(action)
  ) {
    return {
      decision: "require_approval",
      reason: `Protected action requires explicit human approval: ${action || event.event_type}`,
      policy_ids: ["AGT-001"],
      required_role: event.sensitivity === "restricted" ? "security" : "tech_lead",
    };
  }

  return {
    decision: "allow",
    reason: "Action is within the default read-only or observational scope",
    policy_ids: [],
    required_role: null,
  };
}

export function createApproval(event: MaestroEvent, decision: PolicyDecision): Approval {
  if (decision.decision !== "require_approval" || !decision.required_role) {
    throw new Error("Approval can only be created for require_approval decisions");
  }
  const requestedAt = new Date();
  const expiresAt = new Date(requestedAt.getTime() + 30 * 60 * 1000);
  return {
    approval_id: randomUUID(),
    project_id: event.project_id,
    session_id: event.session_id,
    action: String(event.payload.action ?? event.payload.tool ?? event.event_type),
    reason: decision.reason,
    required_role: decision.required_role,
    status: "pending",
    requested_at: requestedAt.toISOString(),
    resolved_at: null,
    resolved_by: null,
    expires_at: expiresAt.toISOString(),
  };
}
