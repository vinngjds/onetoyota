import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao/metas")({
  component: GestaoMetas,
});

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type TargetRow = {
  id: string;
  store_id: string;
  indicator_id: string;
  target: number | string;
  period_year: number | null;
  period_month: number | null;
};

function GestaoMetas() {
  const [storeId, setStoreId] = useState<string>("");
  const period = usePeriod();
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
      return {
        modules: mods.data ?? [],
        indicators: inds.data ?? [],
        targets: (targets.data ?? []) as unknown as TargetRow[],
      };
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: {
      indicator_id: string;
      target: number;
      period_year: number | null;
      period_month: number | null;
    }) => {
      // Manual upsert (unique index uses COALESCE, so onConflict isn't declared)
      const existing = (q.data?.targets ?? []).find(
        (t) =>
          t.indicator_id === p.indicator_id &&
          t.period_year === p.period_year &&
          t.period_month === p.period_month,
      );
      if (existing) {
        const { error } = await supabase
          .from("store_indicator_targets")
          .update({ target: p.target } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_indicator_targets").insert({
          store_id: storeId,
          indicator_id: p.indicator_id,
          target: p.target,
          period_year: p.period_year,
          period_month: p.period_month,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-metas", storeId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_indicator_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-metas", storeId] }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Metas por loja</h1>
        <p className="text-slate-500">
          Ajuste metas específicas de cada loja. Você pode definir a meta padrão (vale para todos os meses)
          ou um valor específico para o mês selecionado no topo ({MONTHS[period.month - 1]}/{period.year}).
        </p>
      </div>

      <Card className="p-5">
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Selecione uma loja" />
          </SelectTrigger>
          <SelectContent>
            {(storesQ.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {q.data &&
        q.data.modules.map((m) => {
          const list = q.data!.indicators.filter((i) => i.module_id === m.id);
          return (
            <Card key={m.id} className="p-0 overflow-hidden">
              <div className="px-5 py-3 border-b font-semibold" style={{ color: m.color }}>
                {m.name}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b">
                    <th className="px-5 py-2">Indicador</th>
                    <th className="py-2 text-right w-28">Meta padrão</th>
                    <th className="py-2 text-right w-32">
                      Meta anual da loja
                    </th>
                    <th className="py-2 text-right w-40">
                      Meta {MONTHS[period.month - 1]}/{period.year}
                    </th>
                    <th className="py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const annual =
                      q.data!.targets.find(
                        (t) =>
                          t.indicator_id === i.id &&
                          t.period_year == null &&
                          t.period_month == null,
                      ) ?? null;
                    const monthly =
                      q.data!.targets.find(
                        (t) =>
                          t.indicator_id === i.id &&
                          t.period_year === period.year &&
                          t.period_month === period.month,
                      ) ?? null;
                    return (
                      <MetaRow
                        key={i.id}
                        indicator={i}
                        defaultTarget={i.default_target}
                        annual={annual}
                        monthly={monthly}
                        period={period}
                        onSave={(p) => upsert.mutate({ indicator_id: i.id, ...p })}
                        onDelete={(id) => del.mutate(id)}
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
  indicator,
  defaultTarget,
  annual,
  monthly,
  period,
  onSave,
  onDelete,
}: {
  indicator: any;
  defaultTarget: number | null;
  annual: TargetRow | null;
  monthly: TargetRow | null;
  period: { year: number; month: number };
  onSave: (p: { target: number; period_year: number | null; period_month: number | null }) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"annual" | "monthly">("monthly");

  const openDialog = () => {
    const current = monthly ?? annual;
    setValue(current ? String(current.target) : defaultTarget != null ? String(defaultTarget) : "");
    setScope(monthly ? "monthly" : "annual");
    setOpen(true);
  };

  const submit = () => {
    if (value === "") {
      toast.error("Informe um valor");
      return;
    }
    onSave({
      target: Number(value),
      period_year: scope === "monthly" ? period.year : null,
      period_month: scope === "monthly" ? period.month : null,
    });
    setOpen(false);
  };

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-5 py-2">
        <div className="font-medium">{indicator.name}</div>
        {indicator.subgroup && <div className="text-xs text-slate-500">{indicator.subgroup}</div>}
      </td>
      <td className="py-2 text-right text-slate-500">{defaultTarget ?? "-"}</td>
      <td className="py-2 text-right">
        {annual ? (
          <span className="font-medium">{Number(annual.target)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-2 text-right">
        {monthly ? (
          <span className="font-medium text-blue-600">{Number(monthly.target)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={openDialog}>
            <Pencil className="w-4 h-4" />
          </Button>
          {(annual || monthly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm("Remover meta customizada?")) return;
                if (monthly) onDelete(monthly.id);
                else if (annual) onDelete(annual.id);
              }}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar meta</DialogTitle>
              <DialogDescription>{indicator.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Valor da meta</Label>
                <Input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                />
                <div className="text-xs text-slate-500 mt-1">
                  Meta padrão do indicador: {defaultTarget ?? "-"}
                </div>
              </div>
              <div>
                <Label>Aplicar em</Label>
                <RadioGroup value={scope} onValueChange={(v: any) => setScope(v)} className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem id="scope-month" value="monthly" className="mt-1" />
                    <Label htmlFor="scope-month" className="font-normal cursor-pointer">
                      Somente {MONTHS[period.month - 1]}/{period.year}
                      <div className="text-xs text-slate-500">
                        Vale apenas neste mês; outros meses seguem a meta anual/padrão.
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem id="scope-annual" value="annual" className="mt-1" />
                    <Label htmlFor="scope-annual" className="font-normal cursor-pointer">
                      Todos os meses (meta anual da loja)
                      <div className="text-xs text-slate-500">
                        Sobrepõe a meta padrão em todos os meses sem meta específica.
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
