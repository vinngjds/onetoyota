
-- Lexus modules
INSERT INTO public.modules (name, slug, sort_order, store_type) VALUES
  ('Qualidade',            'lexus-qualidade',   1, 'lexus'),
  ('Vendas',               'lexus-vendas',      2, 'lexus'),
  ('Retenção',             'lexus-retencao',    3, 'lexus'),
  ('Value Chain',          'lexus-value-chain', 4, 'lexus'),
  ('Customer Experience',  'lexus-customer-experience', 5, 'lexus'),
  ('Extras',               'lexus-extras',      6, 'lexus');

-- Lexus indicators
WITH m AS (
  SELECT id, slug FROM public.modules WHERE store_type = 'lexus'
)
INSERT INTO public.indicators (module_id, subgroup, name, max_points, default_target, unit, sort_order)
SELECT (SELECT id FROM m WHERE slug=x.slug), x.subgroup, x.name, x.mp, x.mp, 'number', x.so
FROM (VALUES
  ('lexus-qualidade', NULL::text, 'NPS Vendas - Média Mensal',                    7::numeric, 10),
  ('lexus-qualidade', NULL,       'NPS Vendas - Média Acumulada',                 3, 20),
  ('lexus-qualidade', NULL,       'NPS Serviços - Média Mensal',                  7, 30),
  ('lexus-qualidade', NULL,       'NPS Serviços - Média Acumulada',               3, 40),
  ('lexus-qualidade', NULL,       'FIRR',                                         3, 50),
  ('lexus-qualidade', NULL,       'Certificação Takumi e Trilha de Aprendizagem', 5, 60),
  ('lexus-vendas',    NULL,       'Desempenho de Vendas - Mensal',               12, 10),
  ('lexus-vendas',    NULL,       'Desempenho de Vendas - Acumulado',             4, 20),
  ('lexus-vendas',    NULL,       'Collaboration',                                1, 30),
  ('lexus-retencao',  NULL,       'Retenção Total',                              13, 10),
  ('lexus-retencao',  NULL,       'Passagens Oficina (CSR + CSP)',                5, 20),
  ('lexus-retencao',  NULL,       'Ticket Médio (CSR + CSP)',                     5, 30),
  ('lexus-retencao',  NULL,       'BPUS',                                         5, 40),
  ('lexus-value-chain', NULL,     'Vendas de Usados',                             6, 10),
  ('lexus-value-chain', NULL,     'Trade In',                                     5, 20),
  ('lexus-value-chain', NULL,     'Acessórios',                                   3, 30),
  ('lexus-customer-experience', NULL, 'Customer Round Table',                     2, 10),
  ('lexus-customer-experience', NULL, 'Experiência Omotenashi',                   6, 20),
  ('lexus-customer-experience', NULL, 'Detalhe Omotenashi',                       5, 30),
  ('lexus-extras', NULL, 'Utilização Mídia Cooperada',                            2, 10),
  ('lexus-extras', NULL, 'LEXUSCARE: Blindagem Certificada',                      1, 20),
  ('lexus-extras', NULL, 'Baixas até o dia 15 do mês',                            2, 30)
) AS x(slug, subgroup, name, mp, so);
