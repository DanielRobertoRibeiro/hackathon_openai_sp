// Creates PRIVATE per-person bundles outside the repository; never publish these ZIPs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [connectionFile, outputDir] = process.argv.slice(2);
if (!connectionFile || !outputDir) throw new Error('Usage: node scripts/package-onboarding.mjs private-connection.json private-output-directory');
const connection = JSON.parse(await fs.readFile(connectionFile,'utf8'));
if (!/^[a-z0-9_-]+$/.test(connection.identity)) throw new Error('Invalid identity');
await fs.mkdir(outputDir,{recursive:true,mode:0o700});
const bundle = path.join(outputDir, 'maestro-' + connection.identity);
await fs.mkdir(bundle,{mode:0o700});
for (const name of ['install-maestro.mjs','codex-workflow-hook.mjs','connection-utils.mjs','diagnosticar-maestro.mjs']) await fs.copyFile(new URL('../public/onboarding/'+name,import.meta.url),path.join(bundle,name));
await fs.copyFile(connectionFile,path.join(bundle,'connection.json'));
await fs.writeFile(path.join(bundle,'Instalar.cmd'),'@echo off\r\necho Maestro - instalacao pessoal para Codex Desktop\r\necho Informe a pasta do clone do projeto (nao a pasta deste ZIP).\r\nset /p PROJECT=Pasta do projeto: \r\nnode "%~dp0install-maestro.mjs" "%~dp0connection.json" "%PROJECT%"\r\npause\r\n');
await fs.writeFile(path.join(bundle,'LEIA-ME.txt'),`Instalacao pessoal de ${connection.identity}. NAO compartilhe este pacote: contem sua credencial.\n\nRequisitos: Git, Node.js 20+ e Codex Desktop.\nWindows: extraia fora do repositorio, abra Instalar.cmd e informe a pasta do clone hackathon_openai_sp.\nLinux/macOS: node install-maestro.mjs connection.json /caminho/do/projeto\n\nReinicie completamente o Codex. Revise e confie nos tres hooks Maestro; sem essa etapa os hooks nao rodam. Uma conversa Codex corresponde a uma tarefa. Use uma nova conversa para uma nova tarefa.\nO agente consulta as notas, envia o plano e aguarda revisao humana. MCP sozinho nao bloqueia ferramentas; o hook instalado faz o controle no fluxo instrumentado.\nNao remova/desative o hook para contornar o gate. Para desinstalar, remova somente os hooks com statusMessage 'Maestro plan gate' e o servidor mcp_servers.maestro das configuracoes, preservando os demais.\n\nURL temporaria do hackathon: ${connection.url}/api/mcp\nO computador do responsavel precisa estar ligado; se o tunel for recriado, solicite pacote atualizado.\n`);
const zip = path.join(outputDir,'maestro-'+connection.identity+'.zip');
execFileSync('zip',['-qr',zip,path.basename(bundle)],{cwd:outputDir});
await fs.chmod(zip,0o600);
console.log('Private bundle created: '+zip);
