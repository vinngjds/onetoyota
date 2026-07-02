## Objetivo
Reordenar a sidebar para que "Insights" apareça abaixo de "Resumo", fora do grupo "Gestão".

## Mudanças

### `src/components/AppShell.tsx`
- Mover `<NavItem to="/gestao/insights" icon={Sparkles} label="Insights" />` para logo abaixo do item "Resumo" (também restrito a `isGestao`).
- Remover o item Insights de dentro do bloco "Gestão".

Ordem final da sidebar (Gestão):
```
Dashboard
Histórico
Resumo
Insights
--- Gestão ---
Consolidado
Lojas & LTs
Indicadores
Metas por loja
```

## Fora do escopo
- Nenhuma alteração de rota, permissões ou lógica do módulo Insights.
