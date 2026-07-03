import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedStoreId, useSelectedStoreType } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { classifyScore, resolveTarget, pointsFrom, type Indicator, type TargetRow } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/historico")({
  component: Historico,
});

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function Historico() {
  const storeId = useSelectedStoreId();
  const q = useQuery({
    queryKey: ["hist", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [inds, targets, entries, bands] = await Promise.all([
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId!),
        supabase.from("indicator_entries").select("*").eq("store_id", storeId!).order("period_year", { ascending: false }).order("period_month", { ascending: false }),
        supabase.from("classification_bands").select("*"),
      ]);
      return { indicators: (inds.data ?? []) as Indicator[], targets: targets.data ?? [], entries: entries.data ?? [], bands: bands.data ?? [] };
    },
  });

  if (!storeId) return <div className="text-slate-500">Selecione uma loja.</div>;
  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;
  const { indicators, targets, entries, bands } = q.data;
  const maxTotal = indicators.reduce((s, i) => s + Number(i.max_points), 0);

  const periods = new Map<string, { year: number; month: number; entries: any[] }>();
  entries.forEach((e) => {
    const key = `${e.period_year}-${e.period_month}`;
    if (!periods.has(key)) periods.set(key, { year: e.period_year, month: e.period_month, entries: [] });
    periods.get(key)!.entries.push(e);
  });

  const rows = Array.from(periods.values()).map((p) => {
    const eMap = new Map(p.entries.map((e) => [e.indicator_id, e]));
    let real = 0, proj = 0;
    indicators.forEach((ind) => {
      const t = resolveTarget(ind, targets as TargetRow[], p.year, p.month);
      const e: any = eMap.get(ind.id);
      real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
      proj += pointsFrom(ind, e?.projecao != null ? Number(e.projecao) : (e?.realizado != null ? Number(e.realizado) : null), t);
    });
    return { ...p, real, proj, cls: classifyScore(real, maxTotal, bands) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-slate-500">Pontuação da loja por período.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b bg-slate-50">
              <th className="px-5 py-3">Período</th>
              <th className="py-3 text-right">Realizado</th>
              <th className="py-3 text-right">Projeção</th>
              <th className="py-3 text-right pr-5">Classificação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.year}-${r.month}`} className="border-b last:border-b-0">
                <td className="px-5 py-3 font-medium">{MONTHS[r.month - 1]}/{r.year}</td>
                <td className="py-3 text-right">{r.real.toFixed(2)} <span className="text-slate-400 text-xs">/ {maxTotal.toFixed(2)}</span></td>
                <td className="py-3 text-right">{r.proj.toFixed(2)}</td>
                <td className="py-3 text-right pr-5">
                  <span className="px-2 py-1 rounded text-white text-xs font-semibold" style={{ backgroundColor: r.cls.color }}>
                    {r.cls.letter} · {r.cls.pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">Sem lançamentos ainda.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
