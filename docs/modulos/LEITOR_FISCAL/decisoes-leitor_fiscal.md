# LEITOR_FISCAL — Decisões de implementação

## Divergências de Premissa

2026-10-04, #677: o backlog menciona persistência de amostras/alertas e compose do produto.
O plano aprovado delimita #677 ao bootstrap/contrato/XML: amostras/alertas ficam na #680;
integração de redes do produto é P4, do integrador. O compose existente do serviço foi preservado.
As instruções e documentos do repositório já existiam; não havia src, DTOs, tabelas ou migrações.
A próxima migração livre era 001. Os arquivos de módulo eram modelos sem comportamento confirmado.
O host usa Node 26; build, tipos e testes finais usam Node 24.21.0, e o container usa node:24-alpine.

## Decisões Técnicas

2026-10-04, #677: DT-NOVA-1 a 4 aplicadas no contrato, autenticação e XML.
OpenAPI 3.0.3 publicado no primeiro commit (JSON é sintaxe válida de YAML).
Schemas zod no módulo da rota; respostas comparadas ao OpenAPI por AJV e Schemathesis.
Fast-xml-parser preserva números como texto, recusa DOCTYPE antes do parsing e valida XML bem formado.
Operações decimais usam BigInt e escala textual, sem arredondamento binário.
Migrações SQL numeradas executadas em transação, com advisory lock e registro schema_migration;
SQL dinâmico contém apenas arquivo versionado de migração, nunca entrada HTTP.
Banco via Kysely/pg; chave aleatória de 32 bytes, SHA-256 persistido e comparação timingSafeEqual.
Rotação permite coexistência; revogação opera pelo UUID da chave, não pelo segredo.
Comandos locais usam a CLI compilada em dist, disponível também na imagem sem dependências dev.
IA permanece desligada: servidor não instala adaptadores de IA/UF nesta tarefa.
O orquestrador fornece entradas e contexto com conta, chave e AbortSignal aos futuros adaptadores.
Cache, limites, SSRF, QR, IA, alertas e amostras permanecem nas tarefas designadas no plano.

## #679 — Escolha de QR/PDF antes do código (2026-10-05)

