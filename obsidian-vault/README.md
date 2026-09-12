# Maestro Segundo Cérebro

Vault inicial do conhecimento persistente do Maestro. Pode ser copiado para o Obsidian ou sincronizado futuramente por um adaptador MCP/filesystem.

## Estrutura-alvo

```text
Maestro Segundo Cérebro/
├── 00 Inbox/
├── 01 Projeto Maestro/
│   ├── 01 Visao e objetivo/
│   ├── 02 Problema e oportunidade/
│   ├── 03 Usuarios e necessidades/
│   ├── 04 Hipoteses e perguntas/
│   ├── 05 Escopo do MVP/
│   ├── 06 Fora de escopo/
│   ├── 07 Fluxos ponta a ponta/
│   ├── 08 Arquitetura/
│   ├── 09 Eventos e contratos/
│   ├── 10 Agentes e permissoes/
│   ├── 11 Seguranca e privacidade/
│   ├── 12 Avaliacao e metricas/
│   ├── 13 Demonstracao/
│   ├── 14 Plano incremental/
│   ├── 15 Decisoes/
│   ├── 16 Riscos e bloqueios/
│   ├── 17 Evidencias/
│   └── 18 Handoffs/
├── 02 Areas de conhecimento/
├── 03 Recursos e referencias/
├── 04 Arquivo/
├── 20 Cybersecurity & Compliance/
│   ├── 20.1 Modelo de ameacas/
│   ├── 20.2 Controles e guardrails/
│   ├── 20.3 Gestao de segredos/
│   ├── 20.4 Resposta a incidentes/
│   ├── 20.5 Auditoria e evidencias/
│   └── 20.6 Privacidade e LGPD-GDPR/
├── 21 Politicas e Praticas de Desenvolvimento/
├── 22 Guardrails para Agentes/
├── 23 Checklists e Gates/
├── 24 Incidentes e Resposta/
├── 25 Auditoria e Evidencias/
└── 99 Sistema/
    ├── Templates/
    ├── Schemas/
    ├── Indices/
    └── Configuracao/
```

Os diretórios são criados à medida que recebem conteúdo. O Git não preserva diretórios vazios.

## Templates iniciais

- nota comum;
- decisão;
- risco e bloqueio;
- evidência;
- pergunta aberta;
- handoff;
- política versionada;
- prática de desenvolvimento;
- exceção de política;
- incidente;
- registro de auditoria;
- checklist ou gate.

Consulte [`99 Sistema/Templates`](99%20Sistema/Templates/).

## Regras

- não armazenar segredos;
- toda nota tem ID, tipo, origem e timestamps;
- fatos referenciam fontes;
- inferências são explicitamente rotuladas;
- políticas em rascunho não concedem autorização;
- histórico de auditoria é append-only;
- o vault não substitui o banco transacional nem o Policy Engine.
