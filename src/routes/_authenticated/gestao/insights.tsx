import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  classifyScore,
  pctReal,
  pointsFrom,
  resolveTarget,
  type Indicator,
  type TargetRow,
} from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/gestao/insights")({
  component: InsightsPage,
});

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Band = { min_score: number; letter: string; color: string };

/** % de atingimento de uma loja em um mês (null quando não há lançamentos). */
function storeMonthPct(
  indicators: Indicator[],
  targets: (TargetRow & { store_id: string })[],
  entries: any[],
  storeId: string,
  year: number,
  month: number,
): number | null {
  const monthEntries = entries.filter(
    (e) => e.store_id === storeId && e.period_year === year && e.period_month === month,
  );
  if (monthEntries.length === 0) return null;
  const stTargets = targets.filter((t) => t.store_id === storeId);
  let real = 0;
  let max = 0;
  indicators.forEach((ind) => {
    const t = resolveTarget(ind, stTargets, year, month);
    const e = monthEntries.find((x) => x.indicator_id === ind.id);
    max += Number(ind.max_points);
    real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
  });
  return max ? (real / max) * 100 : null;
}

function InsightsPage() {
  const period = usePeriod();
  const [region, setRegion] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Acumulado: janeiro até o mês anterior ao selecionado.
  const prevMonth = period.month - 1;
  const accMonths = useMemo(
    () => Array.from({ length: Math.max(prevMonth, 0) }, (_, i) => i + 1),
    [prevMonth],
  );

  const q = useQuery({
    queryKey: ["insights-overview", period.year],
    queryFn: async () => {
      const [stores, inds, targets, entries, bands] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("indicators").select("*").order("sort_order"),
        supabase.from("store_indicator_targets").select("*"),
        supabase.from("indicator_entries").select("*").eq("period_year", period.year),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        stores: stores.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: (targets.data ?? []) as (TargetRow & { store_id: string })[],
        entries: entries.data ?? [],
        bands: (bands.data ?? []) as Band[],
      };
    },
  });

  const regions = useMemo(() => {
    if (!q.data) return [];
    const s = new Set<string>();
    q.data.stores.forEach((st: any) => st.region && s.add(st.region));
    return Array.from(s).sort();
  }, [q.data]);

  const filteredStores = useMemo(() => {
    if (!q.data) return [];
    const term = search.trim().toLowerCase();
    return q.data.stores.filter((st: any) => {
      if (region !== "all" && st.region !== region) return false;
      if (term && !st.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [q.data, region, search]);

  /** Média por loja em um conjunto de meses (ignora meses sem lançamento). */
  const storeAvgFor = useMemo(() => {
    return (months: number[]) => {
      if (!q.data) return [] as { id: string; name: string; pct: number }[];
      const { indicators, targets, entries } = q.data;
      const out: { id: string; name: string; pct: number }[] = [];
      filteredStores.forEach((st: any) => {
        const vals = months
          .map((m) => storeMonthPct(indicators, targets, entries, st.id, period.year, m))
          .filter((v): v is number => v != null);
        if (vals.length === 0) return;
        out.push({ id: st.id, name: st.name, pct: vals.reduce((a, b) => a + b, 0) / vals.length });
      });
      return out;
    };
  }, [q.data, filteredStores, period.year]);

  const summaryRows = useMemo(() => {
    if (!q.data) return [];
    const bands = q.data.bands;
    const defs: { label: string; months: number[] }[] = [
      { label: `Jan–Jun ${String(period.year).slice(2)}`, months: [1, 2, 3, 4, 5, 6] },
      { label: `Jul–Dez ${String(period.year).slice(2)} (parcial)`, months: [7, 8, 9, 10, 11, 12] },
      {
        label: prevMonth >= 1 ? `${MONTHS_SHORT[prevMonth - 1]} ${String(period.year).slice(2)}` : "Mês anterior",
        months: prevMonth >= 1 ? [prevMonth] : [],
      },
    ];
    return defs.map(({ label, months }) => {
      const rows = storeAvgFor(months);
      const avg = rows.length ? rows.reduce((s, r) => s + r.pct, 0) / rows.length : null;
      const dist: Record<string, number> = {};
      rows.forEach((r) => {
        const letter = classifyScore(r.pct, 100, bands).letter;
        dist[letter] = (dist[letter] ?? 0) + 1;
      });
      return {
        label,
        count: rows.length,
        avg,
        avgLetter: avg == null ? "-" : classifyScore(avg, 100, bands).letter,
        avgColor: avg == null ? "#6B7280" : classifyScore(avg, 100, bands).color,
        dist,
      };
    });
  }, [q.data, storeAvgFor, prevMonth, period.year]);

  const ranking = useMemo(() => {
    if (!q.data) return { best: [], worst: [] as any[] };
    const rows = storeAvgFor(accMonths).map((r) => {
      const c = classifyScore(r.pct, 100, q.data!.bands);
      return { ...r, letter: c.letter, color: c.color };
    });
    const sorted = [...rows].sort((a, b) => b.pct - a.pct);
    return { best: sorted.slice(0, 10), worst: [...sorted].reverse().slice(0, 10) };
  }, [q.data, storeAvgFor, accMonths]);

  const worstKpis = useMemo(() => {
    if (!q.data) return [];
    const { indicators, targets, entries } = q.data;
    const storeIds = new Set(filteredStores.map((s: any) => s.id));
    const agg = new Map<string, { name: string; sum: number; n: number; fails: number }>();
    entries.forEach((e: any) => {
      if (!storeIds.has(e.store_id)) return;
      if (!accMonths.includes(e.period_month)) return;
      const ind = indicators.find((i) => i.id === e.indicator_id);
      if (!ind) return;
      const t = resolveTarget(ind, targets.filter((x) => x.store_id === e.store_id), e.period_year, e.period_month);
      const p = pctReal(ind, e.realizado != null ? Number(e.realizado) : null, t) ?? 0;
      const cur = agg.get(ind.id) ?? { name: ind.name, sum: 0, n: 0, fails: 0 };
      cur.sum += Math.min(Math.max(p, 0), 1) * 100;
      cur.n += 1;
      if (p < 1) cur.fails += 1;
      agg.set(ind.id, cur);
    });
    return Array.from(agg.entries())
      .map(([id, v]) => ({ id, name: v.name, pct: v.sum / v.n, fails: v.fails, n: v.n }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);
  }, [q.data, filteredStores, accMonths]);

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;

  const bandLetters = [...q.data.bands]
    .sort((a, b) => Number(b.min_score) - Number(a.min_score))
    .map((b) => ({ letter: b.letter, color: b.color }));

  const accLabel =
    prevMonth >= 1 ? `Jan–${MONTHS_SHORT[prevMonth - 1]}/${period.year}` : `sem meses fechados em ${period.year}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-slate-500 text-sm">
            Resultados acumulados ({accLabel}) e KPIs com menores atingimentos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
            placeholder="Buscar loja..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bloco 1 + 2 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-sm">
              Categoria média e distribuição
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="px-5 py-2">Período</th>
                    <th className="px-3 py-2 text-right">Categoria média</th>
                    {bandLetters.map((b) => (
                      <th key={b.letter} className="px-3 py-2 text-right" style={{ color: b.color }}>
                        {b.letter}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">Lojas</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={r.label} className="border-b last:border-b-0">
                      <td className="px-5 py-2 font-medium">{r.label}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.avg == null ? (
                          "-"
                        ) : (
                          <>
                            {r.avg.toFixed(2)}{" "}
                            <span style={{ color: r.avgColor }}>({r.avgLetter})</span>
                          </>
                        )}
                      </td>
                      {bandLetters.map((b) => (
                        <td key={b.letter} className="px-3 py-2 text-right text-slate-600">
                          {r.count ? `${Math.round(((r.dist[b.letter] ?? 0) / r.count) * 100)}%` : "-"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-500">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RankCard title={`TOP 10 melhores – ${accLabel}`} rows={ranking.best} tone="good" />
            <RankCard title={`BOTTOM 10 – ${accLabel}`} rows={ranking.worst} tone="bad" />
          </div>

          <Card className="p-5">
            <div className="font-semibold text-sm mb-3">Atingimento acumulado por loja</div>
            {ranking.best.length === 0 ? (
              <div className="text-slate-500 text-sm">Sem lançamentos no acumulado.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, ranking.best.length * 34)}>
                <BarChart data={ranking.best} layout="vertical" margin={{ left: 24, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                    {ranking.best.map((r: any) => (
                      <Cell key={r.id} fill={r.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Bloco 3 */}
        <Card className="overflow-hidden p-0 h-fit">
          <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-sm">
            KPIs c/ menores atingimentos
          </div>
          <ul className="divide-y">
            {worstKpis.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-500">Sem lançamentos no acumulado.</li>
            )}
            {worstKpis.map((k) => (
              <li key={k.id} className="px-5 py-3">
                <div className="font-medium text-sm">{k.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {k.pct.toFixed(1)}% médio · {k.fails} de {k.n} lançamentos abaixo da meta
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function RankCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { id: string; name: string; pct: number; letter: string; color: string }[];
  tone: "good" | "bad";
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div
        className={`px-5 py-3 font-semibold text-sm text-white ${tone === "good" ? "bg-slate-700" : "bg-red-700"}`}
      >
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b">
            <th className="px-4 py-2 w-12">#</th>
            <th className="px-3 py-2">Loja</th>
            <th className="px-3 py-2 text-right">%</th>
            <th className="px-3 py-2 text-right">Cat.</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-slate-500 text-sm">
                Sem dados.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b last:border-b-0">
              <td className="px-4 py-2 font-semibold text-slate-500">{i + 1}</td>
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right">{r.pct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: r.color }}>
                {r.letter}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
