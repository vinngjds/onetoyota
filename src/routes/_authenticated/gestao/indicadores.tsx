import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao/indicadores")({
  component: GestaoIndicadores,
});

const UNITS = [
  { value: "percent", label: "Percentual (%)" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda (R$)" },
  { value: "boolean", label: "SIM/NÃO (0 ou 1)" },
];

function GestaoIndicadores() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["gestao-indicadores"],
    queryFn: async () => {
      const [mods, inds] = await Promise.all([
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("indicators").select("*").order("sort_order"),
      ]);
      return { modules: mods.data ?? [], indicators: inds.data ?? [] };
    },
  });

  const [form, setForm] = useState({
    module_id: "",
    subgroup: "",
    name: "",
    max_points: "0",
    default_target: "",
    unit: "percent",
    sort_order: "0",
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("indicators").insert({
        module_id: form.module_id,
        subgroup: form.subgroup || null,
        name: form.name,
        max_points: Number(form.max_points),
        default_target: form.default_target === "" ? null : Number(form.default_target),
        unit: form.unit,
        sort_order: Number(form.sort_order),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ ...form, name: "", max_points: "0", default_target: "", subgroup: "" });
      qc.invalidateQueries({ queryKey: ["gestao-indicadores"] });
      toast.success("Indicador criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-indicadores"] }),
  });

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;
  const { modules, indicators } = q.data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Catálogo de indicadores</h1>
        <p className="text-slate-500">Gerencie os indicadores de cada módulo e defina metas padrão.</p>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Novo indicador</div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label>Módulo</Label>
            <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Subgrupo</Label>
            <Input value={form.subgroup} onChange={(e) => setForm({ ...form, subgroup: e.target.value })} placeholder="Ex.: NPS de Vendas" />
          </div>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Média Mensal" />
          </div>
          <div>
            <Label>Pontuação</Label>
            <Input type="number" step="any" value={form.max_points} onChange={(e) => setForm({ ...form, max_points: e.target.value })} />
          </div>
          <div>
            <Label>Meta padrão</Label>
            <Input type="number" step="any" value={form.default_target} onChange={(e) => setForm({ ...form, default_target: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Tipo</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ordem</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => add.mutate()} disabled={!form.module_id || !form.name || add.isPending} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </Card>

      {modules.map((m) => {
        const list = indicators.filter((i) => i.module_id === m.id);
        return (
          <Card key={m.id} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold" style={{ color: m.color }}>{m.name}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="px-5 py-2">Subgrupo</th>
                  <th className="py-2">Indicador</th>
                  <th className="py-2 text-right">Pontuação</th>
                  <th className="py-2 text-right">Meta padrão</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0">
                    <td className="px-5 py-2 text-slate-600">{i.subgroup ?? "-"}</td>
                    <td className="py-2 font-medium">{i.name}</td>
                    <td className="py-2 text-right">{Number(i.max_points).toFixed(2)}</td>
                    <td className="py-2 text-right">{i.default_target ?? "-"}</td>
                    <td className="py-2 text-xs text-slate-500">{i.unit}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => confirm("Remover indicador?") && del.mutate(i.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-4 text-center text-slate-400 text-sm">Sem indicadores.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
