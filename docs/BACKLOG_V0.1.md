# Backlog — inteligencia/openproject-api — V0.1

**Branch:** `main` (repositório nasce com o fork — ver P1)
**Tarefa âncora (OpenProject):** N/A — ferramenta de integração com o próprio OpenProject, ainda sem tarefa registrada lá (chicken-and-egg: é o que estamos construindo)
**Versão atual:** N/A → **destino:** V0.1 (as 4 prioridades funcionando + consolidação do Script OP)
**Tipo do pocket:** Infraestrutura
**Objetivo:** Fork do `openproject-mcp-server` validado e estendido para criar tarefa com custom fields, mudar status, editar tarefa e criar versão — consolidando o Script OP como uma tool a mais.
**Data da abertura:** 04/09/2026

> **Regra de uso:** este documento é o PRONTUÁRIO — estado atual das tarefas.
> Cada tarefa corresponde 1:1 a um item da Seção 3 (`Gaps a fechar, por prioridade`) do
> `PLANO_ACAO_OPENPROJECT_API.md` — consultar lá o detalhe técnico completo antes de iniciar.
> Texto completo da decisão de arquitetura NÃO vive aqui — só a referência (Seção 1 do plano).

---

## Último Handoff

**Data:** 04/09/2026
**Sessão:** Análise (skill `/analise`, adaptada para pocket greenfield — investigação executada nesta mesma sessão)
**O que foi feito:** Clonado (read-only, em `/tmp`, fora do projeto) o `openproject-mcp-server` real e lido o código-fonte completo de `client.py`/`work_packages.py`/`versions.py`. Achados registrados em `investigacao/INVESTIGACAO_V0.1_P001.md`: (1) `lockVersion` já tratado em `update_work_package` — reduz escopo de P2/P3; (2) bug real em `create_version` (`due_date`/`end_date` incompatíveis) — vira correção dentro de P4; (3) confirmado gap real de custom fields em P1 (zero código relacionado no fork). Análise de P1, P2 e P4 preenchida no backlog.
**Próximo passo:** Fazer o fork de fato (`git clone` para dentro de `inteligencia/openproject-api/`, não mais em `/tmp`) e implementar o Backend de P1 (custom fields) — P2 e P3 ficam mais simples do que o previsto, P4 ganhou a correção do bug.
**Estado do git:** `inteligencia/openproject-api/` ainda não é um repositório git — só tem `docs/`. O clone de investigação foi feito em `/tmp` (scratchpad da sessão), não faz parte do projeto.

---

## Resumo de Estado

| # | Tarefa | Gravidade | Análise | Backend | Teste |
|---|--------|-----------|---------|---------|-------|
| P1 | Fork + custom fields em criar/editar tarefa | Alta | ✅ | ⬜ | ⬜ |
| P2 | Validar mudar status (`lockVersion` já tratado no fork) | Alta | ✅ | ⬜ | ⬜ |
| P3 | Editar tarefas (campos gerais) | Normal | ⬜ | ⬜ | ⬜ |
| P4 | Criar versões + corrigir bug `due_date`/`end_date` | Normal | ✅ | ⬜ | ⬜ |
| P5 | Consolidar Script OP (import CSV em lote) | Normal | ⬜ | ⬜ | ⬜ |

Legenda: ⬜ não iniciado · 🟡 em andamento · ✅ concluído · — não se aplica

> **Regra:** ao marcar `[x]` numa tarefa abaixo, sincronizar esta tabela NO MESMO MOMENTO.
> **Design** e **Frontend** foram omitidos desta tabela — não se aplicam a este pocket (é uma ferramenta de infraestrutura, sem interface).

---

## Tarefas

### P1 — Fork do `openproject-mcp-server` + custom fields em `create_work_package`/`update_work_package`

**Gravidade:** Alta *(bloqueia P2, P3 e P4 — é quem cria o código dentro de `inteligencia/openproject-api/`)*
*Contexto relatado:* O fork ainda não existe. É a prioridade #1 de João (criar tarefa com os customfields corretos) e o gap real do MCP de terceiros — ele não documenta suporte a custom fields, e é exatamente o que o Script OP já resolve.

