import { EventEmitter } from "node:events";
import { MaestroApplication } from "./maestro-application";
import { MaestroStore, resolveStoragePath } from "@/src/core/store";
import { createKnowledgeAdapter } from "@/src/knowledge/factory";

interface Runtime {
  application: MaestroApplication;
  events: EventEmitter;
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
  globalRuntime.__maestroRuntime = { application, events };
  return globalRuntime.__maestroRuntime;
}
