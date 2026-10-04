# Módulo: [Nome] — Decisões Técnicas

> Parte de `docs/modulos/[MODULO]/` — arquivo irmão de `regras-[modulo].md`,
> `cenarios-[modulo].md` e `contrato-[modulo].md`.
>
> **Última confirmação:** [AAAA-MM-DD]
> **Versão de origem:** V[X.Y]
>
> **Regra de leitura:** as skills carregam APENAS os módulos tocados pela tarefa.
> **Regra de escrita:** decisões provisórias de qualquer skill ficam em
> `DECISOES_V[X.Y].md`. Backend registra aqui apenas divergências e decisões
> técnicas da implementação efetiva; a skill-retomada faz a curadoria final.

---

## 4. Decisões Técnicas

> O que NÃO está no código mas precisa ser lembrado.

| Data | Decisão | Motivo | Alternativa descartada |
|------|---------|--------|------------------------|
| [AAAA-MM-DD] | [o que foi decidido] | [por quê] | [o que foi rejeitado e por quê] |

---

### Divergências de Premissa

> Casos onde o backlog/spec dizia X mas o código implementou Y.
> Alimentado pela skill-backend/frontend ao fechar cada tarefa.

| Pocket | Premissa registrada | Realidade do código | Impacto |
|--------|---------------------|---------------------|---------|
| V0.X | [o que estava escrito] | [o que o código tem] | [o que isso afeta] |

---

### Legado e Exceções

> Padrões antigos que coexistem e NÃO devem ser replicados em código novo.

- [ex: `interface + impl` existe em `AuthService` por legado dos Épicos 1-5 — código novo usa classe concreta `@Service`]
- [ex: `ORCAMENTO` como motivo de saída de Insumo é branch morto no enum — nenhum fluxo grava esse valor]
