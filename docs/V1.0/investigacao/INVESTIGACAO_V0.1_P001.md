# Investigação - V0.1 - P001

**Tarefa âncora:** N/A — pocket sem tarefa no OpenProject ainda (ver `BACKLOG_V0.1.md`)
**Tarefa(s) vinculada(s):** P1 — Fork do `openproject-mcp-server` + custom fields em `create_work_package`/`update_work_package`
**Tipo:** Feature nova / múltiplas frentes (código de dois projetos diferentes) → julgamento, prompt individual
**Meta do pocket:** padrão de qualidade desde o início (sem atalho por velocidade) — calibra as decisões abaixo

## Fontes carregadas

- `Infraestrutura/Script OP/CLAUDE.md`
- `Infraestrutura/Script OP/docs/ARCHITECTURE_ScriptOP_v0.md`, `BUSINESS_RULES_ScriptOP_v0.md`
- `Infraestrutura/Script OP/src/script_op/{custom_fields.py, api_client.py}`, `config/custom_fields_map.yaml`
- `inteligencia/openproject-api/docs/PLANO_ACAO_OPENPROJECT_API.md`

## Objetivo (READ-ONLY — proibido alterar qualquer arquivo)

Mapear o estado real do código do `github.com/AndyEverything/openproject-mcp-server` (ainda não clonado) para localizar EXATAMENTE onde e como implementar custom fields, como pré-requisito do P1. Nenhuma correção ou código deve ser escrito nesta etapa — só evidência.

## Perguntas a responder, com evidência exata (arquivo:linha)

1. Clonar o repositório (`git clone --depth 1 https://github.com/AndyEverything/openproject-mcp-server`) em local temporário (fora do projeto) e mapear a estrutura real de pastas/arquivos.
2. Localizar a implementação real de `create_work_package`: qual arquivo, qual função, qual formato de payload monta hoje para a API do OpenProject (`POST /api/v3/work_packages`)?
3. Localizar `update_work_package`: qual arquivo, qual função. Ele já lê `lockVersion` do work package atual antes de montar o `PATCH`? Se sim, como (função, arquivo:linha)? Se não, confirmar a ausência.
4. Confirmar como o framework (FastMCP) registra tools — decorator, arquivo central, algum registro/manifest — para saber onde registrar mudanças de assinatura se custom fields virarem parâmetro novo de `create_work_package`/`update_work_package`.
5. Confirmar se existe QUALQUER menção a "custom field"/"customField" no código (não só no README) — grep no repositório inteiro.
6. Comparar o payload de `create_work_package` do fork com o payload que o Script OP monta em `api_client.py::create_work_package` (que já inclui `customFieldN: {href: ...}` com sucesso em produção) — apontar exatamente a diferença de payload.
7. Confirmar como o fork lê autenticação (`OPENPROJECT_API_KEY`) — Bearer ou Basic Auth "apikey"? Isso muda o formato de `requests.Session`/headers a herdar.
8. Confirmar `create_version`: arquivo, função, payload atual — comparar contra `POST /api/v3/projects/{id}/versions` da documentação oficial da API v3.

## Trava de Escopo

Se a estrutura real do fork divergir muito do assumido no `PLANO_ACAO_OPENPROJECT_API.md` (ex: framework diferente, ausência de alguma tool documentada no README, arquitetura monolítica sem separação por arquivo), **PAUSAR e reportar antes de prosseguir** — não presumir e seguir adiante.

## Saída esperada

Um relatório por pergunta, com caminho de arquivo (dentro do clone) + trecho de código relevante + linha. Zero código de correção.

---

## Achados (executado em 04/09/2026)

> Clone real feito em `/tmp/.../scratchpad/openproject-mcp-server` (`git clone --depth 1`), fora do projeto. Nenhum arquivo do projeto foi alterado.

**1. Estrutura real** — diverge do assumido no plano original (assumia código mais "flat"). Real: modular, `src/{server.py, client.py, auth.py}` + `src/tools/{work_packages.py, versions.py, projects.py, users.py, memberships.py, hierarchy.py, relations.py, time_entries.py, weekly_reports.py, news.py, connection.py}`. Framework: FastMCP (`@mcp.tool` decorator), Pydantic para validação de input, `aiohttp` (assíncrono) — não `requests` como o Script OP.

