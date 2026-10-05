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

## #679 — Implementação QR, portal e cache (2026-10-05)

POST /v1/leituras mantém o OpenAPI publicado na #677. Link validado antes do cache: HTTPS443,
host exato versionado, sem credenciais; chave de44 posições extraída de p/chNFe, UF pela chave.
DNS valida TODOS os endereços e conexão fixa no IP público validado, SNI do portal; até3 redirects,
2MB de HTML,15s, global4,host2 e1req/s, sem cookies. Recusas PORTAL_NAO_PERMITIDO.
PNG/JPEG e PDF NFC-e decodificam QR no serviço (10MB,12MP,raster1500px,3 primeiras páginas).
PDF/PNG/JPEG continuam exigindo confirmouEnvioIa. Sem QR segue ao encaixe de IA com aviso.
Cache Postgres nota_lida (migração002), sem expiração, somente resultado validado; releitura
marca doCache=true sem mudar metodo; serializa leituras da mesma chave no processo.
XML NF-e sem IA e sem cache prévio continua igual; resultado válido é guardado após leitura.
Leitor SP conservador, por assinatura de leiaute e dados obrigatórios. Nesta entrega comprovado
somente sobre fixture controlada; cupom real fornecido pelo Gestor no teste final. Em produção,
SP_LEITOR_LIBERADO=false até validar consulta real/VPS (DT-NOVA-15). Não alegar cobertura real
aprovada. Chave/UF diferente da resposta bloqueia LEITURA_IMPOSSIVEL antes de gravar no cache.

## #678 — IA, privacidade e limites (contrato antes do código, 2026-10-05)

Mantém POST /v1/leituras e nota/erro OpenAPI. IA desligada por padrão (`IA_HABILITADA=0`);
produção só liga após política #675. Cadeia compatívelOpenAI (deepseek-flash primário) e
AnthropicMessages (fallback), configurada por ambiente. Tentativa20s, resposta validadazod;
timeout/5xx/429/schema inválido seguem ao próximo. Esgotada retorna IA_INDISPONIVEL.
Texto do portal enviado à IA contém só emitente e itens, CPF removido. Metadatafiscal obrigatória
(chave, número, série, emissão, total) extraída localmente e incorporada após extração dos itens;
não depende de a IA inventar metadados que não foram enviados. Se não for possível extrair
metadados obrigatórios de modo confiável, leitura falha. PDF com texto usa texto com CPF removido;
foto/PDFescaneado requer confirmação e CPF na imagem não é ocultado (decisãoGestor).
Resultado IA validado e coerente com chave/UF conta1uso; XML/leitorUF/cache não contam.
Mês civil em America/Sao_Paulo; limites30/conta e2000/chave, primeiro que bloquear prevalece.
Reserva atômica antes de chamarIA; falha devolve reserva, sucesso incrementa contador. Reservas
expiram após120s em caso de queda do processo. Concorrência por chave4; excesso é400/BLOQUEIO.
Logs somente provedor/modelo/tokens/custo estimado, sem documento/chave/CPF/token.

## #680 — Amostras e alertas (antes do código, 2026-10-05)

Sem rotas HTTP novas. Só fallback de NFC-e consultada no portal gera amostra sanitizada
(emitente/itens, sem CPF/URL) e alerta local único aberto por UF/leiaute. Conteúdo repetido
incrementa contador sem duplicar amostra; retenção12meses, limpeza startup/24h. CLI local
amostra:ver e alerta:resolver. Worker60s consulta título exato no projeto9 antes de criar,
adota tarefa existente após resposta perdida e repete com backoff60s→1h. Envia apenas
metadados/identificadores, nunca documento/CPF/chave/URL de cupom. Falha de OpenProject
não afeta a leitura. Comentário diário somente quando link addComment for disponibilizado;
sem esse link o contador local basta. Configuração sem credencial desativa envio remoto.
