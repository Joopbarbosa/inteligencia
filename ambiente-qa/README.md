# ambiente-qa

Sobe o ambiente de QA pronto (banco de teste, API a partir do jar do commit fixado, site) a partir de um arquivo de configuração, para o agente de QA não montar tudo a cada rodada. Genérico: nada é específico de um projeto.

    ./ambiente-qa.sh subir  CONFIG.env
    ./ambiente-qa.sh status CONFIG.env
    ./ambiente-qa.sh parar  CONFIG.env

- **Jar do commit certo:** cria uma worktree própria em `REF`, faz o build e copia o jar (nunca reaproveita `target/` de outra árvore). Se `VERIFICA_CLASSE` e `VERIFICA_TEXTO` estão na configuração, recusa o jar que não os contenha. Mostra `commit` e início do SHA-256 em `status`.
- **Travas:** `DB_CONTAINER` e `DB_NAME` devem começar com `test_`; portas de `PORTAS_PROIBIDAS` (padrão 3000 e 8080) são recusadas. Nunca usa `prune`.
- **Segredos:** ficam em `API_ENV_FILE` (`KEY=VALUE`), fora do repositório; o script só os exporta para a API.
- **Estado:** pids, logs e jar em `~/.cache/ambiente-qa/<NOME>`. `parar` encerra API e site e para o contêiner do banco (não o apaga).
- **Fora do escopo:** criar a conta de teste do E2E (use `POS_SUBIR`, um comando livre) e rodar as suítes.

Ver `exemplo-pense-precifique.env`. Tarefa de origem: #1049 (projeto Pipeline de Desenvolvimento).
