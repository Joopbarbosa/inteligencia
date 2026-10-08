CREATE TABLE chave_cliente (
 id uuid PRIMARY KEY,
 produto text NOT NULL CHECK (length(produto) BETWEEN 1 AND 100),
 hash char(64) UNIQUE NOT NULL,
 estado text NOT NULL DEFAULT 'ativa' CHECK (estado IN ('ativa','revogada')),
 criada_em timestamptz NOT NULL DEFAULT now()
);
