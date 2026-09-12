import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { it, expect } from "vitest";

it("real hook blocks missing approval and outages, allows only planning tools before review", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "maestro-hook-test-"));
  const configFile = path.join(temp, "connection.json");
  let allowed = false;
  const server = createServer((_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ allowed, reason: "Review required" })); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  await writeFile(configFile, JSON.stringify({ workspace: temp, url: `http://127.0.0.1:${address.port}`, token: "test-only" }));
  const run = (event: string, tool = "Bash") => new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve("public/onboarding/codex-workflow-hook.mjs")], { env: { ...process.env, MAESTRO_CONNECTION_FILE: configFile } });
    let output = ""; child.stdout.on("data", (chunk) => output += chunk);
    child.on("error", reject); child.on("close", () => resolve(output));
    child.stdin.end(JSON.stringify({ hook_event_name: event, tool_name: tool, session_id: "test-session", cwd: temp }));
  });
  try {
    expect(JSON.parse(await run("PreToolUse")).hookSpecificOutput.permissionDecision).toBe("deny");
    expect(await run("PreToolUse", "mcp__maestro__maestro_workflow_submit_plan")).toBe("");
    expect(await run("UserPromptSubmit")).toContain("session_id");
    allowed = true;
    expect(await run("PreToolUse")).toBe("");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  expect(JSON.parse(await run("PreToolUse")).hookSpecificOutput.permissionDecision).toBe("deny");
});
