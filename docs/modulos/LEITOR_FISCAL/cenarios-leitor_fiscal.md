# Módulo: [Nome] — Cenários BDD

> Parte de `docs/modulos/[MODULO]/` — arquivo irmão de `regras-[modulo].md`,
> `contrato-[modulo].md` e `decisoes-[modulo].md`.
>
> **Última confirmação:** [AAAA-MM-DD] — comportamento verificado contra o código real
> **Versão de origem:** V[X.Y]
>
> **Regra de leitura:** as skills carregam APENAS os módulos tocados pela tarefa.
> **Regra de escrita:** o Dev da tarefa registra cobertura e achados provisórios
> no `DECISOES_V[X.Y].md`. Somente a skill-retomada consolida aqui cenários,
> numeração definitiva e Índice de Rastreabilidade no fechamento do pocket.

---

## 2. Cenários BDD

> Número definitivo atribuído pela skill-retomada, sempre contra ESTE arquivo.
> Cenários de erro classificam o tipo: BLOQUEIO (impede) ou AVISO (permite com confirmação).

### Cenário [PREFIXO]-CEN-[NNN] — [Nome] ✅
```gherkin
Dado [contexto]
Quando [ação]
Então [resultado]
```
*RN relacionada:* [PREFIXO]-[NNN]
`[confirmado em V0.X — AAAA-MM-DD]`

### Cenário [PREFIXO]-CEN-[NNN] — [Nome] ❌ (BLOQUEIO)
```gherkin
Dado [contexto]
Quando [ação inválida]
Então o sistema bloqueia com [mensagem]
```
*RN relacionada:* [PREFIXO]-[NNN]
`[confirmado em V0.X — AAAA-MM-DD]`

---

### Cenários com referência cruzada — incluídos também em outro módulo

> Cobertura é mais importante que evitar duplicação. Texto idêntico ao publicado
> no módulo indicado na nota de origem.

### Cenário [PREFIXO]-CEN-[NNN] — [Nome] ⚡
*Também em: docs/modulos/[OUTRO]/cenarios.md — Origem: [bloco/seção do arquivo-legado]*
```gherkin
Dado [contexto]
Quando [ação]
Então [resultado]
```
*RN relacionada:* [PREFIXO]-[NNN]

---

### Índice de Rastreabilidade

| Cenário | RN | UC | Cobertura E2E |
|---------|----|----|---------------|
| [PREFIXO]-CEN-[NNN] | [PREFIXO]-[NNN] | UC-[NNN] | [arquivo.spec.ts / manual / ausente] |
