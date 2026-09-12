# Estabilização e teste — 2026-09-12

## Plano e estado

Correção rápida: reinstalar URL/credencial do MCP sem preservar valores antigos,
validar autenticação antes da instalação, incluir diagnóstico e distribuir ZIPs
reais por SSH. Não desenvolver Café Aurora: ele é apenas o cenário de simulação.
Não incluir segredos no Git ou no vault. Preservar eventos de testes anteriores.

Na auditoria inicial, o GitHub estava na base 113fcdd e a integração existia apenas
no clone local. Esta versão inclui a integração e a correção. Os pacotes pessoais permitem testar o cliente contra o
servidor já instalado sem executar o backend do clone antigo.

Próximas etapas, em ordem:
1. Atualizar os clones com esta versão; distribuir credenciais somente por canal privado.
2. Homologar instalação e hooks no Windows (integrante + responsável).
3. Migrar gateway para VM e endereço HTTPS estável (infraestrutura; domínio pendente).
4. Configurar cadastro de múltiplos projetos e backup recorrente dos eventos.
5. Integrar avaliação semântica pelo gestor, preservando aprovação determinística.

## Teste do integrante no Windows

Pré-requisitos: Node.js 20+, Git, Codex Desktop e SSH individual já autorizado.
No PowerShell, substitua guilherme por seu usuário (vitor ou ian):

```powershell
scp guilherme@64.181.177.114:maestro-guilherme-v2.zip "$env:USERPROFILE\Downloads\maestro-guilherme-v2.zip"
Expand-Archive "$env:USERPROFILE\Downloads\maestro-guilherme-v2.zip" "$env:USERPROFILE\Downloads\maestro-guilherme-v2"
```

O SSH pode pedir a senha da chave. Não compartilhe a chave privada ou o ZIP.
Abra a subpasta extraída `maestro-guilherme`, execute `Instalar.cmd` e informe a
pasta do clone hackathon_openai_sp. Esta simulação pertence ao projeto Maestro;
não cria um cadastro independente Café Aurora. O instalador exige Git nessa pasta.

Execute, na pasta extraída:

```powershell
node .\diagnosticar-maestro.mjs
```

Esperado: autenticação OK e sessão sem plano bloqueada. Isso não comprova o hook.
Encerre e reabra o Codex; revise e confie nos hooks Maestro. Abra uma nova tarefa
no clone informado. Se as ferramentas Maestro não aparecerem, não prossiga.

Prompt de simulação:

> Simule o workflow Café Aurora, sem construir o site. Consulte 00-HOME.md pelo
> MCP maestro e envie um plano para criar apenas maestro-simulacao.txt contendo
> "teste de workflow", com teste de releitura desse arquivo e risco de simulação
> confundida com desenvolvimento real. Use o session_id fornecido pelo hook,
> task_id CAFE-AURORA-SIMULACAO e context_refs ["00-HOME.md"]. Não invente sessão
> se o hook não a fornecer. Retorne plan_id, path e status e aguarde revisão humana.

Antes da aprovação, uma tentativa controlada de criar APENAS esse arquivo deve
ser negada pelo hook e o arquivo deve continuar ausente. Se houver apenas recusa
verbal do agente, ainda falta evidência do hook. Se criar, pare o teste: não está homologado.

O responsável lê o plano no Obsidian e, fora do agente executor, executa no Linux:

```sh
node public/onboarding/review-plan.mjs /home/mestre/.config/maestro-workflow/connections/mestre.json PLAN_ID approved
```

Depois o integrante pede para continuar o mesmo plano na mesma tarefa Codex.
Esperado: status permitido, arquivo criado e atividade em 20 Workflow; handoff em
18 Handoffs. Aprovação expira em 30 minutos. Nenhum deploy faz parte deste teste.
O responsável pode repetir a revisão com `rejected` para confirmar bloqueio.

## Evidências e limites

Guardar: versão do pacote, usuário, pasta, plan_id, caminho da nota, resultado do
diagnóstico, bloqueio real do hook, decisão humana, arquivo e evento de atividade.
Não guardar tokens ou configurações privadas. Reportar cada etapa como passou,
falhou ou não testada; conexão sozinha não equivale a supervisão completa.

URL temporária e computador do responsável continuam sendo dependências. ZIPs
contêm credenciais individuais; enviar pelo SSH ou canal privado, nunca GitHub.
Instalação mantém backups .backup-TIMESTAMP. Para rollback, fechar Codex e restaurar
o conjunto correspondente de config.toml, hooks.json e connection.json, preservando
as configurações de outros MCPs. Não remover hooks para contornar reprovação.
