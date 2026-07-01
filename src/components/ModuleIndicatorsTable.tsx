import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pctReal, pointsFrom, resolveTarget, deliveryStatus, type Indicator, type TargetRow, type DeliveryStatus } from "@/lib/scoring";
import { toast } from "sonner";

function fmtPct(v: number | null | undefined) {
  if (v == null) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

export function ModuleSection({
  storeId,
  moduleSlug,
  year,
  month,
  compact = false,
  statusFilter = "all",
}: {
  storeId: string;
  moduleSlug: string;
  year: number;
  month: number;
  compact?: boolean;
  statusFilter?: "all" | DeliveryStatus;
}) {
  const userId = useCurrentUser();
  const qc = useQueryClient();
  const key = ["module-section", moduleSlug, storeId, year, month];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const modRes = await supabase.from("modules").select("*").eq("slug", moduleSlug).single();
      if (modRes.error) throw modRes.error;
      const module_id = modRes.data.id;
      const [inds, targets, entries] = await Promise.all([
        supabase.from("indicators").select("*").eq("module_id", module_id).order("sort_order"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId),
        supabase
          .from("indicator_entries")
          .select("*")
          .eq("store_id", storeId)
          .eq("period_year", year)
          .eq("period_month", month),
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
    mutationFn: async (payload: {
      indicator_id: string;
      realizado?: number | null;
      projecao?: number | null;
    }) => {
      const { error } = await supabase.from("indicator_entries").upsert(
        {
          store_id: storeId,
          indicator_id: payload.indicator_id,
          period_year: year,
          period_month: month,
          realizado: payload.realizado ?? null,
          projecao: payload.projecao ?? null,
          updated_by: userId,
        },
        { onConflict: "store_id,indicator_id,period_year,period_month" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  if (q.isLoading || !q.data) return <div className="text-slate-500 text-sm">Carregando...</div>;

  const { module: mod, indicators, targets, entries } = q.data;
  const entryMap = new Map(entries.map((e) => [e.indicator_id, e]));

  const groups = new Map<string, Indicator[]>();
  indicators.forEach((ind) => {
    if (statusFilter !== "all") {
      const t = resolveTarget(ind, targets as TargetRow[], year, month);
      const e = entryMap.get(ind.id);
      const st = deliveryStatus(ind, e?.realizado != null ? Number(e.realizado) : null, t);
      if (st !== statusFilter) return;
    }
    const g = ind.subgroup ?? "Geral";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(ind);
  });

  let totalReal = 0,
    totalProj = 0,
    totalMax = 0;
  indicators.forEach((ind) => {
    const t = resolveTarget(ind, targets as TargetRow[], year, month);
    const e = entryMap.get(ind.id);
    totalMax += Number(ind.max_points);
    totalReal += pointsFrom(ind, e?.realizado != null ? Number(e.realizado) : null, t);
    totalProj += pointsFrom(
      ind,
      e?.projecao != null ? Number(e.projecao) : e?.realizado != null ? Number(e.realizado) : null,
      t,
    );
  });

  if (statusFilter !== "all" && groups.size === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={compact ? "text-lg font-bold" : "text-2xl font-bold"} style={{ color: mod.color }}>
            {mod.name}
          </h2>
          {!compact && (
            <p className="text-slate-500 text-sm">Preencha o Realizado e a Projeção de cada indicador.</p>
          )}
        </div>
        <Card className="p-3 flex gap-6">
          <div>
            <div className="text-xs text-slate-500">Realizado</div>
            <div className="text-lg font-bold">
              {totalReal.toFixed(2)}{" "}
              <span className="text-xs text-slate-400">/ {totalMax.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Projeção</div>
            <div className="text-lg font-bold">{totalProj.toFixed(2)}</div>
          </div>
        </Card>
      </div>

      {indicators.length === 0 && (
        <Card className="p-6 text-center text-slate-500 text-sm">Nenhum indicador cadastrado.</Card>
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
                  const t = resolveTarget(ind, targets as TargetRow[], year, month);
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
    </section>
  );
}

function IndicatorRow({
  indicator,
  target,
  realizado,
  projecao,
  onSave,
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
  const status = deliveryStatus(indicator, realNum, target);
  const rowBg =
    status === "entregue"
      ? "bg-green-500/10"
      : status === "parcial"
        ? "bg-yellow-400/10"
        : "bg-red-500/10";

  const unitSuffix =
    indicator.unit === "percent"
      ? "%"
      : indicator.unit === "currency"
        ? "R$"
        : indicator.unit === "boolean"
          ? "0/1"
          : "";

  return (
    <tr className={`border-b last:border-b-0 ${rowBg} hover:brightness-95 transition`}>

      <td className="px-5 py-2 font-medium">{indicator.name}</td>
      <td className="px-3 py-2 text-right">{Number(indicator.max_points).toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-slate-600">
        {target ? `${target}${unitSuffix ? " " + unitSuffix : ""}` : "-"}
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-8"
          value={realStr}
          type="number"
          step="any"
          onChange={(e) => setRealStr(e.target.value)}
          onBlur={() =>
            onSave({
              realizado: realStr === "" ? null : Number(realStr),
              projecao: projStr === "" ? null : Number(projStr),
            })
          }
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
          onBlur={() =>
            onSave({
              realizado: realStr === "" ? null : Number(realStr),
              projecao: projStr === "" ? null : Number(projStr),
            })
          }
        />
      </td>
    </tr>
  );
}
