# Módulo: Leitor fiscal — Cenários BDD
> Fonte de verdade · V0.16.0 · confirmado 2026-10-07 (Retomada V0.16.0)

> Cenários do serviço consolidados de `SPEC_V0.16.0.md`. Os cenários de tela e de compra que usam o serviço estão em `modulos/COMPRAS/cenarios-compras.md` (COM-CEN-045 a 089).

---

### Cenário LF-CEN-001 (CEN-NOVO-8) — Texto enviado à IA sem CPF ✅
```gherkin
Dado que a página da nota traz "CPF consumidor: 123.456.789-09"
Quando o leitor-fiscal envia a página à IA
Então o texto enviado contém o emitente e a tabela de itens
E não contém o CPF 123.456.789-09
```
*RN relacionada:* LF-004
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-002 (CEN-NOVO-39) — Link fora dos portais fiscais ❌
```gherkin
Dado um link de QR code que aponta para "http://exemplo-malicioso.test/nfce?p=123"
Quando o leitor-fiscal recebe o link
Então recusa o pedido sem fazer nenhuma consulta
```
*Tipo de erro:* BLOQUEIO
*RN relacionada:* LF-005
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-003 (CEN-NOVO-40) — Redirecionamento para endereço interno ❌
```gherkin
Dado um link de portal fiscal oficial que redireciona para "http://169.254.169.254/latest/meta-data"
Quando o leitor-fiscal segue a consulta
Então interrompe a consulta no redirecionamento e recusa o pedido
```
*Tipo de erro:* BLOQUEIO
*RN relacionada:* LF-005
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-004 (CEN-NOVO-41) — Pedido sem autorização ❌
```gherkin
Dado um produto que não tem credencial válida no leitor-fiscal
Quando ele envia um pedido de leitura
Então o pedido é recusado e nenhuma leitura é feita nem contada
```
*Tipo de erro:* BLOQUEIO
*RN relacionada:* LF-001
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-005 (CEN-NOVO-53) — Alerta de estado: uma tarefa por estado e leiaute ✅
```gherkin
Dado que já existe a tarefa "mapear estado PI, leiaute A"
Quando chegam mais 2 cupons do PI com o mesmo leiaute e 1 cupom do PI com leiaute diferente
Então os 2 cupons somam amostras à tarefa existente, sem abrir outra
E o cupom de leiaute diferente abre uma nova tarefa "mapear estado PI, leiaute B"
```
*RN relacionada:* LF-006
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-006 (CEN-NOVO-54) — Gerenciador de tarefas fora do ar não perde o alerta ✅
```gherkin
Dado que o gerenciador de tarefas está fora do ar quando a IA lê um cupom do PI
Quando a leitura termina
Então a artesã recebe a nota normalmente
E o alerta fica guardado
E, quando o gerenciador volta, o alerta é enviado sem duplicar a tarefa
```
*RN relacionada:* LF-006
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-007 — Parte do multipart sem cabeçalhos ✅
```gherkin
Quando o multipart chega com a parte sem cabeçalhos (--B\r\nTrue--B--)
Então o serviço responde 400, tipo BLOQUEIO, código DOCUMENTO_INVALIDO
```
*Tipo:* negativo
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-008 — Corpo cortado no meio da parte ✅
```gherkin
Quando o corpo termina no meio da parte do arquivo
Então o serviço responde 400 DOCUMENTO_INVALIDO
```
*Tipo:* negativo
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-009 — TRACE responde 405 ✅
```gherkin
Quando TRACE /saude ou TRACE /v1/leituras é chamado
Então o serviço responde 405, com Allow GET, HEAD e POST respectivamente, e METODO_NAO_PERMITIDO; rota inexistente responde 404
```
*Tipo:* negativo
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-010 — Cada código de erro tem texto de orientação próprio ✅
```gherkin
Então LIMITE_IA_ATINGIDO, LIMITE_SIMULTANEAS, ERRO_INTERNO, IA_INDISPONIVEL e CHAVE_INVALIDA têm, cada um, texto próprio de orientação para a artesã
```
*Tipo:* positivo
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-011 — Contrato lista METODO_NAO_PERMITIDO ✅
```gherkin
Então o enum do OpenAPI, a lista de códigos e a tabela do contrato listam METODO_NAO_PERMITIDO
```
*Tipo:* contrato
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

### Cenário LF-CEN-012 — QUERY responde 405 ✅
```gherkin
Quando QUERY /saude, QUERY /v1/leituras ou QUERY /nao-existe é chamado
Então o serviço responde 405 com Allow GET, HEAD; 405 com Allow POST; e 404; e lixo que não é HTTP segue 400
```
*Tipo:* negativo
*RN relacionada:* LF-007
`[confirmado em V0.16.0 — 2026-10-07]`

---

### Índice de Rastreabilidade

| Cenário | RN | Cobertura |
|---|---|---|
| LF-CEN-001 (CEN-NOVO-8) | LF-004 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-002 (CEN-NOVO-39) | LF-005 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-003 (CEN-NOVO-40) | LF-005 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-004 (CEN-NOVO-41) | LF-001 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-005 (CEN-NOVO-53) | LF-006 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-006 (CEN-NOVO-54) | LF-006 | teste do serviço citado nas entregas `ENTREGA_V0.16.0-#677`, `#678`, `#679` e `#680` do Pense & Precifique |
| LF-CEN-007 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
| LF-CEN-008 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
| LF-CEN-009 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
| LF-CEN-010 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
| LF-CEN-011 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
| LF-CEN-012 | LF-007 | `test/erro-protocolo.test.ts`, `test/textos-erro.test.ts` e `test/contrato-erros.test.ts` |
