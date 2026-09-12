# Codex Desktop → Maestro → Obsidian

Roteiro atualizado de distribuição e simulação: [Estabilização e teste](ESTABILIZACAO-E-TESTE.md).
O pacote v2 valida autenticação antes de instalar e substitui a configuração antiga
do MCP Maestro na reinstalação. Não confundir links locais com transferência de ZIP.

## Implementado nesta fatia

- `KnowledgePort` ligado ao plugin real via `ObsidianMcpAdapter` e SDK MCP.
- MCP `maestro` em `/api/mcp`: consulta de conhecimento, envio de plano, status e visão do workflow.
- Credenciais individuais mapeadas no servidor para identidade, papel e projeto.
- Plano validado, registrado em eventos append-only, gravado no Obsidian e relido antes de confirmar recibo.
- Gate fechado sem plano persistido, sem revisão humana válida, com nota alterada ou com Obsidian indisponível.
- Revisão somente com credencial de líder/owner, sem autoaprovação e com validade de 30 minutos. O MCP de desenvolvedores não expõe ferramenta de aprovação.
- Hook pré-execução; atividade pós-ferramenta registrada como **declarada**, não como verificação independente. Prompts e resultados brutos não são enviados pelo hook.
- Relatórios/handoffs automáticos com baseline determinístico, coalescidos por sessão. O modo OpenAI continua opcional e requer chave do responsável; não foi ativado nem validado nesta entrega.

## Instalação de cada integrante

Requisitos: Git, Node.js 20+ e Codex Desktop com suporte aos hooks documentados.
Receba seu ZIP pessoal por um canal privado. Ele contém uma credencial; não
publique, não coloque no Git e não compartilhe o pacote de outra pessoa.

Windows: extraia fora do repositório, abra `Instalar.cmd` e informe a pasta do clone
`hackathon_openai_sp`. Linux/macOS:

```sh
node install-maestro.mjs connection.json /caminho/do/clone
```

O instalador preserva configurações anteriores com backup, adiciona o MCP `maestro`
e hooks de UserPromptSubmit, PreToolUse e PostToolUse limitados à pasta do projeto.
Reinicie o aplicativo por Sair/Quit. Revise e confie nos hooks; hooks não confiados
são ignorados pelo Codex. Consulte `/hooks` no CLI quando a interface não oferecer
a revisão. Não use bypass de confiança para tentar finalizar a instalação.

Use **uma nova conversa/tarefa Codex para cada tarefa de desenvolvimento**.
Na primeira mensagem, descreva objetivo, escopo, critérios de aceite e restrições.
O hook entrega o session_id ao agente. Ele deve consultar a base, enviar o plano
com `maestro_workflow_submit_plan` e aguardar `maestro_workflow_status`.
Mensagens de esclarecimento na mesma conversa mantêm a sessão; uma mudança de
escopo exige novo plano e nova revisão. O hook não consegue inferir essa mudança
somente pela linguagem natural.

## Aprovação humana

O responsável usa sua credencial privada, depois de ler o plano:

```sh
node public/onboarding/review-plan.mjs /caminho/privado/conexao-owner.json PLAN_ID approved
# Ou: rejected
```

Não forneça a credencial de revisão ao agente executor. O caminho público só
permite MCP, gate, atividade e revisão autenticados; as APIs antigas de demo,
eventos arbitrários e aprovação por papel declarado no body **não** são expostas.
O dashboard permanece privado em loopback. Não exponha o servidor Next inteiro
diretamente à internet: endpoints legados ainda não são uma API multiusuário segura.

## Hospedagem de demonstração

Nesta instalação, a aplicação, o gateway e o túnel HTTPS são serviços de usuário
no computador Linux do responsável; o Obsidian continua na VM Oracle.
A URL TryCloudflare é temporária, sem SLA, muda ao recriar o túnel e requer
este computador ligado, logado e com internet. O tráfego passa pela Cloudflare.
Para URL permanente, configure domínio/túnel nomeado e refaça os pacotes.

Configuração privada: `~/.config/maestro-workflow/`.
Eventos duráveis: `~/.local/state/maestro-workflow/maestro.json`.
Serviços: `maestro-workflow-app`, `maestro-workflow-gateway`, `maestro-workflow-https`.
O vault mantém backups na VM; o event store local precisa de backup próprio.

## Limites de garantia

O gate é determinístico dentro do fluxo instrumentado; não é sandbox nem DLP.
Usuários administradores podem remover hooks, mudar arquivos locais ou agir fora
do Codex. Algumas ferramentas especializadas/hosted não passam por esses hooks.
Hook ausente, desativado, não confiado ou que falhe antes de devolver uma decisão
pode ser ignorado pelo host. **MCP sozinho não garante supervisão universal.**
Para imposição organizacional, é necessária configuração gerenciada de hooks,
runtime executor restrito e controle de credenciais fora dos agentes.

O plano aprovado limita a intenção, mas não é prova de que um comando shell
arbitrário respeita todos os caminhos. Revisão de comandos e permissões normais
do Codex continuam necessárias. Novos planos, recibos alterados e indisponibilidade
do Obsidian são bloqueados. Aprovação não é sinônimo de execução nem verificação.

Plano recusado por falha de persistência pode ser reenviado idêntico: a operação
é idempotente. Atividade cujo espelhamento falhar permanece no event store e
aceita retry com o mesmo activity_id; não há worker durável de retries automático.
Criação de notas não possui primitive create-if-absent no plugin; caminhos de
planos são hashes de conteúdo e não devem ser usados por escritores concorrentes
fora do gateway. Atualizações existentes usam versão do plugin e releitura.

## Validação e rollback

Executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
`scripts/verify-live-workflow.mjs` exige duas credenciais de projeto `integration-test`
e testa HTTPS, rejeição sem autenticação, MCP, plano, recibo, idempotência e revisão.
Não usar identidades reais para testes de aprovação.

Para desativar publicação: `systemctl --user disable --now maestro-workflow-https`.
Para remover o cliente: retirar somente `[mcp_servers.maestro]` e os handlers
com statusMessage `Maestro plan gate`, preservando os demais hooks e MCPs.
Revogar pessoa removendo seu hash do registro privado; a próxima requisição falha.
Código e documentação podem ser distribuídos pelo Git; pacotes pessoais e credenciais não.

Referências: [Codex hooks](https://learn.chatgpt.com/docs/hooks),
[MCP no Codex](https://learn.chatgpt.com/docs/extend/mcp),
[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
