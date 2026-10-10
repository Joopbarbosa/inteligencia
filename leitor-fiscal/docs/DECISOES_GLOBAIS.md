# leitor-fiscal — DECISOES_GLOBAIS

> Rascunho V0.16.0. Formato **narrativo**, append-only. Cada entrada com data e origem.
> Valem para quem chama ou evolui o serviço. Seeds (linguagem, pastas, comandos) ficam no `ARCHITECTURE.md`.

## Invariantes herdadas do Pense & Precifique (restrição read-only)

Lidas de `docs-pense-precifique/DECISOES_GLOBAIS.md`; este serviço não as redecide.

| Origem | Restrição aplicada aqui |
|---|---|
| RN-085 | A API do serviço devolve 400 para entrada inválida, 404 para recurso inexistente e 500 com mensagem genérica para o resto, sem stack trace nem detalhe interno |
| Modal de erro padrão (`titulo`, `motivo`, `comoResolver`, `itens`) | O corpo de erro do serviço carrega os mesmos quatro campos, para o produto repassar sem remapear |
| Tipo de erro BLOQUEIO/AVISO como campo estruturado | Todo erro funcional traz `tipo`, nunca é inferido por texto de mensagem |
| Parâmetro de busca `busca` | Qualquer listagem com filtro textual usa `busca` |
| Valores em dinheiro | Exibição com 2 casas é do produto; cálculos e valores guardados conservam 4 casas. O serviço devolve o valor como lido na nota (sem arredondar) e não formata para tela |
| Limite de 500 caracteres em descrição/observação | Campos livres devolvidos respeitam o limite |
| Limite mensal de IA por conta (RN-NOVA-6 da SPEC) | Resolvido pelo Gestor em 2026-10-04: limite por conta e teto por chave, os dois (INV-LF-2). A SPEC não muda |
| Mensagens ao usuário exigem validação humana | **Conflito exposto:** o serviço é dono do texto de erro; todo texto que chegue ao usuário final fica em rascunho até o Gestor validar. Ver pendência abaixo |

## Invariantes novas deste serviço

### INV-LF-1 — Contrato primeiro (OpenAPI)
Toda rota existe antes no `openapi.yaml`; código e schemas seguem o arquivo. Campos de payload em `camelCase`.
**Onde se aplica:** toda integração (Pense & Precifique, bot).

### INV-LF-2 — Autenticação por chave de produto
Cada produto usa uma chave própria no cabeçalho de cada chamada. O serviço guarda só o hash, conta uso de IA e aplica limite mensal por chave; revogar uma chave não afeta as outras. Cada chamada leva também um identificador opaco da conta (código sem significado, que só o produto sabe traduzir). O serviço aplica o limite mensal de IA **por conta** (RN-NOVA-6) e mantém um **teto mensal por chave**; vale o que bloquear primeiro. O serviço não guarda nome, e-mail nem CPF de ninguém. Decisão do Gestor, 2026-10-04. A chave da IA (do Gestor) é outra coisa e fica só no `.env` do serviço.

### INV-LF-3 — Serviço só lê, nunca grava no produto
O serviço não acessa o banco do produto nem recebe dado de usuário final além do documento a ler. Quem chama é dono de compra, insumo, vínculo e histórico.

### INV-LF-4 — Resposta sempre rotulada
Toda leitura devolve `origem`, `metodo`, `uf` e `leiaute`. O produto decide o que mostrar; o serviço nunca esconde de onde veio o dado.

### INV-LF-5 — Rede interna
Porta não publicada no host. Só entra por rede Docker compartilhada com os produtos autorizados.

### INV-LF-6 — Defesa de busca externa (SSRF)
URL recebida só é buscada se o esquema e o host estiverem na lista de portais oficiais; o IP resolvido é verificado e redirecionamentos para fora da lista são bloqueados. Detalhe de regras: Fase 3.

### INV-LF-7 — Dado pessoal em documento
Antes de enviar texto à IA, o serviço seleciona só o emitente e a tabela de itens e remove o CPF (RN-NOVA-7, CEN-NOVO-8); o mesmo texto limpo é o que pode virar amostra; em imagem só há aviso ao usuário (decisão do Gestor). Logs nunca trazem CPF, chave de API nem conteúdo da nota.

### INV-LF-8 — Identificador sequencial visível ao usuário
Não se aplica: o serviço não expõe identificador sequencial a usuário final; chaves de acesso e códigos de cliente são os identificadores externos.

### INV-LF-11 — Banco próprio
O serviço tem banco próprio e é dono de cache de notas lidas, amostras, alertas, chaves e uso de IA. Nenhum outro serviço lê ou grava nele; acesso só pela API.

### INV-LF-9 — Organização, compartilhado e DTOs
Um pacote por capacidade em `src/`. Código sai para `shared/` só quando 2 ou mais módulos o usam e ele não carrega regra de negócio. Schemas zod (DTOs) vivem dentro do módulo dono, nunca em pasta plana global.

### INV-LF-10 — Estilo
Não se aplica: serviço sem interface.

## Pendências para validação do Gestor

1. Texto das mensagens de erro do serviço (dono do texto, mas validação humana é invariante).

## Confirmado pelo Gestor em 2026-10-04

Node em versão LTS atual (proposta: 24) e Kysely como acesso a dados. Valor do teto por chave e do limite por conta: plano de execução.