**2. `create_work_package`** — `src/client.py:225-288`. Usa padrão de 2 passos: primeiro `POST /work_packages/form` com payload mínimo (project, type, subject) para obter um payload-template válido + `lockVersion` default (linha 251-255); depois enriquece esse payload com campos opcionais (`description`, `priority`, `assignee`, `version`, datas) e só então faz o `POST /work_packages` real (linha 288). **Não adiciona custom fields.**

**3. `update_work_package`** — `src/client.py:434-508`. **Já busca `lockVersion` antes do PATCH** (linha 446: `current_wp = await self.get_work_package(work_package_id)`), incluindo no payload (linha 449). O gap assumido no plano original (§3, P2) **não existe** — reduz o escopo de P2 e P3 a "validar", não "implementar". **Não adiciona custom fields.**

**4. Registro de tools (FastMCP)** — `src/server.py`: `mcp = FastMCP(name="openproject-mcp")`; cada tool é uma função `async def` decorada com `@mcp.tool` em `src/tools/*.py`, com um modelo Pydantic de input quando há muitos campos (`CreateWorkPackageInput`, `UpdateWorkPackageInput` em `src/tools/work_packages.py:17-45`; `CreateVersionInput` em `src/tools/versions.py:8-15`). Para adicionar `custom_fields` como parâmetro, o ponto de entrada é: (a) novo campo `Optional[dict]` nesses modelos Pydantic, (b) repassar para `client.create_work_package`/`update_work_package`, (c) tratar em `client.py` como novo `if "custom_fields" in data: payload["_links"].update(...)`.

**5. Menções a "custom field" no código** — nenhuma (grep confirma; os únicos matches são "custom processing"/"custom visualizations" em `weekly_reports.py`, sem relação). Gap confirmado, exatamente como o README sugeria.

**6. Comparação de payload com o Script OP** — Script OP (`api_client.py::create_work_package`) monta o payload inteiro na mão e inclui `customFieldN: {href: ...}` direto em `_links` num único `POST`, sem etapa de form. O fork usa form-based creation. **Achado (não bloqueante):** o payload retornado por `POST /work_packages/form` pode já trazer slots de custom field em `_links` para o tipo escolhido — isso precisa ser confirmado empiricamente (chamando o form real) antes de decidir se dá pra só sobrescrever `payload["_links"]["customFieldN"]` (mais robusto, aproveita validação do form) ou se precisa ser adicionado do zero como o Script OP faz.

**7. Autenticação** — `src/client.py:41-56`: Basic Auth, `base64("apikey:" + api_key)` no header `Authorization`. **Idêntico ao esquema do Script OP** (`requests.Session` com `auth=("apikey", token)`), só muda a lib (aiohttp async vs requests sync). Nenhuma adaptação de esquema de auth necessária.

**8. `create_version`** — `src/client.py:721-749` + `src/tools/versions.py:68-115`. **Bug real encontrado** (fora do escopo do que a Trava de Escopo cobre — item pequeno, não requer pausar): a tool aceita `due_date` do usuário (`versions.py:94`, `data["due_date"] = input.due_date`), mas `client.py:744` só lê `data["end_date"]` para montar `payload["endDate"]` — chave incompatível, `due_date` é **descartado silenciosamente**, nunca chega na API. Confirmado por leitura direta do código (não é suposição). Precisa de correção de 1 linha em `versions.py` (usar `end_date` em vez de `due_date`, ou alinhar `client.py` para aceitar `due_date`) antes do P4 ser considerado validado.

### Cruzamento (Fase 3)

- Achado 3 (lockVersion já tratado) **reduz** o escopo de P2 e P3 no `BACKLOG_V0.1.md` — de "portar padrão" para "só validar".
- Achado 8 (bug end_date/due_date) **é uma tarefa nova** dentro do escopo de P4 — registrado no backlog como sub-item de correção, não como tarefa separada (é a mesma tool).
- Achado 6 é uma dependência real de P1: antes de escrever código, confirmar via chamada real ao `/work_packages/form` se custom fields já aparecem no payload-template.

### Documentação desatualizada (Fase 5)

`PLANO_ACAO_OPENPROJECT_API.md` §2 e §3 (P2) foram escritos antes desta investigação e presumiam que `lockVersion` precisaria ser portado manualmente — **incorreto**, já existe no fork. Atualizado nesta sessão (ver plano).
