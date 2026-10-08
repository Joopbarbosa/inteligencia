CREATE TABLE alerta (
 id UUID PRIMARY KEY, uf VARCHAR(2) NOT NULL, leiaute TEXT NOT NULL,
 motivo TEXT NOT NULL CHECK(motivo IN ('UF_SEM_LEITOR','LEITOR_FALHOU')),
 estado TEXT NOT NULL DEFAULT 'ABERTO' CHECK(estado IN ('ABERTO','RESOLVIDO')),
 envio TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(envio IN ('PENDENTE','ENVIADO')),
 tarefa_id INTEGER, contador INTEGER NOT NULL DEFAULT 1,
 tentativas INTEGER NOT NULL DEFAULT 0, criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
 ultima_tentativa TIMESTAMPTZ, proxima_tentativa TIMESTAMPTZ NOT NULL DEFAULT now(),
 ultimo_comentario TIMESTAMPTZ, resolvida_em TIMESTAMPTZ
);
CREATE UNIQUE INDEX alerta_aberto_uf_leiaute ON alerta(uf,leiaute) WHERE estado='ABERTO';
CREATE TABLE amostra (
 id UUID PRIMARY KEY, alerta_id UUID NOT NULL REFERENCES alerta(id),
 resumo CHAR(64) NOT NULL, conteudo TEXT NOT NULL, criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(alerta_id,resumo)
);
CREATE INDEX amostra_retencao ON amostra(criada_em);
