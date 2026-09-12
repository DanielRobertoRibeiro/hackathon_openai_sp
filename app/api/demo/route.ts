import { NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";
import { errorResponse } from "@/src/http/errors";

export const runtime = "nodejs";

const PROJECT_ID = "maestro-demo";
const SESSION_ID = "session-demo";
const TASK_ID = "TASK-42";

export async function POST() {
  try {
    const application = getRuntime().application;
    await application.resetSession(PROJECT_ID, SESSION_ID);
    const base = {
      project_id: PROJECT_ID,
      session_id: SESSION_ID,
      task_id: TASK_ID,
      correlation_id: "demo-flow",
    };
    await application.ingest({
      ...base,
      event_type: "task.started",
      actor: { type: "human", id: "ana.dev", role: "developer" },
      payload: {
        objective: "Adicionar autenticação segura à API sem alterar o módulo de pagamentos.",
        description: "Tarefa de autenticação iniciada",
      },
    });
    await application.ingest({
      ...base,
      event_type: "prompt.submitted",
      actor: { type: "human", id: "ana.dev", role: "developer" },
      payload: {
        description: "Desenvolvedora solicita implementação de autenticação",
        prompt: "Implemente autenticação na API e preserve o escopo aprovado.",
      },
    });
    await application.ingest({
      ...base,
      event_type: "plan.proposed",
      actor: { type: "agent", id: "executor", role: "developer-agent" },
      payload: {
        action_id: "plan-auth",
        description: "Criar middleware de autenticação, testes e documentação",
        component: "src/auth",
      },
    });
    await application.ingest({
      ...base,
      event_type: "tool.completed",
      actor: { type: "tool", id: "repository-reader", role: null },
      payload: {
        action_id: "read-auth",
        tool: "read_repository",
        description: "Estrutura do repositório analisada",
        status: "passed",
      },
      evidence_refs: ["demo-repository-snapshot"],
    });
    await application.ingest({
      ...base,
      event_type: "file.change.proposed",
      actor: { type: "agent", id: "executor", role: "developer-agent" },
      payload: {
        action_id: "change-payment-config",
        action: "write_file",
        path: "src/payments/config.ts",
        component: "payments",
        description: "Alterar configuração de pagamentos fora do escopo aprovado",
      },
    });
    await application.ingest({
      ...base,
      event_type: "risk.detected",
      actor: { type: "service", id: "maestro-rules", role: "security" },
      payload: {
        description: "Mudança proposta fora do escopo de autenticação",
        severity: "high",
        component: "payments",
      },
      evidence_refs: ["change-payment-config"],
    });
    const report = await application.analyze(PROJECT_ID, SESSION_ID);
    return NextResponse.json({
      project_id: PROJECT_ID,
      session_id: SESSION_ID,
      task_id: TASK_ID,
      report,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
