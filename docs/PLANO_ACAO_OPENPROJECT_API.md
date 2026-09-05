# Plano de Ação — `inteligencia/openproject-api`

> Status: **plano aprovado, implementação ainda não iniciada.**
> Gerado em 04/09/2026, a partir da validação da infraestrutura real do OpenProject e do Script OP, e de pesquisa na documentação oficial do OpenProject + repositório de terceiros indicado por João.

---

## 1. Contexto e decisão de arquitetura

O item 22 do `Migração By mentoria/PLANO_ACAO_MIGRACAO.md` previa um esqueleto de CLI (`op.py`) para integração com o OpenProject. Antes de codar, validamos a infraestrutura real e pesquisamos as opções disponíveis. As 4 prioridades definidas por João, em ordem:

1. Criar tarefa (com os custom fields corretos)
2. Mudar status das tarefas
3. Editar tarefas
4. Criar versões

### 1.1 Infraestrutura real do gerenciador de tarefas

`Infraestrutura/OpenProject/` — instância self-hosted via Docker:
- Imagem `openproject/openproject:14` (all-in-one — Postgres/Memcached embutidos, sem serviços separados no compose)
- Porta `8090:80`, host `localhost:8090`, HTTPS desabilitado
- Sem indicação de licença Enterprise no `.env`
- Repositório git próprio (`Joopbarbosa/OpenProject`), 2 commits

### 1.2 Ferramenta já existente: `Script OP`

`Infraestrutura/Script OP/` — CLI Python (Typer) que importa work packages em lote via CSV. Engine validada e em uso real (10 commits, CSVs reais em `CSV/`):

- **Autenticação**: `requests.Session` com Basic Auth, usuário fixo `"apikey"`, senha = token (`OPENPROJECT_BASE_URL` + `OPENPROJECT_API_TOKEN` no `.env`)
- **Resolução dinâmica via API** (com cache em memória por execução): tipo (`GET /api/v3/types`), situação (`GET /api/v3/statuses`), projeto (`GET /api/v3/projects`), prioridade (`GET /api/v3/priorities`, com tradução PT→EN hardcoded), versão (`GET {projeto_href}/versions`)
- **Custom fields**: mapa estático `config/custom_fields_map.yaml` (texto → href de `custom_option`), resolvido em `custom_fields.py`:
  ```python
  CUSTOM_FIELD_IDS = {"sistema": "customField1"}

  def resolve_href(mapa: dict, categoria: str, texto: str) -> str:
      href = mapa.get(categoria, {}).get(texto)
      if not href:
          raise ValueError(f"Href não configurado para {categoria}='{texto}' em config/custom_fields_map.yaml")
      return href

  def resolve_custom_fields(mapa: dict, sistema: str) -> dict:
      return {CUSTOM_FIELD_IDS["sistema"]: {"href": resolve_href(mapa, "sistema", sistema)}}
  ```
- **Criação**: só `POST /api/v3/work_packages` (`api_client.py::create_work_package`). **Não existe** `PATCH` (editar/status) nem criação de versão.
- **Validações**: RN-007 (`test_connection()` via `GET /api/v3/users/me`, aborta tudo se falhar), RN-003 (linha inválida não interrompe o lote, `try/except` + `continue` por linha), RN-002 (campos obrigatórios), RN-005 (versão deve existir no projeto).
- **Estrutura**: módulo plano `src/script_op/` — `main.py` (entrypoint), `csv_parser.py`, `validators.py`, `custom_fields.py`, `api_client.py`, `output.py` (regra de arquitetura do próprio `CLAUDE.md` do projeto: toda validação em `validators.py`, nenhum `print()` fora de `output.py`).

### 1.3 Pesquisa: API direta vs MCP

