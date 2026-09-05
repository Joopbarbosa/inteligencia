# Atribuição

Este projeto vendoriza (copia seletivamente, sem tracking de upstream) uma parte do código-fonte de:

- **Projeto original**: [openproject-mcp-server](https://github.com/AndyEverything/openproject-mcp-server)
- **Autor**: AndyEverything
- **Licença declarada**: MIT (`pyproject.toml` do projeto original, `license = {text = "MIT"}`)

## O que foi trazido

Os arquivos abaixo têm origem direta no projeto acima, depois trimados/modificados por nós (ver `docs/estrutura/ARCHITECTURE.md` §3 para o detalhe completo do que foi mantido/removido/corrigido):

- `openproject-mcp-fastmcp.py`
- `src/server.py`
- `src/client.py`
- `src/tools/connection.py`
- `src/tools/work_packages.py`
- `src/tools/versions.py`
- `src/utils/formatting.py`

## O que é nosso (não existe no projeto original)

- `src/custom_fields.py` e `config/custom_fields_map.yaml` (portados de `Infraestrutura/Script OP/`)
- `src/csv_import.py` (planejado, P5 do `docs/BACKLOG_V0.1.md`)
- A tool `get_work_package` em `src/tools/work_packages.py`
- Correção de bug em `create_version` (chave `due_date`/`end_date` incompatível no original)

## Por que vendoring em vez de fork

Decisão registrada em `docs/estrutura/ARCHITECTURE.md` §2 — usamos só ~40% do código original (as 4 prioridades de integração com o OpenProject), sem intenção de sincronizar com atualizações do projeto original. Não há `git remote upstream` configurado.
