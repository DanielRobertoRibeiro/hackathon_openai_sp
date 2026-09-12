---
id: maestro-status-inicial
tipo: status
status: rascunho
data_criacao: 2026-09-12
data_atualizacao: 2026-09-12
origem: requisitos-do-projeto
autor: equipe-maestro
confianca: 1.0
tags: [maestro, status, configuracao]
relacionados: [prompt-maestro-v1, prompt-guardiao-v1, registro-politicas-maestro]
---

# Status inicial do Maestro

## Fatos

- O projeto é o Maestro — Plataforma de Orquestração Humano–IA.
- O objetivo é acompanhar e coordenar fluxos de uma operação de desenvolvimento.
- O ambiente informado inclui Codex e VM Oracle com Obsidian.
- O Segundo Cérebro atuará também como Guardião de Políticas, Práticas de Desenvolvimento e Cybersecurity.
- Nenhuma nota operacional externa foi processada.

## Inferências

- O Obsidian será a fonte persistente de conhecimento, mas não de autorização transacional.
- O acesso deve ser implementado por uma porta estável, permitindo MCP ou filesystem.
- Permissões, schemas, bloqueios e aprovações precisam ser aplicados por código.

## Recomendações

- começar pelo event store e pela timeline;
- implementar um Maestro analítico antes de múltiplos agentes;
- usar um adaptador em memória até a integração com a VM ser decidida;
- validar políticas e responsáveis antes de habilitar ações críticas.

## Riscos e bloqueios

- mecanismo Codex–Obsidian indefinido;
- dados permitidos e proibidos indefinidos;
- aprovador de ações críticas não designado;
- autonomia por ambiente indefinida;
- retenção, exclusão e backup indefinidos;
- integrações com GitHub, CI/CD e segurança não confirmadas.

## Perguntas abertas

1. Quem são os usuários e responsáveis?
2. Quais decisões já foram aprovadas?
3. Quais dados são permitidos e proibidos?
4. Quais normas são aplicáveis?
5. Qual é a retenção por categoria?
6. Quem aprova ações e exceções?
7. O que está fora de escopo?
8. Qual será o primeiro conteúdo capturado?
9. Quais ferramentas de segurança existem?
10. Qual autonomia é permitida por ambiente?
