## 1. Botão "Voltar" na página do módulo

Em `src/routes/_authenticated/modulo.$slug.tsx`, adicionar no topo (acima do título do módulo) um botão "← Voltar ao Dashboard" usando `<Link to="/">` do TanStack Router, com ícone `ArrowLeft` do lucide. Fica alinhado à esquerda, discreto, sempre visível ao entrar em Vendas / Retenção / Value Chain / SQE.

## 2. Modo de edição em "Metas por loja"

Em `src/routes/_authenticated/gestao/metas.tsx`:

- Hoje cada linha já tem input editável salvando no `onBlur`. O problema é que a meta é **anual** (sem período) — a mesma vale para todos os meses.
- Adicionar por linha um botão **Editar** (lápis) que abre um pequeno popover/dialog com duas opções:
  - **Aplicar somente ao mês selecionado** (usa o mês/ano do seletor global do AppShell) — grava um override mensal.
  - **Aplicar a todos os meses (padrão da loja)** — grava o override anual atual (comportamento existente).
- Mostrar ao lado da meta: badge "padrão" ou "mês X/AAAA" indicando a origem do valor exibido.

**Mudança de schema necessária:** adicionar colunas opcionais `period_year` e `period_month` (nullable) em `store_indicator_targets` e trocar o unique para `(store_id, indicator_id, period_year, period_month)` tratando NULL como "padrão anual". O `effectiveTarget` em `src/lib/scoring.ts` e as queries de módulo/dashboard/consolidado passam a preferir o override do mês atual, caindo para o anual, caindo para `default_target`.

## 3. Botão Editar em "Indicadores" (catálogo)

Em `src/routes/_authenticated/gestao/indicadores.tsx`, cada linha ganha um botão **Editar** (lápis) que transforma a linha em modo edição inline (mesmos campos do formulário de criação: subgrupo, nome, pontuação, meta padrão, tipo, ordem), com botões Salvar / Cancelar. Persiste via `update` na tabela `indicators`.

## 4. Botão Editar em "Lojas & LTs"

Em `src/routes/_authenticated/gestao/lojas.tsx`, cada card de loja ganha um botão **Editar** no cabeçalho que permite alterar `name` e `code` inline (input + Salvar / Cancelar). Atribuição de LTs continua como está.

## Detalhes técnicos

- Migration: alterar `store_indicator_targets` (nullable period_year/month + novo unique). Manter linhas existentes como "padrão anual" (period_year/month = NULL).
- `scoring.effectiveTarget(ind, override)` passa a receber o override já resolvido pela query (mês → anual → default), sem mudar assinatura pública se possível.
- Dashboard (`index.tsx`), módulo (`modulo.$slug.tsx`), histórico e consolidado: adaptar as queries de `store_indicator_targets` para trazer ambos (mês corrente + anuais) e resolver no cliente.
- UI de edição usa `Dialog` do shadcn onde couber, ou modo inline nas tabelas para não pesar.

Pergunta rápida antes de eu executar: quando você editar a meta "somente para o mês selecionado", o valor deve **substituir** o padrão só naquele mês (padrão continua valendo nos outros), ou você quer também poder editar mês a mês individualmente no futuro? Vou assumir a primeira (override pontual do mês, com fallback ao anual), a menos que diga o contrário.