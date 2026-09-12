import { EventEmitter } from "node:events";
import { MaestroApplication } from "./maestro-application";
import { MaestroStore, resolveStoragePath } from "@/src/core/store";
import { createKnowledgeAdapter } from "@/src/knowledge/factory";
import { PlanWorkflow } from "./plan-workflow";
import type { KnowledgePort } from "@/src/knowledge/port";

interface Runtime {
  application: MaestroApplication;
  events: EventEmitter;
  workflow: PlanWorkflow;
  knowledge: KnowledgePort;
}

const globalRuntime = globalThis as typeof globalThis & { __maestroRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (globalRuntime.__maestroRuntime) return globalRuntime.__maestroRuntime;
  const events = new EventEmitter();
  events.setMaxListeners(100);
  const storageSetting = process.env.MAESTRO_STORAGE_FILE ?? ".data/maestro.json";
  const store = new MaestroStore(
    storageSetting === "memory" ? null : resolveStoragePath(storageSetting),
  );
  const knowledge = createKnowledgeAdapter();
  const application = new MaestroApplication(store, knowledge, (projectId, sessionId) => {
    events.emit("update", { project_id: projectId, session_id: sessionId });
  });
  const workflow = new PlanWorkflow(store, knowledge, (projectId, sessionId) => {
    events.emit("update", { project_id: projectId, session_id: sessionId });
    scheduleAnalysis(projectId, sessionId);
  });
  // Bounded, coalesced baseline analysis. Reports never feed back into this scheduler.
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let analyses = Promise.resolve();
  function scheduleAnalysis(projectId: string, sessionId: string) {
    const key = `${projectId}:${sessionId}`;
    if (pending.has(key) || pending.size >= 100) return;
    pending.set(key, setTimeout(() => {
      analyses = analyses.then(async () => {
        try { await application.analyze(projectId, sessionId); }
        catch { events.emit("analysis_failed", { project_id: projectId, session_id: sessionId }); }
        finally { pending.delete(key); }
      });
    }, 2000));
  }
  globalRuntime.__maestroRuntime = { application, events, workflow, knowledge };
  return globalRuntime.__maestroRuntime;
}
