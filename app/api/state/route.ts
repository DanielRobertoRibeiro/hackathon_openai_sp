import { NextRequest, NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!projectId || !sessionId) {
    return NextResponse.json({ error: "project_id and session_id are required" }, { status: 400 });
  }
  return NextResponse.json(await getRuntime().application.getState(projectId, sessionId));
}
