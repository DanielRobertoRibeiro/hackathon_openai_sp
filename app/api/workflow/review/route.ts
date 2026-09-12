import { z } from "zod";
import { getRuntime } from "@/src/application/runtime";
import { authenticateWorkflow, boundedJson } from "@/src/http/workflow-auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (request.headers.has("origin")) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await authenticateWorkflow(request);
    if (!actor || actor.role === "developer") return Response.json({ error: "Reviewer required" }, { status: 403 });
    const body = z.object({ plan_id: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(["approved", "rejected"]) }).strict().parse(await boundedJson(request, 1000));
    return Response.json(await getRuntime().workflow.review(actor, body.plan_id, body.decision));
  } catch { return Response.json({ error: "Review rejected; inspect plan and reviewer scope" }, { status: 409 }); }
}
