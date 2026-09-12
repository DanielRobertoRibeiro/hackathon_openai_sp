import { describe, it, expect, vi } from "vitest";
import { PlanWorkflow } from "@/src/application/plan-workflow";
import { MaestroStore } from "@/src/core/store";
import { MemoryKnowledgeAdapter } from "@/src/knowledge/memory-adapter";
const developer = { id: "alice", role: "developer" as const, project: "maestro" };
const leader = { id: "lead", role: "tech_lead" as const, project: "maestro" };
const plan = { session_id: "session-1", task_id: "task-1", objective: "Implement action plan gate",
  steps: ["Implement the gate"], files: ["src/gate.ts"], tests: ["Test denied execution"], risks: ["Network unavailable"], context_refs: ["context"] };
async function setup() {
  const knowledge = new MemoryKnowledgeAdapter();
  await knowledge.upsert({ id: "context", path: "context.md", content: "Project context", frontmatter: {} });
  const store = new MaestroStore();
  return { knowledge, store, service: new PlanWorkflow(store, knowledge) };
}
describe("plan-before-execution workflow", () => {
  it("blocks without plan and before human review, then permits approved persisted plan", async () => {
    const { service } = await setup();
    expect((await service.status(developer, plan.session_id)).allowed).toBe(false);
    const saved = await service.submit(developer, plan);
    expect((await service.status(developer, plan.session_id)).allowed).toBe(false);
    await service.review(leader, saved.plan_id, "approved");
    expect((await service.status(developer, plan.session_id)).allowed).toBe(true);
    expect((await service.status({ ...developer, id: "bob" }, plan.session_id)).allowed).toBe(false);
  });
  it("blocks outage, missing references, self-approval and cross-project review", async () => {
    const { service, knowledge } = await setup();
    await expect(service.submit(developer, { ...plan, context_refs: ["missing"] })).rejects.toThrow("missing");
    const saved = await service.submit(developer, plan);
    await expect(service.review(developer, saved.plan_id, "approved")).rejects.toThrow("role");
    await expect(service.review({ ...leader, id: developer.id }, saved.plan_id, "approved")).rejects.toThrow("Self");
    await expect(service.review({ ...leader, project: "other" }, saved.plan_id, "approved")).rejects.toThrow("not found");
    await service.review(leader, saved.plan_id, "approved");
    vi.spyOn(knowledge, "get").mockRejectedValue(new Error("offline"));
    expect((await service.status(developer, plan.session_id)).allowed).toBe(false);
  });
  it("blocks expired approvals and notes changed after approval", async () => {
    const { service, knowledge } = await setup();
    const saved = await service.submit(developer, plan);
    await service.review(leader, saved.plan_id, "approved");
    const current = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(current + 31 * 60 * 1000);
    try { expect((await service.status(developer, plan.session_id)).allowed).toBe(false); }
    finally { clock.mockRestore(); }
    const note = await knowledge.get(saved.plan_id);
    const get = vi.spyOn(knowledge, "get").mockResolvedValue({ ...note!, version: "changed" });
    try { expect((await service.status(developer, plan.session_id)).allowed).toBe(false); }
    finally { get.mockRestore(); }
  });
  it("retries an identical plan without duplicating it and preserves failed events", async () => {
    const { service, knowledge, store } = await setup();
    const write = vi.spyOn(knowledge, "upsert").mockRejectedValueOnce(new Error("offline"));
    await expect(service.submit(developer, plan)).rejects.toThrow("blocked");
    expect((await service.status(developer, plan.session_id)).allowed).toBe(false);
    write.mockRestore();
    const a = await service.submit(developer, plan), b = await service.submit(developer, plan);
    expect(a.plan_id).toBe(b.plan_id);
    const events = await store.listEvents("maestro");
    expect(events.filter((e) => e.event_type === "plan.proposed")).toHaveLength(1);
    expect(events.filter((e) => e.event_type === "knowledge.sync.completed")).toHaveLength(1);
    expect(events.some((e) => e.event_type === "knowledge.sync.failed")).toBe(true);
  });
  it("a changed plan requires a new review and secret-like payloads are rejected", async () => {
    const { service } = await setup();
    const saved = await service.submit(developer, plan);
    await service.review(leader, saved.plan_id, "approved");
    await service.submit(developer, { ...plan, steps: ["Different implementation step"] });
    expect((await service.status(developer, plan.session_id)).allowed).toBe(false);
    await expect(service.submit(developer, { ...plan, objective: "sk-" + "a".repeat(30) })).rejects.toThrow("policy");
  });
});
