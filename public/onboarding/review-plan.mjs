import fs from 'node:fs/promises';
const [file, plan_id, decision] = process.argv.slice(2);
if (!file || !/^[a-f0-9]{64}$/.test(plan_id ?? '') || !['approved','rejected'].includes(decision)) throw new Error('Usage: node review-plan.mjs private-owner-connection.json PLAN_ID approved|rejected');
const connection = JSON.parse(await fs.readFile(file, 'utf8'));
if (new URL(connection.url).protocol !== 'https:') throw new Error('HTTPS required');
const response = await fetch(new URL('/api/workflow/review', connection.url), { method:'POST',
  headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type':'application/json' },
  body: JSON.stringify({ plan_id, decision }), redirect:'error', signal:AbortSignal.timeout(30_000) });
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