- [x] **Análise:** feita em `investigacao/INVESTIGACAO_V0.1_P001.md` (clone real do fork, leitura de código). Causa raiz do gap: `create_work_package` (`src/client.py:225-288`) e `update_work_package` (`src/client.py:434-508`) nunca tratam custom fields — zero menção no código (só falsos positivos em `weekly_reports.py`). Estrutura real difere do assumido: FastMCP + Pydantic (`src/tools/work_packages.py:17-45`, modelos `CreateWorkPackageInput`/`UpdateWorkPackageInput`) + `aiohttp` async, não a estrutura flat assumida antes. `create_work_package` usa padrão form-based (`POST /work_packages/form` → enriquece → `POST /work_packages`) — decisão de implementação: confirmar empiricamente se o form já retorna slots de custom field antes de decidir entre sobrescrever `payload["_links"]` do form ou montar do zero como o Script OP faz.
- [ ] **Backend:**
  - Fazer fork/clone de `github.com/AndyEverything/openproject-mcp-server` para dentro de `inteligencia/openproject-api/`
  - Adicionar campo `custom_fields: Optional[dict]` em `CreateWorkPackageInput`/`UpdateWorkPackageInput` (`src/tools/work_packages.py:17-45`)
  - Portar `custom_fields.py` (`resolve_href`, `resolve_custom_fields`) e `config/custom_fields_map.yaml` do Script OP (`Infraestrutura/Script OP/src/script_op/custom_fields.py` e `config/custom_fields_map.yaml`)
  - Expor no payload de `create_work_package`/`update_work_package` (`src/client.py`) como `customFieldN: {href: "/api/v3/custom_options/N"}`
  - Configurar `.env`/`.env.example` (`OPENPROJECT_URL`, `OPENPROJECT_API_KEY`) — ver Seção 5 do plano
- [ ] **Teste:** criar 1 work package real de teste com pelo menos um custom field (ex.: Sistema), confirmar via `GET` que o valor foi de fato aplicado

*(Melhoria futura, não bloqueante: trocar o mapa estático YAML por descoberta dinâmica via `GET /api/v3/custom_options` — registrar como item futuro, não fazer agora.)*

---

### P2 — Mudar status das tarefas

**Gravidade:** Alta
*Contexto relatado:* `update_work_package(status_id=...)` já existe no fork. Escopo reduzido pela investigação do P1.

- [x] **Análise:** confirmado em `investigacao/INVESTIGACAO_V0.1_P001.md` — `src/client.py:446` (`update_work_package`) já faz `GET` do work package e lê `lockVersion` antes do `PATCH` (linha 449). **Não há gap a implementar aqui**, só validar contra a instância real.
- [ ] **Backend:** nenhum código novo esperado — só rodar e confirmar. Se algum caso de borda falhar (ex.: status transition não permitida pelo workflow do OpenProject), documentar o erro retornado.
- [ ] **Teste:** mudar o status de 1 work package de teste (pós-P1, mesmo ambiente) e confirmar via `GET` que o novo status foi aplicado; testar também o caso de `lockVersion` desatualizado (deve falhar com erro claro, não silenciosamente)

---

### P3 — Editar tarefas (campos gerais)

**Gravidade:** Normal
*Contexto relatado:* `update_work_package` do fork hoje aceita `subject`, `description`, `type_id`, `status_id`, `priority_id`, `assignee_id`, `percentage_done` — falta confirmar se cobre o necessário.

- [ ] **Análise:** listar quais campos de edição são realmente necessários no dia a dia (ex.: mudar versão de uma tarefa?) e comparar com o que o fork já aceita
- [ ] **Backend:** se faltar campo, estender `update_work_package` (reaproveitando o tratamento de `lockVersion` do P2); custom fields na edição já resolvidos pelo P1
- [ ] **Teste:** editar 1 work package de teste em pelo menos 2 campos diferentes (ex.: `subject` + `priority_id`) numa única chamada, confirmar via `GET`

