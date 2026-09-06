# Backlog — inteligencia/openproject-api — V1.2

**Branch:** N/A — repositório local, sem remote no GitHub (`git branch -a` só mostra `main`) — decisão do usuário em 06/09/2026 de não criar branch, trabalho segue direto na `main`.
**Tarefa âncora (OpenProject):** [#402](http://localhost:8090/work_packages/402) — [Investigação] - Pocket V1.2 - inteligencia/openproject-api (ativar parent_id) — projeto Pense & Precifique (id `6`, usado como âncora de rastreabilidade; a ferramenta não tem projeto próprio no OpenProject — decisão da correção V1.1).
**Versão atual:** V1.1 → **destino:** V1.2 (não corresponde a versão/milestone dentro do projeto 6 — é a versão da própria ferramenta `inteligencia/openproject-api`, não do produto Pense & Precifique; nenhum `version_id` do OpenProject foi atribuído às tarefas abaixo por esse motivo, ver `DECISOES_V1.2.md`).
**Tipo do pocket:** Feature (misto de 6 features pequenas e independentes)
**Objetivo:** ativar hierarquia nativa de tarefas (parent/child), fechar o gap de criação/exclusão (`create_project`, `delete_version`, `delete_work_package`), paginar `list_work_packages` de verdade e permitir mover tarefa de projeto — para então criar o projeto `inteligencia` no OpenProject e migrar as tarefas deste pocket pra lá.
**Data da abertura:** 06/09/2026

> **Regra de uso:** este documento é o PRONTUÁRIO — estado atual das tarefas.
> Decisões, achados e RNs/cenários novos vão no `DECISOES_V1.2.md`.
> Texto completo de regra NUNCA vive aqui — só a referência.

---

## Último Handoff
> Atualizado OBRIGATORIAMENTE ao encerrar qualquer sessão de execução.

**Data:** 06/09/2026
**Sessão:** Backend — implementação + validação manual concluídas
**O que foi feito:** as 6 tarefas implementadas (`src/client.py`, `src/tools/work_packages.py`, `src/tools/versions.py`, `src/tools/projects.py` novo, `src/server.py` registrando o módulo novo) seguindo `ANALYSIS_V1.2.md` + `DECISOES_V1.2.md`. Suite de testes existente (13 testes) passou sem alteração. Corrigido import circular (`versions.py`→`work_packages.py`) descoberto durante os testes, com import tardio. Validação manual completa contra a instância real (script isolado, chamando `server.mcp.call_tool` diretamente — a conexão MCP já aberta nesta sessão roda código antigo, não seria atualizada sem reiniciar): as 6 features + os 2 BLOQUEIOs (RN-NOVA-1, RN-NOVA-2) + a limpeza automática de versão (RN-NOVA-3) + a paginação completa (86/86) se comportaram exatamente como especificado. Status das 6 tarefas atualizado no OpenProject para "Pronto para commitar".
**Próximo passo:** usuário decidir sobre commit (nenhum commit foi feito ainda — regra de só commitar quando pedido) e sobre apagar manualmente o projeto de teste `#8` ("[TESTE V1.2 - APAGAR] Validação", sem `delete_project` disponível). Depois disso, seguir o plano de migração já registrado em `#402` (criar projeto `inteligencia` de verdade com `create_project`, mover `#402`-`#408` com `update_work_package`).
**Estado do git:** branch `main`, working tree com as mudanças desta sessão + as pendências herdadas de `docs/V1.0`/`V1.1` (não commitadas, ver entrada anterior).
**Estado do git:** branch `main` (sem branch dedicada), mudanças não commitadas herdadas de sessões anteriores (reorganização `docs/V1.0/` + `docs/V1.1/`) — ver `DECISOES_V1.2.md`, não resolvido neste pocket.

---

## Resumo de Estado

| # OP | Tarefa | Gravidade | Análise | Spec | Design | Back | Front | Teste |
|------|--------|-----------|---------|------|--------|------|-------|-------|
| [#403](http://localhost:8090/work_packages/403) | Ativar parent_id (create/update) | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |
| [#404](http://localhost:8090/work_packages/404) | Nova tool create_project | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |
| [#405](http://localhost:8090/work_packages/405) | Nova tool delete_version | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |
| [#406](http://localhost:8090/work_packages/406) | Nova tool delete_work_package | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |
| [#407](http://localhost:8090/work_packages/407) | Paginação automática em list_work_packages | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |
| [#408](http://localhost:8090/work_packages/408) | Mover tarefa de projeto (update_work_package) | N/A (Feature) | ✅ | ✅ | — | ✅ | — | ✅ |

Legenda: ⬜ não iniciado · 🟡 em andamento · ✅ concluído · — não se aplica (ferramenta Python sem Frontend/Design próprios)

> **Regra:** ao marcar `[x]` numa tarefa abaixo, sincronizar esta tabela NO MESMO MOMENTO.

---

## Tarefas

### #403 — [OpenProject API] - Ativar parent_id em create_work_package/update_work_package

**Gravidade:** N/A *(Feature — gravidade só é obrigatória para Bug/Débito Técnico, `gravidade.md`)*
*Contexto relatado:* `src/client.py` já monta `_links.parent` dentro de `update_work_package` (código herdado do fork original, nunca conectado à tool Pydantic). `create_work_package` não trata `parent` em lugar nenhum.

- [x] **Análise:** causa raiz confirmada — `client.py:373-383` já trata, falta só conectar na tool (`ANALYSIS_V1.2.md`)
- [x] **Spec:** N/A — decisão de não-implementar validação própria de ciclo, ver nota em `DECISOES_V1.2.md`
- [ ] **Design:** N/A — ferramenta sem interface
- [x] **Backend:** `UpdateWorkPackageInput`/`CreateWorkPackageInput` (`src/tools/work_packages.py`) + `src/client.py` — commit `—` (pendente, aguardando ok do usuário pra commitar)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado manualmente — criou #409 como filho de #402 (create), reatribuiu #410 pra #409 e removeu (`parent_id: null`) via update — ambos confirmados via `get_work_package`

---

### #404 — [OpenProject API] - Nova tool create_project

**Gravidade:** N/A *(Feature)*
*Contexto relatado:* não existe hoje — `src/tools/projects.py` foi descartado deliberadamente na vendorização seletiva do fork original (`ARCHITECTURE.md` §3).

- [x] **Análise:** causa raiz confirmada (descartado na vendorização); payload exato de `POST /projects` fica como pergunta aberta pra Spec/Backend (`ANALYSIS_V1.2.md`)
- [x] **Spec:** N/A — decisão de contrato técnico (`identifier` opcional, padrão de `create_version`), sem RN — ver `DECISOES_V1.2.md`
- [ ] **Design:** N/A
- [x] **Backend:** `client.create_project` + tool nova, padrão de `create_version` — commit `—` (pendente)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado — criado projeto `#8` ("[TESTE V1.2 - APAGAR] Validação"), identifier auto-gerado pela API a partir do name. **Projeto de teste não apagado (sem `delete_project`) — apagar manualmente pela UI.**

---

### #405 — [OpenProject API] - Nova tool delete_version

**Gravidade:** N/A *(Feature)*
*Contexto relatado:* não existe hoje — obrigou exclusão manual pela UI das versões de teste `#24`/`#25` na correção V1.1.

- [x] **Análise:** causa raiz confirmada (gap total de `delete_*`); side-effects em versão com tarefas associadas fica como pergunta aberta pra Backend (`ANALYSIS_V1.2.md`)
- [x] **Spec:** RN-NOVA-1 / CEN-NOVO-1 — BLOQUEIO se houver tarefas vinculadas — ver `DECISOES_V1.2.md`
- [ ] **Design:** N/A
- [x] **Backend:** `client.delete_version` + tool nova, com BLOQUEIO (RN-NOVA-1) — commit `—` (pendente)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado — versão `#27` com 1 tarefa vinculada: BLOQUEIO confirmado; após excluir a tarefa, exclusão da versão funcionou normalmente

---

### #406 — [OpenProject API] - Nova tool delete_work_package

**Gravidade:** N/A *(Feature)*
*Contexto relatado:* mesmo gap do `#405` — obrigou exclusão manual da tarefa de teste `#397` na correção V1.1.

- [x] **Análise:** causa raiz confirmada (gap total de `delete_*`); trava ao excluir tarefa com filhos fica como pergunta aberta — recomendado validar depois de #403 (`ANALYSIS_V1.2.md`, seção Cruzamento)
- [x] **Spec:** RN-NOVA-2 / CEN-NOVO-2 — BLOQUEIO se houver filhos, sem cascata — ver `DECISOES_V1.2.md`
- [ ] **Design:** N/A
- [x] **Backend:** `client.delete_work_package` + tool nova, com BLOQUEIO (RN-NOVA-2) — commit `—` (pendente)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado — tarefa `#409` com filho `#410`: BLOQUEIO confirmado; após excluir o filho, exclusão do pai funcionou normalmente

---

### #407 — [OpenProject API] - Paginação automática em list_work_packages

**Gravidade:** N/A *(Feature)*
*Contexto relatado:* `client.py::list_work_packages` (linhas 422-454) faz uma única chamada com `pageSize` fixo (default 100) e nunca lê `offset`/`total` da resposta pra buscar páginas seguintes — hoje só avisa no texto que há mais.

- [x] **Análise:** causa raiz confirmada — falta loop de paginação; cap real de `pageSize` desta instância fica como pergunta aberta (`ANALYSIS_V1.2.md`)
- [x] **Spec:** N/A — Estrutural (completude de busca, sem BLOQUEIO/AVISO) — ver `DECISOES_V1.2.md`
- [ ] **Design:** N/A
- [x] **Backend:** loop com `offset`/`pageSize` em `client.py::list_work_packages` (trava de segurança: máx. 50 páginas) — commit `—` (pendente)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado — `page_size=5` forçado no projeto 6 (86 tarefas reais): total reportado pela API (86) bateu exatamente com os elementos coletados pelo loop (86)

---

### #408 — [OpenProject API] - Mover tarefa de projeto em update_work_package

**Gravidade:** N/A *(Feature)*
*Contexto relatado:* `update_work_package` não trata `project_id` (só `type_id`/`status_id`/`priority_id`/`assignee_id`/`version_id`/`parent_id`); `create_work_package` já tem o padrão `_links.project` pronto, só não foi portado. Necessário pro plano de migração da tarefa `#402`.

- [x] **Análise:** causa raiz confirmada, simétrica ao #403 — padrão a replicar já existe em `create_work_package:187-190` (`ANALYSIS_V1.2.md`)
- [x] **Spec:** RN-NOVA-3 / CEN-NOVO-3 — limpa `version_id` automaticamente ao mover — ver `DECISOES_V1.2.md`
- [ ] **Design:** N/A
- [x] **Backend:** `project_id` em `UpdateWorkPackageInput` + tratamento em `client.py::update_work_package`, com limpeza automática de `version_id` (RN-NOVA-3) — commit `—` (pendente)
- [ ] **Frontend:** N/A
- [x] **Teste:** validado — tarefa `#412` (projeto 6, `version_id=28`) movida pro projeto `#8`: `_links.project` atualizado e `_links.version` limpo automaticamente, confirmado via `get_work_package`

---

## Fora do Escopo

- **`list_projects`/busca por projeto:** já é achado separado, aberto na correção V1.1 (`ACHADO_V1.1_LIST_PROJECTS.md`) — não duplicado neste pocket.
- **`delete_project`:** não foi pedido pelo usuário.
- **Ferramenta de relação genérica entre tarefas** (dependências, "relates to", "blocks"): fora de escopo — só parent/child (hierarquia nativa).
- **Commitar as mudanças pendentes de `docs/V1.0`/`docs/V1.1`:** achado paralelo, não resolvido neste pocket (ver `DECISOES_V1.2.md`).

## Plano de migração para o projeto `inteligencia`

1. Implementar e validar `#404` (create_project) e `#408` (mover tarefa de projeto) primeiro — são pré-requisito direto da migração.
2. Usar a tool `create_project` recém-criada para criar o projeto `inteligencia` no OpenProject (dogfooding — serve de validação real da tool).
3. Usar a tool de mover projeto (`#408`) para migrar `#402`-`#408` (esta tarefa e todas as sub-tarefas deste pocket) do projeto `6` (Pense & Precifique) para `inteligencia`.
4. Atualizar `CLAUDE.md` (raiz) com o `project_id` do novo projeto `inteligencia`, junto da tabela já existente do `project_id: 6`.
5. Pockets futuros de `inteligencia/openproject-api` (e de outras ferramentas em `inteligencia/`) passam a usar o projeto `inteligencia` como âncora, não mais o `6`.

---

## CSV para OpenProject

> N/A — fluxo substituído pelos Fluxos A/B via MCP do OpenProject nesta skill (`recepcao-analise`); as 6 tarefas acima já foram criadas via `create_work_package` (Fluxo B), não por CSV/Script OP.
