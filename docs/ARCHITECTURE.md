# leitor-fiscal — ARCHITECTURE

> **Rascunho V0.16.0 (Fase 1 da estrutura).** Vive em `docs-pense-precifique/version/V0.16.0/fundacao-leitor-fiscal/`
> até o repositório existir; no bootstrap (Fase 2) vai para `docs/` do repositório `leitor-fiscal`
> (privado, `Joopbarbosa`, pasta local `inteligencia/leitor-fiscal/`). Decisões de origem:
> `DECISOES_V0.16.0.md`, entrada "2026-10-04 — estrutura (Fase 1)".

## 1. Propósito

Serviço reutilizável que transforma documento fiscal em dados estruturados: **nota lida**
(emitente, itens com nome inteiro, quantidade, unidade, valor, descontos, total, chave de acesso).
Atende o Pense & Precifique (v0.16.0) e, no futuro, o bot de saúde financeira no WhatsApp.
O serviço **só lê e devolve**: não grava compra, não conhece insumo nem conta de usuário.

## 2. Entradas e ordem de leitura

| Entrada | Caminho |
|---|---|
| Chave de acesso (44 posições), URL ou texto do QR da NFC-e | cache por chave → leitor próprio da UF (SP primeiro) → IA → amostra + alerta |
| Foto/PDF de NFC-e | lê o QR; se não ler, segue como a linha acima por IA |
| XML de NF-e | leitura direta, origem `NFE_XML`, método `XML` |
| PDF/foto de NF-e (modelo 55) | direto para a IA (Decisão 17 da V0.15.0) |

Resposta sempre traz `origem` (`NFCE_QR`, `NFE_PDF`, `NFE_FOTO`, `NFE_XML`), `metodo` (`LEITOR_UF`, `IA`, `XML`, como na RN-NOVA-2), `uf`, `leiaute` e o indicador `doCache`. Resultado devolvido do cache mantém o `metodo` com que foi lido e traz `doCache` verdadeiro; o cache nunca vira método.

## 3. Decisões seed (locais deste serviço)

| Tema | Decisão |
|---|---|
| Linguagem/runtime | Node.js LTS atual (proposta: 24) com TypeScript `strict` |
| HTTP | Fastify, com schemas zod validando entrada e saída |
| HTML de portais | cheerio; navegador headless (Playwright) só se um estado exigir JavaScript, decisão por UF no spike #684 |
| Banco | Postgres em container próprio do serviço (a separação de dono do dado é a invariante INV-LF-11) |
| Acesso a dados | Kysely, migrações em arquivos SQL numerados aplicados na subida |
| IA | dois adaptadores atrás de uma interface única: compatível com OpenAI e Anthropic Messages; cadeia de fallback configurável; DeepSeek `deepseek-flash` como primeiro da cadeia |
| Testes | Vitest (unitário e integração com Postgres de teste), supertest/`inject` do Fastify |
| Qualidade | `tsc --noEmit` estrito, ESLint com typescript-eslint; portão mecânico: Semgrep, OSV, Schemathesis contra o OpenAPI |
| Subida | `docker-compose.yml` próprio (serviço + Postgres); a rede compartilhada e a porta fechada são a invariante INV-LF-5 |
| Segredos | só em `.env` (ignorado pelo git); `.env.example` lista os nomes |

Contrato OpenAPI primeiro, autenticação por chave de produto, rede interna e banco próprio não são seeds: são invariantes em `DECISOES_GLOBAIS.md` (INV-LF-1, 2, 5, 11).

Variáveis de ambiente previstas (nomes, sem valores): `DATABASE_URL`, `IA_PROVEDOR_PRIMARIO_*`
(`URL_BASE`, `CHAVE`, `MODELO`, `TIPO_ADAPTADOR`), `IA_PROVEDOR_FALLBACK_*`, `OP_URL`, `OP_TOKEN`,
`OP_PROJETO_ID`, `LIMITE_IA_MENSAL_POR_CONTA`, `LIMITE_IA_MENSAL_POR_CHAVE`, `RETENCAO_AMOSTRAS_MESES`.

## 4. Estrutura de pastas (módulo por capacidade)

```
src/
  api/            rotas Fastify, uma pasta por recurso (leituras, chaves-cliente, saude)
  leitura/        orquestrador: cache -> leitor próprio -> IA -> amostra/alerta
  leitores/       um pacote por UF (sp/, ...) com busca, extração e normalização
  ia/             interface única + adaptadores (openai-compativel/, anthropic/) + cadeia de fallback
  seguranca/      defesa SSRF, remoção de CPF em texto, limite por host
  cache/          cache por chave de acesso
  amostras/       amostras por UF+leiaute e retenção
  alertas/        deduplicação e envio ao OpenProject (registro local primeiro, reenvio)
  autenticacao/   chaves por produto (hash), limites e uso por chave
  db/             conexão, migrações, tipos
  shared/         erros, configuração, utilitários sem regra de negócio
test/             espelha src/
docs/             ARCHITECTURE.md, DECISOES_GLOBAIS.md, openapi.yaml, modulos/
```

## 5. Modelagem conceitual (sem DDL)

| Entidade | Papel | Cardinalidade |
|---|---|---|
| **chave-cliente** | produto autorizado a chamar o serviço; guarda só o hash, estado ativa/revogada e limite mensal de IA | 1 produto : N chaves (rotação) |
| **nota-lida** | resultado normalizado da leitura, cache por chave de acesso, com origem, método, UF, leiaute | 1 chave de acesso : 1 nota-lida |
| **uso-ia** | contagem mensal de leituras por IA (e custo estimado) por chave-cliente | 1 chave-cliente : N meses |
| **amostra** | documento sanitizado (sem CPF em texto) guardado quando a IA leu, para virar leitor próprio | N amostras : 1 UF+leiaute |
| **alerta** | um por UF+leiaute com estado de envio ao OpenProject e tentativas | 1 UF+leiaute : 1 alerta aberto |

Retenção de amostras: 12 meses (pendência de confirmação na Fase 3). Cache de nota-lida: sem
expiração por tempo; nota fiscal emitida não muda.

## 6. Fronteira com o Pense & Precifique

- O serviço é chamado pelo backend do Pense & Precifique (nunca pelo navegador), na rede Docker
  compartilhada, com a chave do produto no cabeçalho.
- Dono do dado: leitor-fiscal é dono do cache de notas lidas, amostras, alertas e uso de IA; o
  Pense & Precifique é dono de compras, insumos, fornecedores, vínculos e histórico.
- A conciliação (vínculo item→insumo, nome, sugestão por IA) **não** é do serviço: o contrato
  aqui só devolve a nota lida. A sugestão item→insumo fica no produto.

## 7. Operação

- Container com limite de memória (VPS enxuta, `DEPLOY.md` do Pense & Precifique); navegador
  headless só entra se o spike exigir e com limite próprio.
- Saúde: rota de verificação sem dado sensível. Logs sem CPF, sem chave de API, sem conteúdo de nota.
- Teste de bloqueio de IP da VPS pelos portais SEFAZ: pendência da Fase 3.

## 8. Pendências levadas à Fase 3

Regras de SSRF (lista de portais, DNS, redirecionamentos); formato e rotação da chave por produto;
mecanismo de envio ao OpenProject (REST de comentário disponível?); valor inicial do limite de IA;
retenção; deduplicação de alerta; contrato OpenAPI completo.
