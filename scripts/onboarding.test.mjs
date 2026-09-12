import { test } from 'vitest';
import assert from 'node:assert/strict';
import { maestroConfig } from '../public/onboarding/connection-utils.mjs';
const connection = {url:'https://example.com',token:'a'.repeat(40)};
test('reinstallation replaces stale URL and credentials without duplicate tables', () => {
  const old = '[mcp_servers.maestro]\nurl="https://old.example"\n[mcp_servers.maestro.http_headers]\nAuthorization="old"\n[mcp_servers.other]\ncommand="other"\n';
  const result = maestroConfig(old,connection);
  assert(!result.includes('old'));
  assert(result.includes('[mcp_servers.other]'));
  assert.equal(maestroConfig(result,connection),result);
});
test('unrelated configuration survives and invalid credentials fail', () => {
  assert(maestroConfig('model="example"\n',connection).startsWith('model="example"'));
  assert.throws(()=>maestroConfig('',{...connection,token:'bad'}));
  assert.throws(()=>maestroConfig('',{...connection,url:'http://example.com'}));
});
