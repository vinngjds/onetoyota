import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, TrendingUp, Users, Package, Search, ArrowRight } from "lucide-react";
import {
  classifyScore,
  pointsFrom,
  resolveTarget,
  type Indicator,
  type TargetRow,
} from "@/lib/scoring";

const ICONS: Record<string, any> = {
  "seguranca-qualidade-esg": Shield,
  vendas: TrendingUp,
  retencao: Users,
  "value-chain": Package,
};

export function GestaoOverview() {
  const period = usePeriod();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [sort, setSort] = useState<"name" | "pct">("pct");

  const q = useQuery({
    queryKey: ["gestao-overview", period.year, period.month],
    queryFn: async () => {
      const [stores, mods, inds, targets, entries, assigns, profiles, bands] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*"),
        supabase
          .from("indicator_entries")
          .select("*")
          .eq("period_year", period.year)
          .eq("period_month", period.month),
        supabase.from("store_assignments").select("*"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        stores: stores.data ?? [],
        modules: mods.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: (targets.data ?? []) as (TargetRow & { store_id: string })[],
        entries: entries.data ?? [],
        assigns: assigns.data ?? [],
        profiles: profiles.data ?? [],
        bands: bands.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!q.data) return [];
    const { stores, modules, indicators, targets, entries, assigns, profiles, bands } = q.data;
    const profileById = new Map(profiles.map((p: any) => [p.id, p.full_name]));
    const ltByStore = new Map<string, string[]>();
    assigns.forEach((a: any) => {
      const name = profileById.get(a.user_id);
      if (!name) return;
      const list = ltByStore.get(a.store_id) ?? [];
      list.push(name);
      ltByStore.set(a.store_id, list);
    });

    const maxTotal = indicators.reduce((s, i) => s + Number(i.max_points), 0);

    return stores.map((s: any) => {
      const stTargets = targets.filter((t) => t.store_id === s.id);
      const stEntries = new Map(
        entries.filter((e: any) => e.store_id === s.id).map((e: any) => [e.indicator_id, e]),
      );

      const moduleStats = modules.map((m: any) => {
        const modInds = indicators.filter((i) => i.module_id === m.id);
        let real = 0,
          max = 0;
        modInds.forEach((ind) => {
          const t = resolveTarget(ind, stTargets, period.year, period.month);
          const e = stEntries.get(ind.id);
          max += Number(ind.max_points);
          real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
        });
        return { module: m, real, max };
      });

      const totalReal = moduleStats.reduce((sum, x) => sum + x.real, 0);
      const cls = classifyScore(totalReal, maxTotal, bands);
      return {
        store: s,
        lts: ltByStore.get(s.id) ?? [],
        moduleStats,
        totalReal,
        maxTotal,
        cls,
      };
    });
  }, [q.data, period.year, period.month]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rows;
    if (term) list = list.filter((r) => r.store.name.toLowerCase().includes(term));
    if (sort === "name") list = [...list].sort((a, b) => a.store.name.localeCompare(b.store.name));
    else list = [...list].sort((a, b) => b.cls.pct - a.cls.pct);
    return list;
  }, [rows, search, sort]);

  if (q.isLoading) return <div className="text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Painel da Gestão</h1>
          <p className="text-slate-500">
            Visão de todas as lojas no período selecionado. Clique em uma loja para editar seus indicadores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 w-64"
              placeholder="Buscar loja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Ordenar por nome</SelectItem>
              <SelectItem value="pct">Ordenar por atingimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((r) => (
          <Link
            key={r.store.id}
            to="/gestao/loja/$storeId"
            params={{ storeId: r.store.id }}
            className="group"
          >
            <Card className="p-5 hover:shadow-lg transition h-full flex flex-col">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-lg truncate">{r.store.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {r.lts.length ? `LT: ${r.lts.join(", ")}` : "Sem LT atribuída"}
                  </div>
                </div>
                <span
                  className="px-2 py-1 rounded text-white text-xs font-semibold"
                  style={{ backgroundColor: r.cls.color }}
                >
                  {r.cls.letter} · {r.cls.pct.toFixed(1)}%
                </span>
              </div>

              <div className="mt-4 space-y-2.5 flex-1">
                {r.moduleStats.map(({ module: m, real, max }) => {
                  const Icon = ICONS[m.slug] ?? Shield;
                  const pct = max ? (real / max) * 100 : 0;
                  return (
                    <div key={m.id}>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: m.color }} />
                          <span className="truncate text-slate-700">{m.name}</span>
                        </div>
                        <div className="text-slate-500 shrink-0 ml-2">
                          {real.toFixed(1)}/{max.toFixed(0)} · {pct.toFixed(0)}%
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: m.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-slate-500">Pontuação total</div>
                  <div className="text-xl font-bold">
                    {r.totalReal.toFixed(2)}
                    <span className="text-sm text-slate-400 font-normal"> / {r.maxTotal.toFixed(0)}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500">
            Nenhuma loja encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
