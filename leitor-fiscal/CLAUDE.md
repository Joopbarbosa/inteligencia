# CLAUDE.md — leitor-fiscal

> Rascunho V0.16.0. No bootstrap vira o `CLAUDE.md` da raiz do repositório (com `AGENTS.md` como link).

## 1. Cabeçalho

Serviço que lê documento fiscal (NFC-e por QR/chave, NF-e por XML, PDF ou foto) e devolve a nota
estruturada. Stack: Node.js LTS + TypeScript estrito + Fastify + zod + cheerio + Postgres (Kysely).
Branch padrão atual: `feature/V0.16.0` (base `staging`, produção `main`). Docs em `docs/`
(`ARCHITECTURE.md`, `DECISOES_GLOBAIS.md`, `openapi.yaml`, `modulos/`). Produto de origem:
Pense & Precifique; segundo cliente previsto: bot de saúde financeira no WhatsApp.

## 2. Ambiente

| Item | Valor |
|---|---|
| Instalar | `npm ci` |
| Rodar em dev | `npm run dev` |
| Tipos | `npm run typecheck` (`tsc --noEmit`) |
| Lint | `npm run lint` |
| Testes | `npm test` (Vitest; integração usa Postgres do compose de teste) |
| Build | `npm run build` |
| Subir tudo | `docker compose up -d` (serviço + Postgres, rede externa compartilhada) |
| Variáveis | copiar `.env.example` para `.env`; nunca commitar `.env` |
| Conta de teste | chave de produto de teste gerada localmente; nunca chave real em teste |

Comandos e versões acima são seeds propostos e ficam confirmados no bootstrap.

## 3. Onde cada coisa vai

| Categoria | Local |
|---|---|
| Rotas e schemas de entrada/saída | `src/api/<recurso>/` |
| Fluxo cache → leitor próprio → IA → amostra/alerta | `src/leitura/` |
| Leitor próprio de um estado | `src/leitores/<uf>/` |
| Adaptadores de IA e cadeia de fallback | `src/ia/` |
| SSRF, remoção de CPF, limite por host | `src/seguranca/` |
| Cache, amostras, alertas, chaves de cliente | `src/cache/`, `src/amostras/`, `src/alertas/`, `src/autenticacao/` |
| Migrações e acesso a dados | `src/db/` |
| Erros, configuração, utilitários sem regra | `src/shared/` |
| Contrato | `docs/openapi.yaml` (alterar antes do código) |

Novo estado? Pasta nova em `src/leitores/<uf>/`; o orquestrador não muda.

## 4. Verificar antes de criar

Antes de criar função, schema ou erro, procurar em `src/shared/` e no módulo vizinho. Antes de
nova rota, conferir `docs/openapi.yaml`. Duplicação achada se reporta antes de implementar.
Antes de adicionar dependência, conferir se Fastify, zod ou cheerio já resolvem.

## 5. Convenções da stack

- TypeScript `strict`, sem `any` sem comentário de motivo; entrada externa sempre passa por zod.
- Payloads públicos em `camelCase`; erros no formato dos quatro campos (`titulo`, `motivo`, `comoResolver`, `itens`) mais `tipo` BLOQUEIO/AVISO.
- RN-085: 400 entrada inválida, 404 inexistente, 500 genérico sem detalhe interno.
- Segredo só por variável de ambiente; log nunca traz CPF, chave de API nem conteúdo de nota.
- Toda busca a URL externa passa por `src/seguranca/` (SSRF); nenhum `fetch` direto em leitor.
- Commit: `tipo(escopo): descrição — OpenProject #N`; stage explícito por arquivo.

## 6. Padrões consolidados

Ainda sem código. O primeiro módulo entregue (leitor de SP) vira o arquivo canônico de referência
e entra aqui na retomada da V0.16.0. Contrato canônico: `docs/openapi.yaml`.

## 7. Legado e exceções

Nenhum legado. Exceção consciente: sem JWT; autenticação é por chave de produto (INV-LF-2) e a
porta fica só na rede interna (INV-LF-5).

## 8. Anti-padrões do projeto

- Gravar ou consultar o banco do produto (viola INV-LF-3).
- `fetch` de URL do usuário sem passar pela defesa SSRF.
- Guardar amostra com CPF em texto.
- Esconder a origem da leitura ou devolver dado de IA como se fosse do leitor próprio.
- Texto de erro novo ao usuário sem validação do Gestor.
- Regra de conciliação (item→insumo) neste serviço; ela é do produto.
- Rota nova sem estar antes no `openapi.yaml`.

## 9. Review guidelines

Mapeamento de gravidade entre a escala do Codex e a do pipeline
(`gravidade.md` do processo — fonte única, não duplicar critério aqui):

| Codex | Pipeline | Efeito no gate/QA |
|---|---|---|
| P0 | Urgente | Bloqueia, corrigir sempre |
| P1 | Alta | Bloqueia, corrigir sempre |
| P2 | Normal | Gestor decide |
| P3 | Baixa | Gestor decide |

### AI slop — o que sempre vale achado de qualidade

Cada item abaixo, quando encontrado no diff revisado, é achado de
qualidade de código com local exato (`arquivo:linha`) e correção
sugerida em texto — nunca reescrita direta pelo Codex:

- Duplicação de lógica que já existe em outro lugar do módulo/serviço.
- Over-engineering: abstração, camada ou parâmetro sem uso real no
  código atual ou previsto na `SPEC`.
- Comentário óbvio, que só repete o que a linha seguinte já diz.
- `try/catch` ou checagem de nulo sem efeito (engole exceção sem
  tratar, ou verifica um valor que o tipo já garante não nulo).
- Cast para `any`/tipo genérico que descarta a checagem de tipo sem
  necessidade documentada.
- Código morto: função, branch ou arquivo sem nenhuma chamada real.
- Linha sem efeito observável no comportamento nem na legibilidade.
- Stub ou implementação vazia deixada como se estivesse completa.
- Lógica de negócio (cálculo, regra, validação de `SPEC`) implementada
  no Frontend quando deveria estar no Backend — ou o inverso, quando a
  `SPEC` definir onde a regra vive.

Gravidade de cada item segue `gravidade.md`, linha "Qualidade de código
(QA)": o item que esconde ou pode esconder um bug real de comportamento
é Alta; o item sem efeito funcional é Normal ou Baixa.

### Convenções do projeto

As convenções específicas deste repositório (padrões consolidados,
anti-padrões conhecidos, legado e exceções) vivem no restante deste
`CLAUDE.md` — a seção "Anti-padrões do projeto" é a referência que o
Codex cita quando o achado é específico deste repositório.
