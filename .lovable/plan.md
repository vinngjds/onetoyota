## 1. Novo módulo `Insights` (somente Gestão)

Rota: `src/routes/_authenticated/gestao/insights.tsx`. Item na sidebar visível apenas para role `gestao`.

Layout em 4 blocos empilhados, todos compartilhando os filtros do topo:

**Filtros globais do Insights**
- Janela: últimos 3 / 6 / 12 meses (default 6), terminando no período selecionado no AppShell.
- Região (mesmas opções do Painel de Gestão) + busca por loja.
- Módulo (Todos / Segurança / Vendas / Retenção / Value Chain).
- "Ocorrências mínimas" para considerar recorrente (default 3).

**Bloco A — Linha do tempo de pontuação e classificação**
- Gráfico de linhas (recharts) com uma série por loja, eixo X = mês, eixo Y = % de atingimento total.
- Legenda com badge de classificação (A/B/C/D) do mês mais recente ao lado do nome da loja.
- Tooltip mostra pontos/máx e letra em cada ponto.
- Toggle "Comparar por módulo" troca para 4 linhas do módulo (fixa uma loja no filtro).

**Bloco B — Ranking de lojas-problema**
- Gráfico de barras horizontais: para cada loja, contagem de indicadores classificados como Não Entregue ou Parcial no somatório da janela.
- Ordenado do pior para o melhor. Clique numa barra abre o Bloco D já filtrado por essa loja.

**Bloco C — Indicadores recorrentemente não batidos**
- Tabela agrupada por Loja → Indicador com colunas: Módulo, Indicador, Ocorrências de Não Entregue, Ocorrências de Parcial, Último status, % médio de atingimento na janela, Meses (heatmap linha de bolinhas verde/amarelo/vermelho).
- Só aparecem indicadores com `nao_entregue + parcial >= ocorrências mínimas`.
- Ordenação por severidade (não entregue pesa mais).

**Bloco D — Drill-down causa raiz**
- Ao clicar num indicador da tabela do Bloco C, abre um painel lateral (Sheet) com: histórico do indicador naquela loja em todos os meses da janela (realizado, meta usada, pontos, status), média realizada, gap absoluto vs meta, e link "Editar na loja" para `/gestao/loja/$storeId?module=<slug>`.

Todos os cálculos reusam `resolveTarget`, `pointsFrom`, `pctReal`, `deliveryStatus`, `classifyScore` — nenhuma regra nova de scoring.

## 2. Ranking macro no Dashboard

No `GestaoOverview`, adicionar acima do grid uma nova seção "Classificação das lojas" com 3 tabelas lado a lado (colapsam para tabs no mobile):

- **Mês** — período selecionado no AppShell. Usa realizado do mês.
- **Acumulado** — de Jan até o mês selecionado. Soma pontos e máx de cada mês.
- **Projetado Ano** — Jan–Dez. Meses ≤ atual usam realizado; meses futuros assumem 100% de cada indicador (max_points). Divide pelo total anual (máx × 12).

Cada tabela lista todas as lojas ordenadas por % desc, com colunas: Loja | % | Classificação (badge colorido A/B/C/D usando as faixas atuais). Visual espelha a imagem enviada (linhas coloridas conforme a letra).

## 3. Detalhes técnicos

- Arquivos novos: `src/routes/_authenticated/gestao/insights.tsx`, `src/components/insights/ScoreTimeline.tsx`, `src/components/insights/StoreProblemsChart.tsx`, `src/components/insights/RecurringIssuesTable.tsx`, `src/components/insights/IndicatorDrilldownSheet.tsx`, `src/components/ClassificationRanking.tsx`.
- Alterados: `src/components/AppShell.tsx` (novo link "Insights" para gestão), `src/components/GestaoOverview.tsx` (renderiza `ClassificationRanking` no topo).
- Sem mudanças de schema, RLS ou seed — todos os dados necessários já existem em `indicator_entries`, `indicators`, `store_indicator_targets`, `stores`, `classification_bands`.
- Uma query única no Insights: busca todas as entradas dos últimos 12 meses de todas as lojas, mais catálogo/metas/bands, e deriva timeline/ranking/recorrentes em memória com `useMemo`.
- `recharts` já está no projeto (usado por shadcn/chart). Se não estiver, adicionar via `bun add recharts`.
