-- =====================================================================
-- POUPEE — Banco de dados relacional (PostgreSQL 14+, ex.: Neon)
-- Controle financeiro pessoal — TG/PI Fatec Franca
--
-- Modelo:
--   usuarios   (1) ---- (N) categorias
--   usuarios   (1) ---- (N) transacoes
--   categorias (1) ---- (N) transacoes
--
-- Regras de negócio aplicadas no schema:
--   - valor da transação sempre positivo
--   - toda transação precisa estar vinculada a uma categoria
--   - a categoria usada numa transação precisa ser do mesmo tipo (despesa/receita)
--   - balanço calculado por data de competência (coluna `data`)
--   - saldo realizado = receitas − despesas pagas; saldo previsto = receitas − todas as despesas
--
-- Rode no banco já criado (no Neon, no "SQL Editor" do banco neondb).
-- A API também cria estas tabelas sozinha na primeira vez que conecta
-- num banco vazio (ver backend/src/repositorios/postgres/conexao.js).
-- =====================================================================

-- ---------------------------------------------------------------------
-- USUÁRIOS
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL,
  tema          VARCHAR(5)   NOT NULL DEFAULT 'light',
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT chk_usuarios_tema CHECK (tema IN ('light', 'dark'))
);

-- ---------------------------------------------------------------------
-- CATEGORIAS (cada usuário tem seu próprio conjunto; nome/cor editáveis,
-- `favorita` e `ordem` sustentam o drag-and-drop e os favoritos da tela)
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id INTEGER     NOT NULL,
  nome       VARCHAR(60) NOT NULL,
  cor        CHAR(7)     NOT NULL DEFAULT '#F2600C',
  icone      VARCHAR(8)  NOT NULL DEFAULT '🏷️',
  tipo       VARCHAR(7)  NOT NULL,
  favorita   BOOLEAN     NOT NULL DEFAULT FALSE,
  ordem      INTEGER     NOT NULL DEFAULT 0,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_categorias_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT chk_categorias_tipo CHECK (tipo IN ('despesa', 'receita')),
  CONSTRAINT chk_categorias_cor CHECK (cor ~ '^#[0-9A-Fa-f]{6}$')
);

-- Nome único por usuário e tipo, sem diferenciar maiúsculas de minúsculas
CREATE UNIQUE INDEX uq_categoria_por_usuario ON categorias (usuario_id, lower(nome), tipo);
CREATE INDEX idx_categorias_usuario_tipo ON categorias (usuario_id, tipo);

-- ---------------------------------------------------------------------
-- TRANSAÇÕES (despesas e receitas na mesma tabela, diferenciadas por `tipo`)
-- ---------------------------------------------------------------------
CREATE TABLE transacoes (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id    INTEGER       NOT NULL,
  categoria_id  INTEGER       NOT NULL,
  tipo          VARCHAR(7)    NOT NULL,
  descricao     VARCHAR(160)  NOT NULL,
  valor         NUMERIC(10,2) NOT NULL,
  data          DATE          NOT NULL,
  status        VARCHAR(5)    NOT NULL DEFAULT 'paga',
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_transacoes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_transacoes_categoria FOREIGN KEY (categoria_id)
    REFERENCES categorias(id) ON DELETE RESTRICT,
  CONSTRAINT chk_transacoes_tipo CHECK (tipo IN ('despesa', 'receita')),
  CONSTRAINT chk_transacoes_status CHECK (status IN ('pagar', 'paga')),
  CONSTRAINT chk_transacoes_valor_positivo CHECK (valor > 0)
);

COMMENT ON COLUMN transacoes.data IS 'vencimento (despesa) ou recebimento (receita) — usada como data de competência';

CREATE INDEX idx_transacoes_usuario_data   ON transacoes (usuario_id, data);
CREATE INDEX idx_transacoes_usuario_status ON transacoes (usuario_id, tipo, status);

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------
-- Atualiza `atualizado_em` a cada UPDATE
CREATE FUNCTION fn_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_atualizado_em
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();

CREATE TRIGGER trg_transacoes_atualizado_em
BEFORE UPDATE ON transacoes
FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();

-- Garante que a categoria escolhida seja do mesmo tipo da transação
-- (ex.: não deixar lançar despesa numa categoria de receita)
CREATE FUNCTION fn_transacoes_categoria_tipo() RETURNS trigger AS $$
DECLARE
  tipo_categoria VARCHAR(7);
BEGIN
  SELECT tipo INTO tipo_categoria FROM categorias WHERE id = NEW.categoria_id;
  IF tipo_categoria IS NULL OR tipo_categoria <> NEW.tipo THEN
    RAISE EXCEPTION 'A categoria escolhida não é do mesmo tipo da transação (despesa/receita).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transacoes_categoria_tipo
BEFORE INSERT OR UPDATE ON transacoes
FOR EACH ROW EXECUTE FUNCTION fn_transacoes_categoria_tipo();

-- ---------------------------------------------------------------------
-- VIEW — balanço mensal por data de competência (usada no Dashboard)
-- ---------------------------------------------------------------------
CREATE VIEW vw_balanco_mensal AS
SELECT
  usuario_id,
  EXTRACT(YEAR FROM data)::int  AS ano,
  EXTRACT(MONTH FROM data)::int AS mes,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS total_receitas,
  SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS total_despesas,
  SUM(CASE WHEN tipo = 'despesa' AND status = 'pagar' THEN valor ELSE 0 END) AS total_pendente,
  -- RN001: saldo do período só desconta o que já foi pago; o previsto desconta tudo
  SUM(CASE WHEN tipo = 'receita' THEN valor WHEN status = 'paga' THEN -valor ELSE 0 END) AS saldo_realizado,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) AS saldo_previsto
FROM transacoes
GROUP BY usuario_id, EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data);
