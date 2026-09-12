import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const configPath = process.env.MAESTRO_CONNECTION_FILE ?? path.join(os.homedir(), '.codex', 'maestro-workflow', 'connection.json');
const emit = (value) => process.stdout.write(JSON.stringify(value));
const deny = (reason) => emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
let input;
try {
  let text = '';
  for await (const chunk of process.stdin) { text += chunk; if (text.length > 1_000_000) throw new Error('Hook input too large'); }
  input = JSON.parse(text);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const cwd = await fs.realpath(input.cwd);
  const workspace = await fs.realpath(config.workspace);
  if (cwd !== workspace && !cwd.startsWith(workspace + path.sep)) process.exit(0);
  if (!input.session_id) throw new Error('Codex session id missing');
  // One Codex task/conversation is one workflow. Clarifications retain its plan.
  const session = createHash('sha256').update(input.session_id).digest('hex');
  if (input.hook_event_name === 'UserPromptSubmit') {
    emit({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext:
      `Maestro workflow session_id: ${session}. Before tools that execute or modify anything, read the project knowledge using maestro_knowledge_read/search, prepare a concrete plan with objective, steps, files, tests, risks, context_refs and submit it through maestro_workflow_submit_plan with this session_id. Wait for valid human review via maestro_workflow_status. A stored plan is not an approval. Do not bypass hooks or change their configuration.` } });
    process.exit(0);
  }
  if (input.hook_event_name === 'PostToolUse') {
    const response = await fetch(new URL('/api/workflow/activity', config.url), {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session, tool: String(input.tool_name ?? 'unknown').slice(0,128),
        activity_id: createHash('sha256').update(`${input.session_id}:${input.tool_use_id ?? input.turn_id}:${input.tool_name}`).digest('hex') }),
      signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (!response.ok) emit({ systemMessage: 'Maestro: tool activity could not be recorded. Report this gap before continuing.' });
    process.exit(0);
  }
  if (input.hook_event_name !== 'PreToolUse') process.exit(0);
  const name = input.tool_name ?? '';
  const planningTools = /^mcp__maestro__maestro_(knowledge_(read|search)|workflow_(submit_plan|status|overview))$/;
  if (planningTools.test(name)) process.exit(0);
  const response = await fetch(new URL('/api/workflow/gate', config.url), {
    method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: session }), signal: AbortSignal.timeout(8000), redirect: 'error',
  });
  if (!response.ok) throw new Error('Gate unavailable or credentials rejected');
  const result = await response.json();
  if (result.allowed !== true) deny(String(result.reason ?? 'Plan and approval required'));
  // No "allow" override: retain the user's normal Codex tool approval policy.
} catch {
  if (input?.hook_event_name === 'UserPromptSubmit') {
    emit({ continue: false, stopReason: 'Maestro hook unavailable. Check installation; do not bypass the gate.' });
  } else if (input?.hook_event_name === 'PostToolUse') {
    emit({ systemMessage: 'Maestro activity logging unavailable. Execution already occurred; do not claim complete supervision.' });
  } else {
    deny('Maestro unavailable or plan unverified. Execution blocked. Check installation and network.');
  }
}
