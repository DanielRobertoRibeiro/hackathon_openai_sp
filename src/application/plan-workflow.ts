import { createHash } from "node:crypto";
import { z } from "zod";
import { createEvent } from "@/src/core/events";
import { evaluateEvent } from "@/src/core/policy-engine";
import type { MaestroStore } from "@/src/core/store";
import type { MaestroEvent } from "@/src/core/types";
import type { KnowledgePort, WriteReceipt } from "@/src/knowledge/port";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const lines = z.array(z.string().trim().min(3).max(1000)).min(1).max(50);
export const planSchema = z.object({
  session_id: id, task_id: id, objective: z.string().trim().min(10).max(4000),
  steps: lines, files: lines, tests: lines, risks: lines,
  context_refs: z.array(z.string().min(1).max(500)).min(1).max(30),
}).strict();
export type ActionPlan = z.infer<typeof planSchema>;
export interface WorkflowIdentity { id: string; project: string; role: "developer" | "tech_lead" | "owner" }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** One service per single-process MVP store. All transitions are serialized. */
export class PlanWorkflow {
  private queue: Promise<unknown> = Promise.resolve();
  private timestamp = 0;
  private now() { this.timestamp = Math.max(Date.now(), this.timestamp + 1); return new Date(this.timestamp).toISOString(); }
  constructor(private readonly store: MaestroStore, private readonly knowledge: KnowledgePort,
    private readonly notify: (project: string, session: string) => void = () => undefined) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }
  private session(actor: WorkflowIdentity, session: string) {
    return hash(JSON.stringify([actor.project, actor.id, session]));
  }
  async submit(actor: WorkflowIdentity, input: unknown) {
    const plan = planSchema.parse(input);
    return this.serial(async () => {
      if ((await this.knowledge.health()).status !== "ok") throw new Error("Knowledge unavailable; execution blocked");
      // Read the references before registering the proposal; never use their text as authority.
      for (const ref of plan.context_refs) {
        if (!(await this.knowledge.get(ref))) throw new Error("A context reference is missing");
      }
      const session = this.session(actor, plan.session_id);
      const digest = hash(JSON.stringify([actor.id, actor.project, plan]));
      const path = `01 Projeto Maestro/19 Planos de Acao/${digest}.md`;
      const inputEvent = createEvent({ event_type: "plan.proposed", project_id: actor.project,
        session_id: session, task_id: plan.task_id, actor: { type: "human", id: actor.id, role: actor.role },
        source: "workflow-gateway", idempotency_key: `plan:${digest}`,
        payload: { ...plan, plan_id: digest, document_path: path, description: plan.objective },
      });
      inputEvent.received_at = this.now();
      if (evaluateEvent(inputEvent).decision === "deny") throw new Error("Plan rejected by content policy");
      const event = (await this.store.appendEvent(inputEvent)).event;
      const content = [
        `# Plano de ação — ${plan.task_id}`, "", "Status: proposto; não autoriza execução.",
        `Autor autenticado: ${actor.id}`, `Projeto: ${actor.project}`, `Sessão Codex: ${plan.session_id}`,
        `Evento: ${event.event_id}`, "", "## Objetivo", plan.objective,
        ...([['Etapas', plan.steps], ['Arquivos e escopo', plan.files], ['Testes', plan.tests],
          ['Riscos', plan.risks], ['Contexto consultado', plan.context_refs]] as const)
          .flatMap(([title, entries]) => ["", `## ${title}`, ...entries.map((entry) => `- ${entry}`)]),
      ].join("\n");
      let receipt: WriteReceipt;
      try {
        receipt = await this.knowledge.upsert({ id: digest, path,
          frontmatter: { tipo: "plano-de-acao", status: "proposed", autor: actor.id, projeto: actor.project,
            data_criacao: event.received_at, origem: "workflow-gateway", tags: ["plano", "workflow"] }, content });
        const saved = await this.knowledge.get(digest);
        if (!saved || saved.version !== receipt.version) throw new Error("Receipt verification failed");
      } catch {
        await this.record(actor, session, "knowledge.sync.failed", digest, { description: "Plan not confirmed in Obsidian; retry identical plan" });
        throw new Error("Plan persistence failed; execution blocked. Retry the same plan.");
      }
      await this.record(actor, session, "knowledge.sync.completed", digest, { plan_id: digest, receipt }, `receipt:${digest}`);
      const approvalId = `plan-${digest}`;
      if (!(await this.store.getApproval(approvalId))) {
        const requested = this.now();
        await this.store.saveApproval({ approval_id: approvalId, project_id: actor.project, session_id: session,
          action: `execute_plan:${digest}`, reason: "Plan persisted; human review required", required_role: "tech_lead",
          status: "pending", requested_at: requested, resolved_at: null, resolved_by: null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
        await this.record(actor, session, "approval.requested", digest, { approval_id: approvalId, plan_id: digest,
          description: "Plan awaiting human review", required_role: "tech_lead" }, `plan-review:${digest}`);
      }
      this.notify(actor.project, session);
      return { plan_id: digest, session_id: session, path, version: receipt.version,
        status: "pending_human_review", execution_allowed: false };
    });
  }

  async status(actor: WorkflowIdentity, codexSession: string) {
    id.parse(codexSession);
    const session = this.session(actor, codexSession);
    const events = await this.store.listEvents(actor.project, session);
    const plans = events.filter((e) => e.source === "workflow-gateway" && e.event_type === "plan.proposed");
    const latest = plans.sort((a, b) => a.received_at.localeCompare(b.received_at)).at(-1);
    if (!latest) return { allowed: false, reason: "Submit an action plan with maestro_workflow_submit_plan before using tools", plan_id: null };
    const planId = String(latest.payload.plan_id);
    const receipt = events.find((e) => e.event_type === "knowledge.sync.completed" && e.source === "workflow-gateway" && e.payload.plan_id === planId)?.payload.receipt as WriteReceipt | undefined;
    if (!receipt) return { allowed: false, reason: "Plan has no persistence receipt; retry submission", plan_id: planId };
    try {
      const note = await this.knowledge.get(planId);
      if (!note || note.version !== receipt.version) return { allowed: false, reason: "Plan missing or changed in Obsidian; submit a new revision", plan_id: planId };
    } catch { return { allowed: false, reason: "Obsidian unavailable; execution blocked", plan_id: planId }; }
    const decisions = events.filter((e) => e.source === "workflow-gateway" && e.event_type === "approval.resolved" && e.payload.plan_id === planId);
    const decision = decisions.sort((a, b) => a.received_at.localeCompare(b.received_at)).at(-1);
    const approved = decision?.payload.decision === "approved" && Date.parse(String(decision.payload.expires_at)) > Date.now();
    return { allowed: approved, reason: approved ? "Plan persisted and approved; remain within its scope" : "Waiting for valid human review",
      plan_id: planId, document_path: receipt.path, task_id: latest.task_id };
  }

  async review(actor: WorkflowIdentity, planId: string, decision: "approved" | "rejected") {
    if (actor.role !== "owner" && actor.role !== "tech_lead") throw new Error("Human reviewer role required");
    if (!/^[a-f0-9]{64}$/.test(planId)) throw new Error("Invalid plan id");
    return this.serial(async () => {
      const events = await this.store.listEvents(actor.project);
      const plan = events.find((e) => e.source === "workflow-gateway" && e.event_type === "plan.proposed" && e.payload.plan_id === planId);
      if (!plan) throw new Error("Plan not found in authorized project");
      if (plan.actor.id === actor.id) throw new Error("Self approval is not permitted");
      const receipt = events.find((e) => e.event_type === "knowledge.sync.completed" && e.source === "workflow-gateway" && e.payload.plan_id === planId)?.payload.receipt as WriteReceipt | undefined;
      const note = await this.knowledge.get(planId);
      if (!receipt || !note || note.version !== receipt.version) throw new Error("Persisted plan not verified");
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await this.record(actor, plan.session_id, "approval.resolved", planId, { plan_id: planId, decision, expires_at: expires });
      const approval = await this.store.getApproval(`plan-${planId}`);
      if (approval) await this.store.saveApproval({ ...approval, status: decision, expires_at: expires,
        resolved_at: this.now(), resolved_by: actor.id });
      this.notify(actor.project, plan.session_id);
      return { plan_id: planId, decision, expires_at: expires };
    });
  }

  async overview(actor: WorkflowIdentity) {
    const events = await this.store.listEvents(actor.project);
    return events.filter((e) => e.source === "workflow-gateway" &&
      (actor.role !== "developer" || e.actor.id === actor.id)).slice(-200);
  }
  async activity(actor: WorkflowIdentity, input: { session_id: string; tool: string; activity_id: string }) {
    return this.serial(async () => {
      const session = this.session(actor, input.session_id);
      const events = await this.store.listEvents(actor.project, session);
      const plan = events.filter((e) => e.source === "workflow-gateway" && e.event_type === "plan.proposed")
        .sort((a,b) => a.received_at.localeCompare(b.received_at)).at(-1);
      if (!plan) return { recorded: false, reason: "No plan; planning tools are not execution evidence" };
      const saved = await this.record(actor, session, "tool.completed", String(plan.payload.plan_id), {
        tool: input.tool, status: "declared", description: `Codex hook observed completion of ${input.tool}; output and correctness not independently verified`,
      }, `activity:${input.activity_id}`);
      let knowledgeSynced = false;
      try {
        await this.knowledge.upsert({ id: `activity-${saved.event.event_id}`,
          path: `01 Projeto Maestro/20 Workflow/${saved.event.event_id}.md`,
          frontmatter: { tipo: "atividade", status: "declared", autor: actor.id, projeto: actor.project,
            origem: "codex-hook", data_criacao: saved.event.received_at, tags: ["workflow", "atividade"] },
          content: `# Atividade observada\n\nFerramenta: ${input.tool}\nAutor: ${actor.id}\nSessão: ${session}\nEvento: ${saved.event.event_id}\nPlano: [[${String(plan.payload.document_path)}]]\n\nO hook informou término da chamada. Conteúdo, sucesso e correção não foram verificados independentemente.` });
        knowledgeSynced = true;
      } catch {
        await this.record(actor, session, "knowledge.sync.failed", String(plan.payload.plan_id),
          { description: "Activity persisted in event store; Obsidian sync pending. Retry same activity_id." });
      }
      this.notify(actor.project, session);
      return { recorded: true, knowledge_synced: knowledgeSynced, event_id: saved.event.event_id, verification: "declared" };
    });
  }
  private record(actor: WorkflowIdentity, session: string, type: MaestroEvent["event_type"], planId: string,
    payload: Record<string, unknown>, key?: string) {
    const event = createEvent({ event_type: type, project_id: actor.project, session_id: session,
      actor: { type: "human", id: actor.id, role: actor.role }, source: "workflow-gateway", correlation_id: planId,
      idempotency_key: key ?? null, payload, evidence_refs: [planId] });
    event.received_at = this.now();
    return this.store.appendEvent(event);
  }
}
