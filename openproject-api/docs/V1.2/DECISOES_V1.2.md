# DECISÕES — V1.2 — inteligencia/openproject-api

> Log append-only. Nunca editar entrada antiga — correção de uma decisão anterior é entrada nova referenciando a antiga.

## 06/09/2026 — Abertura do pocket

- **Origem:** investigação de código trazida pelo usuário (achado de código morto em `src/client.py:373-383` — `update_work_package` já monta `_links.parent` a partir de `parent_id`, mas a tool Pydantic `UpdateWorkPackageInput` nunca declara esse campo, então nada chega até ali; `create_work_package` não trata `parent` em lugar nenhum).
- **Classificação:** Feature (`dicionario-demandas.md`) — "adição funcional em um fluxo que já existe... incrementos pontuais (ex: expor na API)". Gravidade não aplicável (só obrigatória para Bug/Débito Técnico).
- **Objetivo confirmado pelo usuário (06/09/2026):** poder criar tarefas filhas de uma tarefa pai já existente usando a hierarquia nativa do OpenProject (visível na UI de `#402` como "Criar novo filho"/"Adicionar filho existente") — não apenas a referência textual que a skill `recepcao-analise` usa hoje pra quebra de tarefas (`anti-padroes.md`: "não presumir uma ferramenta de relação entre tarefas no MCP... rastreabilidade é por referência textual").
- **Tarefa âncora `#402`** criada no projeto `6` (Pense & Precifique) — `inteligencia/openproject-api` não tem projeto próprio no OpenProject; decisão de usar o projeto 6 como âncora de rastreabilidade foi tomada na correção V1.1 anterior (`ACHADO_V1.1_LIST_PROJECTS.md`), mantida aqui pela mesma razão.
- **Sem branch dedicada:** repositório `inteligencia/openproject-api` é local, sem remote no GitHub (`git remote -v` vazio, `git branch -a` só lista `main`). Decisão explícita do usuário nesta sessão: não criar branch nem tratar como pocket completo do pipeline principal — trabalho segue direto na `main`.
- **Achado paralelo, fora do escopo deste pocket:** o repositório tem mudanças não commitadas de sessões anteriores (reorganização de `docs/` flat para `docs/V1.0/`, mais os arquivos de `docs/V1.1/`) — `git status` mostra os arquivos antigos como deletados e as pastas novas como não rastreadas. Não resolvido nesta sessão; fica registrado para quando o usuário decidir commitar.

## 06/09/2026 — Ampliação de escopo: create_project, delete_version, delete_work_package

- **Origem:** pergunta do usuário sobre se o MCP consegue criar projetos e excluir versões — motivada pela dor concreta da correção V1.1 (tivemos que apagar `#397`/`#24`/`#25` manualmente pela UI porque não existe `delete` de nenhum tipo no MCP).
- **Confirmado por `grep -n "async def " src/client.py`:** não existem `create_project`, `delete_version` nem `delete_work_package` hoje. Não é limitação da API v3 do OpenProject (suporta `POST /projects`, `DELETE /versions/{id}`, `DELETE /work_packages/{id}`) — é gap de vendorização, mesma categoria do achado `list_projects` (V1.1).
- **`check_permissions` confirmado:** usuário autenticado é `admin`, permissão suficiente para as 3 operações novas.
- **Decisão:** escopo do pocket V1.2 ampliado de "só `parent_id`" para incluir as 3 tools novas. Perguntado explicitamente ao usuário antes de ampliar (regra da skill: crescimento de escopo é alertado assim que detectado, nunca só reportado depois). Usuário confirmou incluir as 3, incluindo `delete_work_package` (opção mais ampla oferecida).
- **Fora do escopo mesmo assim:** `list_projects`/busca por projeto (já é item de backlog separado, aberto na correção V1.1, não duplicado aqui) e `delete_project` (não foi pedido).

## 06/09/2026 — Ampliação de escopo (2): paginação + mover tarefa de projeto, criação do projeto `inteligencia`

