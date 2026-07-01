export type Indicator = {
  id: string;
  name: string;
  subgroup: string | null;
  max_points: number;
  default_target: number | null;
  unit: string;
  module_id: string;
  sort_order: number;
};

export type Entry = {
  indicator_id: string;
  realizado: number | null;
  projecao: number | null;
};

export function effectiveTarget(ind: Indicator, override?: number | null) {
  return override ?? ind.default_target ?? 0;
}

export type TargetRow = {
  indicator_id: string;
  target: number | string;
  period_year: number | null;
  period_month: number | null;
};

/** Resolve meta com prioridade: mês específico → padrão anual da loja → default do indicador. */
export function resolveTarget(
  ind: Indicator,
  targets: TargetRow[],
  year: number,
  month: number,
): number {
  const list = targets.filter((t) => t.indicator_id === ind.id);
  const monthly = list.find((t) => t.period_year === year && t.period_month === month);
  if (monthly) return Number(monthly.target);
  const annual = list.find((t) => t.period_year == null && t.period_month == null);
  if (annual) return Number(annual.target);
  return ind.default_target ?? 0;
}

// % Real = realizado / objetivo (para boolean: 1 = 100%)
export function pctReal(ind: Indicator, realizado: number | null, target: number) {
  if (realizado == null) return null;
  if (ind.unit === "boolean") return realizado >= 1 ? 1 : 0;
  if (!target) return realizado > 0 ? 1 : 0;
  return realizado / target;
}

// pontuação = min(%Real, 1) × max_points
export function pointsFrom(ind: Indicator, value: number | null, target: number) {
  const p = pctReal(ind, value, target);
  if (p == null) return 0;
  return Math.min(Math.max(p, 0), 1) * Number(ind.max_points);
}

export type DeliveryStatus = "entregue" | "parcial" | "nao-entregue";

/** Null realizado é tratado como Não Entregue. */
export function deliveryStatus(
  ind: Indicator,
  realizado: number | null,
  target: number,
): DeliveryStatus {
  if (realizado == null || realizado === 0) return "nao-entregue";
  if (ind.unit === "boolean") return realizado >= 1 ? "entregue" : "nao-entregue";
  if (!target) return realizado > 0 ? "entregue" : "nao-entregue";
  if (realizado >= target) return "entregue";
  return "parcial";
}

export function classifyScore(
  totalScore: number,
  totalPossible: number,
  bands: { min_score: number; letter: string; color: string }[],
) {
  const pct = totalPossible ? (totalScore / totalPossible) * 100 : 0;
  const sorted = [...bands].sort((a, b) => Number(b.min_score) - Number(a.min_score));
  const found = sorted.find((b) => pct >= Number(b.min_score));
  return { pct, letter: found?.letter ?? "-", color: found?.color ?? "#6B7280" };
}
