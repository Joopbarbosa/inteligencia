# Backlog — inteligencia/openproject-api — V0.1

**Branch:** `main` (repositório nasce com o fork — ver P1)
**Tarefa âncora (OpenProject):** N/A — ferramenta de integração com o próprio OpenProject, ainda sem tarefa registrada lá (chicken-and-egg: é o que estamos construindo)
**Versão atual:** N/A → **destino:** V0.1 (as 4 prioridades funcionando + consolidação do Script OP)
**Tipo do pocket:** Infraestrutura
**Objetivo:** Fork do `openproject-mcp-server` validado e estendido para criar tarefa com custom fields, mudar status, editar tarefa e criar versão — consolidando o Script OP como uma tool a mais.
**Data da abertura:** 04/09/2026

> **Regra de uso:** este documento é o PRONTUÁRIO — estado atual das tarefas.
> Cada tarefa corresponde 1:1 a um item da Seção 3 (`Gaps a fechar, por prioridade`) do
> `PLANO_ACAO_OPENPROJECT_API.md` — consultar lá o detalhe técnico completo antes de iniciar.
> Texto completo da decisão de arquitetura NÃO vive aqui — só a referência (Seção 1 do plano).

---

## Último Handoff

**Data:** 05/09/2026
**Sessão:** P6 (listar/filtrar tarefas) implementado e validado de ponta a ponta, motivado por dúvida de João sobre se o MCP identifica tarefas de uma versão específica (não identificava até agora).
**O que foi feito nesta sessão:**
- **P6**: `client.list_work_packages` + `build_work_package_filters` (função pura, testada) + tool `list_work_packages`. 6 testes unitários novos (13/13 no total). Validado real: WP #397 associada à Versão #24, filtro por versão e por status confirmados no client e na tool MCP. Achado real corrigido: coleção de `/work_packages` não traz `_embedded`, só `_links.{campo}.title` — formatação da tool ajustada.
- Nenhum dado de teste novo criado — reaproveitou WP #397 e Versão #24 já existentes (`docs/DADOS_DE_TESTE.md` atualizado só com a mudança de estado).
**Próximo passo:** MCP já registrado no Claude Code (stdio) — a tool nova só aparece numa sessão que reconecte o servidor (reiniciar Claude Code ou `claude mcp` reconectar). P5 (consolidar Script OP) segue para outra sessão.

