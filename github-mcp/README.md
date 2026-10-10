# github-mcp

MCP oficial do GitHub ([`github/github-mcp-server`](https://github.com/github/github-mcp-server), MIT), registrado no Claude Code para criar/gerenciar branches, Pull Requests e checar CI/Actions direto do chat — sem passar por `gh` CLI ou pela UI do GitHub.

**Diferença do [`inteligencia/openproject-api`](../openproject-api/)**: aqui não há vendoring nem código nosso. É a imagem Docker oficial (`ghcr.io/github/github-mcp-server`) rodada como está — esta pasta só documenta a integração (o que faz, como registrar, gotchas). Não é um projeto, não tem git próprio.

## O que faz

Registrado com `GITHUB_TOOLSETS=repos,pull_requests,actions` (só o que usamos — o servidor tem toolsets bem maiores: issues, gists, discussions, security, etc., propositalmente não habilitados).

**Repos/branches**
- `create_branch` — cria branch a partir de outra (ex.: `feature/V[X.Y]` a partir de `staging`)
- `create_repository`, `delete_repository`, `get_file_contents`, `push_files`, `delete_file` — gestão de arquivo/repositório

**Pull Requests**
- `create_pull_request` — abre PR
- `merge_pull_request` — faz merge
- `pull_request_read` (método `get_status`) — status combinado dos commits do PR
- `pull_request_read` (método `get_check_runs`) — check runs (CI) do commit mais recente do PR

**Actions**
- `actions_get` — detalhes de workflows/runs/jobs
- `get_job_logs` — logs de um job de workflow

## Regra de uso obrigatória: nunca mergear sem checar CI

`merge_pull_request` **não** checa CI sozinho — ele mergeria mesmo com checks vermelhos se você só chamar ele direto. Fluxo correto, sempre:

1. `pull_request_read` (`get_status` e/ou `get_check_runs`) no PR
2. Só chamar `merge_pull_request` se os checks estiverem verdes/passou
3. CI vermelho ou pendente → não mergear, reportar e perguntar

## Gotcha confirmado: não existe `delete_branch`

Verificado contra a documentação oficial em 05/09/2026 (não é suposição): os toolsets `repos`/`pull_requests`/`actions` **não têm** `delete_branch`/`delete_ref`, nem existe uma tool genérica de "chamar qualquer endpoint" que cobrisse isso. **Excluir branch continua sendo um comando git normal, fora do MCP:**

```bash
git push origin --delete feature/V[X.Y]
```

## Como está registrado

O token vive em `inteligencia/github-mcp/.env` (nunca commitado — coberto
pelo `.gitignore` desta pasta), carregado no shell antes do registro:

```bash
cd inteligencia/github-mcp
set -a; source .env; set +a

claude mcp add github -s user \
  -e GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" \
  -e GITHUB_TOOLSETS="$GITHUB_TOOLSETS" \
  -- docker run -i --rm \
     -e GITHUB_PERSONAL_ACCESS_TOKEN \
     -e GITHUB_TOOLSETS \
     ghcr.io/github/github-mcp-server
```

- **Modo local via Docker + PAT** (decidido em 05/09/2026 — ver `Migração By mentoria/PLANO_ACAO_MIGRACAO.md`, item 43). Descartado: remoto via OAuth (`api.githubcopilot.com` — domínio sugere exigir licença Copilot, não confirmado) e binário Go (exige toolchain instalada).
- Escopo `user`: disponível em qualquer projeto/sessão, mesmo padrão do `openproject-api`.
- **Token**: Personal Access Token (classic), scopes `repo` (branches/PR/merge/checks) + `workflow` (exigido pela API do GitHub para push que altere arquivos em `.github/workflows/`, relevante para o item 48 do plano — CI/CD review). Gerado em GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). **Fonte de verdade é o `.env` desta pasta** — trocar o token ali, nunca só exportar no shell avulso (evita `.env` e sessão de terminal divergirem sem ninguém perceber). Nunca colado em texto de conversa.

### Exposição conhecida, não resolvida pelo `.env`

`claude mcp get github` (e provavelmente `claude mcp get <qualquer-server-com--e>`)
exibe o valor registrado **em texto puro na saída**, independente de ter
vindo de `.env`, export manual, ou qualquer outra origem — é o comportamento
da ferramenta, não uma falha de onde o token foi guardado. Guardar em
`.env` evita o token ficar solto em histórico de shell ou arquivo avulso,
mas **não evita** reexposição se alguém rodar `claude mcp get github` de
novo — são dois riscos diferentes; só o primeiro é resolvido aqui. Se o
valor for exposto de novo (nesta sessão já aconteceu, 08/09/2026), a única
mitigação real é revogar e gerar um novo.
