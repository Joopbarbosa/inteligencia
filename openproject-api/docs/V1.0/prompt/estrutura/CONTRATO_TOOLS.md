# Contrato das tools MCP — inteligencia/openproject-api

> Equivalente ao `contrato-[modulo].md` do pipeline padrão, adaptado para tools MCP em vez de endpoints REST. Atualizar a cada tool criada/alterada.

## `create_work_package`

**Input** (`CreateWorkPackageInput`, `src/tools/work_packages.py`):

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `project_id` | int | sim | |
| `subject` | str | sim | 1-255 chars |
| `type_id` | int | sim | |
| `description`, `start_date`, `due_date`, `assignee_id`, `status_id`, `priority_id`, `version_id` | — | não | |
| `sistema` | str | não | **Novo (P1)**. Custom field "Sistema" do OpenProject. Valor textual, ex.: `"BackEnd"`. Resolvido via `src/custom_fields.py` contra `config/custom_fields_map.yaml`. Valor não cadastrado no mapa → erro claro listando os valores válidos (`tipo: BLOQUEIO` — a criação não prossegue). |
| `parent_id` | int | não | **Novo (V1.2, #403)**. Cria a tarefa já como filha da tarefa com esse ID (hierarquia nativa do OpenProject). Sem validação própria de ciclo — delega pra API (ver `DECISOES_V1.2.md`, nota sobre #403). |

**Efeito no payload da API**: `sistema` é resolvido para `{"customField1": {"href": "/api/v3/custom_options/N"}}` e mesclado em `payload["_links"]` **depois** do form-fetch (`POST /work_packages/form`), sobrescrevendo qualquer slot que o form já traga para o tipo escolhido. `parent_id` monta `payload["_links"]["parent"] = {"href": "/api/v3/work_packages/{id}"}`, no mesmo passo.

## `list_work_packages` (P6)

**Input** (`ListWorkPackagesInput`, `src/tools/work_packages.py`):

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `project_id` | int | não | Sem ele, busca na instância inteira |
| `version_id` | int | não | Ex.: "todas as tarefas da versão X" |
| `status_id` | int | não | |
| `type_id` | int | não | |
| `assignee_id` | int | não | |

Todos os filtros são combináveis (AND). Sem nenhum filtro, lista as tarefas da instância/projeto inteiras — **paginação automática desde V1.2** (`#407`): o client percorre `offset` até coletar tudo que a API reporta em `total`, com trava de segurança de 50 páginas (~5000 itens no `pageSize` padrão). Antes da V1.2, buscava só a primeira página (`pageSize=100`) e a tool só avisava no texto que havia mais — ver achado em `docs/V1.2/ANALYSIS_V1.2.md`.

**Montagem do filtro**: `build_work_package_filters(...)` (função pura, sem I/O — `tests/test_work_packages_filters.py`) monta a lista no formato da API v3 (`filters=[{"version": {"operator": "=", "values": ["24"]}}, ...]`), passada para `client.list_work_packages(project_id, filters, page_size)`, que faz `GET /work_packages` (ou `/projects/{id}/work_packages`) em loop, uma chamada por página, com `filters` serializado e URL-encoded na query string.

**Achado real (validação P6)**: a coleção `GET /work_packages` não traz `_embedded` por elemento (diferente do `GET /work_packages/{id}` individual usado por `get_work_package`) — tipo/status/prioridade só vêm em `_links.{campo}.title`. A formatação da tool lê de `_links`, não de `_embedded`.

## `update_work_package`

Mesmo campo `sistema` adicionado em `UpdateWorkPackageInput`, mesmo comportamento de resolução — reaproveita `src/custom_fields.py`. Diferença: aqui o merge acontece no payload do `PATCH` (que já inclui `lockVersion` buscado via `GET` prévio — comportamento herdado, não alterado pelo P1).

**Novo em V1.2:**

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `parent_id` | int ou `null` | não | `#403`. Reatribui o pai da tarefa. **Único campo do input em que `null` explícito é distinto de "campo ausente"** — ausente = não mexe no pai; `null` explícito = remove o pai atual. Implementado via `model_fields_set` do Pydantic (não `is not None`, diferente do padrão dos outros campos). |
| `project_id` | int | não | `#408`. Move a tarefa pra outro projeto. **RN-NOVA-3** (`DECISOES_V1.2.md`): se a tarefa tiver `version_id` de uma versão do projeto de origem, ele é limpo automaticamente no mesmo `PATCH` (a menos que um `version_id` novo já tenha sido enviado na mesma chamada). |

## `delete_work_package` (novo, V1.2 `#406`)

**Input** (`DeleteWorkPackageInput`, `src/tools/work_packages.py`): `work_package_id` (int, obrigatório).

**RN-NOVA-2** (`DECISOES_V1.2.md`): recusa a exclusão se a tarefa tiver filhos (`_links.children` não vazio) — sem cascata. A checagem é feita na camada de tool (via `get_work_package`), não no client — `client.delete_work_package` é só o `DELETE /work_packages/{id}` cru.

## `delete_version` (novo, V1.2 `#405`)

**Input** (`DeleteVersionInput`, `src/tools/versions.py`): `version_id` e `project_id` (ambos int, obrigatórios — `project_id` é necessário pra checar tarefas vinculadas antes de excluir).

**RN-NOVA-1** (`DECISOES_V1.2.md`): recusa a exclusão se houver tarefas vinculadas à versão (`build_work_package_filters(version_id=...)` + `list_work_packages`) — sem desvincular em massa. `client.delete_version` é só o `DELETE /versions/{id}` cru.

## `create_project` (novo, V1.2 `#404`, `src/tools/projects.py`)

**Input** (`CreateProjectInput`): `name` (str, obrigatório), `identifier` (str, opcional — se ausente, a própria API gera a partir do `name`; decisão de contrato técnico, não RN, ver `DECISOES_V1.2.md`), `description` (str, opcional).

**Efeito no payload da API**: payload direto (sem fluxo de form, diferente de `create_work_package`) — mesmo padrão de `create_version`. `POST /projects`.

## Erros

| Situação | Tipo | Mensagem |
|---|---|---|
| `sistema` com valor não cadastrado no YAML | BLOQUEIO | `"Valor '<X>' não configurado para a categoria 'sistema' em config/custom_fields_map.yaml. Valores válidos: [...]"` |
| `sistema` omitido | — | Nenhum custom field é enviado (comportamento igual ao pré-P1) |
| `delete_version` com tarefas vinculadas | BLOQUEIO | `"BLOQUEIO: a versão #<id> tem <N> tarefa(s) vinculada(s) — reatribua ou remova a versão de cada uma primeiro (update_work_package, version_id) antes de excluir."` |
| `delete_work_package` com filhos | BLOQUEIO | `"BLOQUEIO: a tarefa #<id> tem <N> filho(s) (#<ids>) — exclua ou reatribua os filhos primeiro (update_work_package com parent_id apontando pra outro pai, ou null)."` |
| `parent_id` formando ciclo (tarefa pai de si mesma, ou A↔B) | não confirmado | Delegado à validação nativa da API — não implementado no MCP (ver `DECISOES_V1.2.md`, nota #403). Se a API não bloquear, é achado novo a decidir. |

## Decisão técnica: campo nomeado (`sistema: str`) em vez de dict genérico (`custom_fields: dict`)

Registrado em 05/09/2026. Hoje só existe 1 custom field ativo no fluxo (Sistema/`customField1` — Módulo e Gravidade foram removidos do OpenProject/do fluxo, ver `docs/investigacao/INVESTIGACAO_V0.1_P001.md`). Um campo nomeado com descrição específica é mais discoverável para uma tool MCP (o schema Pydantic vira parte do que o modelo vê ao decidir como chamar a tool) do que um `Dict[str, str]` genérico. Quando um novo custom field for reativado no OpenProject, adicionar um novo campo nomeado (`modulo: Optional[str]`, por exemplo) segue o mesmo padrão — não é um redesenho.
