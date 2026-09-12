import { z } from "zod";
import { EVENT_TYPES } from "./types";

const id = z.string().trim().min(1).max(128);

export const createEventSchema = z.object({
  event_type: z.enum(EVENT_TYPES),
  project_id: id,
  session_id: id,
  task_id: id.nullable().optional(),
  actor: z
    .object({
      type: z.enum(["human", "agent", "service", "tool"]),
      id,
      role: z.string().trim().max(128).nullable().optional(),
    })
    .optional(),
  source: z.string().trim().min(1).max(128).optional(),
  correlation_id: id.optional(),
  causation_id: id.nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(256).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
  consent_scope: z.string().trim().max(256).nullable().optional(),
  evidence_refs: z.array(z.string().trim().min(1).max(256)).max(100).optional(),
  occurred_at: z.iso.datetime().optional(),
});

export const createSessionSchema = z.object({
  project_id: id.default("maestro-demo"),
  task_id: id,
  objective: z.string().trim().min(5).max(4000),
  prompt: z.string().trim().min(1).max(12000),
  developer_id: id.default("developer-demo"),
});

export const analyzeSchema = z.object({
  project_id: id,
  session_id: id,
});

export const resolveApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  resolved_by: id,
  role: z.enum(["tech_lead", "security", "owner"]),
});

const evidenceRefs = z.array(z.string().min(1)).max(200);
const factSchema = z.object({ statement: z.string().min(1), evidence_refs: evidenceRefs.min(1) });
const actionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  status: z.enum([
    "proposed",
    "approved",
    "executing",
    "executed",
    "declared",
    "verified",
    "failed",
    "blocked",
  ]),
  evidence_refs: evidenceRefs,
});

export const maestroReportSchema = z.object({
  report_id: id,
  schema_version: z.literal("1.0.0"),
  prompt_version: z.literal("1.0.0"),
  generated_at: z.iso.datetime(),
  project_id: id,
  task_id: id.nullable(),
  session_id: id,
  summary: z.string().min(1).max(2000),
  current_state: z.string().min(1).max(128),
  objective: z.string().min(1).max(2000),
  facts: z.array(factSchema),
  inferences: z.array(
    factSchema.extend({ rationale: z.string().min(1), confidence: z.number().min(0).max(1) }),
  ),
  recommendations: z.array(
    z.object({
      action: z.string().min(1),
      impact: z.string().min(1),
      urgency: z.enum(["low", "medium", "high", "immediate"]),
      requires_approval: z.boolean(),
    }),
  ),
  progress: z.array(actionSchema),
  planned_actions: z.array(actionSchema),
  executed_actions: z.array(actionSchema),
  affected_components: z.array(z.string().min(1)),
  evidence: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      source: z.string().min(1),
      observed_at: z.iso.datetime(),
    }),
  ),
  risks: z.array(
    z.object({
      description: z.string().min(1),
      severity: z.enum(["low", "medium", "high", "critical"]),
      probability: z.enum(["unlikely", "possible", "likely"]),
      confidence: z.number().min(0).max(1),
      mitigation: z.string().min(1),
      evidence_refs: evidenceRefs,
    }),
  ),
  blockers: z.array(
    z.object({
      description: z.string().min(1),
      owner: z.string().nullable(),
      next_action: z.string().min(1),
    }),
  ),
  scope_changes: z.array(factSchema),
  decisions: z.array(factSchema),
  approval_requests: z.array(
    z.object({
      approval_id: id,
      action: z.string().min(1),
      status: z.enum(["pending", "approved", "rejected", "expired"]),
      required_role: z.string().min(1),
    }),
  ),
  unknowns: z.array(z.string().min(1)),
  verification_status: z.enum(["not_started", "partial", "verified", "failed"]),
  overall_confidence: z.number().min(0).max(1),
});
