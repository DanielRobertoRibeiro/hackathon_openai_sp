import { NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";

export const runtime = "nodejs";

export async function GET() {
  const knowledge = await getRuntime().application.knowledgeHealth();
  return NextResponse.json({
    status: knowledge.status === "degraded" ? "degraded" : "ok",
    service: "maestro",
    agent_mode: process.env.MAESTRO_AGENT_MODE ?? "auto",
    openai_configured: Boolean(process.env.OPENAI_API_KEY),
    knowledge,
  });
}
