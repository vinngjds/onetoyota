import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { classifyScore, effectiveTarget, pointsFrom, type Indicator } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/gestao/")({
  component: GestaoConsolidado,
});

function GestaoConsolidado() {
  const period = usePeriod();
  const q = useQuery({
    queryKey: ["gestao-consolidado", period.year, period.month],
    queryFn: async () => {
      const [stores, inds, targets, entries, bands] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*"),
        supabase.from("indicator_entries").select("*").eq("period_year", period.year).eq("period_month", period.month),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        stores: stores.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: targets.data ?? [],
        entries: entries.data ?? [],
        bands: bands.data ?? [],
      };
    },
  });

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;
  const { stores, indicators, targets, entries, bands } = q.data;

  const maxTotal = indicators.reduce((s, i) => s + Number(i.max_points), 0);

  const rows = stores.map((s) => {
    const stTargets = new Map(targets.filter((t) => t.store_id === s.id).map((t) => [t.indicator_id, Number(t.target)]));
    const stEntries = new Map(entries.filter((e) => e.store_id === s.id).map((e) => [e.indicator_id, e]));
    let real = 0, proj = 0;
    indicators.forEach((ind) => {
      const t = effectiveTarget(ind, stTargets.get(ind.id));
      const e = stEntries.get(ind.id);
      real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
      proj += pointsFrom(ind, e?.projecao != null ? Number(e.projecao) : (e?.realizado != null ? Number(e.realizado) : null), t);
    });
    return { store: s, real, proj, cls: classifyScore(real, maxTotal, bands), pcls: classifyScore(proj, maxTotal, bands) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consolidado — Gestão</h1>
        <p className="text-slate-500">Pontuação de todas as lojas no período selecionado.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b bg-slate-50">
              <th className="px-5 py-3">Loja</th>
              <th className="px-3 py-3 text-right">Realizado</th>
              <th className="px-3 py-3 text-right">Classif. Real</th>
              <th className="px-3 py-3 text-right">Projeção</th>
              <th className="px-3 py-3 text-right">Classif. Proj</th>
              <th className="px-3 py-3 text-right">Máx</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store.id} className="border-b last:border-b-0">
                <td className="px-5 py-3 font-medium">{r.store.name}</td>
                <td className="px-3 py-3 text-right">{r.real.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">
                  <span className="px-2 py-1 rounded text-white text-xs font-semibold" style={{ backgroundColor: r.cls.color }}>
                    {r.cls.letter} · {r.cls.pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3 text-right">{r.proj.toFixed(2)}</td>
                <td className="px-3 py-3 text-right">
                  <span className="px-2 py-1 rounded text-white text-xs font-semibold" style={{ backgroundColor: r.pcls.color }}>
                    {r.pcls.letter} · {r.pcls.pct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-slate-500">{maxTotal.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Nenhuma loja cadastrada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
