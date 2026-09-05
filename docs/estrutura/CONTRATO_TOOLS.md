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

**Efeito no payload da API**: `sistema` é resolvido para `{"customField1": {"href": "/api/v3/custom_options/N"}}` e mesclado em `payload["_links"]` **depois** do form-fetch (`POST /work_packages/form`), sobrescrevendo qualquer slot que o form já traga para o tipo escolhido.

## `list_work_packages` (P6)

**Input** (`ListWorkPackagesInput`, `src/tools/work_packages.py`):

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `project_id` | int | não | Sem ele, busca na instância inteira |
| `version_id` | int | não | Ex.: "todas as tarefas da versão X" |
| `status_id` | int | não | |
| `type_id` | int | não | |
| `assignee_id` | int | não | |

Todos os filtros são combináveis (AND). Sem nenhum filtro, lista as primeiras tarefas da instância/projeto (`pageSize=100` por página — não pagina automaticamente).

**Montagem do filtro**: `build_work_package_filters(...)` (função pura, sem I/O — `tests/test_work_packages_filters.py`) monta a lista no formato da API v3 (`filters=[{"version": {"operator": "=", "values": ["24"]}}, ...]`), passada para `client.list_work_packages(project_id, filters, page_size)`, que faz `GET /work_packages` (ou `/projects/{id}/work_packages`) com `filters` serializado e URL-encoded na query string.

**Achado real (validação P6)**: a coleção `GET /work_packages` não traz `_embedded` por elemento (diferente do `GET /work_packages/{id}` individual usado por `get_work_package`) — tipo/status/prioridade só vêm em `_links.{campo}.title`. A formatação da tool lê de `_links`, não de `_embedded`.

## `update_work_package`

Mesmo campo `sistema` adicionado em `UpdateWorkPackageInput`, mesmo comportamento de resolução — reaproveita `src/custom_fields.py`. Diferença: aqui o merge acontece no payload do `PATCH` (que já inclui `lockVersion` buscado via `GET` prévio — comportamento herdado, não alterado pelo P1).

## Erros

| Situação | Tipo | Mensagem |
|---|---|---|
| `sistema` com valor não cadastrado no YAML | BLOQUEIO | `"Valor '<X>' não configurado para a categoria 'sistema' em config/custom_fields_map.yaml. Valores válidos: [...]"` |
| `sistema` omitido | — | Nenhum custom field é enviado (comportamento igual ao pré-P1) |

## Decisão técnica: campo nomeado (`sistema: str`) em vez de dict genérico (`custom_fields: dict`)

Registrado em 05/09/2026. Hoje só existe 1 custom field ativo no fluxo (Sistema/`customField1` — Módulo e Gravidade foram removidos do OpenProject/do fluxo, ver `docs/investigacao/INVESTIGACAO_V0.1_P001.md`). Um campo nomeado com descrição específica é mais discoverável para uma tool MCP (o schema Pydantic vira parte do que o modelo vê ao decidir como chamar a tool) do que um `Dict[str, str]` genérico. Quando um novo custom field for reativado no OpenProject, adicionar um novo campo nomeado (`modulo: Optional[str]`, por exemplo) segue o mesmo padrão — não é um redesenho.
