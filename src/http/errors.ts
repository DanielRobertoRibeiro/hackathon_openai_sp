import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(error: unknown, fallbackStatus = 500): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_error", issues: error.issues },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message.includes("not found") || message.includes("Not found")
      ? 404
      : message.includes("requires role") || message.includes("expired")
        ? 403
        : fallbackStatus;
  return NextResponse.json({ error: "request_failed", message }, { status });
}
