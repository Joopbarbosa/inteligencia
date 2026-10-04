# Módulo: [Nome] — Contrato de API

> Parte de `docs/modulos/[MODULO]/` — arquivo irmão de `regras-[modulo].md`,
> `cenarios-[modulo].md` e `decisoes-[modulo].md`.
>
> **Última confirmação:** [AAAA-MM-DD] — comportamento verificado contra o código real
> **Versão de origem:** V[X.Y]
>
> **Regra de leitura:** as skills carregam APENAS os módulos tocados pela tarefa.
> **Regra de escrita:** skill-backend atualiza este arquivo a cada tarefa fechada.
> A skill-retomada faz a curadoria completa no fechamento do pocket.

---

## 3. Contrato de API

> Comportamento REAL dos endpoints, confirmado contra o código.
> Schema completo: Swagger em dev (`/swagger-ui.html`). Aqui vive o que o schema não conta.

### [VERBO] /[endpoint]

**Autenticação:** Bearer JWT obrigatório
**Query params / Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| | | | |

**Response 200:**
```json
{
  "campo": "valor"
}
```

**Erros de negócio:**

| Código | `tipo` | Quando |
|--------|--------|--------|
| 400 | BLOQUEIO | [condição] |
| 400 | AVISO | [condição — permite prosseguir com confirmação] |
| 404 | — | [condição] |

**Decisões de formato não óbvias:**
- [ex: `numeroFormatado` retorna sem prefixo e sem zero-padding em PDFs por RN-053 — ver `decisoes.md`]

**Diferenças em relação a endpoints similares de outros módulos:**
- [ex: diferente de Produção, este fluxo NÃO possui modal de confirmação]

`[confirmado em V0.X — AAAA-MM-DD]`