- **Origem:** usuário pediu (a) corrigir a limitação de paginação de `list_work_packages` (hoje só traz ~100 e avisa, não busca o resto) e (b) reverteu a decisão anterior de usar o projeto `6` como âncora permanente — decidiu criar um projeto dedicado `inteligencia` no OpenProject e migrar as tarefas deste pocket (e futuras) pra lá.
- **Achado adicional durante a investigação da migração:** `update_work_package` não tem como mudar o projeto de uma tarefa (`project_id` não é tratado nem no client nem na tool) — sem isso não dava pra cumprir o pedido (b). Confirmado por leitura direta de `client.py::update_work_package` (nenhuma ocorrência de "project" no corpo do método).
- **Decisão:** ampliar o pocket para 6 tarefas, criando `#407` (paginação) e `#408` (mover tarefa de projeto). Confirmado com o usuário via pergunta explícita antes de ampliar (regra da skill).
- **Sequenciamento da migração (decidido com o usuário):** não criar o projeto `inteligencia` manualmente agora — esperar `#404` (create_project) e `#408` (mover projeto) serem implementados e validados, e usar essas próprias tools novas para criar o projeto e migrar `#402`-`#408` pra lá (dogfooding). Motivo: usa a Fase de Backend deste mesmo pocket como validação real das duas features, em vez de contornar manualmente como fizemos na V1.1 (que não tinha alternativa disponível na hora).
- **Ação futura registrada:** depois da migração, atualizar `/home/joaobarbosa/Documentos/Projetos/CLAUDE.md` (raiz) com o `project_id` do projeto `inteligencia`, na mesma tabela do `project_id: 6`.

## 06/09/2026 — Spec-driven: entrevista de refinamento (Fase 2) e registros provisórios (Fase 3)

- **Nota de adaptação:** este projeto não tem `modulos/[MODULO]/regras-*.md`/`cenarios-*.md` — é ferramenta interna sem regra de negócio de produto. Decisão (confirmada com o usuário): mesmo assim usar o formato Gherkin completo da skill (RN-NOVA/CEN-NOVO/UC-NOVO) para as decisões que definem comportamento real da ferramenta (classificação BLOQUEIO/AVISO), documentando comportamento do *sistema* (o MCP) em vez de regra de *negócio*. **Destino provisório** de todo RN/cenário abaixo: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (documento mestre análogo desta ferramenta — seção "Erros" já usa o vocabulário BLOQUEIO), não `modulos/[MODULO]/`.
- **Fase 3.5 (validação cruzada) pulada explicitamente:** não existe `regras-[modulo].md`/script aplicável para esta ferramenta — não há arquivo mestre de regras pra checar duplicidade contra. Todos os itens abaixo nascem como `NOVA`/`NOVO` sem checagem cruzada por esse motivo, não por omissão.
- **Ator único em todos os cenários abaixo:** "Sessão do Claude Code" (ou qualquer cliente MCP), operando via `openproject-api` em nome de um usuário humano autenticado (hoje sempre `admin`, ver `check_permissions` na correção V1.1).
- **Itens do pocket sem RN/cenário (classificados explicitamente, não implícito):**
  - `#404` (create_project) — decisão sobre `identifier` ausente é contrato técnico de input, não regra de comportamento: **N/A — decisão de contrato.** Segue o padrão de `create_version` (campo opcional, resto por conta da API); registrado direto no `CONTRATO_TOOLS.md` na fase de Backend, sem RN.
  - `#407` (paginação) — **N/A — Estrutural.** Corrige busca incompleta, não define uma regra de comportamento nova nem cenário de erro (não há BLOQUEIO/AVISO envolvido, é completude de busca).

### RN-NOVA-1 — Bloqueio de exclusão de versão com tarefas vinculadas
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`delete_version`)

A tool `delete_version` deve recusar a exclusão de uma versão do OpenProject se
houver alguma tarefa (work package) vinculada a ela (`_links.version` apontando
pra essa versão) — a ferramenta não desvincula tarefas em massa sem ação
explícita do usuário. Usuário precisa reatribuir ou remover a versão de cada
tarefa vinculada primeiro (via `update_work_package`, `version_id: null`),
depois excluir a versão.

Motivo: exclusão em cascata de vínculo silencioso é o tipo de ação que a
correção V1.1 já mostrou ser fácil de fazer sem querer (tivemos que apagar
manualmente versões de teste) — bloquear por padrão evita desvincular tarefas
reais sem intenção.
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### CEN-NOVO-1 — Tentativa de excluir versão com tarefas vinculadas
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`delete_version`)

Dado que a versão `V0.8.4` (id 26) tem tarefas vinculadas (`_links.version`)
Quando a sessão do Claude Code chama `delete_version` com esse id
Então a tool recusa a exclusão
E retorna mensagem indicando quantas tarefas estão vinculadas e que precisam
ser reatribuídas antes
E a versão continua existindo, sem alteração

Tipo de erro: BLOQUEIO (critério 1 e 2 de `classificacao-bloqueio-aviso.md` —
desvincular tarefas em massa não é barato de reverter e pode deixar tarefas
sem versão sem intenção do usuário).
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### RN-NOVA-2 — Bloqueio de exclusão de tarefa com filhos
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`delete_work_package`)

A tool `delete_work_package` deve recusar a exclusão de uma tarefa que tenha
filhos (sub-tarefas via `parent_id`) — sem exclusão em cascata. Usuário precisa
excluir ou reatribuir os filhos (mudando o `parent_id` deles) antes de excluir
a tarefa pai.

