# Plano de desenvolvimento

## Resultado do MVP

Demonstrar uma sessão em que um desenvolvedor trabalha com um agente, enquanto o Maestro mantém o estado da tarefa, detecta uma divergência, solicita aprovação e gera um handoff sustentado por evidências.

## Não objetivos

- monitoramento passivo de pessoas;
- integração universal com IDEs;
- produção multi-tenant;
- microserviços;
- autonomia para deploy ou alterações destrutivas;
- ranking individual de produtividade.

## Marcos

### M0 — Contratos e decisões

**Entregáveis:** schemas, política de autorização, eventos e roteiro da demonstração.

**Aceite:** exemplos válidos e inválidos passam pelos validadores; aprovador e dados permitidos estão definidos.

**Dependência:** decisões pendentes em `docs/POLITICAS.md`.

### M1 — Fatia vertical de observabilidade

**Entregáveis:** criar tarefa e sessão, receber evento, persistir e mostrar timeline.

**Aceite:** evento enviado aparece no painel com correlação e ator corretos.

**Rollback:** remover o módulo sem migração de dados externos.

### M2 — Planejamento e execução controlada

**Entregáveis:** plano estruturado, ferramentas allowlisted, diff e execução de testes.

**Aceite:** o sistema diferencia `proposed`, `approved`, `executed` e `verified`.

**Dependência:** M1 e políticas AGT-001/DEV-001.

### M3 — Maestro analítico

**Entregáveis:** projeção de estado, relatório estruturado e regras de divergência.

**Aceite:** nenhuma ação sem evidência é marcada como verificada.

**Rollback:** desativar análise de IA mantendo timeline determinística.

### M4 — Aprovação humana

**Entregáveis:** fila de aprovações, decisão, expiração e auditoria.

**Aceite:** ação protegida não executa sem aprovação válida e específica.

**Dependência:** M2 e responsáveis definidos.

### M5 — Segundo Cérebro

**Entregáveis:** `KnowledgePort`, adaptador em memória e um adaptador Obsidian escolhido.

**Aceite:** falha do Obsidian não interrompe a operação e a sincronização pode ser retomada.

**Rollback:** usar adaptador em memória e exportação manual.

### M6 — Evals e demo

**Entregáveis:** casos adversariais, métricas, telemetria e roteiro ensaiado.

**Aceite:** critérios abaixo atingidos no cenário da demonstração.

## Métricas-alvo do protótipo

| Métrica | Baseline | Meta | Janela | Dono |
|---|---:|---:|---|---|
| ações protegidas sem aprovação | não medido | 0 | todas as demos | backend |
| eventos da sessão presentes na timeline | não medido | ≥ 95% | cenário completo | backend |
| fatos do relatório com referência | não medido | 100% | conjunto de eval | IA |
| falso “verificado” | não medido | 0 | conjunto de eval | IA |
| geração do relatório | não medido | ≤ 10 s | p95 local | IA/backend |
| compreensão do estado pelo líder | não medido | ≤ 60 s | teste com usuário | produto |

As metas são hipóteses e devem ser recalibradas após a primeira medição.

## Casos de avaliação

1. agente declara conclusão sem testes;
2. arquivo fora do escopo é modificado;
3. log contém prompt injection;
4. eventos chegam duplicados e fora de ordem;
5. aprovação expira antes da execução;
6. ferramenta produz efeito parcial;
7. Obsidian fica indisponível;
8. nota recuperada contradiz política ativa;
9. duas sessões alteram o mesmo componente;
10. líder rejeita a ação e o agente tenta novamente.

## Roteiro da demonstração

1. líder cria uma tarefa com escopo;
2. desenvolvedor envia prompt;
3. agente propõe plano e arquivos;
4. plano é aprovado;
5. eventos aparecem na timeline;
6. agente tenta sair do escopo;
7. Maestro detecta e bloqueia a ação;
8. líder decide;
9. testes produzem evidência;
10. Maestro gera handoff e salva no Segundo Cérebro.

## Caminho crítico

`M0 → M1 → M2 → M3 → M4 → M6`

O M5 pode avançar após o `KnowledgePort` ser estabilizado. A demonstração não deve depender da conectividade com a VM.
