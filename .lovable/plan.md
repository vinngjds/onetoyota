# Importação do histórico — Loja Vitória (Jan a Jun/2026)

## Objetivo
Popular `indicator_entries` com os 6 primeiros meses de 2026 da loja Vitória, replicando exatamente as pontuações mostradas nas planilhas, para que o Dashboard, Histórico e Consolidado exibam dados reais para teste.

## Estratégia de conversão
Como as colunas mensais dos prints já são **pontuações calculadas** (ex.: Yaris Cross = 3,00 pts), farei engenharia reversa para gravar um `realizado` equivalente:

- `pct = pontos_do_mes / max_points` do indicador
- `realizado = pct × meta_efetiva` (meta da loja, se houver override, senão `default_target`)
- Para indicadores `boolean`: `realizado = 1` se pontos > 0, senão `0`
- Para indicadores sem meta (`number` sem target claro): `realizado = pontos_do_mes` (mantém proporção 1:1 quando `max_points = target`)

Isso garante que `pointsFrom()` recalcule exatamente o valor original do print.

## Projeção
Coluna **PROJEÇÃO 2026** de cada linha será replicada em todos os 6 meses no campo `projecao` (mesma conversão acima).

## Escopo dos dados
- **Loja:** Vitória (buscar por `name = 'Vitória'`)
- **Período:** 2026-01 a 2026-06
- **Indicadores:** todos os 76 já cadastrados no catálogo, cobrindo os 4 módulos
- **Origem:** transcrição manual dos dois prints anexados (imagens `image-2.png` e `image-3.png`)

## Execução técnica
1. Leitura completa dos prints para montar uma tabela `{indicator_name, subgroup, module, projecao, jan..jun}` em pontos.
2. Match dos indicadores por `(module_slug, subgroup, name)` para obter `id`, `max_points`, `default_target`, `unit`.
3. Geração de INSERTs em lote no `indicator_entries` (`ON CONFLICT (store_id, indicator_id, period_year, period_month) DO UPDATE`) com os campos `realizado` e `projecao` convertidos.
4. Verificação: consultar totais por mês e comparar com a linha de totais de cada módulo do print (QUALIDADE E ESG 12,00 / VENDAS 23,00 / RETENÇÃO 30,00 / VALUE CHAIN 35,00) — tolerância de arredondamento ~0,05 pts.

## Observações
- Nenhuma alteração de schema, UI ou lógica de scoring.
- Só afeta a loja Vitória; demais lojas permanecem vazias.
- Caso algum indicador do print não exista no catálogo (ex.: "Pontos Extras — B&P In House", "Modernização 25"), listo ao final para você decidir se cadastramos.
