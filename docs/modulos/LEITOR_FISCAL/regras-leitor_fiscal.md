# Módulo: [Nome] — Regras de Negócio

> Parte de `docs/modulos/[MODULO]/` — arquivo irmão de `cenarios-[modulo].md`,
> `contrato-[modulo].md` e `decisoes-[modulo].md`.
>
> **Última confirmação:** [AAAA-MM-DD] — comportamento verificado contra o código real
> **Versão de origem:** V[X.Y]
>
> **Regra de leitura:** as skills carregam APENAS os módulos tocados pela tarefa.
> **Regra de escrita:** somente a skill-retomada consolida regras definitivas
> no fechamento do pocket. Regras e casos de uso novos permanecem provisórios
> no `DECISOES_V[X.Y].md`; Backend atualiza o contrato implementado, não este arquivo.

---

## 1. Regras de Negócio

### Entidades

#### [NomeEntidade]

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| id | UUID | sim | gerado pelo sistema |
| | | | |

**Estados e transições** *(se aplicável)*

| De | Para | Quem dispara | Condição |
|----|------|--------------|----------|
| | | | |

---

### Regras

### [PREFIXO]-[NNN] — [Nome da regra]
[Texto completo da regra, autocontido — deve ser compreensível sem ler outra RN]
`[confirmado em V0.X — AAAA-MM-DD]`

---

### Regras com referência cruzada

> Regras cuja casa (home) é outro módulo, mas cujo texto define diretamente
> comportamento deste módulo. Texto completo mantido aqui por conveniência —
> a fonte de verdade continua sendo o módulo de origem indicado.

### [PREFIXO]-[NNN] — [Nome da regra]
[Texto completo, idêntico ao do módulo de origem]
*Referência cruzada: também em docs/modulos/[OUTRO]/regras.md (home da regra).*
`[confirmado em V0.X — AAAA-MM-DD]`

---

### Casos de Uso

### UC-[NNN] — [Nome]
*Ator:* [perfil]
*Pré-condição:* [o que precisa existir]
*Fluxo principal:*
1. [passo]
2. [passo]
*Fluxos alternativos:* [se houver]
*Exceções:* [o que bloqueia e como]
`[confirmado em V0.X — AAAA-MM-DD]`
