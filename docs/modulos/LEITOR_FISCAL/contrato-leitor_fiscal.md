# LEITOR_FISCAL — Contrato de API

Última confirmação: 2026-10-04 — #677, V0.16.0. Contrato canônico: `docs/openapi.yaml`.

### GET /saude

Sem autenticação. Não revela configuração, banco ou credenciais.

**Response 200:**
```json
{"status":"ok"}
```

### POST /v1/leituras

Autenticação: `Authorization: Bearer <chave do produto>`. `X-Conta-Id`: UUID opaco obrigatório.
A chave é conferida antes de ler o corpo; chave ausente, inválida ou revogada responde 401.

Entrada JSON: `modelo` (`NFE` ou `NFCE`) e exatamente um de `qrUrl` ou `chaveAcesso`.
Entrada multipart: `modelo` e um `arquivo`; `confirmouEnvioIa=true` obrigatório para imagens/PDF.
Tipos de arquivo aceitos: application/xml, text/xml, application/pdf, image/png, image/jpeg.
XML até 5 MB; demais arquivos até 10 MB. Campos desconhecidos e entradas simultâneas são recusados.

**Response 200:**
```json
{"emitente":{"cnpj":"12ABCDEF000195","nome":"Distribuidora Aurora","uf":"SP"},"chaveAcesso":"35261012ABCDEF000195550010000012341234567890","numero":"1234","serie":"1","dataEmissao":"2026-10-04T10:30:00-03:00","totalPago":"61.9513","descontoGeral":"1.2334","acrescimos":"0.6067","itens":[{"nome":"PAPEL COUCHE 250G A4 C/100","quantidade":"1.2500","valorFinal":"36.0101","valorBruto":"38.1234","desconto":"2.1133","unidade":"PCT","codigo":"001","ean":"SEM GTIN"},{"nome":"FITA  CETIM & AZUL","quantidade":"2.0000","valorFinal":"19.0001","valorBruto":"20.0017","desconto":"1.0016"},{"nome":"Caneta GEL Preta","quantidade":"3.5000","valorFinal":"7.5678","valorBruto":"7.5678"}],"origem":"NFE_XML","metodo":"XML","doCache":false,"uf":"SP","leiaute":"SP-NFE-XML-4.00","avisos":[]}
```

**Erros de negócio:**

| Código HTTP | `tipo` | Quando |
|---|---|---|
| 400 | BLOQUEIO | DOCUMENTO_INVALIDO: entrada, conta, XML ou multipart inválido, limite de tamanho ou dados obrigatórios ausentes |
| 400 | BLOQUEIO | CONFIRMACAO_ENVIO_IA_AUSENTE: imagem ou PDF sem confirmação |
| 400 | BLOQUEIO | LEITURA_IMPOSSIVEL: leitor externo/IA ainda não ligado na #677 |
| 401 | BLOQUEIO | CHAVE_INVALIDA: chave ausente, inválida ou revogada |
| 404 | BLOQUEIO | RECURSO_INEXISTENTE: rota inexistente |
| 500 | BLOQUEIO | ERRO_INTERNO: mensagem genérica sem detalhe interno |

Erros sempre trazem `tipo`, `codigo`, `titulo`, `motivo`, `comoResolver`, `itens`.
Textos ao usuário são **rascunhos**, sujeitos à validação do Gestor.

Valores monetários e quantidades são strings decimais. Nome do item preservado como no XML,
incluindo espaços internos e entidades XML decodificadas. Chave com CNPJ alfanumérico aceita,
sem validar dígito verificador (decisão do spike #684). Não há HTTP administrativo.

XML usa leitura direta, sem IA, sem consulta a URL, sem cache; aceita NFe e nfeProc.
DOCTYPE/ENTITY e XML incompleto são recusados. Desconto geral = desconto total menos descontos
por item, com mínimo zero; acréscimos = frete + seguro + outras despesas.
A #679 implementará busca segura, leitor de SP e cache; #678 ligará IA e limites.
Prazo de execução da leitura: 60 s, sinal de cancelamento repassado aos adaptadores.
