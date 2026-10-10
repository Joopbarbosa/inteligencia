# evolution

Serviço compartilhado de WhatsApp (não oficial) para os produtos da pasta `inteligencia/`. Roda a **Evolution API** com a versão fixada em `.env` e um Postgres próprio. Nada aqui é específico de um produto: cada produto cria **a sua instância** (um número de WhatsApp).

Primeiro produto: Olivia Secretária Pessoal (projeto 12 no OpenProject). Tarefa de origem: #820 (projeto inteligencia).

## Decisões

- Só a Evolution API (Baileys). A Evolution Go foi descartada por ora (decisão do Gestor, 08/10/2026).
- Versão fixada, nunca `latest`: `evoapicloud/evolution-api:v2.3.7`, a estável que não exige ativação de licença. A 2.3.7 tem relatos abertos de mensagens privadas pendentes (issue #2626 do repositório); por isso a escolha é provisória e depende do teste prático da tarefa #826 da Olivia.
- Armazenamento de conteúdo desligado: `DATABASE_SAVE_DATA_NEW_MESSAGE`, `DATABASE_SAVE_MESSAGE_UPDATE`, `DATABASE_SAVE_DATA_CONTACTS`, `DATABASE_SAVE_DATA_CHATS`, `DATABASE_SAVE_DATA_LABELS`, `DATABASE_SAVE_DATA_HISTORIC` e `DATABASE_SAVE_IS_ON_WHATSAPP` em `false`; `S3_ENABLED=false`; só `DATABASE_SAVE_DATA_INSTANCE=true`. A confirmação de que nada de mensagem fica guardado é um dos critérios do teste.
- Nenhuma porta publicada no host. Os produtos entram pela rede Docker externa `evolution-rede`.
- Cada produto usa **só a chave da sua instância**, nunca a chave global.

## Como subir

```
docker network create evolution-rede        # uma vez
cp .env.example .env                        # preencher os valores; nunca commitar o .env
docker compose up -d                        # sem portas no host

# teste local, com a porta só em 127.0.0.1:8081
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Como um produto usa

1. Entrar na rede `evolution-rede` no compose do produto.
2. Criar a instância do produto pela API (com a chave global, uma vez), com um nome próprio, e guardar **a chave da instância** devolvida. Os detalhes do pedido de criação são confirmados no teste da tarefa #826 e entram aqui depois.
3. Configurar o webhook da instância para o backend do produto, com segredo próprio.
4. O produto fala com `http://evolution-api:8080` usando a chave da instância.

## Riscos conhecidos

- O número pode ser desconectado ou banido (protocolo não oficial). Use número reserva nos testes e tenha número de contingência em produção.
- A queda deste serviço derruba o canal de todos os produtos: backup da sessão e monitoramento são requisitos de operação.
- Quando a `inteligencia` tiver VPS própria, os produtos trocam o endereço por variável de ambiente e a comunicação passa a precisar de rede privada entre as máquinas.
