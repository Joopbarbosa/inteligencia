CREATE TABLE IF NOT EXISTS uso_ia (
 chave_cliente_id uuid NOT NULL REFERENCES chave_cliente(id),
 conta_id uuid NOT NULL,
 mes char(7) NOT NULL,
 quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
 PRIMARY KEY (chave_cliente_id,conta_id,mes)
);
CREATE TABLE IF NOT EXISTS reserva_ia (
 id uuid PRIMARY KEY,
 chave_cliente_id uuid NOT NULL REFERENCES chave_cliente(id),
 conta_id uuid NOT NULL,
 mes char(7) NOT NULL,
 expira_em timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reserva_ia_chave_mes ON reserva_ia(chave_cliente_id,mes);
