import { z } from "zod";
import { getRuntime } from "@/src/application/runtime";
import { authenticateWorkflow, boundedJson } from "@/src/http/workflow-auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (request.headers.has("origin")) return Response.json({ allowed: false }, { status: 403 });
  try {
    const actor = await authenticateWorkflow(request);
    if (!actor) return Response.json({ allowed: false, reason: "Unauthorized" }, { status: 401 });
    const { session_id } = z.object({ session_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) }).strict().parse(await boundedJson(request, 1000));
    return Response.json(await getRuntime().workflow.status(actor, session_id));
  } catch { return Response.json({ allowed: false, reason: "Gate unavailable; execution blocked" }, { status: 503 }); }
}
