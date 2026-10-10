# canva-mcp

Integração com o MCP oficial do Canva para montar apresentações (kickoff,
onboarding, treinamentos) a partir de copy pronta. O endpoint é
`https://mcp.canva.com/mcp`.

## Como funciona

O servidor é remoto e hospedado pelo Canva, por isso esta pasta não tem
código nem `.env`. A autenticação é por OAuth na conta pessoal do Canva:
não há chave para guardar.

O servidor `canva` está registrado no Claude Code (escopo `user`):

```bash
claude mcp add --transport http --scope user canva https://mcp.canva.com/mcp
```

Para autenticar, abrir uma nova sessão do Claude Code, rodar `/mcp`,
selecionar `canva` e concluir o login no navegador. Verificar com
`claude mcp get canva`: o status deve mudar de "Needs authentication"
para "Connected".

## Ferramentas principais

- `generate-design` + `create-design-from-candidate`: gera opções de
  design a partir de um prompt de texto (não aceita imagens de referência).
- Edição por transação (`start-editing-transaction` →
  `perform-editing-operations` → `commit`): troca textos e imagens,
  insere, move, redimensiona e apaga elementos de um design existente.
- `search-designs`, `get-design-content`, exportação (PDF/PNG), pastas,
  comentários e upload de assets.

## Limites

- Upload de assets só por URL pública; logos e fotos locais devem ser
  enviados manualmente para o Canva uma vez.
- Kit de marca e redimensionamento exigem plano Pro ou superior;
  autofill de brand templates só no Enterprise.
- Templates do marketplace não ficam disponíveis pelo MCP.

## Fluxo recomendado

Duplicar um design base com a identidade visual (ex.: onboarding antigo
da AgroOps) e substituir os textos pela copy, em vez de gerar do zero
por prompt. Assim a identidade vem do template e o conteúdo, da copy.
