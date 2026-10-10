# Achado — V1.1 — MCP do OpenProject sem busca/listagem de projetos

**Tarefa âncora:** N/A — achado de ferramenta, registrado fora de pocket (ainda não existe `BACKLOG_V1.1.md`)
**Origem:** sessão de 05/09/2026, durante a criação das 4 tarefas de Frontend deferidas da Retomada P-R001 (V0.8.3) e da versão `V0.8.4` no projeto "Pense & Precifique" (ver `docs-pense-precifique/version/V0.8.3/BACKLOG_V0.8.3.md`)
**Tipo:** Achado de ferramenta (gap de funcionalidade) — read-only, nenhum código alterado

## Achado

O servidor MCP do OpenProject conectado a este projeto (`inteligencia/openproject-api`) não expõe uma ferramenta de `list_projects` ou busca por texto/nome de projeto. Para descobrir o `project_id` correto (necessário antes de criar versão ou tarefa), foi preciso contornar via `curl` direto na API REST do OpenProject, fora do MCP.

**Impacto:** qualquer sessão futura que precise criar/consultar recursos em um projeto do OpenProject pela primeira vez (sem o `project_id` já conhecido) vai precisar do mesmo contorno manual, a menos que o MCP seja atualizado com uma ferramenta de listagem/busca de projetos, ou que o `project_id` do projeto em questão já esteja registrado em algum lugar de referência fixa.

## Investigação (código real, read-only)

Confirmado por leitura de `src/server.py`, `src/tools/*.py`, `src/client.py`, `README.md`, `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` e `docs/V1.0/prompt/estrutura/ARCHITECTURE.md`:

1. **Tools registradas hoje:** `test_connection`, `check_permissions` (`src/tools/connection.py`); `create_work_package`, `update_work_package`, `get_work_package`, `list_work_packages`, `list_types`, `list_statuses`, `list_priorities` (`src/tools/work_packages.py`); `list_versions`, `create_version` (`src/tools/versions.py`). Nenhuma tool de projeto.
2. **`src/client.py`** só referencia sub-recursos de `/projects/{project_id}/...` (types, versions, work_packages) — nunca chama o endpoint de coleção `GET /projects`.
3. **`ARCHITECTURE.md` §3** confirma que um `src/tools/projects.py` existia no fork original (`AndyEverything/openproject-mcp-server`) e foi **descartado deliberadamente** na vendorização seletiva, junto com `hierarchy.py`, `memberships.py`, `time_entries.py` etc., por não fazer parte das 4 prioridades originais deste projeto.
4. **Confirmação empírica do `project_id` usado nesta sessão:** `project_id = 6` corresponde ao projeto "Pense & Precifique" — confirmado tanto pelo campo `Project` retornado por `get_work_package`/`list_versions` quanto pelo dump `_migration_dumps/openproject.sql` (`COPY public.projects`: `6 | Pense & Precifique | ...`).

## Onde implementar, se a tool for adicionada

Seguindo o padrão existente (`versions.py` é o precedente estrutural mais próximo):
- Novo `src/tools/projects.py` (modelo Pydantic de input + função `@mcp.tool`, registrada via import em `src/server.py`).
- Novo método em `src/client.py` (ex.: `get_projects()` chamando `GET /projects`, com filtro por nome se a API v3 suportar).
- Atualizar `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` ("Atualizar a cada tool criada/alterada") e a tabela "Onde cada coisa vai" do `CLAUDE.md` deste projeto.

Este achado só documenta o gap — nenhum código foi criado nesta sessão (`src/tools/projects.py` não existe ainda). Decisão de priorizar essa tool fica para o backlog de V1.1.

## Sugestão sobre o `project_id: 6` — decisão final

A sugestão original era registrar `project_id: 6` como referência fixa em algum documento canônico (ex.: `PIPELINE_DESENVOLVIMENTO.md` ou um `CLAUDE.md`). **Decisão: não registrar dentro de `inteligencia/openproject-api`** (nem em `src/`, nem em `CLAUDE.md`/`docs/` deste projeto) — este é um servidor MCP genérico, reaproveitado por qualquer projeto que use OpenProject; hardcodar o `project_id` de um projeto específico aqui acopla uma ferramenta compartilhada a um único projeto (ver memória `nao-adiantar-scripts-sem-autorizacao`).

Também descartada a opção de registrar dentro do `CLAUDE.md` do próprio "Pense & Precifique": esse arquivo só é lido automaticamente em sessões abertas dentro daquele projeto — não ajudaria uma sessão aberta na raiz de `Projetos/` (ou em outro projeto) que precise chamar o mesmo MCP.

**Registrado em `/home/joaobarbosa/Documentos/Projetos/CLAUDE.md`** (raiz), seção "Skills e inteligência" — esse arquivo é lido automaticamente em toda sessão aberta em qualquer ponto de `Projetos/` (o Claude Code sobe a árvore de diretórios a partir do cwd carregando o `CLAUDE.md` de cada pasta ancestral), então é o único ponto que garante a leitura automática independente de qual projeto a sessão está trabalhando. A tabela já está preparada para receber o `project_id` de "Pense & Car" e "Pense & Estude" quando esses projetos tiverem instância criada no OpenProject.

## Status

- ✅ Achado documentado (este arquivo).
- ✅ Investigação de código concluída (gap confirmado, ponto de implementação mapeado).
- ⬜ Tool `list_projects`/busca por nome — não implementada (fica para backlog de V1.1, se priorizado).
- ✅ Registro do `project_id: 6` — feito em `/home/joaobarbosa/Documentos/Projetos/CLAUDE.md` (raiz), não dentro deste projeto.
