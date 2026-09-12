import { describe, expect, it } from "vitest";
import { createEvent } from "@/src/core/events";
import { projectSession } from "@/src/core/projector";

describe("session projector", () => {
  it("only completes a session with independent verification", () => {
    const base = { project_id: "project", session_id: "session", task_id: "TASK-1" };
    const events = [
      createEvent({ ...base, event_type: "task.started", payload: { objective: "Ship safely" } }),
      createEvent({
        ...base,
        event_type: "verification.completed",
        payload: { status: "passed", description: "Tests passed" },
        evidence_refs: ["test-run-1"],
      }),
      createEvent({ ...base, event_type: "session.completed", payload: {} }),
    ];
    const state = projectSession(events, [], null);
    expect(state.status).toBe("completed");
    expect(state.verification_status).toBe("verified");
  });
});
