# inteligencia

Serviços e integrações compartilhados entre os projetos (fora de qualquer produto). Cada pasta é independente e tem o seu README.

| Pasta | O que é |
|---|---|
| `evolution/` | Evolution API (WhatsApp) compartilhada |
| `whisper/` | Transcrição de áudio local (API compatível com a da OpenAI) |
| `leitor-fiscal/` | Leitura de cupom fiscal (NFC-e) |
| `openproject-api/` | MCP do OpenProject |
| `github-mcp/` | Documentação da integração do MCP oficial do GitHub |
| `canva-mcp/` | Documentação do MCP do Canva |
| `stitch-mcp/` | MCP do Stitch |

Segredos ficam em `.env` por serviço (ignorado pelo git); cada pasta traz o `.env.example`.