- QR: jsQR (JavaScript, RGBA, sem navegador) com sharp para JPEG/PNG, cache desligado e concorrência1. ZXing via WASM foi considerado, mas adiciona runtime/formatos que o QR fiscal não exige. Referência: https://github.com/cozmo/jsqr.
- PDF: Poppler (`pdfinfo`, `pdftoppm`, depois `pdftotext` na #678), processos locais com tempo e páginas limitados. PDF.js/@napi-rs/canvas foi considerado (referência https://github.com/mozilla/pdf.js/tree/master/examples/node), mas requer heap/canvas/worker no processo Node; Poppler permite limitar processo e raster por tamanho sem browser. Instalar poppler-utils na imagem Alpine.
- Experimento prévio em imagem node:24-alpine com limite 256 MiB, 1CPU: PNG640px 185ms, PDF raster1500px 381ms, ambos decodificaram o mesmo link; RSS Node final90.329.088 bytes, pico cgroup68.931.584 bytes (memória compartilhada pode não ser debitada integralmente ao cgroup). Sem OOM. Logs /tmp/leitor679-benchmark.jsonl e fixture controlada /tmp/codex679-bench. Não equivale a medição de todos os PDFs reais.
- Processamento sequencial de QR; máximo10MB, imagem12MP e raster1500px, três primeiras páginas, subprocesso15s/página. Não instalar browser no leitor.
- Gestor fornecerá o QR real de SP no roteiro final. Fixture sintética não prova leiaute do portal real; liberação em produção depende da validação real/VPS prevista em DT-NOVA-15.

## #678 — Cadeia IA e limites (2026-10-05)

- IA permanece desligada por padrão. Provedor principal compatível com chat/completions e fallback Anthropic são configuráveis; nenhuma credencial real é necessária nos testes. JSON e schema inválidos, timeout, 429 e 5xx acionam fallback; 400/401 encerram a cadeia.
- HTML é reduzido localmente a emitente/itens, sem CPF. Chave, data e totais são extraídos localmente e combinados após validação. PDF textual usa pdftotext e remoção de CPF; fotos e PDF sem texto exigem confirmação explícita.
- O adaptador compatível rasteriza PDF escaneado em até três páginas para os blocos de imagem suportados pelo protocolo; não recorta o conteúdo. PDFs maiores seguem ao fallback. Anthropic recebe o PDF original como document/base64. Não presumir suporte a upload de PDF no endpoint compatível.
- Limites mensais usam mês de São Paulo, reserva transacional e advisory lock por chave, antes da chamada. Somente resultado válido incrementa uso. Reservas abandonadas expiram em 120 segundos; falha/aborto libera a reserva. Padrões: 30 por conta e 2.000 por chave.
- Até quatro leituras HTTP simultâneas por chave; quinta retorna erro estruturado. Logs contêm somente provedor, modelo, tokens e custo estimado configurável, sem documento, chave de API ou conta. Sem preço configurado, custo é null, sem estimativa inventada.
- Evidência: 106 testes, incluindo servidor HTTP IA local real, reservas concorrentes em PostgreSQL, fronteira mensal, confirmação e privacidade. Provedores comerciais não foram chamados; validação funcional real permanece no roteiro final.

## #726 — Correções da QA da #678 (2026-10-06)

- **Decisão tomada sem consulta (Gestor confirma):** 401/403 do provedor passam ao próximo da cadeia e a falha é registrada em log (`falha_provedor_ia`: provedor, modelo, HTTP; nunca documento, chave ou conta). Disponibilidade pesa mais que parar na primeira credencial vencida; a ESTRUTURA DT-NOVA-5 listava só timeout, 5xx, 429 e schema. 400 continua interrompendo a cadeia.
- `decimalPt` e a leitura de Emissão/Número/Série/Descontos/Acréscimos vivem em `src/leitores/cabecalho.ts`, usados pelo leitor de SP e pelo preparo da IA.
- Parâmetro `iaHabilitada` do Orquestrador removido: IA habilitada = existe o adaptador `ia` (`src/leitura/composicao.ts`, mesma composição de `server.ts`).
- Textos de `CONFIRMACAO_ENVIO_IA_AUSENTE` e `PORTAL_NAO_PERMITIDO` escritos como rascunho; dependem de validação do Gestor.

## #727 — Correções da QA da #679 (2026-10-06)

- Consulta por chave resolve a URL por UF em `portaisPorChave` (`src/leitores/registro.ts`); só SP cadastrada (escopo atual do Gestor: "precisa verificar todos os estados" fica para depois). UF sem entrada responde `LEITURA_IMPOSSIVEL` sem tocar a rede.
- Cache global só recebe nota lida da página do portal (link/QR validado ou consulta por chave cadastrada) com a chave conferida, ou XML com assinatura digital. Resultado de IA lido de foto/PDF nunca entra. **Limitação:** "XML assinado" é presença de `SignatureValue` xmldsig, não verificação criptográfica; verificação real (cadeia ICP-Brasil) fica para decisão do Gestor.
- O aviso "O QR não pôde ser lido..." é acrescentado depois de gravar no cache.
- `chaveAcesso` de entrada passa por `toUpperCase` antes do regex; o regex de saída (`notaSchema`) segue só maiúsculas.

## #680 — Amostras e alertas (2026-10-05)

- Migração004 após003. Alerta parcial único por UF/leiaute ABERTO; upsert transacional incrementa contador e insere amostra por SHA256, sem duplicar HTML sanitizado idêntico. HTML persistido é somente texto do emitente/itens escapado em pre, CPF/endereço removidos. Foto/PDF/XML/cache/leitor próprio não geram amostras.
- Retenção de12meses, limpeza ao subir e diariamente. Amostras vistas somente pela CLI amostra:ver; resolução manual pela CLI alerta:resolver. Identificadores novos de leiaute geram alertas próprios.
- Worker60s, single-flight no processo e tentativa persistida antes do envio. Consulta sempre antes de criar (filtro subject contendo + igualdade exata local); busca incompleta recusa criar. Reenvio60s→1h, adoção do id remoto após resposta perdida. Sem configuração, envio desligado; coleta local continua.
- Verificação de comentário no início: documentação oficial expõe addComment condicionado à permissão de notas. Usar link HAL somente da mesma origem/api/v3, aceitando method post/POST. Sem link, contador local basta. Reservar instante antes da tentativa de comentário limita a1tentativa/24h mesmo se resposta se perder; comentário perdido não perde contador local. Fontes: https://www.openproject.org/docs/api/endpoints/work-packages/ e https://www.openproject.org/docs/api/filters/. Nenhuma credencial comercial usada nem tarefa real de alerta criada durante testes.
- Metadados enviados: UF/leiaute/motivo/data/contador/idlocal e comando CLI. Nunca HTML, conteúdo fiscal, CPF, chave de acesso ou endereço com chave. Erro remoto tratado no worker, sem afetar resposta fiscal.

## #728 — Correções da QA da #680 (2026-10-06)

- A composição de `server.ts` (cache, leitor da UF, IA atrás do limite, alerta de fallback) vive em `montarOrquestrador` (`src/leitura/composicao.ts`), usada pelo servidor e pelo teste de integração do fluxo CEN-NOVO-2/53. `Orquestrador` aceita `hostsPermitidos` só para o teste injetar um host de portal.
- Alerta com página que perdeu emitente, CNPJ ou tabela: a amostra guarda um recorte mínimo (UF, leiaute, tamanho do HTML e estrutura de tags/ids/classes com números trocados por N; nenhum texto da página). O alerta nasce antes da chamada à IA.
- **Decisão tomada sem consulta (Gestor confirma):** com o leitor desligado por política (produção sem `SP_LEITOR_LIBERADO=true`) o fallback não registra nada (nem alerta nem amostra), em vez de criar um motivo `LEITOR_DESLIGADO`, que exigiria migração do CHECK de `alerta.motivo`.
- OpenProject: um só conjunto de variáveis (`OPENPROJECT_*`); `OPENPROJECT_PROJETO_ID` com padrão 9.
- `vitest.config.ts` roda os arquivos de teste em sequência: os testes de banco compartilham a base e o worker de alertas lê todos os alertas pendentes.
