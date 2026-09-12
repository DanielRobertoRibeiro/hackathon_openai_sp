import { z } from "zod";
import { getRuntime } from "@/src/application/runtime";
import { authenticateWorkflow, boundedJson } from "@/src/http/workflow-auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (request.headers.has("origin")) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await authenticateWorkflow(request);
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const input = z.object({ session_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
      activity_id: z.string().regex(/^[a-f0-9]{64}$/), tool: z.string().regex(/^[a-zA-Z0-9_:.-]{1,128}$/) }).strict().parse(await boundedJson(request, 2000));
    return Response.json(await getRuntime().workflow.activity(actor, input));
  } catch { return Response.json({ error: "Activity not recorded" }, { status: 503 }); }
}
