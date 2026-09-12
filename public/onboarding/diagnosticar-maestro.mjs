import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { probe } from './connection-utils.mjs';
try {
  const config = JSON.parse(await fs.readFile(path.join(os.homedir(), '.codex', 'maestro-workflow', 'connection.json'), 'utf8'));
  console.log('Pasta instrumentada: ' + config.workspace);
  console.log(await probe(config));
  console.log('Proximo: reinicie o Codex e valide as ferramentas maestro e a confianca dos hooks.');
} catch {
  console.error('Diagnostico falhou. Verifique instalacao, internet e pacote pessoal atualizado. Nao compartilhe config.toml ou connection.json.');
  process.exitCode = 1;
}
