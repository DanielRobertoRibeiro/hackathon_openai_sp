// No credentials are logged. Only the Maestro TOML tables are replaced.
export function maestroConfig(config, connection) {
  const url = new URL(connection.url);
  if (url.protocol !== 'https:' || url.username || url.password || !/^[A-Za-z0-9_-]{32,200}$/.test(connection.token)) throw new Error('Invalid HTTPS connection file');
  const lines = config.split('\n');
  let skip = false;
  const kept = [];
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      skip = /^\s*\[mcp_servers\.(?:maestro|"maestro"|'maestro')(?:\.|\])/.test(line);
      if (!skip && /maestro/.test(line) && /mcp_servers/.test(line)) throw new Error('Unsupported Maestro table format; review config.toml manually');
    }
    if (!skip) kept.push(line);
  }
  return kept.join('\n').trimEnd() + `\n\n[mcp_servers.maestro]\nurl = ${JSON.stringify(url.origin + '/api/mcp')}\nhttp_headers = { Authorization = ${JSON.stringify('Bearer ' + connection.token)} }\nstartup_timeout_sec = 30\ntool_timeout_sec = 60\n`;
}

export async function probe(connection) {
  const response = await fetch(new URL('/api/workflow/gate', connection.url), {
    method: 'POST', headers: { Authorization: 'Bearer ' + connection.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: 'onboarding-readonly-check' }),
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  if (response.status === 401) throw new Error('Credencial recusada. Solicite seu pacote pessoal atualizado.');
  if (!response.ok) throw new Error(`Servidor indisponivel (HTTP ${response.status}). Contate o responsavel.`);
  const result = await response.json();
  if (result.allowed !== false || result.plan_id !== null) throw new Error('Diagnostico inesperado: a sessao de teste deve estar sem plano e bloqueada.');
  return 'Autenticacao OK; gate bloqueia sessao sem plano. Isso nao comprova hooks ativos no Codex.';
}
