-- =====================================================================
-- POUPEE — Dados de exemplo (mesmo conteúdo do mock em script.js)
-- Rodar depois do schema.sql
-- =====================================================================

-- Login de exemplo: thiago@exemplo.com / 123456 (hash bcrypt gerado pela API)
INSERT INTO usuarios (nome, email, senha_hash) VALUES
  ('Thiago Veronez', 'thiago@exemplo.com', '$2b$10$9H8UegKKMcPtSrydJGXE7egcX9YnpIl2vdxpCAydhHuqDWYwWFat.');

-- Categorias de despesa
INSERT INTO categorias (usuario_id, nome, cor, icone, tipo, ordem) VALUES
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Moradia',      '#F2600C', '🏠', 'despesa', 1),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Alimentação',  '#2F7DBF', '🛒', 'despesa', 2),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Transporte',   '#8A5CD6', '⛽', 'despesa', 3),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Lazer',        '#D6497D', '🎬', 'despesa', 4),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Saúde',        '#3EA37A', '💊', 'despesa', 5),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Educação',     '#C9A227', '📚', 'despesa', 6),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Outros',       '#6B6B66', '📦', 'despesa', 7);

-- Categorias de receita
INSERT INTO categorias (usuario_id, nome, cor, icone, tipo, ordem) VALUES
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Renda Fixa',    '#1E8A5F', '💼', 'receita', 8),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Renda Extra',   '#3FA36B', '💻', 'receita', 9),
  ((SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com'), 'Investimentos', '#2F9E82', '📈', 'receita', 10);

-- Despesas e receitas (a categoria é encontrada pelo nome)
INSERT INTO transacoes (usuario_id, categoria_id, tipo, descricao, valor, data, status)
SELECT c.usuario_id, c.id, v.tipo, v.descricao, v.valor, v.data::date, v.status
FROM (VALUES
  ('despesa', 'Aluguel',              950.00, '2026-09-05', 'pagar', 'Moradia'),
  ('despesa', 'Mercado',              386.40, '2026-08-28', 'paga',  'Alimentação'),
  ('despesa', 'Combustível',          210.00, '2026-09-18', 'pagar', 'Transporte'),
  ('despesa', 'Internet',              99.90, '2026-08-10', 'paga',  'Moradia'),
  ('despesa', 'Assinatura streaming',  39.90, '2026-09-22', 'pagar', 'Lazer'),
  ('despesa', 'Farmácia',              68.20, '2026-08-14', 'paga',  'Saúde'),
  ('receita', 'Salário',             4200.00, '2026-08-01', 'paga',  'Renda Fixa'),
  ('receita', 'Freelance de design', 1500.00, '2026-08-14', 'paga',  'Renda Extra'),
  ('receita', 'Dividendos',           420.00, '2026-08-20', 'paga',  'Investimentos')
) AS v (tipo, descricao, valor, data, status, categoria)
JOIN categorias c
  ON c.nome = v.categoria AND c.tipo = v.tipo
 AND c.usuario_id = (SELECT id FROM usuarios WHERE email = 'thiago@exemplo.com');
