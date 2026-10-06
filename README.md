# leitor-fiscal

Node 24 LTS, TypeScript estrito, Fastify e Postgres próprio. Contrato: [docs/openapi.yaml](docs/openapi.yaml).

## Desenvolvimento e testes isolados

```sh
npm ci
npm run build
# Usar a .pocket.env da worktree; contém apenas banco test_* e portas próprias.
docker compose --env-file .pocket.env -f docker-compose.test.yml up -d --wait
node --env-file=.pocket.env dist/server.js
```

Em outro terminal, `npm test`, `npm run typecheck` e `npm run lint`.
Integração carrega .pocket.env, confirma localhost/porta/nome e remove apenas suas próprias chaves.
Vitest inclui CEN-NOVO-5 e 41, XML/XXE/tamanhos, contrato HTTP, migrações e comandos locais.
Após instalar Schemathesis (`uv tool install schemathesis`), com API isolada em execução:
`python3 test/contrato-http.py`. Cria chave efêmera, valida upload XML real, executa contrato
com seed 677 e revoga a chave no fim. Relatórios em /tmp/lf677-schemathesis.*.

## Chaves locais

Após build, carregar DATABASE_URL do ambiente correto. Criar:
`npm run chave:criar -- <produto>`; saída contém UUID e chave, exibida apenas nessa criação.
Revogar pelo UUID: `npm run chave:revogar -- <id>`. Não há rotas administrativas.
A imagem também contém a CLI compilada para execução local no container.
Não copiar chaves para histórico de comandos, logs ou arquivos versionados.

## Operação

`docker-compose.yml` mantém a API sem porta publicada, na rede externa leitor-fiscal-rede,
com limite de 256 MB. Migrações são aplicadas ao iniciar; banco pertence ao serviço.
Copiar .env.example para .env e preencher banco/segredos antes da subida.
IA_HABILITADA=0; #677 lê XML, demais entradas respondem bloqueio até #679/#678.
Imagem/PDF exigem confirmação de envio à IA mesmo antes de adaptadores instalados.

## Alertas no OpenProject

Leitor próprio que falha ou UF sem leitor grava um alerta local (com amostra sanitizada) e, se configurado, abre uma tarefa
"Mapear leitor da UF" por UF e leiaute. Um só conjunto de variáveis: `OPENPROJECT_URL`, `OPENPROJECT_API_KEY`,
`OPENPROJECT_TIPO_TAREFA_ID`, `OPENPROJECT_PRIORIDADE_NORMAL_ID` e `OPENPROJECT_PROJETO_ID` (padrão 9, projeto inteligencia).
Sem `OPENPROJECT_URL` e `OPENPROJECT_API_KEY` nada é enviado. Em produção, com `SP_LEITOR_LIBERADO` diferente de `true` o leitor de SP
fica desligado e essas leituras não geram alerta nem tarefa.