**Handoff anterior (05/09/2026 — P1 a P4):**
**Sessão:** P1 a P4 implementados e validados de ponta a ponta contra a instância real do OpenProject — **V0.1 completa** (P5 fica para outra sessão, é a consolidação do Script OP).
**O que foi feito:**
- **P1**: `src/custom_fields.py` + `config/custom_fields_map.yaml` portados do Script OP; campo `sistema` em `CreateWorkPackageInput`/`UpdateWorkPackageInput`; testes unitários 7/7 verdes; validado real (WP #397, `customField1`="BackEnd").
- **P2**: mudança de status validada real (WP #397, `BackLog`→`Prioridade`), `lockVersion` confirmado correto em sucesso e em conflito (409).
- **P3**: edição de `subject`+`priority_id` validada real numa única chamada; custom field do P1 preservado; achado `percentage_done` read-only nesta instância (não é bug).
- **P4**: bug `due_date`/`end_date` corrigido no P-000, validado real nas duas camadas (client e tool MCP — versões #24 e #25).
- Dois obstáculos de ambiente resolvidos no caminho (não eram bugs do código): token do Script OP expirado, e projeto `Pense & Precifique` com todos os tipos de WP desabilitados.
- Achado técnico transversal: `POST /work_packages/form` é leniente sobre `type` permitido por projeto — só o `POST` final valida de verdade contra `allowedValues`.
- 4 work packages/versões de teste criados na instância real, todos registrados em `docs/DADOS_DE_TESTE.md` para exclusão.
**Próximo passo:** (1) João apagar os dados de teste listados em `docs/DADOS_DE_TESTE.md`; (2) decidir remote no GitHub; (3) P5 (consolidar Script OP) e registro do MCP no Claude Code — ambos fora do escopo da V0.1, ficam para o próximo pocket.
**Estado do git:** `inteligencia/openproject-api/` é repositório git próprio, branch `main`, 6 commits (`4802e53` → `070723d` + este handoff). Sem remote configurado. `.env` local tem token real válido (gerado por João em 05/09/2026), gitignored.

---

## Resumo de Estado

| # | Tarefa | Gravidade | Análise | Backend | Teste |
|---|--------|-----------|---------|---------|-------|
| P1 | Fork + custom fields em criar/editar tarefa | Alta | ✅ | ✅ | ✅ |
| P2 | Validar mudar status (`lockVersion` já tratado no fork) | Alta | ✅ | ✅ | ✅ |
| P3 | Editar tarefas (campos gerais) | Normal | ✅ | ✅ | ✅ |
| P4 | Criar versões + corrigir bug `due_date`/`end_date` | Normal | ✅ | ✅ | ✅ |
| P5 | Consolidar Script OP (import CSV em lote) | Normal | ⬜ | ⬜ | ⬜ |
| P6 | Listar/filtrar tarefas (ex: todas as tarefas de uma versão) | Normal | ✅ | ✅ | ✅ |

Legenda: ⬜ não iniciado · 🟡 em andamento · ✅ concluído · — não se aplica

> **Regra:** ao marcar `[x]` numa tarefa abaixo, sincronizar esta tabela NO MESMO MOMENTO.
> **Design** e **Frontend** foram omitidos desta tabela — não se aplicam a este pocket (é uma ferramenta de infraestrutura, sem interface).

---

## Tarefas

### P1 — Fork do `openproject-mcp-server` + custom fields em `create_work_package`/`update_work_package`

**Gravidade:** Alta *(bloqueia P2, P3 e P4 — é quem cria o código dentro de `inteligencia/openproject-api/`)*
*Contexto relatado:* O fork ainda não existe. É a prioridade #1 de João (criar tarefa com os customfields corretos) e o gap real do MCP de terceiros — ele não documenta suporte a custom fields, e é exatamente o que o Script OP já resolve.

- [x] **Análise:** feita em `investigacao/INVESTIGACAO_V0.1_P001.md` (clone real do fork, leitura de código). Causa raiz do gap: `create_work_package` (`src/client.py:225-288`) e `update_work_package` (`src/client.py:434-508`) nunca tratam custom fields — zero menção no código (só falsos positivos em `weekly_reports.py`). Estrutura real difere do assumido: FastMCP + Pydantic (`src/tools/work_packages.py:17-45`, modelos `CreateWorkPackageInput`/`UpdateWorkPackageInput`) + `aiohttp` async, não a estrutura flat assumida antes. `create_work_package` usa padrão form-based (`POST /work_packages/form` → enriquece → `POST /work_packages`) — decisão de implementação: confirmar empiricamente se o form já retorna slots de custom field antes de decidir entre sobrescrever `payload["_links"]` do form ou montar do zero como o Script OP faz.
- [x] **Backend:** feito em 05/09/2026.
  - Fork/vendoring de `github.com/AndyEverything/openproject-mcp-server` executado via `docs/prompt/P-000_SETUP.md`
  - Portado `src/custom_fields.py` (`resolve_href`, `resolve_custom_fields`) e `config/custom_fields_map.yaml`, a partir do Script OP (`Infraestrutura/Script OP/src/script_op/custom_fields.py`) — assinatura adaptada para keyword arg (`sistema=`) em vez de posicional, documentado em `docs/estrutura/CONTRATO_TOOLS.md`
  - Campo `sistema: Optional[str]` adicionado em `CreateWorkPackageInput`/`UpdateWorkPackageInput` (`src/tools/work_packages.py`) — decisão de campo nomeado em vez de dict genérico, registrada em `docs/estrutura/CONTRATO_TOOLS.md`
  - `src/client.py::create_work_package`/`update_work_package` mesclam `data["custom_fields"]` em `payload["_links"]`
  - `.env`/`.env.example` já configurados desde o P-000
- [x] **Teste (unitário):** `tests/test_custom_fields.py` — 7 testes, 100% verde (`uv run pytest`), cobrindo resolução correta (`"BackEnd"` → `/api/v3/custom_options/2`), erro claro para valor/categoria inválidos, e `resolve_custom_fields` sem `sistema` retornando vazio (comportamento pré-P1 preservado)
- [x] **Teste (integração):** feito em 05/09/2026 contra a instância real. Work package **#397** criado em `Pense & Precifique` com `customField1` = "BackEnd", confirmado via `GET` (`_links.customField1: {"title": "BackEnd", "href": "/api/v3/custom_options/2"}`). Dado registrado em `docs/DADOS_DE_TESTE.md` para exclusão ao final do pocket.
  - **Achado no caminho**: o projeto `Pense & Precifique` estava com **todos os tipos de work package desabilitados** (config do projeto, não bug do P1) — João habilitou "Task" pela UI antes do teste passar.
  - **Achado técnico (relevante para P2/P3/P4)**: `POST /work_packages/form` é **leniente** — aceita e retorna preview válido para qualquer `type` mesmo que não esteja habilitado no projeto (`schema.type._embedded.allowedValues` é que reflete a lista real). O `POST /work_packages` final é quem de fato valida contra essa lista e rejeita com 422 `PropertyConstraintViolation`. Ou seja: **o form passar não garante que a criação vai passar** — para status/tipo/campos com lista restrita por projeto, testar sempre a chamada real, não só o form.

*(Melhoria futura, não bloqueante: trocar o mapa estático YAML por descoberta dinâmica via `GET /api/v3/custom_options` — registrar como item futuro, não fazer agora.)*

---

### P2 — Mudar status das tarefas

**Gravidade:** Alta
*Contexto relatado:* `update_work_package(status_id=...)` já existe no fork. Escopo reduzido pela investigação do P1.

- [x] **Análise:** confirmado em `investigacao/INVESTIGACAO_V0.1_P001.md` — `src/client.py:446` (`update_work_package`) já faz `GET` do work package e lê `lockVersion` antes do `PATCH` (linha 449). **Não há gap a implementar aqui**, só validar contra a instância real.
- [x] **Backend:** confirmado — nenhum código novo foi necessário, o comportamento herdado já está correto.
- [x] **Teste:** feito em 05/09/2026, contra a instância real, reaproveitando o work package #397 (`docs/DADOS_DE_TESTE.md`):
  - Mudança de status `BackLog` → `Prioridade` (id=5): sucesso, `lockVersion` incrementado corretamente (1 → 2), confirmado via `GET` separado.
  - `lockVersion` desatualizado (`PATCH` com valor antigo): rejeitado com `409 UpdateConflict` — comportamento correto, sem corrupção silenciosa.

---

### P3 — Editar tarefas (campos gerais)

**Gravidade:** Normal
*Contexto relatado:* `update_work_package` do fork hoje aceita `subject`, `description`, `type_id`, `status_id`, `priority_id`, `assignee_id`, `percentage_done`.

- [x] **Análise:** campos já cobertos (`subject`, `description`, `type_id`, `status_id`, `priority_id`, `assignee_id`, `version_id`, `percentage_done`, `sistema` desde o P1) atendem o necessário — não foi preciso adicionar campo novo.
- [x] **Backend:** nenhum código novo necessário.
- [x] **Teste:** feito em 05/09/2026 contra a instância real, reaproveitando o work package #397:
  - `subject` + `priority_id` numa única chamada: sucesso, confirmado via `GET` separado.
  - Custom field do P1 (`sistema=BackEnd`) **não foi perdido** por uma edição que não o tocou — confirmado explicitamente.
  - **Achado real (não bug)**: `percentage_done` foi rejeitado com `422 PropertyIsReadOnly` ("% de conclusão tentou escrever, mas não é gravável") — essa instância calcula `percentageDone` automaticamente (modo de progresso não-manual) para o tipo "Task", não aceita escrita direta. Campo continua exposto em `UpdateWorkPackageInput` (pode ser gravável em outros tipos/instâncias com modo manual), documentado aqui como conhecido-instável.

---

### P4 — Criar versões

**Gravidade:** Normal *(subiu de "só validar" para "tem bug real a corrigir", achado durante a investigação do P1)*
*Contexto relatado:* `create_version` já existe no fork (`name`, `description`, `start_date`, `due_date`, `status`).

- [x] **Análise:** feita em `investigacao/INVESTIGACAO_V0.1_P001.md` — **bug confirmado por leitura de código**: `src/tools/versions.py:94` monta `data["due_date"] = input.due_date`, mas `src/client.py:744` só lê `data["end_date"]` para preencher `payload["endDate"]`. Chave incompatível → o campo de data final informado pelo usuário é **descartado silenciosamente**, nunca chega na API do OpenProject.
- [x] **Backend:** corrigido no P-000 (`src/tools/versions.py` monta `data["end_date"]` a partir de `input.due_date`; `src/client.py::create_version` lê `end_date` de forma consistente).
- [x] **Teste:** feito em 05/09/2026 contra a instância real, nas duas camadas:
  - `client.create_version` direto (versão #24): `startDate`/`endDate` aplicados corretamente, confirmado via `GET`/`list_versions` separado.
  - Tool MCP `create_version` (versão #25, `CreateVersionInput.due_date="2027-01-15"`): `**End Date**: 2027-01-15` no retorno da tool — confirma o fix ponta a ponta (o campo do usuário, `due_date`, chega corretamente como `endDate` na API).

---

### P5 — Consolidar o Script OP (import CSV em lote)

**Gravidade:** Normal *(só inicia depois de P1 a P4 validados — é o item que aposenta o Script OP)*
*Contexto relatado:* O Script OP resolve bem o import em lote via CSV, mas vive fora do novo canal único. Consolidar evita ter duas fontes de verdade para o OpenProject.

- [ ] **Análise:** confirmar que P1 (custom fields) já cobre tudo que `Script OP/src/script_op/custom_fields.py` fazia, antes de portar o restante
- [ ] **Backend:**
  - Portar `csv_parser.py` + `validators.py` do Script OP como uma tool nova do fork (ex.: `import_work_packages_from_csv`)
  - Reaproveitar RN-002 (campos obrigatórios), RN-003 (linha inválida não interrompe o lote), RN-005 (versão deve existir no projeto), RN-007 (validar conexão antes de processar)
- [ ] **Teste:** rodar o `exemplo.csv` real do Script OP (`Infraestrutura/Script OP/exemplo.csv`) pela tool nova e comparar resultado com o comportamento documentado do Script OP original (mesmas linhas válidas criadas, mesma linha inválida pulada)

*(Só depois deste item validado em produção, `Infraestrutura/Script OP/` é marcado como legado — não apagar antes disso.)*

---

### P6 — Listar/filtrar tarefas (ex: "todas as tarefas da versão X")

**Gravidade:** Normal
*Contexto relatado:* João perguntou se o MCP identifica "quais tarefas estão na versão X" — não identificava: `get_work_package` só busca por ID único, não existia nenhuma tool de listar/filtrar. Gap descoberto em conversa, fora da investigação original do P001.

- [x] **Análise:** confirmado que nenhuma tool de listagem/filtro existia (`docs/estrutura/ARCHITECTURE.md` §3 não lista nenhuma). A API v3 suporta nativamente via `GET /api/v3/work_packages?filters=[...]` (e `GET /api/v3/projects/{id}/work_packages` com escopo por projeto) — só não tinha sido portado por não estar nas 4 prioridades originais.
- [x] **Backend:** feito em 05/09/2026.
  - `client.py::list_work_packages(project_id, filters, page_size)` — monta a URL com `filters` (JSON, URL-encoded) e `pageSize`, reaproveita `_request` existente.
  - `src/tools/work_packages.py::build_work_package_filters(...)` — função pura que monta a lista de filtros da API v3 a partir de `version_id`/`status_id`/`type_id`/`assignee_id` (testável sem rede).
  - Tool nova `list_work_packages` (`ListWorkPackagesInput`: `project_id`, `version_id`, `status_id`, `type_id`, `assignee_id`, todos opcionais).
- [x] **Teste (unitário):** `tests/test_work_packages_filters.py` — 6 testes, 100% verde, cobrindo cada filtro isolado e a combinação de dois (`version_id=24` é o valor real da Versão #24 de teste).
- [x] **Teste (integração):** feito em 05/09/2026 contra a instância real, reaproveitando os dados de teste existentes (WP #397, Versão #24, `docs/DADOS_DE_TESTE.md`):
  - WP #397 associada à Versão #24 via `update_work_package` (dado de teste existente, sem criar dado novo).
  - `client.list_work_packages(project_id=6, filters=[{"version": ...}])` → retornou `[397]`. Repetido com filtro por `status` → mesmo resultado.
  - Tool MCP `list_work_packages({"project_id": 6, "version_id": 24})` → retornou a #397 formatada corretamente, confirmando o fluxo ponta a ponta.
  - **Achado real (não bug, mas corrigido no caminho):** a coleção `GET /work_packages` **não traz `_embedded`** por elemento (diferente do `GET /work_packages/{id}` individual) — tipo/status/prioridade só vêm em `_links.{campo}.title`. A formatação inicial da tool assumia `_embedded` (copiado do padrão de `create_work_package`/`update_work_package`) e mostrava tudo como "—"; corrigido para ler de `_links` antes de fechar a tarefa.

---

## Fora do Escopo

- **Descoberta dinâmica de custom fields** (substituir o YAML estático por `GET /api/v3/custom_options`): melhoria futura registrada no P1, não faz parte do V0.1.
- **Tools do fork não usadas** (gestão de projetos, membros, roles, time entries, relações de hierarquia, filtros avançados): existem no fork mas nenhuma skill deve chamá-las sem uma validação dedicada própria — fora do escopo deste pocket.
- ~~**Registro do MCP no Claude Code**~~ — **feito em 05/09/2026**, fora de ordem (antes do P5), a pedido de João: `claude mcp add openproject-api -s user ...`, escopo `user` (disponível em qualquer projeto/sessão), status `√ Connected` confirmado (`claude mcp get openproject-api`). Ver Seção 6 do `PLANO_ACAO_OPENPROJECT_API.md`.
- **Atualização das 7 skills** para chamarem as tools novas em vez de CSV manual: ainda não feita — depende de P5 (consolidação do Script OP) e é trabalho de edição de prompt, não de código. Fica para quando João reescrever as skills (corresponde ao item 25 replanejado do `PLANO_ACAO_MIGRACAO.md`).

---

## Referência

- Plano de ação completo (contexto, decisão de arquitetura, o que já vem pronto no fork, tools fora de escopo, autenticação, plano de validação): `PLANO_ACAO_OPENPROJECT_API.md` (nesta mesma pasta).
- Evidência de código real (fork clonado e lido linha a linha): `investigacao/INVESTIGACAO_V0.1_P001.md`.
- Decisões técnicas e estrutura de pastas (vendoring seletivo): `estrutura/ARCHITECTURE.md`.
- Prompt de setup executável (vendoring + trim + git init): `prompt/P-000_SETUP.md`.
