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
