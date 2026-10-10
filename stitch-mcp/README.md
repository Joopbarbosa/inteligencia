# stitch-mcp

Integração com o MCP do Google Stitch para produzir designs de telas de
sistema. O endpoint é `https://stitch.googleapis.com/mcp`.

## Preparar a chave

Edite `.env` nesta pasta e preencha `STITCH_API_KEY=` com a chave gerada no
Stitch. Não coloque a chave no chat ou em `.env.example`. O arquivo `.env`
está ignorado pelo Git.

A chave foi configurada localmente e uma tela piloto isolada foi criada
por chamada direta ao endpoint. O proxy local em `server.mjs` lê a chave
somente do `.env` e expõe as ferramentas do Stitch por stdio.

O servidor `stitch` está registrado no Claude Code (escopo `user`) e
no Codex (configuração global). Depois de registrar ou alterar um MCP,
abrir uma nova sessão do cliente para que as ferramentas apareçam.
Verificar com `claude mcp list` e `codex mcp list`; um teste local de
`listTools` confirmou 15 ferramentas, incluindo
`generate_screen_from_text`, `edit_screens` e `generate_variants`.

A skill `geracao-visual` usa esse MCP para criar e corrigir telas.
Pedidos de correção podem ser feitos no chat do Claude Code ou do Codex;
o usuário não precisa repetir o pedido no chat do Stitch.
