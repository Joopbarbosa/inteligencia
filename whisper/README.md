# whisper

Serviço compartilhado de **transcrição de áudio** (fala para texto), local e em CPU, para os produtos da pasta `inteligencia/`. Roda o **faster-whisper** atrás de uma API compatível com a da OpenAI (`POST /v1/audio/transcriptions`), com a imagem `ghcr.io/speaches-ai/speaches` na versão fixada em `.env`. Nada aqui é específico de um produto; cada produto recebe a sua chave de acesso.

Primeiro produto: Olivia Secretária Pessoal (projeto 12 no OpenProject). Tarefa de origem: #828 (teste de viabilidade). Autorizado pelo Gestor em 09/10/2026, com a condição de nascer genérico.

## Decisões

- Versão da imagem fixada, nunca `latest`: `ghcr.io/speaches-ai/speaches:0.8.3-cpu`.
- Modelo recomendado: `Systran/faster-whisper-small` em `int8`; o `base` é mais rápido e erra mais. O modelo é carregado sob demanda e descartado depois de `WHISPER_MODELO_TTL` segundos parado, para devolver a memória (a máquina é compartilhada).
- Nenhuma porta publicada no host. Os produtos entram pela rede Docker externa `whisper-rede` e falam com `http://whisper-api:8000`.
- A API exige a chave (`Authorization: Bearer <chave>`) em todas as rotas, inclusive `/health`.
- O serviço não guarda áudio: o arquivo vive só na requisição. Quem chama continua responsável por não persistir o áudio (INV-OL-7 da Olivia).

## Como subir

```
docker network create whisper-rede          # uma vez
cp .env.example .env                        # gerar uma chave aleatória longa; nunca commitar o .env
docker compose up -d --wait                 # sem portas no host

# teste local, com a porta só em 127.0.0.1:8083
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait

# baixar os modelos (uma vez; ficam no volume)
curl -X POST -H "Authorization: Bearer $CHAVE" http://127.0.0.1:8083/v1/models/Systran/faster-whisper-small
```

## Como um produto usa

1. Entrar na rede `whisper-rede` no compose do produto.
2. `POST http://whisper-api:8000/v1/audio/transcriptions` com `multipart/form-data`: `file` (o áudio; OGG/Opus do WhatsApp funciona), `model=Systran/faster-whisper-small`, `language=pt`, `response_format=json`. Resposta: `{"text": "..."}`.
3. Erros: `403` sem chave; `415` para arquivo vazio, corrompido ou de tipo não suportado; resposta com `text` vazio para silêncio ou ruído.

## Medidas (CPU, 16 núcleos, sem GPU; ver o relatório da #828 na pasta da versão da Olivia)

| Modelo | Áudio de 2 min | Memória (pico) |
|---|---|---|
| small | cerca de 26 a 29 s | cerca de 1,1 GB |
| base | cerca de 10 a 13 s | cerca de 0,9 GB |

## Riscos conhecidos

- Exige cerca de 1,5 GB de memória livre enquanto o modelo está carregado; dimensionar a VPS considerando isto.
- Acerto medido só com voz sintética; a validação com áudios reais de WhatsApp é feita no teste manual de cada produto.
