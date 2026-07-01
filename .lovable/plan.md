## Nova visão da Gestão

Criar experiência dedicada para usuários com role `gestao`, mantendo a LT intacta. O foco é transformar o painel principal em um "grid de lojas" e permitir drill-down por loja com edição completa.

### 1. Painel Gestão (`/` para role gestao)

Detectar role em `src/routes/_authenticated/index.tsx`. Se `gestao`, renderizar novo componente `GestaoOverview`; se `lt`, manter Dashboard atual.

`GestaoOverview` mostra um **grid de cards de lojas** (3 colunas desktop, inspirado no layout de "Projects" da referência):

- Cabeçalho de cada card: nome da loja (destaque) + "LT: Fulana" em fonte pequena/muted (ou "Sem LT" quando não atribuída).
- 4 mini-barras horizontais, uma por macro indicador (Segurança/Qualidade/ESG, Vendas, Retenção, Value Chain), cada uma com:
  - ícone + nome curto
  - `pontos realizados / máx` e `%`
  - barra na cor do módulo
- Rodapé do card: pontuação total + classificação (badge colorido A/B/C/D), similar ao card atual da LT.
- Card inteiro clicável → navega para `/gestao/loja/$storeId`.

Filtros no topo: busca por nome de loja + período (já existe no AppShell). Ordenação por nome (default) ou por % realizado.

Reaproveitar `resolveTarget`, `pointsFrom`, `classifyScore` — uma única query buscando stores + assignments + profiles (para nome da LT) + indicators + targets + entries do mês.

### 2. Drill-down da loja (`/gestao/loja/$storeId`)

Nova rota que replica visualmente o Dashboard da LT e a listagem de indicadores, com a loja fixada pela URL (ignora o `selectedStoreId` global só nessa tela):

- Cabeçalho: nome da loja + LT responsável + botão "← Voltar" para `/`.
- 3 cards de topo (Realizado / Projeção / Classificação) — mesmos do Dashboard LT.
- **Filtro de macro indicador**: `Select` com opções "Todos" (default), "Segurança, Qualidade e ESG", "Vendas", "Retenção", "Value Chain".
- Listagem:
  - Quando "Todos": renderiza os 4 módulos empilhados, cada um com sua tabela completa de subtarefas (mesmo componente da tela `/modulo/$slug`).
  - Quando um módulo específico: mostra só aquele módulo.
- **Edição inline liberada**: os inputs de Realizado e Projeção são editáveis, salvando em `indicator_entries` para a loja do URL. RLS já permite gestão editar qualquer loja.

### 3. Refatoração de componente

Extrair o corpo da tabela de indicadores de `src/routes/_authenticated/modulo.$slug.tsx` para `src/components/ModuleIndicatorsTable.tsx` (props: `storeId`, `moduleSlug`, `year`, `month`). Reutilizar na rota de módulo da LT e na nova tela de gestão para evitar duplicação.

### 4. Sidebar & navegação

Em `AppShell`, para role `gestao`:
- Manter "Painel" (agora é o novo overview) e "Histórico".
- Manter as entradas de Gestão (Consolidado, Metas, Indicadores, Lojas & LTs) já existentes.
- Ocultar o seletor global de loja quando estivermos em `/gestao/loja/$storeId` (a loja vem da URL).

### Detalhes técnicos

- Arquivos novos: `src/routes/_authenticated/gestao/loja.$storeId.tsx`, `src/components/GestaoOverview.tsx`, `src/components/ModuleIndicatorsTable.tsx`.
- Arquivos alterados: `src/routes/_authenticated/index.tsx` (switch por role), `src/routes/_authenticated/modulo.$slug.tsx` (usa componente extraído), `src/components/AppShell.tsx` (ajustes menores de menu).
- Sem migrações de banco — RLS de gestão já cobre leitura/escrita em todas as lojas.
- Identidade visual mantida (mesmas cores de módulo, cards arredondados, badges de classificação).
