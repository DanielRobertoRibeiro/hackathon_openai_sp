import { randomUUID } from "node:crypto";
import type { CreateEventInput, MaestroEvent } from "./types";

export function createEvent(input: CreateEventInput): MaestroEvent {
  const receivedAt = new Date().toISOString();
  return {
    event_id: randomUUID(),
    event_type: input.event_type,
    schema_version: "1.0.0",
    occurred_at: input.occurred_at ?? receivedAt,
    received_at: receivedAt,
    organization_id: null,
    project_id: input.project_id,
    workflow_id: null,
    task_id: input.task_id ?? null,
    session_id: input.session_id,
    actor: {
      type: input.actor?.type ?? "human",
      id: input.actor?.id ?? "anonymous",
      role: input.actor?.role ?? null,
    },
    source: input.source ?? "maestro-api",
    correlation_id: input.correlation_id ?? randomUUID(),
    causation_id: input.causation_id ?? null,
    idempotency_key: input.idempotency_key ?? null,
    payload: input.payload ?? {},
    sensitivity: input.sensitivity ?? "internal",
    consent_scope: input.consent_scope ?? "project-workflow",
    evidence_refs: input.evidence_refs ?? [],
  };
}
