import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao/metas")({
  component: GestaoMetas,
});

function GestaoMetas() {
  const [storeId, setStoreId] = useState<string>("");
  const qc = useQueryClient();

  const storesQ = useQuery({
    queryKey: ["metas-stores"],
    queryFn: async () => (await supabase.from("stores").select("*").order("name")).data ?? [],
  });

  const q = useQuery({
    queryKey: ["gestao-metas", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [mods, inds, targets] = await Promise.all([
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*").order("sort_order"),
        supabase.from("store_indicator_targets").select("*").eq("store_id", storeId),
      ]);
      return { modules: mods.data ?? [], indicators: inds.data ?? [], targets: targets.data ?? [] };
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: { indicator_id: string; target: number | null }) => {
      if (p.target === null) {
        await supabase.from("store_indicator_targets").delete().eq("store_id", storeId).eq("indicator_id", p.indicator_id);
      } else {
        const { error } = await supabase.from("store_indicator_targets").upsert(
          { store_id: storeId, indicator_id: p.indicator_id, target: p.target },
          { onConflict: "store_id,indicator_id" },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-metas", storeId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Metas por loja</h1>
        <p className="text-slate-500">Ajuste metas específicas de cada loja (sobrepõem a meta padrão).</p>
      </div>

      <Card className="p-5">
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-80"><SelectValue placeholder="Selecione uma loja" /></SelectTrigger>
          <SelectContent>
            {(storesQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {q.data && q.data.modules.map((m) => {
        const list = q.data!.indicators.filter((i) => i.module_id === m.id);
        return (
          <Card key={m.id} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold" style={{ color: m.color }}>{m.name}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="px-5 py-2">Indicador</th>
                  <th className="py-2 text-right w-32">Meta padrão</th>
                  <th className="py-2 w-40">Meta desta loja</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const override = q.data!.targets.find((t) => t.indicator_id === i.id);
                  return (
                    <MetaRow
                      key={i.id}
                      name={i.name}
                      subgroup={i.subgroup}
                      defaultTarget={i.default_target}
                      overrideValue={override ? Number(override.target) : null}
                      onSave={(v) => upsert.mutate({ indicator_id: i.id, target: v })}
                    />
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

function MetaRow({
  name, subgroup, defaultTarget, overrideValue, onSave,
}: { name: string; subgroup: string | null; defaultTarget: number | null; overrideValue: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(overrideValue != null ? String(overrideValue) : "");
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-5 py-2">
        <div className="font-medium">{name}</div>
        {subgroup && <div className="text-xs text-slate-500">{subgroup}</div>}
      </td>
      <td className="py-2 text-right text-slate-500">{defaultTarget ?? "-"}</td>
      <td className="py-2">
        <Input
          className="h-8"
          type="number"
          step="any"
          value={v}
          placeholder="usar padrão"
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onSave(v === "" ? null : Number(v))}
        />
      </td>
    </tr>
  );
}
