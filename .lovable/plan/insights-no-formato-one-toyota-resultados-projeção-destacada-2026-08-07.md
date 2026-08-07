# Insights no formato "ONE TOYOTA: Resultados" + projeção destacada + log de atualização

## 1. Novo módulo Insights (substitui o conteúdo atual)

A tela `/gestao/insights` passa a ter um overview executivo. Todos os cálculos usam o
**acumulado de janeiro até o mês anterior ao atual** (ex.: em agosto/2026 → Jan–Jul/2026).

### Bloco 1 — Categoria Média e distribuição A/B/C/D
Tabela com 3 linhas:

```text
Período              | Categoria Média | A    | B    | C    | D
Jan–Jun 26           | 79,58 (B)       | 26%  | 51%  | 20%  | 3%
Jul–Dez 26 (parcial) | ...             | ...  | ...  | ...  | ...
Mês anterior (Jul26) | 76,00 (B)       | 23%  | 33%  | 30%  | 14%
```

- Categoria Média = média do % de atingimento das lojas com lançamentos no período,
  classificada pelas faixas atuais (A ≥ 85, B ≥ 75, C ≥ 65, D < 65).
- Colunas A/B/C/D = % de lojas em cada classificação no período.
- Lojas sem nenhum lançamento no período são ignoradas (hoje só Vitória tem dados).

### Bloco 2 — Top 10 melhores e Top 10 piores
Duas tabelas/gráficos lado a lado, com ranking, nome da loja, % acumulado e badge de
categoria colorida — melhores em ordem decrescente, piores em crescente, ambos com o
mesmo acumulado Jan–mês anterior.

### Bloco 3 — KPIs com menores atingimentos
Lista descritiva (painel à direita, como na imagem) dos indicadores com pior % médio de
atingimento no acumulado, considerando todas as lojas com dados. Mostra o nome do
indicador e o % médio; ordenado do pior para o melhor, limitado aos 10 piores.

### Filtros
Mantidos apenas: região e busca por loja. Os filtros de janela/módulo/ocorrências saem,
pois o período agora é fixo pela regra do acumulado. Os blocos antigos (linha do tempo,
lojas-problema, recorrência e painel de causa raiz) são removidos.

## 2. Projeção em destaque na loja
No dashboard de loja (LT e gestão), a Projeção passa a ser o número dominante: fonte
maior/negrito e ordem antes do Realizado nos cards de resumo, mantendo o Realizado
visível em tamanho menor. Nada muda no cálculo.

## 3. Log de atualização (somente gestão)
- Botão **Salvar** em cada linha de indicador (substitui o salvamento silencioso no blur),
  com confirmação via toast.
- Nova coluna **Última atualização** na tabela de indicadores, visível apenas para gestão,
  mostrando data/hora e o nome de quem registrou.

## Detalhes técnicos
- `indicator_entries` já possui `updated_at` e `updated_by`; a coluna de log lê esses
  campos e resolve o nome via `profiles`. Nenhuma migração é necessária.
- O upsert atual já grava `updated_by`/`updated_at`; o botão Salvar apenas passa a
  disparar a mutação explicitamente.
- Cálculos reaproveitam `pointsFrom`, `resolveTarget`, `deliveryStatus` e `classifyScore`
  de `src/lib/scoring.ts`.
- Arquivos afetados: `src/routes/_authenticated/gestao/insights.tsx` (reescrito),
  `src/components/ModuleIndicatorsTable.tsx`, `src/routes/_authenticated/index.tsx`,
  `src/routes/_authenticated/gestao/loja.$storeId.tsx`.

## Fora do escopo
- Importação de dados das outras lojas.
- Tabela de auditoria completa (histórico de todas as alterações).
