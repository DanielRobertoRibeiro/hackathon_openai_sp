# Catálogo de templates

Todos os templates usam os metadados mínimos do arquivo `nota-comum.md`. Ao instanciar, altere `tipo`, `status`, `tags` e as seções conforme o modelo abaixo.

## Decisão

```markdown
# Decisão — {{titulo}}
## Contexto
## Opções consideradas
## Decisão
## Aprovador
## Consequências e rollback
## Evidências
```

## Risco ou bloqueio

```markdown
# Risco — {{titulo}}
## Descrição
## Probabilidade e impacto
## Evidências
## Mitigação
## Responsável e prazo
```

## Evidência

```markdown
# Evidência — {{titulo}}
## Observação
## Método de obtenção
## Integridade
## Limitações
```

## Pergunta aberta

```markdown
# Pergunta — {{titulo}}
## Por que importa
## Responsável pela resposta
## Prazo de decisão
## Resposta e evidência
```

## Handoff

```markdown
# Handoff — {{titulo}}
## Resultado
## Estado atual
## Trabalho executado
## Evidências e verificações
## Decisões
## Riscos e bloqueios
## Próxima ação
```

## Política versionada

```markdown
# Política — {{id}} — {{titulo}}
## Objetivo e escopo
## Regras
## Enforcement
## Exceções
## Proprietário e aprovador
## Vigência, testes e rollback
```

## Prática de desenvolvimento

```markdown
# Prática — {{titulo}}
## Problema tratado
## Prática recomendada
## Exemplos
## Verificação
## Exceções
```

## Exceção de política

```markdown
# Exceção — {{titulo}}
## Política afetada
## Justificativa
## Escopo e validade
## Riscos e controles compensatórios
## Solicitante e aprovador
## Encerramento
```

## Incidente

```markdown
# Incidente — {{titulo}}
## Detecção e severidade
## Linha do tempo
## Impacto
## Contenção e recuperação
## Causa raiz
## Ações corretivas
## Evidências
```

## Registro de auditoria

```markdown
# Auditoria — {{titulo}}
## Ator e ação
## Recurso e ambiente
## Decisão de política
## Aprovação
## Resultado
## Evidências de integridade
```

## Checklist ou gate

```markdown
# Gate — {{titulo}}
## Escopo
- [ ] Critério verificável 1
- [ ] Critério verificável 2
## Evidências
## Resultado
## Responsável
```
