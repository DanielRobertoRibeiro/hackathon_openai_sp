import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";
import { createSessionSchema } from "@/src/core/schemas";
import { errorResponse } from "@/src/http/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const input = createSessionSchema.parse(await request.json());
    const sessionId = randomUUID();
    const correlationId = randomUUID();
    const application = getRuntime().application;
    await application.ingest({
      event_type: "task.started",
      project_id: input.project_id,
      session_id: sessionId,
      task_id: input.task_id,
      actor: { type: "human", id: input.developer_id, role: "developer" },
      correlation_id: correlationId,
      payload: { objective: input.objective, description: `Tarefa iniciada: ${input.task_id}` },
    });
    await application.ingest({
      event_type: "prompt.submitted",
      project_id: input.project_id,
      session_id: sessionId,
      task_id: input.task_id,
      actor: { type: "human", id: input.developer_id, role: "developer" },
      correlation_id: correlationId,
      payload: { prompt: input.prompt, description: "Solicitação enviada ao agente executor" },
    });
    await application.ingest({
      event_type: "plan.proposed",
      project_id: input.project_id,
      session_id: sessionId,
      task_id: input.task_id,
      actor: { type: "agent", id: "executor", role: "developer-agent" },
      correlation_id: correlationId,
      payload: {
        action_id: correlationId,
        description: "Analisar a solicitação e trabalhar apenas no escopo aprovado.",
      },
    });
    return NextResponse.json(
      { project_id: input.project_id, session_id: sessionId, task_id: input.task_id },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
