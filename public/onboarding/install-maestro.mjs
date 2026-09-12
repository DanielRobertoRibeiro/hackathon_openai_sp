// Node.js 20+; run from the project clone. No SSH service or Administrator required.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { maestroConfig, probe } from './connection-utils.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node install-maestro.mjs /path/to/private-connection.json [project-folder]');
const connection = JSON.parse(await fs.readFile(source, 'utf8'));
const url = new URL(connection.url);
if (url.protocol !== 'https:' || url.username || url.password || !/^[A-Za-z0-9_-]{32,200}$/.test(connection.token)) throw new Error('Invalid HTTPS connection file');
const workspace = execFileSync('git', ['-C', process.argv[3] ?? process.cwd(), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const root = path.join(os.homedir(), '.codex');
const configFile = path.join(root, 'config.toml');
let config = '';
try { config = await fs.readFile(configFile, 'utf8'); } catch (e) { if(e.code !== 'ENOENT') throw e; }
const updatedConfig = maestroConfig(config, connection);
console.log(await probe(connection));
const dir = path.join(root, 'maestro-workflow');
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
const stamp = Date.now();
const backup = async (file) => { try { await fs.copyFile(file, file + '.backup-' + stamp); await fs.chmod(file + '.backup-' + stamp, 0o600); } catch (e) { if(e.code !== 'ENOENT') throw e; } };
const privateConfig = path.join(dir, 'connection.json');
await backup(privateConfig);
await fs.writeFile(privateConfig, JSON.stringify({ url: url.origin, token: connection.token, workspace }), { mode: 0o600 });
await fs.chmod(privateConfig, 0o600);
const hook = path.join(dir, 'codex-workflow-hook.mjs');
// Prefer the adjacent downloaded script so the installed hook can be reviewed.
const adjacent = path.join(path.dirname(fileURLToPath(import.meta.url)), 'codex-workflow-hook.mjs');
await fs.copyFile(adjacent, hook);
const hooksFile = path.join(root, 'hooks.json');
let hooks = {};
try { hooks = JSON.parse(await fs.readFile(hooksFile, 'utf8')); } catch (e) { if(e.code !== 'ENOENT') throw e; }
hooks.hooks ??= {};
for (const event of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse']) {
  const existing = hooks.hooks[event] ?? [];
  if (!Array.isArray(existing)) throw new Error('Existing hooks format unsupported; not overwriting');
  hooks.hooks[event] = existing.filter((entry) => !entry.hooks?.some((h) => h.statusMessage === 'Maestro plan gate'));
  hooks.hooks[event].push({ hooks: [{ type: 'command', command: `"${process.execPath}" "${hook}"`,
    commandWindows: `"${process.execPath}" "${hook}"`, timeout: 15, statusMessage: 'Maestro plan gate' }] });
}
await backup(hooksFile);
await fs.writeFile(hooksFile, JSON.stringify(hooks, null, 2) + '\n', { mode: 0o600 });
await backup(configFile);
await fs.writeFile(configFile, updatedConfig, { mode: 0o600 });
await fs.chmod(configFile, 0o600);
console.log('Installed for workspace: ' + workspace);
console.log('Restart Codex fully. Review and trust the three Maestro hooks; untrusted hooks do not run.');
console.log('Do NOT share the connection file or config.toml: they contain your personal credential.');
console.log('Connecting the MCP alone is not enforcement. Check the hook appears and blocks a test edit before using real tasks.');
