# Módulo: Leitor fiscal — Regras de Negócio
> Fonte de verdade · V0.16.0 · confirmado 2026-10-07 (Retomada V0.16.0)

> Consolidadas a partir de `SPEC_V0.16.0.md` do Pense & Precifique (RN-NOVA-2, 3, 6, 7, 8 e 9). O comportamento visível ao usuário do produto fica em `modulos/COMPRAS/regras-compras.md` (COM-018 a COM-023). Decisões técnicas: `decisoes-leitor_fiscal.md`; contrato: `contrato-leitor_fiscal.md` e `docs/openapi.yaml`.

---

## 1. Regras de Negócio

### LF-001 — Contrato padronizado da leitura

O leitor-fiscal recebe um documento (link do QR code, imagem, PDF ou XML) e devolve **sempre** o mesmo resultado, para qualquer produto que o use (Pense & Precifique, bot de saúde financeira):
- **Emitente:** CNPJ, nome e UF.
- **Chave de acesso** da nota, com **44 posições** (a parte do CNPJ pode conter letras).
- **Número, série e data de emissão.**
- **Total pago** da nota, o **desconto geral da nota** (quando houver) e os **acréscimos** da nota (frete e outras despesas, quando houver).
- **Itens:** para cada item, o **nome inteiro do produto exatamente como está na nota** (sem abreviar nem normalizar), a **quantidade** e o **valor final do item** (valor total do item já com o desconto do item). Quando a nota trouxer, também o **valor bruto** e o **desconto do item**, a unidade, o código do produto no emitente e o EAN.
- **Origem** (`NFCE_QR`, `NFE_PDF`, `NFE_FOTO`, `NFE_XML`), **método de leitura** (`LEITOR_UF`, `IA` ou `XML`) e **avisos** da leitura.
O serviço só lê e devolve; **não liga item a insumo nem a categoria**. Essa ligação é de cada produto. Só clientes autorizados do serviço podem pedir uma leitura; pedido sem autorização é recusado.

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-2]`

---

### LF-002 — Ordem de leitura da NFC-e e economia de IA

Para um link de QR code, o leitor-fiscal segue esta ordem e para na primeira que resolver:
1. **Chave já lida antes** (mesma chave): devolve o resultado guardado, sem nova consulta e sem IA.
2. **Estado com leitor próprio** (nesta versão, SP; outros estados entram quando o spike #684 e o mapeamento confirmarem): busca a página do portal e lê por regras fixas, sem IA. Se faltar algum dado obrigatório (emitente, chave, qualquer item sem nome, quantidade ou valor final), considera que o leitor falhou e passa ao passo 3.
3. **IA:** estado sem leitor próprio, ou leitor que falhou, tem a página lida pela IA. O resultado da IA é conferido contra o contrato da LF-001.
A diferença entre a soma dos itens e o total pago **não** é falha do leitor: descontos e acréscimos da nota explicam diferença, e diferença sem explicação vira AVISO no rascunho (COM-025 (Pense & Precifique)).
Estado sem leitor próprio **não é erro**: a artesã recebe a leitura sem perceber diferença.

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-3]`

---

### LF-003 — Limite mensal de leituras por IA

Cada conta tem um **limite mensal de leituras por IA**, definido em configuração. Ao atingir o limite, a nova leitura por IA é **bloqueada** com mensagem clara e a alternativa de **registrar a compra à mão**. Leitura por leitor próprio (LF-002 passo 2), por XML e leitura devolvida do cache **não contam** no limite. O contador volta a zero no primeiro dia de cada mês. Valores iniciais aprovados pelo Gestor: 30 leituras por conta por mês e teto de 2.000 por mês por chave de produto; ambos por variável de ambiente (`LIMITE_IA_MENSAL_POR_CONTA`, `LIMITE_IA_MENSAL_POR_CHAVE`).
*Tipo de erro:* BLOQUEIO.

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-6]`

---

### LF-004 — Privacidade dos dados enviados à IA

Antes de enviar texto à IA (página do portal, texto extraído), o sistema envia **só o emitente e a tabela de itens** e **remove o CPF** da compradora. Quando a nota chega como **imagem** (foto ou PDF escaneado), a imagem é enviada como está e a artesã é **avisada antes do envio** de que ela vai a um serviço externo de IA; o sistema não oculta o CPF na imagem. XML e leitor próprio não usam IA e não enviam dados a terceiros. Em produção, a leitura por IA só fica disponível depois da Política de Privacidade (#675) citar o envio a serviço externo de IA e definir o mecanismo legal da transferência internacional.
*Tipo de erro:* AVISO (imagem), antes do envio.

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-7]`

---

### LF-005 — Só portais fiscais oficiais

O leitor-fiscal só consulta endereços dos portais oficiais de consulta de nota fiscal dos estados. Link de QR code que aponte para outro endereço, que redirecione para fora desses portais ou cujo destino seja um endereço interno ou privado é **recusado**, sem nenhuma consulta. A recusa vale também quando o redirecionamento acontece no meio da consulta.
*Tipo de erro:* BLOQUEIO.

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-8]`

---

### LF-006 — Alerta de estado ou leiaute a mapear

Quando a leitura passa pela IA por falta de leitor próprio (estado ainda não mapeado) ou porque o leitor próprio falhou (leiaute mudou), o leitor-fiscal **guarda uma amostra** da página (sem CPF) e **abre uma tarefa no gerenciador de tarefas do projeto `inteligencia`**. Existe **uma tarefa por estado + leiaute**: as leituras seguintes do mesmo estado e leiaute **somam a amostra à tarefa existente** e não abrem outra. Cada estado e leiaute diferente abre a sua tarefa. Se o gerenciador de tarefas estiver fora do ar, o alerta fica guardado e é enviado depois, sem perder nada e sem atrapalhar a leitura da artesã. Amostras guardadas por 12 meses (prazo confirmado pelo Gestor em 2026-10-04).

`[confirmado em V0.16.0 — 2026-10-07, ex-RN-NOVA-9]`

---

### LF-007 — Método fora do contrato é 405

o leitor-fiscal responde **405** com `Allow` (e `METODO_NAO_PERMITIDO` no corpo) a método HTTP que a rota existente não aceita, incluindo `TRACE` e `QUERY`; rota inexistente segue 404. Requisição malformada (multipart sem cabeçalhos na parte, corpo cortado, lixo que não é HTTP) responde **400** no formato padrão (`DOCUMENTO_INVALIDO` para o arquivo).

`[confirmado em V0.16.0 — 2026-10-07, #776, #779]`

---

*Ajustes feitos depois da SPEC (QA e decisões do Gestor): limite por conta de 30 leituras/mês e por chave de 2.000/mês, código `LIMITE_IA_ATINGIDO` (#725); 401/403 do provedor de IA passam ao próximo da cadeia, 400 interrompe (#726); consulta por chave de UF sem leitor responde `LEITURA_IMPOSSIVEL` sem tocar a rede e "XML assinado" no cache = presença de `SignatureValue` (#727); com `SP_LEITOR_LIBERADO` diferente de `true` o fallback não registra alerta (#728).*
