import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod, useSelectedStoreId, useCurrentUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { pctReal, pointsFrom, resolveTarget, type Indicator, type TargetRow } from "@/lib/scoring";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modulo/$slug")({
  component: ModulePage,
});

function fmtPct(v: number | null | undefined) {
  if (v == null) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

function ModulePage() {
  const { slug } = Route.useParams();
  const period = usePeriod();
  const storeId = useSelectedStoreId();
  const userId = useCurrentUser();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["module", slug, storeId, period.year, period.month],
    enabled: !!storeId,
    queryFn: async () => {
      const modRes = await supabase.from("modules").select("*").eq("slug", slug).single();
      if (modRes.error) throw modRes.error;
      const module_id = modRes.data.id;
      const [inds, targets, entries] = await Promise.all([
        supabase.from("indicators").select("*").eq("module_id", module_id).order("sort_order"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId!),
        supabase.from("indicator_entries").select("*").eq("store_id", storeId!).eq("period_year", period.year).eq("period_month", period.month),
      ]);
      return {
        module: modRes.data,
        indicators: (inds.data ?? []) as Indicator[],
        targets: targets.data ?? [],
        entries: entries.data ?? [],
      };
    },
  });

  const upsertEntry = useMutation({
    mutationFn: async (payload: { indicator_id: string; realizado?: number | null; projecao?: number | null }) => {
      const { error } = await supabase.from("indicator_entries").upsert(
        {
          store_id: storeId!,
          indicator_id: payload.indicator_id,
          period_year: period.year,
          period_month: period.month,
          realizado: payload.realizado ?? null,
          projecao: payload.projecao ?? null,
          updated_by: userId,
        },
        { onConflict: "store_id,indicator_id,period_year,period_month" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module", slug, storeId, period.year, period.month] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  if (!storeId) return <div className="text-slate-500">Selecione uma loja.</div>;
  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;

  const { module: mod, indicators, targets, entries } = q.data;
  const entryMap = new Map(entries.map((e) => [e.indicator_id, e]));

  // group by subgroup
  const groups = new Map<string, Indicator[]>();
  indicators.forEach((ind) => {
    const g = ind.subgroup ?? "Geral";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(ind);
  });

  let totalReal = 0, totalProj = 0, totalMax = 0;
  indicators.forEach((ind) => {
    const t = resolveTarget(ind, targets as TargetRow[], period.year, period.month);
    const e = entryMap.get(ind.id);
    totalMax += Number(ind.max_points);
    totalReal += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
    totalProj += pointsFrom(ind, e?.projecao != null ? Number(e.projecao) : (e?.realizado != null ? Number(e.realizado) : null), t);
  });

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: mod.color }}>{mod.name}</h1>
          <p className="text-slate-500 text-sm">Preencha o Realizado e a Projeção de cada indicador.</p>
        </div>
        <Card className="p-4 flex gap-6">
          <div>
            <div className="text-xs text-slate-500">Realizado</div>
            <div className="text-xl font-bold">{totalReal.toFixed(2)} <span className="text-sm text-slate-400">/ {totalMax.toFixed(2)}</span></div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Projeção</div>
            <div className="text-xl font-bold">{totalProj.toFixed(2)}</div>
          </div>
        </Card>
      </div>

      {indicators.length === 0 && (
        <Card className="p-8 text-center text-slate-500">
          Nenhum indicador cadastrado neste módulo. A Gestão pode cadastrá-los em "Indicadores".
        </Card>
      )}

      {Array.from(groups.entries()).map(([subgroup, inds]) => (
        <Card key={subgroup} className="overflow-hidden p-0">
          <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-sm">{subgroup}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="px-5 py-2">Indicador</th>
                  <th className="px-3 py-2 w-24 text-right">Pontuação</th>
                  <th className="px-3 py-2 w-28 text-right">Objetivo</th>
                  <th className="px-3 py-2 w-32">Realizado</th>
                  <th className="px-3 py-2 w-24 text-right">% Real</th>
                  <th className="px-3 py-2 w-24 text-right">Real (pts)</th>
                  <th className="px-3 py-2 w-32">Projeção</th>
                </tr>
              </thead>
              <tbody>
                {inds.map((ind) => {
                  const t = resolveTarget(ind, targets as TargetRow[], period.year, period.month);
                  const e = entryMap.get(ind.id);
                  return (
                    <IndicatorRow
                      key={ind.id}
                      indicator={ind}
                      target={t}
                      realizado={e?.realizado != null ? Number(e.realizado) : null}
                      projecao={e?.projecao != null ? Number(e.projecao) : null}
                      onSave={(patch) => upsertEntry.mutate({ indicator_id: ind.id, ...patch })}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function IndicatorRow({
  indicator, target, realizado, projecao, onSave,
}: {
  indicator: Indicator;
  target: number;
  realizado: number | null;
  projecao: number | null;
  onSave: (patch: { realizado?: number | null; projecao?: number | null }) => void;
}) {
  const [realStr, setRealStr] = useState(realizado != null ? String(realizado) : "");
  const [projStr, setProjStr] = useState(projecao != null ? String(projecao) : "");

  useEffect(() => setRealStr(realizado != null ? String(realizado) : ""), [realizado]);
  useEffect(() => setProjStr(projecao != null ? String(projecao) : ""), [projecao]);

  const realNum = realStr === "" ? null : Number(realStr);
  const p = pctReal(indicator, realNum, target);
  const pts = pointsFrom(indicator, realNum, target);

  const unitSuffix =
    indicator.unit === "percent" ? "%" :
    indicator.unit === "currency" ? "R$" :
    indicator.unit === "boolean" ? "0/1" : "";

  return (
    <tr className="border-b last:border-b-0 hover:bg-slate-50/50">
      <td className="px-5 py-2 font-medium">{indicator.name}</td>
      <td className="px-3 py-2 text-right">{Number(indicator.max_points).toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-slate-600">{target ? `${target}${unitSuffix ? " " + unitSuffix : ""}` : "-"}</td>
      <td className="px-3 py-2">
        <Input
          className="h-8"
          value={realStr}
          type="number"
          step="any"
          onChange={(e) => setRealStr(e.target.value)}
          onBlur={() => onSave({ realizado: realStr === "" ? null : Number(realStr), projecao: projStr === "" ? null : Number(projStr) })}
        />
      </td>
      <td className="px-3 py-2 text-right font-medium">{fmtPct(p)}</td>
      <td className="px-3 py-2 text-right font-semibold">{pts.toFixed(2)}</td>
      <td className="px-3 py-2">
        <Input
          className="h-8"
          value={projStr}
          type="number"
          step="any"
          onChange={(e) => setProjStr(e.target.value)}
          onBlur={() => onSave({ realizado: realStr === "" ? null : Number(realStr), projecao: projStr === "" ? null : Number(projStr) })}
        />
      </td>
    </tr>
  );
}
