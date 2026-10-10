# openproject-api

Servidor MCP para integração com o OpenProject: criar tarefa (com custom fields), mudar status, editar tarefa e criar versão.

Vendorizado seletivamente a partir de [openproject-mcp-server](https://github.com/AndyEverything/openproject-mcp-server) (MIT) — ver `ATTRIBUTION.md`.

## Tools disponíveis

**Conexão**
- `test_connection` — testa autenticação/conectividade com o OpenProject
- `check_permissions` — retorna dados do usuário autenticado (`/users/me`)

**Tarefas (work packages)**
- `create_work_package` — cria tarefa (projeto, título, tipo + opcionais: descrição, datas, responsável, status, prioridade, versão, e o custom field `sistema`, ex: "BackEnd")
- `update_work_package` — edita qualquer campo acima numa tarefa existente, incluindo mudar status; trata `lockVersion` (concorrência otimista) automaticamente
- `get_work_package` — busca uma tarefa por ID, com todos os detalhes
- `list_work_packages` — lista/filtra tarefas por `project_id`, `version_id`, `status_id`, `type_id`, `assignee_id` (combináveis). É o que responde "quais tarefas estão na versão X". **Limitação conhecida:** sem paginação automática — só a primeira página (até 100 itens)

**Metadados** (sempre dinâmico, direto da API — nunca fica desatualizado)
- `list_types`, `list_statuses`, `list_priorities` — tipos, status e prioridades disponíveis

**Versões**
- `list_versions` — lista versões de um projeto
- `create_version` — cria versão nova (nome, datas, status)

**Fora do escopo hoje** — não implementado, não portado do fork original: projetos/membros/roles, time entries, relações entre tarefas, deletar tarefa/projeto, e import CSV em lote (P5 do backlog, ainda não feito — vai consolidar o `Script OP`).

**Custom fields:** novo campo custom field no OpenProject (não só nova opção de valor) exige código novo (`src/custom_fields.py` + `CreateWorkPackageInput`/`UpdateWorkPackageInput`); nova opção de valor num campo existente (ex: novo item em "Sistema") só exige atualizar `config/custom_fields_map.yaml`. Status novo não exige nada — é lido dinamicamente.

## Documentação

- `CLAUDE.md` — contexto para sessões do Claude Code
- `docs/PLANO_ACAO_OPENPROJECT_API.md` — plano de ação por prioridade
- `docs/BACKLOG_V0.1.md` — backlog de implementação
- `docs/investigacao/` — evidência de código real
- `docs/estrutura/ARCHITECTURE.md` — decisões técnicas
- `docs/prompt/P-000_SETUP.md` — prompt de setup

## Setup rápido

```bash
uv sync
cp .env.example .env   # preencher OPENPROJECT_URL e OPENPROJECT_API_KEY
uv run python openproject-mcp-fastmcp.py
```
