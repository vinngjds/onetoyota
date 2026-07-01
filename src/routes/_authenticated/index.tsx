import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod, useSelectedStoreId } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Shield, TrendingUp, Users, Package, ArrowRight } from "lucide-react";
import { pointsFrom, resolveTarget, classifyScore, type Indicator, type TargetRow } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

const ICONS: Record<string, any> = {
  "seguranca-qualidade-esg": Shield,
  "vendas": TrendingUp,
  "retencao": Users,
  "value-chain": Package,
};

function Dashboard() {
  const period = usePeriod();
  const storeId = useSelectedStoreId();

  const dataQ = useQuery({
    queryKey: ["dashboard", storeId, period.year, period.month],
    enabled: !!storeId,
    queryFn: async () => {
      const [mods, inds, targets, entries, bands] = await Promise.all([
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*").order("sort_order"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId!),
        supabase.from("indicator_entries").select("*").eq("store_id", storeId!).eq("period_year", period.year).eq("period_month", period.month),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        modules: mods.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: targets.data ?? [],
        entries: entries.data ?? [],
        bands: bands.data ?? [],
      };
    },
  });

  if (!storeId) {
    return (
      <div className="max-w-xl mx-auto text-center py-24">
        <h2 className="text-xl font-semibold">Nenhuma loja disponível</h2>
        <p className="text-slate-500 mt-2">
          Peça à Gestão para atribuir você a uma loja.
        </p>
      </div>
    );
  }

  if (dataQ.isLoading || !dataQ.data) {
    return <div className="text-slate-500">Carregando...</div>;
  }

  const { modules, indicators, targets, entries, bands } = dataQ.data;
  const targetMap = new Map(targets.map((t) => [t.indicator_id, Number(t.target)]));
  const entryMap = new Map(entries.map((e) => [e.indicator_id, e]));

  let grandReal = 0;
  let grandProj = 0;
  let grandMax = 0;

  const moduleStats = modules.map((m) => {
    const inds = indicators.filter((i) => i.module_id === m.id);
    let real = 0, proj = 0, max = 0;
    inds.forEach((ind) => {
      const t = effectiveTarget(ind, targetMap.get(ind.id));
      const e = entryMap.get(ind.id);
      max += Number(ind.max_points);
      real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
      proj += pointsFrom(ind, e?.projecao != null ? Number(e.projecao) : (e?.realizado != null ? Number(e.realizado) : null), t);
    });
    grandReal += real;
    grandProj += proj;
    grandMax += max;
    return { module: m, real, proj, max, count: inds.length };
  });

  const cls = classifyScore(grandReal, grandMax, bands);
  const projCls = classifyScore(grandProj, grandMax, bands);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel do mês</h1>
        <p className="text-slate-500">Pontuação consolidada da loja no período selecionado.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Realizado</div>
          <div className="text-3xl font-bold mt-2">{grandReal.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">de {grandMax.toFixed(2)} pontos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Projeção</div>
          <div className="text-3xl font-bold mt-2">{grandProj.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">de {grandMax.toFixed(2)} pontos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Classificação</div>
          <div className="flex items-baseline gap-3 mt-2">
            <div className="text-3xl font-bold" style={{ color: cls.color }}>{cls.letter}</div>
            <div className="text-sm text-slate-500">real ({cls.pct.toFixed(1)}%)</div>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-xl font-semibold" style={{ color: projCls.color }}>{projCls.letter}</div>
            <div className="text-xs text-slate-500">projeção ({projCls.pct.toFixed(1)}%)</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moduleStats.map(({ module: m, real, proj, max, count }) => {
          const Icon = ICONS[m.slug] ?? Shield;
          const pct = max ? (real / max) * 100 : 0;
          return (
            <Link key={m.id} to="/modulo/$slug" params={{ slug: m.slug }}>
              <Card className="p-5 hover:shadow-md transition cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.color + "20", color: m.color }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-slate-500">{count} indicadores</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-bold">{real.toFixed(2)}</div>
                    <div className="text-sm text-slate-500">/ {max.toFixed(2)} pts</div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: m.color }} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Projeção: <span className="font-medium text-slate-700">{proj.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