---

### P4 — Criar versões

**Gravidade:** Normal *(subiu de "só validar" para "tem bug real a corrigir", achado durante a investigação do P1)*
*Contexto relatado:* `create_version` já existe no fork (`name`, `description`, `start_date`, `due_date`, `status`).

- [x] **Análise:** feita em `investigacao/INVESTIGACAO_V0.1_P001.md` — **bug confirmado por leitura de código**: `src/tools/versions.py:94` monta `data["due_date"] = input.due_date`, mas `src/client.py:744` só lê `data["end_date"]` para preencher `payload["endDate"]`. Chave incompatível → o campo de data final informado pelo usuário é **descartado silenciosamente**, nunca chega na API do OpenProject.
- [ ] **Backend:** corrigir a incompatibilidade de chave (`due_date` vs `end_date`) em `src/tools/versions.py` ou `src/client.py` — escolher um nome e alinhar as duas pontas
- [ ] **Teste:** criar 1 versão de teste num projeto de teste **incluindo data final**, confirmar via `list_versions`/`GET` que `endDate` foi de fato aplicado (não só que a versão foi criada)

---

### P5 — Consolidar o Script OP (import CSV em lote)

**Gravidade:** Normal *(só inicia depois de P1 a P4 validados — é o item que aposenta o Script OP)*
*Contexto relatado:* O Script OP resolve bem o import em lote via CSV, mas vive fora do novo canal único. Consolidar evita ter duas fontes de verdade para o OpenProject.

- [ ] **Análise:** confirmar que P1 (custom fields) já cobre tudo que `Script OP/src/script_op/custom_fields.py` fazia, antes de portar o restante
- [ ] **Backend:**
  - Portar `csv_parser.py` + `validators.py` do Script OP como uma tool nova do fork (ex.: `import_work_packages_from_csv`)
  - Reaproveitar RN-002 (campos obrigatórios), RN-003 (linha inválida não interrompe o lote), RN-005 (versão deve existir no projeto), RN-007 (validar conexão antes de processar)
- [ ] **Teste:** rodar o `exemplo.csv` real do Script OP (`Infraestrutura/Script OP/exemplo.csv`) pela tool nova e comparar resultado com o comportamento documentado do Script OP original (mesmas linhas válidas criadas, mesma linha inválida pulada)

*(Só depois deste item validado em produção, `Infraestrutura/Script OP/` é marcado como legado — não apagar antes disso.)*

---

## Fora do Escopo

- **Descoberta dinâmica de custom fields** (substituir o YAML estático por `GET /api/v3/custom_options`): melhoria futura registrada no P1, não faz parte do V0.1.
- **Tools do fork não usadas** (gestão de projetos, membros, roles, time entries, relações de hierarquia, filtros avançados): existem no fork mas nenhuma skill deve chamá-las sem uma validação dedicada própria — fora do escopo deste pocket.
- **Registro do MCP no Claude Code** (`claude mcp add ...`) e **atualização das 7 skills** para chamarem as tools novas em vez de CSV manual: dependem de P1-P5 estarem todos validados; ficam para o próximo pocket (correspondem às Seções 6 e ao item 25 replanejado do `PLANO_ACAO_MIGRACAO.md`).

---

## Referência

- Plano de ação completo (contexto, decisão de arquitetura, o que já vem pronto no fork, tools fora de escopo, autenticação, plano de validação): `PLANO_ACAO_OPENPROJECT_API.md` (nesta mesma pasta).
- Evidência de código real (fork clonado e lido linha a linha): `investigacao/INVESTIGACAO_V0.1_P001.md`.
- Decisões técnicas e estrutura de pastas (vendoring seletivo): `estrutura/ARCHITECTURE.md`.
- Prompt de setup executável (vendoring + trim + git init): `prompt/P-000_SETUP.md`.
