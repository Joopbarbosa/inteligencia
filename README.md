# openproject-api

Servidor MCP para integração com o OpenProject: criar tarefa (com custom fields), mudar status, editar tarefa e criar versão.

Vendorizado seletivamente a partir de [openproject-mcp-server](https://github.com/AndyEverything/openproject-mcp-server) (MIT) — ver `ATTRIBUTION.md`.

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
