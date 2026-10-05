CREATE TABLE IF NOT EXISTS nota_lida (
 chave_acesso char(44) PRIMARY KEY,
 resultado jsonb NOT NULL,
 criada_em timestamptz NOT NULL DEFAULT now()
);
