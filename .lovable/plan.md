## Objetivo
Mover o "Ranking Macro" (componente `ClassificationRanking`) do Dashboard da Gestão para um novo módulo dedicado chamado **Resumo**, acessível pela sidebar logo abaixo de "Histórico".

## Mudanças

### 1. Dashboard da Gestão (`src/components/GestaoOverview.tsx`)
- Remover o bloco:
  ```
  <h2>Classificação das lojas</h2>
  <ClassificationRanking />
  ```
- Remover o import não utilizado de `ClassificationRanking`.
- Mantém todo o restante (busca, filtros de região, ordenação, grid de cards das lojas).

### 2. Nova rota `/resumo` (`src/routes/_authenticated/resumo.tsx`)
- Cria rota nova usando `createFileRoute("/_authenticated/resumo")`.
- Renderiza um cabeçalho "Resumo — Classificação das lojas" + `<ClassificationRanking />` (3 tabelas: Mês, Acumulado, Projetado Ano).
- `head()` com título/description próprios.
- Acesso restrito ao perfil `gestao` (mesmo padrão usado em `insights.tsx` — redireciona ou mostra aviso se LT).

### 3. Sidebar (AppShell)
- Adicionar item "Resumo" na navegação da Gestão, posicionado imediatamente abaixo de "Histórico".
- Ícone coerente com o restante (ex.: `BarChart3` ou `Trophy`).
- Visível apenas para role `gestao` (LT continua com Dashboard + Histórico apenas).

## Fora do escopo
- Nenhuma alteração de lógica de cálculo, dados ou banco.
- Nenhuma alteração no comportamento do Histórico ou do Dashboard além da remoção do bloco de ranking.
