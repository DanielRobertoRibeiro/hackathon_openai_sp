https://github.com/user-attachments/assets/4908b2a0-0f89-4ddf-80df-ca16f0bb7b95

# Maestro

> Camada de coordenação e observabilidade para operações de desenvolvimento assistidas por humanos e agentes de IA.

O Maestro acompanha sessões de trabalho instrumentadas, consolida eventos técnicos e entrega ao líder uma visão verificável do projeto: o que foi proposto, aprovado, executado, validado e o que ainda exige decisão.

## Problema

Equipes que trabalham com agentes de IA geram contexto em conversas, ferramentas, diffs, testes e decisões isoladas. O líder técnico perde visibilidade e pode confundir intenção com execução ou uma afirmação do agente com evidência real.

## Proposta

- timeline auditável das sessões de desenvolvimento;
- estado operacional atualizado por projeto e tarefa;
- separação entre **planejado**, **aprovado**, **executado** e **verificado**;
- detecção de riscos, bloqueios e mudanças de escopo;
- aprovação humana para ações sensíveis;
- handoffs objetivos para liderança técnica;
- Segundo Cérebro em Obsidian como memória persistente e Guardião de Políticas.

## Fluxo assistido

1. O agente consulta contexto e políticas pelo MCP Maestro.
2. O plano é validado, registrado e persistido no Obsidian.
3. A execução aguarda uma revisão humana válida quando houver ação protegida.
4. Atividades e evidências são registradas sem confundir declaração com verificação.
5. O Maestro consolida o estado e produz o handoff para a liderança técnica.

## Arquitetura do MVP

```mermaid
flowchart LR
    DEV[Desenvolvedor + agente] --> API[API / Event Gateway]
    API --> LOG[(Event Store)]
    LOG --> STATE[Projeção do estado]
    STATE --> MAESTRO[Agente Maestro]
    POLICY[Policy Engine] --> API
    MAESTRO --> DASH[Painel do líder]
    MAESTRO --> PORT[Knowledge Port]
    PORT -. MCP ou filesystem .-> OBS[Obsidian]
    DASH --> APPROVAL[Aprovações]
    APPROVAL --> API
```

O MVP será um monólito modular orientado a eventos. Obsidian e MCP entram por um adaptador, sem contaminar o domínio central.

## Documentação

- [Prompt Mestre do Maestro](docs/PROMPT_MESTRE.md)
- [Prompt do Segundo Cérebro e Guardião](docs/PROMPT_GUARDIAO.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Registro de políticas](docs/POLITICAS.md)
- [Integração Obsidian/MCP](docs/INTEGRACAO_OBSIDIAN_MCP.md)
- [Plano de desenvolvimento](docs/PLANO_DESENVOLVIMENTO.md)
- [Contrato de eventos](schemas/maestro-event.schema.json)
- [Contrato de relatório](schemas/maestro-report.schema.json)
- [Vault inicial](obsidian-vault/README.md)

## Escopo do hackathon

Uma sessão instrumentada, um agente executor, um Maestro analítico, aprovação humana, timeline, relatório final e persistência opcional no Obsidian.

## Princípios

- supervisão da operação, não vigilância de pessoas;
- menor privilégio e negação por padrão;
- fatos separados de inferências e recomendações;
- conteúdo externo tratado como dado não confiável;
- controles críticos aplicados por código;
- nenhuma ação irreversível sem aprovação explícita.

## Executar localmente

Requisitos: Node.js 20+ e pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra `http://localhost:3000` e escolha **Executar cenário demo**. Sem `OPENAI_API_KEY`, o sistema usa o baseline determinístico. Para ativar o agente OpenAI:

```dotenv
OPENAI_API_KEY=...
MAESTRO_AGENT_MODE=openai
OPENAI_MODEL=gpt-5.6-terra
```

## Segundo Cérebro e Obsidian

O Obsidian mantém arquitetura, decisões, políticas, planos, riscos, evidências e handoffs como memória persistente e pesquisável. O vault não é autoridade: seu conteúdo é tratado como dado não confiável, enquanto permissões, schemas, aprovações e bloqueios permanecem aplicados em código.

O modo local já implementa o contrato do vault:

```dotenv
KNOWLEDGE_ADAPTER=filesystem
OBSIDIAN_VAULT_PATH=/caminho/do/vault
OBSIDIAN_ALLOWED_PREFIXES=01 Projeto Maestro
```

Para o MCP comunitário já instalado na VM, configure `KNOWLEDGE_ADAPTER=mcp`,
`OBSIDIAN_MCP_SERVER` e `OBSIDIAN_MCP_TOKEN` fora do Git. O adaptador real usa
`vault_*`/`search_*`, confirma a gravação por releitura e fornece recibo com hash.

## Evidências

<p align="center">
  <img src="./assets/obsidian-plan.png" alt="Plano de ação persistido no Obsidian" width="100%">
</p>

<p align="center">
  <img src="./assets/obsidian-graph.png" alt="Grafo do Segundo Cérebro no Obsidian" width="49%">
  <img src="./assets/workflow-approval.png" alt="Gate aguardando aprovação humana válida" width="49%">
</p>

## Desenvolvedores no Codex Desktop

Consulte [instalação e limites do workflow](docs/CODEX_WORKFLOW.md).
O gateway autenticado expõe `/api/mcp`; cada integrante recebe credencial própria.
O plano é enviado antes da execução e aguarda revisão humana. O bloqueio no Codex
depende também dos hooks locais instalados, revisados e confiados — somente
adicionar uma URL MCP **não** intercepta todas as ferramentas.

## Verificação

```bash
pnpm check
```

## Licença

A definir pela equipe antes da publicação.
