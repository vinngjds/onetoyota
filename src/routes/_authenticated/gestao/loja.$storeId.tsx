import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import {
  classifyScore,
  pointsFrom,
  resolveTarget,
  type Indicator,
  type TargetRow,
} from "@/lib/scoring";
import { ModuleSection } from "@/components/ModuleIndicatorsTable";
import { StatusFilter, type StatusFilterValue } from "@/components/StatusFilter";

export const Route = createFileRoute("/_authenticated/gestao/loja/$storeId")({
  component: LojaGestao,
});

function LojaGestao() {
  const { storeId } = Route.useParams();
  const period = usePeriod();
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilterValue>("all");

  const q = useQuery({
    queryKey: ["gestao-loja", storeId, period.year, period.month],
    queryFn: async () => {
      const [store, mods, inds, targets, entries, assigns, profiles, bands] = await Promise.all([
        supabase.from("stores").select("*").eq("id", storeId).single(),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId),
        supabase
          .from("indicator_entries")
          .select("*")
          .eq("store_id", storeId)
          .eq("period_year", period.year)
          .eq("period_month", period.month),
        supabase.from("store_assignments").select("*").eq("store_id", storeId),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        store: store.data,
        modules: mods.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: targets.data ?? [],
        entries: entries.data ?? [],
        assigns: assigns.data ?? [],
        profiles: profiles.data ?? [],
        bands: bands.data ?? [],
      };
    },
  });

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;
  const { store, modules, indicators, targets, entries, assigns, profiles, bands } = q.data;
  if (!store) return <div className="text-slate-500">Loja não encontrada.</div>;

  const profileById = new Map(profiles.map((p: any) => [p.id, p.full_name]));
  const lts = assigns.map((a: any) => profileById.get(a.user_id)).filter(Boolean) as string[];

  const entryMap = new Map(entries.map((e: any) => [e.indicator_id, e]));
  let real = 0,
    proj = 0,
    max = 0;
  indicators.forEach((ind) => {
    const t = resolveTarget(ind, targets as TargetRow[], period.year, period.month);
    const e = entryMap.get(ind.id);
    max += Number(ind.max_points);
    real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
    proj += pointsFrom(
      ind,
      e?.projecao != null ? Number(e.projecao) : e?.realizado != null ? Number(e.realizado) : null,
      t,
    );
  });
  const cls = classifyScore(real, max, bands);
  const projCls = classifyScore(proj, max, bands);

  const visibleModules =
    moduleFilter === "all" ? modules : modules.filter((m: any) => m.slug === moduleFilter);

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao painel
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-slate-500 text-sm">
            {lts.length ? `LT: ${lts.join(", ")}` : "Sem LT atribuída"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusFilter value={status} onChange={setStatus} />
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os macro indicadores</SelectItem>
              {modules.map((m: any) => (
                <SelectItem key={m.id} value={m.slug}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Realizado</div>
          <div className="text-3xl font-bold mt-2">{real.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">de {max.toFixed(2)} pontos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Projeção</div>
          <div className="text-3xl font-bold mt-2">{proj.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">de {max.toFixed(2)} pontos</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Classificação</div>
          <div className="flex items-baseline gap-3 mt-2">
            <div className="text-3xl font-bold" style={{ color: cls.color }}>
              {cls.letter}
            </div>
            <div className="text-sm text-slate-500">real ({cls.pct.toFixed(1)}%)</div>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-xl font-semibold" style={{ color: projCls.color }}>
              {projCls.letter}
            </div>
            <div className="text-xs text-slate-500">projeção ({projCls.pct.toFixed(1)}%)</div>
          </div>
        </Card>
      </div>

      <div className="space-y-8">
        {visibleModules.map((m: any) => (
          <ModuleSection
            key={m.id}
            storeId={storeId}
            moduleSlug={m.slug}
            year={period.year}
            month={period.month}
            compact
          />
        ))}
      </div>
    </div>
  );
}