- **MCP Server oficial do OpenProject** — confirmado na [documentação oficial](https://www.openproject.org/docs/system-admin-guide/integrations/mcp-server/): recurso **exclusivo Enterprise** (Cloud/On-premises, planos Professional/Premium/Corporate). A instância self-hosted de vocês não tem essa licença → **descartado**.
- **API REST v3** — [documentação oficial](https://www.openproject.org/docs/api/introduction/): HAL+JSON, autenticação por API token (Bearer ou Basic Auth com usuário `apikey`), endpoints descobríveis via `_links`, spec em `/api/v3/spec.json`. Sem rate limit documentado.
- **MCP de terceiros** — [`AndyEverything/openproject-mcp-server`](https://github.com/AndyEverything/openproject-mcp-server) (indicado por João): Python + FastMCP, 42 tools, autenticação por API key. Cobre:
  - `create_work_package`, `update_work_package` (inclui mudar status via `status_id`), `get_work_package`, `list_work_packages`, `delete_work_package`
  - `create_version`, `list_versions`
  - `list_types`, `list_statuses`, `list_priorities`, `test_connection`, `check_permissions`
  - Além disso: gestão de projetos, membros, roles, time entries, relações de hierarquia (não interessam ao nosso uso agora)
  - **Gap**: README não documenta suporte a **custom fields** em `create_work_package`/`update_work_package` — exatamente a prioridade #1 de João
  - **Aviso do próprio projeto**: *"This is an early-stage project. Do not use it productively"*

### 1.4 Decisão

**Fork + estender** o `openproject-mcp-server` para dentro de `inteligencia/openproject-api`, em vez de MCP Enterprise (indisponível) ou CLI própria do zero (reinventaria o que o fork já cobre em status/edição/versão).

Razões:
1. As prioridades 2, 3 e 4 já vêm prontas — falta só validar contra a instância real.
2. A prioridade 1 (custom fields) é exatamente o que o Script OP já resolve — portar a lógica é trabalho pequeno, não uma reescrita.
3. O aviso "não usar em produção" recai sobre as ~36 tools que **não vamos usar** (membros, roles, time entries, relations, delete). O uso real fica restrito a ~8 tools simples e bem estabelecidas na API v3, que serão validadas uma a uma antes de qualquer skill depender delas.
4. MCP nativo é mais escalável que uma CLI: skills chamam a tool diretamente (sem Claude escrever request na mão), no mesmo padrão dos MCPs já configurados no Claude Code (ClickUp, Google Drive).
5. Sem custo de licença Enterprise nem custo de LLM adicional — mesma filosofia de "scripts prontos" da mentoria.

**Consolidação**: o `Script OP` (import CSV em lote) é absorvido pelo `inteligencia/openproject-api` como mais uma tool. Depois da consolidação, `Infraestrutura/Script OP/` vira legado — referenciado como fonte da lógica portada, mas não mais evoluído.

---

## 2. O que já vem pronto no fork (a validar, não a construir)

> **Atualizado em 04/09/2026 após clone real e leitura de código** (`investigacao/INVESTIGACAO_V0.1_P001.md`) — a estrutura real é modular (`src/{server.py,client.py}` + `src/tools/*.py`, FastMCP + Pydantic + `aiohttp` async), diferente do assumido inicialmente. Achado importante: **`lockVersion` já é tratado** em `update_work_package` (`src/client.py:446`) — não é gap, é só validar.

| Tool | Arquivo | Cobre | Validar |
|---|---|---|---|
| `test_connection` | `src/tools/connection.py` | Pré-requisito de qualquer operação (equivalente à RN-007 do Script OP) | Rodar contra a instância real |
| `list_types`, `list_statuses`, `list_priorities` | `src/tools/work_packages.py` | Descoberta dinâmica (substitui o que o Script OP faz inline em `api_client.py`) | Conferir formato de retorno |
| `create_work_package` | `src/tools/work_packages.py` + `src/client.py:225-288` | Prioridade 1 (sem custom fields ainda; usa padrão form-based: `POST /work_packages/form` → enriquece → `POST /work_packages`) | Ver Gap P1 |
| `update_work_package` (com `status_id`) | `src/tools/work_packages.py` + `src/client.py:434-508` | Prioridades 2 e 3 — **`lockVersion` já buscado via `get_work_package` antes do PATCH (linha 446)** | Ver Gap P2/P3 (reduzido) |
| `create_version` | `src/tools/versions.py` + `src/client.py:721-749` | Prioridade 4 — **bug encontrado**: `due_date` do tool nunca chega no payload (`versions.py:94` usa `due_date`, `client.py:744` só lê `end_date`) | Ver Gap P4 |
| `get_work_package` | `src/client.py:422-432` | Necessário para `lockVersion` antes de `PATCH` — já usado internamente | — |

## 3. Gaps a fechar, por prioridade

### P1 — Custom fields em `create_work_package` / `update_work_package`
- Portar `custom_fields.py` (`resolve_href`, `resolve_custom_fields`) e `config/custom_fields_map.yaml` do Script OP para o fork.
- Expor no payload de criação/edição como `customFieldN: {href: "/api/v3/custom_options/N"}` — a API já aceita isso nativamente junto dos campos normais no mesmo `POST`/`PATCH`.
- Melhoria futura (não bloqueante): trocar o mapa estático YAML por descoberta dinâmica via `GET /api/v3/custom_options`, eliminando manutenção manual do YAML a cada novo valor.

### P2 — Mudar status
- ~~Portar tratamento de `lockVersion`~~ — **já existe** (`src/client.py:446`, confirmado por leitura de código). Só validar `update_work_package(status_id=...)` do fork contra a instância real.

### P3 — Editar tarefas
- Validar quais campos o `update_work_package` do fork já aceita hoje: `subject`, `description`, `type_id`, `status_id`, `priority_id`, `assignee_id`, `percentage_done`, `version_id`.
- Checar se cobre o necessário ou se falta algo (custom fields resolvido pelo P1).

### P4 — Criar versões
- Validar `create_version` do fork (`name`, `description`, `start_date`, `due_date`, `status`) contra `POST /api/v3/projects/{id}/versions`.
- **Corrigir bug encontrado na investigação**: `src/tools/versions.py:94` envia `data["due_date"]`, mas `src/client.py:744` só lê `data["end_date"]` — o campo de data final é descartado silenciosamente hoje. Alinhar as duas pontas (usar `end_date` consistentemente, ou fazer `client.py` aceitar `due_date`) antes de considerar P4 validado.

### P5 — Consolidação do Script OP (import CSV em lote)
- Portar `csv_parser.py` + `validators.py` como uma tool nova do fork (ex.: `import_work_packages_from_csv`), reaproveitando:
  - RN-002 (campos obrigatórios)
  - RN-003 (linha inválida não interrompe o lote — try/except por linha)
  - RN-005 (versão deve existir no projeto)
  - RN-007 (validar conexão antes de processar)
  - Custom fields via P1
- Depois de portado e validado, `Infraestrutura/Script OP/` é marcado como legado.

## 4. Tools do fork fora de escopo (não usar/validar agora)

`create_project`, `update_project`, `delete_project`, `delete_work_package`, todas as de membros/roles (`list_memberships`, `create_membership`, etc.), `time_entries` (`list/create/update/delete`), relações de hierarquia (`set_work_package_parent`, `create_work_package_relation`, etc.), filtros avançados (`list_overdue_work_packages` e variantes). Deixar existir no fork sem uso — não removê-las é aceitável, mas nenhuma skill deve chamá-las sem validação prévia dedicada.

## 5. Autenticação

- `.env` com `OPENPROJECT_URL` e `OPENPROJECT_API_KEY` (mesmo padrão do Script OP e do fork) — nunca versionado, `.env.example` documentado no repositório.
- Reaproveitar o token já existente em `Infraestrutura/Script OP/.env` (mesma instância, mesmo usuário) ou gerar um novo dedicado — decidir no início da implementação.

## 6. Registro como MCP server no Claude Code

Mesmo padrão dos MCPs já configurados (ClickUp, Google Drive): `claude mcp add openproject-api <python> <script> -e OPENPROJECT_URL=... -e OPENPROJECT_API_KEY=...` (ou configuração manual equivalente).

## 7. Plano de validação antes de confiar

1. `test_connection` primeiro — nada mais roda se falhar.
2. Validar cada tool prioritária manualmente, uma de cada vez, contra dado de teste (não produção): P1 → P2 → P3 → P4 → P5.
3. Só depois disso alguma skill (`recepcao`, `spec-driven`, `design`, `frontend`, `teste`, `retomada`, `analise`) passa a chamar as tools em vez de gerar bloco CSV manual.

## 8. Fora de escopo desta fase

- Nenhuma chamada real contra a API foi feita na criação deste plano.
- Fork do repositório, código de extensão (custom fields, consolidação do CSV) e testes reais ficam para a próxima sessão de implementação.
- Remoção efetiva do `Infraestrutura/Script OP/` só acontece depois que o P5 estiver validado em produção.
