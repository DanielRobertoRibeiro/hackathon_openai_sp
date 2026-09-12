---
id: registro-politicas-maestro
tipo: indice-politicas
status: rascunho
data_criacao: 2026-09-12
data_atualizacao: 2026-09-12
origem: requisitos-do-projeto
autor: equipe-maestro
confianca: 1.0
tags: [governanca, seguranca, politicas]
relacionados: []
---

# Registro de políticas — Maestro

> **Status geral:** rascunho para validação humana. Até a designação dos responsáveis e aprovadores, ações críticas permanecem bloqueadas por padrão.

## Fatos de configuração

- Projeto: Maestro — Plataforma de Orquestração Humano–IA.
- Ambiente conhecido: Codex e VM Oracle com Obsidian.
- Princípios: menor privilégio, defesa em profundidade, zero trust, negação por padrão, rastreabilidade, privacy by design, conteúdo externo como dado não confiável e falha segura.

## Políticas iniciais

| ID | Política | Enforcement | Status |
|---|---|---:|---|
| [SEC-001](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Gestão de segredos | `block` | rascunho |
| [SEC-002](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Privacidade, minimização e retenção | `block` | rascunho |
| [SEC-003](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Identidade, acesso e menor privilégio | `block` | rascunho |
| [AGT-001](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Ações, autonomia e aprovações | `block` | rascunho |
| [AGT-002](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Prompt injection e conteúdo não confiável | `block` | rascunho |
| [DEV-001](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Revisão, testes e entrega segura | `block` | rascunho |
| [AUD-001](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Auditoria e evidências | `block` | rascunho |
| [INC-001](../obsidian-vault/99%20Sistema/Schemas/policies.initial.json) | Resposta a incidentes | `block` | rascunho |

## Decisões pendentes

1. Nomear o responsável pelas políticas e o aprovador de exceções.
2. Definir quais dados podem ser coletados e quais são proibidos.
3. Definir retenção, exclusão e backup por categoria.
4. Confirmar normas aplicáveis, incluindo LGPD.
5. Informar ferramentas de SAST, DAST, dependências, secret scanning e cofre de segredos.
6. Definir autonomia para desenvolvimento, homologação e produção.

## Gate para ativação

Uma política só pode mudar de `rascunho` para `ativa` quando possuir:

- proprietário;
- aprovador;
- versão e data de vigência;
- escopo;
- regra testável;
- procedimento de exceção;
- evidência de teste;
- estratégia de rollback.
