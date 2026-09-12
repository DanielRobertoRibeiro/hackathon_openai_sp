import { NextRequest, NextResponse } from "next/server";
import { getRuntime } from "@/src/application/runtime";
import { resolveApprovalSchema } from "@/src/core/schemas";
import { errorResponse } from "@/src/http/errors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ approvalId: string }> },
) {
  try {
    const { approvalId } = await context.params;
    const input = resolveApprovalSchema.parse(await request.json());
    const approval = await getRuntime().application.resolveApproval(
      approvalId,
      input.decision,
      input.resolved_by,
      input.role,
    );
    return NextResponse.json(approval);
  } catch (error) {
    return errorResponse(error);
  }
}
