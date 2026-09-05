# CLAUDE.md — inteligencia/openproject-api

Contexto para qualquer sessão do Claude Code trabalhando neste projeto.

## O que é este projeto

Servidor MCP (Model Context Protocol) para o OpenProject, vendorizado a partir de `github.com/AndyEverything/openproject-mcp-server` (MIT, ver `ATTRIBUTION.md`) e estendido com suporte a custom fields. Registrado no Claude Code como MCP local (stdio), expõe tools para criar tarefa (com custom fields), mudar status, editar tarefa e criar versão no OpenProject — nesta ordem de prioridade. Consolida também o import CSV em lote hoje feito por `Infraestrutura/Script OP/` (ver `docs/PLANO_ACAO_OPENPROJECT_API.md` P5).

Ver `docs/estrutura/ARCHITECTURE.md` (decisões técnicas completas), `docs/PLANO_ACAO_OPENPROJECT_API.md` (plano por prioridade) e `docs/investigacao/INVESTIGACAO_V0.1_P001.md` (evidência de código real) antes de qualquer alteração.

**Importante:** não é um fork com tracking de upstream. É um vendoring seletivo — só os arquivos usados pelas 4 prioridades foram trazidos do projeto original; o resto foi descartado. Não existe `git remote upstream` nem expectativa de sincronizar com o projeto original.

## Onde cada coisa vai

| Categoria | Local |
|---|---|
| Entrypoint MCP (stdio, usado pelo Claude Code) | `openproject-mcp-fastmcp.py` |
| Inicialização do FastMCP + registro de tools | `src/server.py` |
| Comunicação com a API do OpenProject (HTTP, async) | `src/client.py` |
| Tools de conexão (`test_connection`, `check_permissions`) | `src/tools/connection.py` |
| Tools de work package (criar, editar, status, listar tipos/situações/prioridades) | `src/tools/work_packages.py` |
| Tools de versão (`list_versions`, `create_version`) | `src/tools/versions.py` |
| Resolução de custom fields (texto → href de custom_option) — **nosso, não existe no original** | `src/custom_fields.py` |
| Mapa estático de custom options — **nosso** | `config/custom_fields_map.yaml` |
| Import CSV em lote (P5, consolidação do Script OP) — **nosso, ainda não implementado** | `src/csv_import.py` |
| Formatação de saída das tools | `src/utils/formatting.py` |
| Variáveis de ambiente | `.env` (nunca commitado; `.env.example` como referência) |
| Documentação de plano/investigação/arquitetura | `docs/` |

## Verificar antes de criar

Antes de criar qualquer função, tool ou módulo novo, verificar se já existe algo equivalente nos arquivos acima — este projeto tem intencionalmente pouco código (só o que as 4 prioridades exigem, vendorizado seletivamente). Em especial:
- Antes de adicionar uma tool nova, checar se `src/client.py` já tem o método HTTP correspondente (muitos foram descartados do original — confirmar em `docs/estrutura/ARCHITECTURE.md` §3 o que foi mantido antes de reimplementar).
- Nenhuma tool deve montar request HTTP na mão fora de `src/client.py` — toda chamada à API do OpenProject passa por lá (mesma regra de camadas do Script OP).
- Resolução de custom fields sempre via `src/custom_fields.py` — nunca hardcoded dentro de uma tool.

## Regras de negócio críticas (resumo — ver `docs/PLANO_ACAO_OPENPROJECT_API.md` para o completo)

- Autenticação: Basic Auth, `base64("apikey:" + OPENPROJECT_API_KEY)` — já implementado em `src/client.py`, não recriar.
- `update_work_package` já busca `lockVersion` via `GET` antes do `PATCH` (`src/client.py`) — controle de concorrência otimista da API v3. Qualquer nova operação de edição/status deve seguir o mesmo padrão.
- `create_work_package` usa padrão form-based (`POST /work_packages/form` → enriquece → `POST /work_packages`) — ao adicionar custom fields, confirmar empiricamente se o form já retorna slots de custom field antes de decidir entre sobrescrever ou adicionar do zero.
- **Bug conhecido a corrigir (P4)**: `src/tools/versions.py` envia `due_date`, `src/client.py::create_version` só lê `end_date` — chave incompatível, corrigir antes de considerar P4 validado.
- Nenhuma tool deve ser exposta ao Claude Code sem antes ser validada manualmente contra a instância real (ver plano de validação em `docs/PLANO_ACAO_OPENPROJECT_API.md` §7).

## Commits

Toda mensagem de commit deve começar com o ID da tarefa do `docs/BACKLOG_V0.1.md` correspondente (ex: `[OPAPI-P1] feat: adiciona resolução de custom fields`).