Motivo: exclusão em cascata é irreversível e cara de reverter (critério 1 de
`classificacao-bloqueio-aviso.md`) — perder sub-tarefas reais como
efeito colateral de excluir a tarefa pai é um risco alto demais para ser o
comportamento padrão.
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### CEN-NOVO-2 — Tentativa de excluir tarefa com filhos
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`delete_work_package`)

Dado que a tarefa `#402` tem filhos (`#403` a `#408`, via `parent_id`)
Quando a sessão do Claude Code chama `delete_work_package` com o id `402`
Então a tool recusa a exclusão
E retorna mensagem indicando quais tarefas filhas existem e que precisam ser
excluídas ou reatribuídas antes
E a tarefa `#402` continua existindo, sem alteração

Tipo de erro: BLOQUEIO (mesmo critério do CEN-NOVO-1 — irreversibilidade).
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### RN-NOVA-3 — Limpeza automática de version_id ao mover tarefa de projeto
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`update_work_package` — campo `project_id`)

Ao mover uma tarefa para outro projeto via `update_work_package` com
`project_id` novo, se a tarefa tiver um `version_id` atribuído, esse vínculo é
removido automaticamente (versão pertence ao projeto de origem, não faz
sentido no destino) — a tool limpa `version_id` proativamente no mesmo
`PATCH`, em vez de deixar a API rejeitar por referência inválida ou aceitar
uma referência quebrada.

Motivo: evita erro confuso da API (referência de versão de outro projeto) e
evita que a tarefa fique com um vínculo de versão que não existe no contexto
novo — decisão tomada com o usuário em vez de descoberta por tentativa e erro
depois.
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### CEN-NOVO-3 — Mover tarefa com versão atribuída para outro projeto
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md` (`update_work_package` — campo `project_id`)

Dado que a tarefa `#402` está no projeto `6` (Pense & Precifique) sem `version_id` atribuído
Quando a sessão do Claude Code chama `update_work_package` com `project_id`
apontando para o projeto `inteligencia`
Então a tarefa passa a pertencer ao projeto `inteligencia`
E nenhum campo de versão precisa ser limpo neste caso (não havia `version_id`)

Cenário complementar (caso composto — com versão atribuída):
Dado que uma tarefa X do projeto `6` tem `version_id` apontando para `V0.8.4` (id 26)
Quando a sessão do Claude Code move essa tarefa para outro projeto via `project_id`
Então a tool remove o `version_id` automaticamente antes/junto do `PATCH`
E a tarefa aparece no projeto novo sem versão atribuída
E nenhum erro de referência inválida é retornado pela API

Tipo: não é erro — é comportamento normal com efeito colateral explícito (não
se aplica classificação BLOQUEIO/AVISO, é a regra RN-NOVA-3 em ação).
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

### UC-NOVO-1 — Migrar tarefas do pocket para o projeto `inteligencia`
Destino: `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md`

Ator: Sessão do Claude Code (em nome do usuário)
Pré-condição: `#404` (create_project) e `#408` (mover projeto, com RN-NOVA-3)
implementados e validados manualmente contra a instância real.
Fluxo principal:
1. Sessão chama `create_project` para criar o projeto `inteligencia`.
2. Sessão confirma a criação via reconsulta (não confia só na resposta do create).
3. Para cada tarefa do pocket (`#402` a `#408`), sessão chama `update_work_package`
   com `project_id` apontando para o projeto `inteligencia` recém-criado
   (RN-NOVA-3 se aplica a qualquer uma que tenha `version_id`).
4. Sessão reconsulta cada tarefa migrada via `get_work_package`, confirmando
   `Project: inteligencia`.
5. `CLAUDE.md` (raiz) é atualizado com o novo `project_id`.
Fluxo alternativo: se `create_project` falhar (nome duplicado, permissão), a
migração é abortada antes do passo 3 — nenhuma tarefa é movida sem o projeto
de destino confirmado existente.
[confirmado em V1.2 — pendente de numeração definitiva na Retomada]

## 06/09/2026 — Backend: implementação e validação manual concluídas

