import { NextRequest, NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";
import { analyzeSchema } from "@/src/core/schemas";
import { errorResponse } from "@/src/http/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const input = analyzeSchema.parse(await request.json());
    const report = await getRuntime().application.analyze(input.project_id, input.session_id);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
