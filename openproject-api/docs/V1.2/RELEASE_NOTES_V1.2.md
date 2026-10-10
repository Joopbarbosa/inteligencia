# Release Notes — V1.2 — inteligencia/openproject-api

**Data:** 06/09/2026
**Commit:** `6d133bf` — `[V1.2] feat: parent_id, create_project, delete_version/work_package, paginação e mover projeto (#402-#408)`
**Escopo:** 6 features pequenas e independentes no MCP `openproject-api`, mais a criação de um projeto próprio (`inteligencia`) e migração das tarefas do pocket pra lá.

## Contexto

Nasceu de uma investigação trazida pelo usuário: `client.py` já tinha código morto tratando `parent_id` (herdado do fork original, nunca conectado à tool). Ao investigar como ativar isso, surgiram mais 5 gaps relacionados — nenhum tool de exclusão existia (dor real da correção V1.1, quando tivemos que apagar itens de teste manualmente pela UI), não dava pra criar projeto nem mover tarefa entre projetos, e a listagem de tarefas não paginava de verdade. Passou pelo pipeline completo pela primeira vez nesta ferramenta: `recepcao-analise` (tarefa âncora `#402` no OpenProject, causa raiz de cada item) → `spec-driven` (regras de comportamento em Gherkin, adaptado pra ferramenta interna em vez de produto) → Backend (implementação + validação manual).

## O que foi entregue

| Tool/campo | O que mudou | Regra |
|---|---|---|
| `create_work_package` | novo campo `parent_id` — cria a tarefa já como filha de outra | — |
| `update_work_package` | novo campo `parent_id` (aceita `null` explícito pra remover o pai) | — |
| `update_work_package` | novo campo `project_id` — move a tarefa de projeto | **RN-NOVA-3**: limpa `version_id` automaticamente se pertencer ao projeto de origem |
| `create_project` (nova tool) | cria projeto no OpenProject (`name` obrigatório, `identifier` auto-gerado se ausente) | — |
| `delete_version` (nova tool) | exclui versão/milestone | **RN-NOVA-1**: BLOQUEIO se houver tarefas vinculadas |
| `delete_work_package` (nova tool) | exclui tarefa | **RN-NOVA-2**: BLOQUEIO se houver filhos (sem cascata) |
| `list_work_packages` | pagina automaticamente por `offset` até coletar tudo (antes só avisava que havia mais) | trava de segurança: 50 páginas |

Todos os 6 itens foram validados manualmente contra a instância real do OpenProject (não só testados em isolamento) — ver `DECISOES_V1.2.md` pra evidência de cada validação (BLOQUEIOs disparando corretamente, limpeza automática de versão confirmada, paginação 86/86).

Ciclo de hierarquia em `parent_id` (tarefa pai de si mesma, ou A↔B) foi uma decisão consciente de **não** implementar validação própria — delega pra API nativa do OpenProject, documentado em `DECISOES_V1.2.md`.

## Projeto `inteligencia` criado e migração executada

Com `create_project` e o "mover projeto" prontos e validados, o próprio pocket usou as ferramentas recém-criadas (dogfooding) pra:

1. Criar o projeto `inteligencia` (id `9`) no OpenProject — âncora de rastreabilidade pra ferramentas desta pasta (`openproject-api`, `github-mcp`, futuras), que não são projetos-produto.
2. Migrar as 7 tarefas do pocket (`#402` a `#408`) do projeto `6` (Pense & Precifique, usado como âncora temporária desde a correção V1.1) pro projeto `inteligencia`.
3. Atualizar `/home/joaobarbosa/Documentos/Projetos/CLAUDE.md` (raiz) com `inteligencia: 9` na tabela de `project_id`.

Daqui pra frente, pockets novos desta ferramenta (e de outras em `inteligencia/`) usam o projeto `9`, não mais o `6`.

## Achados registrados durante o processo (não corrigidos neste pocket)

- Import circular entre `versions.py` e `work_packages.py` (`build_work_package_filters`) — só aparece se um módulo for importado isoladamente (como o teste faz), não no boot normal via `server.py`. Corrigido com import tardio, sem mudar onde a função mora.
- `list_projects`/busca por projeto (achado da correção V1.1) segue em aberto — não fazia parte deste pocket.
- `delete_project` não foi implementado — não foi pedido.

## Pendências

- **Projeto de teste `[TESTE V1.2 - APAGAR] Validação`** (id `8`), criado durante a validação manual, não foi excluído — sem `delete_project` disponível. Precisa de exclusão manual pela UI do OpenProject.
- Nenhum teste automatizado novo foi escrito para as 6 features (consistente com o padrão já existente do projeto — `client.py`/I-O de rede não tem cobertura automatizada; a garantia aqui é validação manual).

## Arquivos alterados

`src/client.py`, `src/server.py`, `src/tools/work_packages.py`, `src/tools/versions.py`, `src/tools/projects.py` (novo), `docs/V1.0/prompt/estrutura/CONTRATO_TOOLS.md`, `docs/V1.2/{POCKET,ANALYSIS,DECISOES}_V1.2.md`. O commit também consolidou a reorganização de `docs/` em pastas por pocket (`V1.0`, `V1.1`, `V1.2`), pendente havia sessões.
