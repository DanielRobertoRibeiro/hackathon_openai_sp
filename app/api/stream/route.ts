import { NextRequest } from "next/server";
import { getRuntime } from "@/src/application/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const { events } = getRuntime();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let onUpdate: ((payload: unknown) => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      onUpdate = (payload: unknown) => {
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      events.on("update", onUpdate);
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 15_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (onUpdate) events.off("update", onUpdate);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (heartbeat) clearInterval(heartbeat);
    if (onUpdate) events.off("update", onUpdate);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
