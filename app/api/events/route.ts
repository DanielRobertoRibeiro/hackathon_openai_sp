import { NextRequest, NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";
import { createEventSchema } from "@/src/core/schemas";
import { errorResponse } from "@/src/http/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project_id");
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!projectId || !sessionId) {
    return NextResponse.json({ error: "project_id and session_id are required" }, { status: 400 });
  }
  const state = await getRuntime().application.getState(projectId, sessionId);
  return NextResponse.json({ events: state.events });
}

export async function POST(request: NextRequest) {
  try {
    const input = createEventSchema.parse(await request.json());
    const result = await getRuntime().application.ingest(input);
    return NextResponse.json(result, { status: result.accepted ? 202 : 403 });
  } catch (error) {
    return errorResponse(error);
  }
}
