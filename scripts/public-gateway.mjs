// Only this allowlisted gateway is exposed. The legacy demo APIs stay private.
import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const allowed = new Set(['/api/mcp', '/api/workflow/gate', '/api/workflow/review', '/api/workflow/activity']);
const staticFiles = new Map(['install-maestro.mjs', 'codex-workflow-hook.mjs', 'review-plan.mjs'].map((name) => ['/onboarding/' + name, new URL('../public/onboarding/' + name, import.meta.url)]));
const windows = new Map();
let running = 0;
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Maestro MCP — endpoint /api/mcp. Personal credential required. Install the Codex workflow hooks as well; MCP alone does not enforce plan submission. Temporary hackathon endpoint.');
  }
  if (req.method === 'GET' && staticFiles.has(pathname)) {
    res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','X-Content-Type-Options':'nosniff'});
    return res.end(await fs.readFile(staticFiles.get(pathname)));
  }
  if (!allowed.has(pathname) || req.method !== 'POST') { res.writeHead(404); return res.end(); }
  if (req.headers.origin) { res.writeHead(403); return res.end(); }
  const auth = req.headers.authorization ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{32,200}$/.test(auth)) { res.writeHead(401); return res.end(); }
  const now = Date.now();
  for (const [key, entry] of windows) if (entry.until < now) windows.delete(key);
  const key = createHash('sha256').update(auth).digest('hex');
  const rate = windows.get(key) ?? { count: 0, until: now + 60_000 };
  if (++rate.count > 180 || windows.size >= 1000 || running >= 16) { res.writeHead(429); return res.end(); }
  windows.set(key, rate);
  running++;
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 128_000) { res.writeHead(413); res.end(); return; }
      chunks.push(chunk);
    }
    const headers = { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (req.headers['mcp-protocol-version']) headers['MCP-Protocol-Version'] = req.headers['mcp-protocol-version'];
    const upstream = await fetch('http://127.0.0.1:3100' + pathname, { method:'POST', headers,
      body: Buffer.concat(chunks), signal: AbortSignal.timeout(45_000), redirect: 'error' });
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control':'no-store' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch { if (!res.headersSent) res.writeHead(503); res.end(); }
  finally { running--; }
}).listen(3200, '127.0.0.1');
