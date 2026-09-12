// Explicit integration test: isolated test project; no real developer approvals.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const [devFile, reviewerFile] = process.argv.slice(2);
const dev = JSON.parse(await fs.readFile(devFile,'utf8'));
const reviewer = JSON.parse(await fs.readFile(reviewerFile,'utf8'));
assert.equal(dev.project, 'integration-test');
const client = new Client({name:'maestro-integration-test',version:'1.0.0'});
const session = randomUUID();
const request = (actor, endpoint, body) => fetch(new URL(endpoint,actor.url), {method:'POST',
  headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
try {
  const unauth = await fetch(new URL('/api/mcp',dev.url), {method:'POST'});
  assert.equal(unauth.status,401);
  assert.equal((await fetch(new URL('/api/events',dev.url))).status,404);
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp',dev.url), {
    requestInit:{headers:{Authorization:'Bearer '+dev.token}},
  }));
  const tools = await client.listTools();
  assert(tools.tools.some(t=>t.name==='maestro_workflow_submit_plan'));
  const call=async(name,args)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:60000});assert(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text)};
  const before = await call('maestro_workflow_status',{session_id:session}); assert.equal(before.allowed,false);
  const context = await call('maestro_knowledge_read',{id:'00-HOME.md'}); assert(context.excerpt.includes('Maestro'));
  const proposal = {session_id:session,task_id:'INTEGRATION-TEST',objective:'Temporary integration test of plan-before-execution',
    steps:['Validate the workflow gate only'],files:['No product files changed'],tests:['Verify denied and approved gate states'],
    risks:['Test-only evidence; not real development'],context_refs:['00-HOME.md']};
  const saved=await call('maestro_workflow_submit_plan',proposal); assert.equal(saved.execution_allowed,false);
  const duplicate=await call('maestro_workflow_submit_plan',proposal); assert.equal(saved.plan_id,duplicate.plan_id);
  assert.equal((await call('maestro_workflow_status',{session_id:session})).allowed,false);
  assert.equal((await request(dev,'/api/workflow/review',{plan_id:saved.plan_id,decision:'approved'})).status,403);
  const review=await request(reviewer,'/api/workflow/review',{plan_id:saved.plan_id,decision:'approved'});
  assert.equal(review.status,200,await review.text());
  assert.equal((await call('maestro_workflow_status',{session_id:session})).allowed,true);
  const gate=await request(dev,'/api/workflow/gate',{session_id:session}); assert.equal((await gate.json()).allowed,true);
  const activity=await request(dev,'/api/workflow/activity',{session_id:session,tool:'integration_test_only',activity_id:createHash('sha256').update(randomUUID()).digest('hex')});
  assert.equal(activity.status,200); const activityResult=await activity.json();
  assert.equal(activityResult.recorded,true); assert.equal(activityResult.knowledge_synced,true);
  assert.equal(activityResult.verification,'declared');
  const activityNote=await call('maestro_knowledge_read',{id:`01 Projeto Maestro/20 Workflow/${activityResult.event_id}.md`});
  assert(activityNote.excerpt.includes('integration_test_only'));
  const rejection=await request(reviewer,'/api/workflow/review',{plan_id:saved.plan_id,decision:'rejected'});assert.equal(rejection.status,200);
  assert.equal((await call('maestro_workflow_status',{session_id:session})).allowed,false);
  console.log(JSON.stringify({result:'PASS',tools:tools.tools.map(t=>t.name),test_note:saved.path,project:dev.project,
    checks:['HTTPS authentication','private APIs hidden','native MCP discovery','knowledge read','plan receipt','idempotency','developer cannot approve','human approval gate','activity in Obsidian','rejection gate']}));
} finally {await client.close()}
