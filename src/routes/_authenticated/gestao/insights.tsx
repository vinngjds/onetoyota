import { createFileRoute, Link } from "@tanstack/react-router";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  classifyScore,
  deliveryStatus,
  pctReal,
  pointsFrom,
  resolveTarget,
  type Indicator,
  type TargetRow,
  type DeliveryStatus,
} from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/gestao/insights")({
  component: InsightsPage,
});

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function InsightsPage() {
  const period = usePeriod();
  const [window, setWindow] = useState<number>(6);
  const [region, setRegion] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [minOccur, setMinOccur] = useState<number>(3);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [drill, setDrill] = useState<{
    storeId: string;
    storeName: string;
    indicatorId: string;
    indicatorName: string;
    moduleSlug: string;
  } | null>(null);

  // window months
  const months = useMemo(() => {
    const arr: { year: number; month: number }[] = [];
    let y = period.year;
    let m = period.month;
    for (let i = 0; i < window; i++) {
      arr.unshift({ year: y, month: m });
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
    }
    return arr;
  }, [period.year, period.month, window]);

  const startYear = months[0].year;
  const startMonth = months[0].month;

  const q = useQuery({
    queryKey: ["insights", period.year, period.month, window],
    queryFn: async () => {
      const [stores, mods, inds, targets, entries, bands] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*"),
        supabase.from("store_indicator_targets").select("*"),
        supabase
          .from("indicator_entries")
          .select("*")
          .gte("period_year", startYear)
          .lte("period_year", period.year),
        supabase.from("classification_bands").select("*"),
      ]);
      return {
        stores: stores.data ?? [],
        modules: mods.data ?? [],
        indicators: (inds.data ?? []) as Indicator[],
        targets: (targets.data ?? []) as (TargetRow & { store_id: string })[],
        entries: entries.data ?? [],
        bands: bands.data ?? [],
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

  // ============ Bloco A: timeline ============
  const timeline = useMemo(() => {
    if (!q.data) return { data: [], stores: [] as { id: string; name: string }[], latest: new Map<string, { letter: string; color: string }>() };
    const { indicators, targets, entries, bands } = q.data;
    const maxTotal = indicators.reduce((s, i) => s + Number(i.max_points), 0);
    const storesList = filteredStores.map((s: any) => ({ id: s.id, name: s.name }));
    const latest = new Map<string, { letter: string; color: string }>();

    const data = months.map(({ year, month }) => {
      const row: any = { label: `${MONTHS_SHORT[month - 1]}/${String(year).slice(2)}` };
      for (const st of storesList) {
        const stTargets = targets.filter((t) => t.store_id === st.id);
        let real = 0;
        indicators.forEach((ind) => {
          const t = resolveTarget(ind, stTargets, year, month);
          const e = entries.find(
            (x: any) => x.store_id === st.id && x.indicator_id === ind.id && x.period_year === year && x.period_month === month,
          );
          real += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
        });
        const cls = classifyScore(real, maxTotal, bands);
        row[st.name] = Number(cls.pct.toFixed(2));
        latest.set(st.id, { letter: cls.letter, color: cls.color });
      }
      return row;
    });

    return { data, stores: storesList, latest };
  }, [q.data, filteredStores, months]);

  // ============ Bloco B/C: contagem por status na janela ============
  const { problemBars, recurring } = useMemo(() => {
    if (!q.data) return { problemBars: [] as any[], recurring: [] as any[] };
    const { indicators, targets, entries, modules } = q.data;
    const modMap = new Map(modules.map((m: any) => [m.id, m]));
    const storeProblemCount = new Map<string, { name: string; count: number; storeId: string }>();
    const perStoreIndicator = new Map<string, {
      storeId: string;
      storeName: string;
      indicator: Indicator;
      module: any;
      naoEntregue: number;
      parcial: number;
      entregue: number;
      timeline: { label: string; status: DeliveryStatus; pct: number | null }[];
      pctSum: number;
      pctCount: number;
      lastStatus: DeliveryStatus;
    }>();

    for (const st of filteredStores) {
      const stTargets = targets.filter((t) => t.store_id === st.id);
      let issues = 0;
      for (const ind of indicators) {
        if (moduleFilter !== "all") {
          const m = modMap.get(ind.module_id);
          if (m?.slug !== moduleFilter) continue;
        }
        const key = `${st.id}::${ind.id}`;
        const rec = {
          storeId: st.id,
          storeName: st.name,
          indicator: ind,
          module: modMap.get(ind.module_id),
          naoEntregue: 0,
          parcial: 0,
          entregue: 0,
          timeline: [] as { label: string; status: DeliveryStatus; pct: number | null }[],
          pctSum: 0,
          pctCount: 0,
          lastStatus: "nao-entregue" as DeliveryStatus,
        };
        for (const { year, month } of months) {
          const t = resolveTarget(ind, stTargets, year, month);
          const e = entries.find(
            (x: any) => x.store_id === st.id && x.indicator_id === ind.id && x.period_year === year && x.period_month === month,
          );
          const val = e?.realizado != null ? Number(e.realizado) : null;
          const status = deliveryStatus(ind, val, t);
          const p = pctReal(ind, val, t);
          rec.timeline.push({ label: `${MONTHS_SHORT[month - 1]}/${String(year).slice(2)}`, status, pct: p });
          if (status === "nao-entregue") rec.naoEntregue++;
          else if (status === "parcial") rec.parcial++;
          else rec.entregue++;
          if (p != null) {
            rec.pctSum += p;
            rec.pctCount++;
          }
          rec.lastStatus = status;
          if (status !== "entregue") issues++;
        }
        perStoreIndicator.set(key, rec);
      }
      storeProblemCount.set(st.id, { name: st.name, count: issues, storeId: st.id });
    }

    const problemBars = Array.from(storeProblemCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const recurring = Array.from(perStoreIndicator.values())
      .filter((r) => r.naoEntregue + r.parcial >= minOccur)
      .filter((r) => (selectedStore === "all" ? true : r.storeId === selectedStore))
      .sort((a, b) => b.naoEntregue * 2 + b.parcial - (a.naoEntregue * 2 + a.parcial));

    return { problemBars, recurring };
  }, [q.data, filteredStores, months, moduleFilter, minOccur, selectedStore]);

  const statusColor = (s: DeliveryStatus) =>
    s === "entregue" ? "#22c55e" : s === "parcial" ? "#facc15" : "#ef4444";

  const drillData = useMemo(() => {
    if (!drill || !q.data) return null;
    const { indicators, targets, entries } = q.data;
    const ind = indicators.find((i) => i.id === drill.indicatorId);
    if (!ind) return null;
    const stTargets = targets.filter((t) => t.store_id === drill.storeId);
    const rows = months.map(({ year, month }) => {
      const t = resolveTarget(ind, stTargets, year, month);
      const e = entries.find(
        (x: any) => x.store_id === drill.storeId && x.indicator_id === ind.id && x.period_year === year && x.period_month === month,
      );
      const val = e?.realizado != null ? Number(e.realizado) : null;
      const p = pctReal(ind, val, t);
      const pts = pointsFrom(ind, val, t);
      const status = deliveryStatus(ind, val, t);
      return { label: `${MONTHS_SHORT[month - 1]}/${year}`, target: t, realizado: val, pct: p, pts, status };
    });
    const avgPct = rows.filter((r) => r.pct != null).reduce((s, r) => s + (r.pct ?? 0), 0) / Math.max(rows.filter((r) => r.pct != null).length, 1);
    return { indicator: ind, rows, avgPct };
  }, [drill, q.data, months]);

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando insights...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-slate-500">
            Análise macro da rede: evolução, lojas com mais problemas e indicadores recorrentemente não batidos.
          </p>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Janela</label>
          <Select value={String(window)} onValueChange={(v) => setWindow(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Região</label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Módulo</label>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {q.data.modules.map((m: any) => (
                <SelectItem key={m.id} value={m.slug}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Loja</label>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {filteredStores.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Buscar loja</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" placeholder="Nome..." />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Ocorrências mínimas</label>
          <Input
            type="number"
            min={1}
            max={window}
            value={minOccur}
            onChange={(e) => setMinOccur(Math.max(1, Number(e.target.value) || 1))}
            className="w-28"
          />
        </div>
      </Card>

      {/* Bloco A */}
      <Card className="p-5">
        <div className="mb-3">
          <div className="font-semibold">Linha do tempo — % de atingimento total</div>
          <div className="text-xs text-slate-500">
            {selectedStore === "all"
              ? "Uma linha por loja. Clique numa barra abaixo para focar."
              : "Loja selecionada. Escolha 'Todas as lojas' para comparar."}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              {selectedStore === "all" && timeline.stores.length <= 8 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {timeline.stores
                .filter((s) => selectedStore === "all" || s.id === selectedStore)
                .map((s, i) => {
                  const info = timeline.latest.get(s.id);
                  return (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.name}
                      stroke={info?.color ?? `hsl(${(i * 47) % 360},60%,45%)`}
                      strokeWidth={selectedStore === s.id ? 3 : 1.8}
                      dot={{ r: 3 }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Bloco B */}
      <Card className="p-5">
        <div className="mb-3">
          <div className="font-semibold">Ranking de lojas-problema</div>
          <div className="text-xs text-slate-500">
            Total de indicadores fora do 100% (Parcial + Não Entregue) na janela. Clique para focar.
          </div>
        </div>
        <div style={{ height: Math.max(240, problemBars.length * 26) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={problemBars} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" width={120} fontSize={11} />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="#ef4444"
                cursor="pointer"
                onClick={(d: any) => setSelectedStore(d.storeId)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Bloco C */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <div className="font-semibold text-sm">Indicadores recorrentemente não batidos</div>
          <div className="text-xs text-slate-500">
            Indicadores com Não Entregue + Parcial ≥ {minOccur} nos últimos {window} meses. Clique para investigar.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b">
                <th className="px-4 py-2">Loja</th>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2">Indicador</th>
                <th className="px-3 py-2 text-right">Não Entregue</th>
                <th className="px-3 py-2 text-right">Parcial</th>
                <th className="px-3 py-2 text-right">Entregue</th>
                <th className="px-3 py-2 text-right">% médio</th>
                <th className="px-3 py-2">Histórico</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r) => (
                <tr
                  key={`${r.storeId}-${r.indicator.id}`}
                  className="border-b last:border-b-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() =>
                    setDrill({
                      storeId: r.storeId,
                      storeName: r.storeName,
                      indicatorId: r.indicator.id,
                      indicatorName: r.indicator.name,
                      moduleSlug: r.module?.slug ?? "",
                    })
                  }
                >
                  <td className="px-4 py-2 font-medium">{r.storeName}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: (r.module?.color ?? "#64748b") + "22", color: r.module?.color ?? "#64748b" }}
                    >
                      {r.module?.name ?? "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.indicator.name}</td>
                  <td className="px-3 py-2 text-right text-red-600 font-semibold">{r.naoEntregue}</td>
                  <td className="px-3 py-2 text-right text-yellow-600 font-semibold">{r.parcial}</td>
                  <td className="px-3 py-2 text-right text-green-600 font-semibold">{r.entregue}</td>
                  <td className="px-3 py-2 text-right">
                    {r.pctCount ? `${((r.pctSum / r.pctCount) * 100).toFixed(0)}%` : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {r.timeline.map((t: { label: string; status: DeliveryStatus; pct: number | null }, i: number) => (
                        <span
                          key={i}
                          title={`${t.label}: ${t.status}${t.pct != null ? ` (${(t.pct * 100).toFixed(0)}%)` : ""}`}
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: statusColor(t.status) }}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {recurring.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Nenhum indicador recorrente com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bloco D */}
      <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {drill && drillData && (
            <>
              <SheetHeader>
                <SheetTitle>{drill.indicatorName}</SheetTitle>
                <SheetDescription>
                  {drill.storeName} — histórico dos últimos {window} meses
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Card className="p-4">
                  <div className="text-xs text-slate-500">% médio realizado na janela</div>
                  <div className="text-2xl font-bold">
                    {(drillData.avgPct * 100).toFixed(1)}%
                  </div>
                </Card>
                <Card className="p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500 border-b">
                        <th className="px-3 py-2">Mês</th>
                        <th className="px-3 py-2 text-right">Meta</th>
                        <th className="px-3 py-2 text-right">Realizado</th>
                        <th className="px-3 py-2 text-right">% Real</th>
                        <th className="px-3 py-2 text-right">Pontos</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillData.rows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b last:border-b-0"
                          style={{ backgroundColor: statusColor(r.status) + "1a" }}
                        >
                          <td className="px-3 py-2">{r.label}</td>
                          <td className="px-3 py-2 text-right">{r.target || "-"}</td>
                          <td className="px-3 py-2 text-right">{r.realizado ?? "-"}</td>
                          <td className="px-3 py-2 text-right">{r.pct != null ? `${(r.pct * 100).toFixed(1)}%` : "-"}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.pts.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: statusColor(r.status) }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Link
                  to="/gestao/loja/$storeId"
                  params={{ storeId: drill.storeId }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  Editar indicadores da loja →
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
