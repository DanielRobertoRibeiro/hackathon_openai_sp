import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { WorkflowIdentity } from "@/src/application/plan-workflow";

const registrySchema = z.array(z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  project: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  role: z.enum(["developer", "tech_lead", "owner"]),
  token_sha256: z.string().regex(/^[a-f0-9]{64}$/),
})).min(1).max(100);

export async function authenticateWorkflow(request: Request): Promise<WorkflowIdentity | null> {
  const file = process.env.MAESTRO_CLIENTS_FILE;
  if (!file) return null;
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer [a-zA-Z0-9_-]{32,200}$/.test(header)) return null;
  const digest = createHash("sha256").update(header.slice(7)).digest();
  const registry = registrySchema.parse(JSON.parse(await readFile(file, "utf8")));
  const matches = registry.filter((entry) => timingSafeEqual(digest, Buffer.from(entry.token_sha256, "hex")));
  if (matches.length !== 1) return null;
  return { id: matches[0].id, role: matches[0].role, project: matches[0].project };
}

export async function boundedJson(request: Request, maximum = 128_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw new Error("Request too large"); }
    parts.push(value);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