- **Implementado:** `src/client.py` (parent_id em create/update, project_id em update com RN-NOVA-3, `delete_version`, `delete_work_package`, `create_project`, paginação real em `list_work_packages`), `src/tools/work_packages.py` (campos novos + tool `delete_work_package` com RN-NOVA-2), `src/tools/versions.py` (tool `delete_version` com RN-NOVA-1), `src/tools/projects.py` (novo arquivo, `create_project`), `src/server.py` (registra o módulo novo).
- **Achado durante a implementação:** import circular entre `versions.py` e `work_packages.py` (`build_work_package_filters`), só aparece quando um módulo é importado isoladamente (como faz `tests/test_work_packages_filters.py`), não quando o boot começa por `src/server.py`. Corrigido com import tardio (dentro da função `delete_version`, não no topo do arquivo) — decisão de manter `build_work_package_filters` onde está (o teste existente depende desse caminho de import) em vez de mover a função de lugar.
- **Testes existentes:** os 13 testes automatizados (`test_work_packages_filters.py`, `test_custom_fields.py`) passaram sem alteração — nenhum teste novo foi escrito para as features de V1.2 (o padrão do projeto, confirmado na Fase 2 da `recepcao-analise`, é não mockar `aiohttp`/`client.py`; a garantia de qualidade aqui é a validação manual contra a instância real, não teste automatizado).
- **Validação manual (regra do projeto: nenhuma tool sem validação antes de expor):** rodada contra a instância real via script isolado chamando `server.mcp.call_tool()` diretamente (a conexão MCP já aberta nesta sessão do Claude Code roda o código antigo — só seria atualizada reiniciando a conexão, o que a sessão não consegue fazer sozinha). Resultado, os 6 itens confirmados:
  - `parent_id` no create: `#409` criado já como filho de `#402` — confirmado.
  - `parent_id` no update: `#410` reatribuído para `#409` e depois removido (`parent_id: null`) — ambos confirmados via `get_work_package`.
  - `create_project`: projeto `#8` criado, identifier auto-gerado pela API (decisão de contrato) — confirmado.
  - `delete_version` (RN-NOVA-1): versão `#27` com 1 tarefa vinculada — BLOQUEIO correto; após excluir a tarefa, exclusão funcionou.
  - `delete_work_package` (RN-NOVA-2): tarefa `#409` com filho `#410` — BLOQUEIO correto; após excluir o filho, exclusão do pai funcionou.
  - Mover projeto + RN-NOVA-3: tarefa `#412` (version_id=28 no projeto 6) movida pro projeto `#8` — `_links.project` atualizado e `_links.version` limpo automaticamente, sem erro de referência inválida.
  - Paginação (#407): `page_size=5` forçado no projeto 6 (86 tarefas reais) — total reportado pela API (86) bateu com os elementos coletados pelo loop (86).
- **Resíduo não resolvido:** o projeto de teste `#8` não foi excluído (sem `delete_project`, fora do escopo deste pocket) — precisa de exclusão manual pela UI, mesmo padrão da correção V1.1. Todas as tarefas/versões de teste criadas durante a validação foram limpas usando as próprias tools novas (`delete_work_package`/`delete_version`).
- **Status no OpenProject:** `#403`-`#408` atualizadas para "Pronto para commitar". Nenhum commit git foi feito — aguardando decisão do usuário (regra: só commitar quando pedido).

## 06/09/2026 — Migração executada: projeto `inteligencia` (id `9`) criado, #402-#408 migrados

- Com `#404` e `#408` implementados e validados, o plano de migração registrado na tarefa `#402` foi executado no mesmo dia: `create_project` criou o projeto `inteligencia` (id `9`, identifier `inteligencia`), e `update_work_package` (`project_id`) moveu `#402` a `#408` pra lá — reconfirmado individualmente via `get_work_package` (todos com `_embedded.project.name = "inteligencia"`).
- `/home/joaobarbosa/Documentos/Projetos/CLAUDE.md` (raiz) atualizado com `inteligencia: 9` na tabela de `project_id`, ao lado do `Pense & Precifique: 6` já existente.
- **A partir de agora**, qualquer pocket novo de `inteligencia/openproject-api` (ou de outra ferramenta em `inteligencia/`, ex. `github-mcp`) usa o projeto `inteligencia` (id `9`) como âncora — não mais o `6`.
- Commit do código desta versão: `[V1.2] feat: parent_id, create_project, delete_version/work_package, paginação e mover projeto (#402-#408)` — inclui também a reorganização de `docs/` em `V1.0`/`V1.1`/`V1.2`, herdada de sessões anteriores nunca commitada.

### Nota — Ciclo em parent_id (#403), decisão de não-decisão

Confirmado com o usuário: **não implementar validação própria de ciclo** (tarefa
pai de si mesma, ou A↔B) no MCP agora. Decisão é confiar no comportamento
nativo da API do OpenProject e testar empiricamente durante a validação manual
do Backend. **Não é um RN-NOVA** — é uma pergunta em aberto da `ANALYSIS_V1.2.md`
resolvida como "testar primeiro, decidir depois": se a API v3 já rejeitar
ciclos nativamente, a tool só precisa repassar o erro dela (documentar em
`CONTRATO_TOOLS.md`, seção Erros); se a API NÃO rejeitar, isso vira um achado
novo a levar de volta ao usuário antes de decidir se cria uma RN de validação
própria.
