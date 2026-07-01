
# Plano — App de Indicadores Kuruma

## Visão geral
Aplicação web para substituir a planilha de acompanhamento de indicadores por loja. Dois perfis de acesso (Líder de Transformação e Gestão Administrativa), com preenchimento recorrente durante o mês e consolidação automática de pontuação.

## Perfis e permissões
- **Gestão Administrativa**: cria lojas, cria/edita indicadores (catálogo global), define metas padrão, ajusta metas por loja (exceções), atribui LTs às lojas, vê todas as lojas e dashboards consolidados.
- **Líder de Transformação (LT)**: acessa apenas as lojas atribuídas, preenche o valor Realizado de cada indicador e o valor de Projeção (manual).
- Cálculo automático de: % Real, Real (pontuação atingida) e Classificação final (A/B/C…).

## Estrutura de dados (Lovable Cloud)
- `stores` — lojas
- `profiles` — dados do usuário (nome)
- `user_roles` — papel (`lt` | `gestao`) em tabela separada, com função `has_role` (segurança)
- `store_assignments` — LT ↔ loja (many-to-many, atribuído pela Gestão)
- `modules` — 4 módulos fixos: Segurança/Qualidade/ESG, Vendas, Retenção, Value Chain
- `indicators` — catálogo (nome, módulo, subgrupo, pontuação máxima, tipo: %, número, moeda, SIM/NÃO)
- `store_indicator_targets` — meta (objetivo) por loja/indicador (override da meta global do indicador)
- `indicator_entries` — lançamentos recorrentes: loja, indicador, período (mês/ano), realizado, projeção, timestamp, autor
- `classification_bands` — faixas de pontuação → letra (A/B/C)

Todas as tabelas com RLS: LT só vê/edita dados das lojas atribuídas; Gestão vê tudo.

## Telas
1. **/auth** — Login e cadastro (e-mail/senha + Google). Design inspirado no mockup enviado (tons de azul, formas orgânicas, cartão branco arredondado).
2. **/ (dashboard LT)** — Seletor de loja (se tiver mais de uma) + 4 cards macro (Segurança/Qualidade/ESG, Vendas, Retenção, Value Chain) mostrando pontuação Realizado vs Objetivo e Classificação atual/projetada.
3. **/modulo/:slug** — Tabela do módulo com todas as micro-tarefas: colunas Pontuação, Objetivo, Realizado, % Real, Real, Projeção. Inputs inline para Realizado e Projeção; demais colunas calculadas.
4. **/historico** — Consulta de meses anteriores da loja.
5. **/gestao** (só Gestão) — Lista de todas as lojas com pontuação consolidada, filtros por mês, drill-down por loja.
6. **/gestao/lojas** — CRUD de lojas, atribuição de LTs.
7. **/gestao/indicadores** — CRUD do catálogo de indicadores + metas globais.
8. **/gestao/metas/:storeId** — Ajuste de metas específicas da loja (override).

## Regras de cálculo
- `% Real = Realizado / Objetivo` (respeitando tipo do indicador; SIM/NÃO = 100% ou 0%).
- `Real (pontuação) = min(% Real, 100%) × Pontuação` (regra padrão; ajustável se a Gestão pedir outra).
- `Projeção (pontuação)` a partir do valor projetado digitado pela LT, mesma fórmula.
- `Classificação` = faixa da soma das pontuações do mês (ex.: ≥90 = A, ≥80 = B…).
- Totais por módulo e total geral atualizados em tempo real.

## Design
Paleta azul do mockup (#4C6EF5 primário, tons claros de fundo), cartões brancos arredondados, tipografia sans-serif moderna (Figtree/Inter). Layout responsivo com sidebar colapsável para navegação entre módulos e áreas de gestão.

## Fora do escopo desta primeira entrega
- Importação da planilha atual (podemos adicionar depois).
- Exportação para Excel/PDF.
- Notificações por e-mail.
- App mobile nativo (será web responsivo).

## Detalhes técnicos
- TanStack Start + Lovable Cloud (Supabase gerenciado).
- Autenticação: e-mail/senha + Google (via broker Lovable).
- Papéis em `user_roles` + `has_role()` SECURITY DEFINER, RLS em todas as tabelas.
- Server functions (`createServerFn`) com `requireSupabaseAuth` para leituras/escritas autenticadas.
- Cálculos derivados feitos no cliente a partir dos dados brutos (Realizado, Projeção, Objetivo, Pontuação), evitando duplicar estado no banco.

Confirma que posso seguir com essa estrutura? Se sim, começo pelo login, cadastro de lojas/indicadores e o fluxo da LT.
