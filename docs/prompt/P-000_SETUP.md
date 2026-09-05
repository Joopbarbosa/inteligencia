# P-000 — Prompt de Setup: inteligencia/openproject-api

> Gerado pela skill `/estrutura`. Este é o prompt a rodar (nesta sessão ou numa nova) para montar o esqueleto real do projeto por vendoring seletivo, antes do Backend do P1 começar a escrever código de custom fields. Ler `../estrutura/ARCHITECTURE.md` e `../../CLAUDE.md` deste projeto antes de executar.

## Passo 1 — Clonar o original em local temporário (fora do projeto)

```bash
git clone --depth 1 https://github.com/AndyEverything/openproject-mcp-server /tmp/openproject-mcp-server-src
```

## Passo 2 — Vendorizar só os arquivos necessários

Copiar do clone temporário para `inteligencia/openproject-api/`, preservando a estrutura de pastas:

```
openproject-mcp-fastmcp.py
pyproject.toml
env_example.txt          → renomear para .env.example
src/__init__.py
src/server.py
src/client.py
src/tools/__init__.py
src/tools/connection.py
src/tools/work_packages.py
src/tools/versions.py
src/utils/__init__.py
src/utils/formatting.py
```

Descartar tudo o mais do clone temporário (ver `../estrutura/ARCHITECTURE.md` §3 para a lista completa do que fica de fora) e depois **remover o clone temporário** (`rm -rf /tmp/openproject-mcp-server-src`) — não deve sobrar referência a ele.

## Passo 3 — Trimar os arquivos vendorizados

- **`src/server.py`**: remover os imports de `src.tools.{users,memberships,hierarchy,relations,time_entries,weekly_reports,news,projects}` (manter só `connection`, `work_packages`, `versions`).
- **`src/client.py`**: manter só os métodos usados pelas tools mantidas: `_request`, `_encode_api_key`, `_format_error_message`, `test_connection`, `check_permissions`, `get_types`, `get_statuses`, `get_priorities`, `get_work_package`, `get_work_packages` (opcional, útil para validação manual), `create_work_package`, `update_work_package`, `get_versions`, `create_version`. Remover os demais (`get_projects`/`create_project`/`update_project`/`delete_project`/`get_users`/`get_memberships`/`*_membership`/`*_relation`/`*_time_entry`/`*_news`/hierarquia).
- **`src/tools/work_packages.py`**: manter `CreateWorkPackageInput`, `UpdateWorkPackageInput`, `create_work_package`, `update_work_package`, `list_types`, `list_statuses`, `list_priorities`. Remover `list_work_packages`, `search_work_packages`, `delete_work_package`, `assign_work_package`, `unassign_work_package`, `add_work_package_comment`, `list_work_package_activities` e todas as tools da seção "ADVANCED FILTERS". **Adicionar tool nova**: `get_work_package(work_package_id: int) -> str`, chamando `client.get_work_package` (já existe no client) — necessário para os passos de validação do `../BACKLOG_V0.1.md` ("confirmar via GET").
- **`src/tools/versions.py`**: manter como está, mas **corrigir o bug do backlog P4** — `create_version` monta `data["due_date"]`, e `client.py::create_version` só lê `data["end_date"]`. Alinhar as duas pontas (recomendado: usar `end_date` nos dois lados, já que é o nome do campo na API v3 do OpenProject).
- **`src/utils/formatting.py`**: manter só `format_work_package_list`, `format_work_package_detail`, `format_error`, `format_success`. Remover `format_project_list`, `format_user_list`, `format_time_entry_list`, `format_news_list`, `format_news_detail`.
- **`pyproject.toml`**: atualizar `name` (ex: `openproject-api`), `authors` (dados reais de João), manter `license = {text = "MIT"}`. Remover dependências não usadas pelo que sobrou (`uvicorn`, `starlette` — eram só para transporte SSE, que descartamos).

## Passo 4 — Arquivos novos (nossos)

- `.env.example` — a partir do `env_example.txt` original, mantendo `OPENPROJECT_URL`, `OPENPROJECT_API_KEY`, `OPENPROJECT_PROXY` (opcional), `LOG_LEVEL`.
- `.gitignore` — `.env`, `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `.uv/`.
- `ATTRIBUTION.md` — créditos ao projeto original (`github.com/AndyEverything/openproject-mcp-server`, MIT), citando que este projeto vendoriza uma seleção de arquivos dele.
- `src/custom_fields.py` e `config/custom_fields_map.yaml` — **não fazer neste P-000**, é trabalho de Backend do P1 (ver `../BACKLOG_V0.1.md`).

## Passo 5 — Ambiente

```bash
cd inteligencia/openproject-api
uv sync                 # gera um uv.lock novo, a partir do pyproject.toml trimado
cp .env.example .env    # preencher OPENPROJECT_URL e OPENPROJECT_API_KEY reais (do Script OP ou novo token)
uv run python openproject-mcp-fastmcp.py   # smoke test: deve inicializar sem erro (ValueError só se .env não tiver as 2 vars obrigatórias)
```

## Passo 6 — Git

```bash
git init
git branch -m main
# stage explícito por arquivo é o padrão do PIPELINE — exceção: repositório recém-inicializado sem histórico, git add . é aceitável aqui
git add .
git commit -m "[OPAPI-000] chore: setup inicial via vendoring seletivo do openproject-mcp-server (MIT)"
```

**PAUSAR AQUI** — antes de configurar remote: perguntar ao João se este repositório deve ter remoto no GitHub (mesmo padrão de `Script OP`/`OpenProject infra`, sob a conta dele) ou ficar só local por enquanto. Não criar repositório remoto sem essa confirmação.

## Passo 7 — Registrar como MCP server no Claude Code (só depois de P1-P4 validados manualmente — ver `../PLANO_ACAO_OPENPROJECT_API.md` §6-7)

Não fazer neste P-000 — fica para depois da validação, para não expor tools quebradas/incompletas a nenhuma skill.

## Checklist de saída deste P-000

- [ ] Vendoring feito, clone temporário removido
- [ ] Arquivos trimados conforme Passo 3
- [ ] Bug `due_date`/`end_date` corrigido em `versions.py`
- [ ] `.env.example`, `.gitignore`, `ATTRIBUTION.md` criados
- [ ] `uv sync` rodou sem erro
- [ ] Smoke test do entrypoint rodou (com `.env` real preenchido)
- [ ] Git inicializado e commit inicial feito
- [ ] Decisão sobre remoto no GitHub tomada com o João (não presumida)
