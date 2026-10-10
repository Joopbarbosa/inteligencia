# ARCHITECTURE.md — inteligencia/openproject-api

> Gerado pela skill `/estrutura` em 04/09/2026, com base em `../PLANO_ACAO_OPENPROJECT_API.md` e `../investigacao/INVESTIGACAO_V0.1_P001.md` — sem PRD/Design formais (projeto de infraestrutura, não produto).

## 1. O que é

Servidor MCP (Model Context Protocol) para o OpenProject, registrado no Claude Code, expondo como tools: criar tarefa com custom fields, mudar status, editar tarefa, criar versão (prioridades definidas por João, nesta ordem). Consolida também o import CSV em lote hoje feito pelo `Script OP`.

**Não é um fork git no sentido tradicional** (sem `git remote upstream`, sem intenção de sincronizar com o projeto original). É um **vendoring seletivo**: copiamos só os arquivos de `github.com/AndyEverything/openproject-mcp-server` que cobrem nossas 4 prioridades, descartamos o resto (~60% do código original: membros, roles, time entries, relations, news, weekly reports, hierarquia), e o repositório passa a ser inteiramente nosso desde o commit inicial.

**Atribuição:** o `pyproject.toml` original declara `license = {text = "MIT"}` (sem arquivo `LICENSE` físico, mas é uma declaração de licenciamento válida). Um arquivo `ATTRIBUTION.md` credita a origem, conforme os termos da MIT (manter aviso de copyright/licença).

## 2. Decisões técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| Linguagem/runtime | Python 3.10+ | Herdado do projeto vendorizado |
| Gerenciador de pacotes | `uv` | Mantém o padrão do código de origem (`pyproject.toml`/`uv.lock` já prontos) — evita reescrever para pip/venv |
| Framework MCP | FastMCP (`@mcp.tool`) | Herdado; é o que já funciona no código vendorizado |
| Validação de input | Pydantic (`BaseModel`) | Herdado; padrão usado nos tools que vamos manter |
| Cliente HTTP | `aiohttp` (assíncrono) | Herdado — diferente do `requests` síncrono do Script OP, mas não vale a pena reescrever só por consistência |
| Autenticação | Basic Auth, `base64("apikey:" + token)` | Idêntico ao esquema do Script OP — só muda a lib |
| Transporte MCP | stdio (`openproject-mcp-fastmcp.py`, `mcp.run(transport="stdio")`) | É o que o Claude Code usa para registrar MCP servers locais — descartamos as variantes HTTP/SSE do original |
| Execução local | Direto via `uv run`, sem container | Mesmo padrão do Script OP; mais rápido para iterar durante a validação das tools (P2 do plano de validação) |
| Hospedagem do código | Repositório git próprio (decisão de hospedar remoto no GitHub fica pendente — ver P-000) | Sem tracking de upstream — evita rebase manual constante já que vamos divergir bastante (custom fields, fix de bug, consolidação CSV) |
| Organização do código | Sem isolamento especial "nosso vs herdado" | Como não há upstream a sincronizar, todo o código vendorizado já é nosso desde o commit inicial — organização segue o padrão do próprio código-fonte (`src/tools/*.py` por domínio) |
| Modelagem de dados | **N/A** | Este projeto não possui banco de dados próprio — os dados vivem inteiramente no OpenProject; o cliente HTTP é só uma camada de acesso |

## 3. Estrutura de pastas (o que fica, o que é descartado)

### Vendorizado (copiado do original, depois modificado por nós)

```
inteligencia/openproject-api/
├── openproject-mcp-fastmcp.py     # entrypoint stdio (Claude Code)
├── pyproject.toml                 # deps via uv — renomear name/author, manter license MIT
├── .env.example                   # (era env_example.txt no original)
├── src/
│   ├── __init__.py
│   ├── server.py                  # boilerplate FastMCP — trimar imports pros 3 módulos de tools mantidos
│   ├── client.py                  # trimar métodos: manter só os usados pelas tools mantidas (ver §4)
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── connection.py          # mantido integralmente (test_connection, check_permissions)
│   │   ├── work_packages.py       # trimar: manter create/update/list_types/list_statuses/list_priorities; ADICIONAR tool get_work_package (novo, usa client.get_work_package já existente)
│   │   └── versions.py            # mantido (list_versions, create_version) — CORRIGIR bug due_date/end_date aqui
│   └── utils/
│       ├── __init__.py
│       └── formatting.py          # trimar: manter format_work_package_list, format_work_package_detail, format_error, format_success
```

### Novo (nosso, não existe no original)

```
├── src/
│   └── custom_fields.py           # portado do Script OP (resolve_href, resolve_custom_fields) — P1
├── config/
│   └── custom_fields_map.yaml     # portado do Script OP — P1
├── docs/                          # já existe (PLANO_ACAO, INVESTIGACAO, BACKLOG, este ARCHITECTURE, CLAUDE.md)
├── ATTRIBUTION.md                 # créditos ao projeto original (MIT)
├── .gitignore                     # .env, venv/, __pycache__/
```

### Descartado do original (não vendorizar)

`src/tools/{hierarchy,memberships,news,projects,relations,time_entries,users,weekly_reports}.py`, `src/utils/report_formatter.py`, `.claude/` (tooling de dev do projeto original), `docs/` original (guias em vietnamita, template de relatório semanal), `Dockerfile`, `.dockerignore`, `.fastmcp.yaml`, `openproject-mcp-http.py`, `openproject-mcp-sse.py`, `openproject-mcp.legacy.py`, `test_news_*.py`, `test_tools.py`, `scripts/install_mcp.ps1`, `CLAUDE_CODE_GUIDE.md`, `CLAUDE_CODE_SETUP.md`, `HUONG_DAN_*.md`, `PERFORMANCE_OPTIMIZATIONS.md`, `SETUP_SUMMARY.md`, `README.md` original (escrevemos o nosso), `requirements.txt` (canônico vira `pyproject.toml`/`uv.lock`), `uv.lock` (regenerar do zero após trimar deps).

## 4. Mapeamento gap → arquivo (das prioridades de João)

| Prioridade | Tool MCP | Arquivo | Status pós-investigação |
|---|---|---|---|
| P1 — Criar com custom fields | `create_work_package` | `src/tools/work_packages.py` + `src/client.py` (+ novo `src/custom_fields.py`) | Gap real — implementar |
| P2 — Mudar status | `update_work_package` (`status_id`) | idem | `lockVersion` já tratado — só validar |
| P3 — Editar tarefa | `update_work_package` (campos gerais) | idem | Já cobre `subject/description/type/priority/assignee/percentage_done/version` — só validar |
| P4 — Criar versão | `create_version` | `src/tools/versions.py` + `src/client.py` | Tem bug (`due_date`/`end_date`) — corrigir + validar |
| P5 — Consolidar CSV (Script OP) | tool nova (`import_work_packages_from_csv`) | novo `src/csv_import.py` | Depende de P1-P4 validados |

## 5. Fora de escopo desta versão

- Descoberta dinâmica de custom fields via `/api/v3/custom_options` (mapa YAML estático por enquanto).
- As ~34 tools descartadas do original (nenhuma delas é chamada por skill nenhuma hoje).
- Deploy em nuvem (FastMCP Cloud/SSE) — só stdio local, registrado direto no Claude Code.
