import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import {
  classifyScore,
  pointsFrom,
  resolveTarget,
  type Indicator,
  type TargetRow,
} from "@/lib/scoring";

type Row = { storeId: string; name: string; pct: number; letter: string; color: string };

export function ClassificationRanking() {
  const period = usePeriod();

  const q = useQuery({
    queryKey: ["classification-ranking", period.year, period.month],
    queryFn: async () => {
      const [stores, inds, targets, entries, bands] = await Promise.all([
        supabase.from("stores").select("id, name").order("name"),
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*"),
        supabase
          .from("indicator_entries")
          .select("*")
          .eq("period_year", period.year),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        stores: stores.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: (targets.data ?? []) as (TargetRow & { store_id: string })[],
        entries: entries.data ?? [],
        bands: bands.data ?? [],
      };
    },
  });

  const { mes, acumulado, projetado } = useMemo(() => {
    if (!q.data) return { mes: [] as Row[], acumulado: [] as Row[], projetado: [] as Row[] };
    const { stores, indicators, targets, entries, bands } = q.data;
    const maxMonth = indicators.reduce((s, i) => s + Number(i.max_points), 0);

    const mes: Row[] = [];
    const acumulado: Row[] = [];
    const projetado: Row[] = [];

    for (const s of stores) {
      const stTargets = targets.filter((t) => t.store_id === s.id);
      const stEntries = entries.filter((e: any) => e.store_id === s.id);

      // Mês
      let mReal = 0;
      indicators.forEach((ind) => {
        const t = resolveTarget(ind, stTargets, period.year, period.month);
        const e = stEntries.find(
          (x: any) => x.indicator_id === ind.id && x.period_month === period.month,
        );
        mReal += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
      });
      const mCls = classifyScore(mReal, maxMonth, bands);
      mes.push({ storeId: s.id, name: s.name, pct: mCls.pct, letter: mCls.letter, color: mCls.color });

      // Acumulado Jan..período
      let accReal = 0;
      let accMax = 0;
      for (let m = 1; m <= period.month; m++) {
        indicators.forEach((ind) => {
          const t = resolveTarget(ind, stTargets, period.year, m);
          const e = stEntries.find((x: any) => x.indicator_id === ind.id && x.period_month === m);
          accMax += Number(ind.max_points);
          accReal += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
        });
      }
      const aCls = classifyScore(accReal, accMax, bands);
      acumulado.push({ storeId: s.id, name: s.name, pct: aCls.pct, letter: aCls.letter, color: aCls.color });

      // Projetado ano: realizado até período atual + 100% dos meses futuros
      let pReal = accReal;
      let pMax = maxMonth * 12;
      // Meses futuros: assume 100% (max_points)
      const monthsFuturos = 12 - period.month;
      pReal += monthsFuturos * maxMonth;
      const pCls = classifyScore(pReal, pMax, bands);
      projetado.push({ storeId: s.id, name: s.name, pct: pCls.pct, letter: pCls.letter, color: pCls.color });
    }

    const sortByPct = (a: Row, b: Row) => b.pct - a.pct;
    return {
      mes: mes.sort(sortByPct),
      acumulado: acumulado.sort(sortByPct),
      projetado: projetado.sort(sortByPct),
    };
  }, [q.data, period.year, period.month]);

  if (q.isLoading) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <RankingTable title="Mês" subtitle="Realizado no mês selecionado" rows={mes} />
      <RankingTable title="Acumulado" subtitle="Jan até o mês selecionado" rows={acumulado} />
      <RankingTable
        title="Projetado Ano"
        subtitle="Realizado + 100% dos meses futuros"
        rows={projetado}
      />
    </div>
  );
}

function RankingTable({ title, subtitle, rows }: { title: string; subtitle: string; rows: Row[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-slate-50">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500 border-b">
            <th className="px-4 py-2">#</th>
            <th className="px-2 py-2">Dealer</th>
            <th className="px-2 py-2 text-right">%</th>
            <th className="px-3 py-2 text-center w-16">Class.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.storeId}
              className="border-b last:border-b-0"
              style={{ backgroundColor: r.color + "22" }}
            >
              <td className="px-4 py-1.5 text-xs text-slate-500">{i + 1}</td>
              <td className="px-2 py-1.5 font-medium">{r.name}</td>
              <td className="px-2 py-1.5 text-right font-semibold">{r.pct.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-center">
                <span
                  className="inline-flex w-7 h-6 items-center justify-center rounded text-white text-xs font-bold"
                  style={{ backgroundColor: r.color }}
                >
                  {r.letter}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">
                Sem dados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
