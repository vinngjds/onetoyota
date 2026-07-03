import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
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

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: any }) => {
      const { error } = await supabase.from("indicators").update(p.patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gestao-indicadores"] });
      toast.success("Indicador atualizado");
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

  const [typeFilter, setTypeFilter] = useState<"all" | "toyota" | "lexus">("all");

  if (q.isLoading || !q.data) return <div className="text-slate-500">Carregando...</div>;
  const { modules, indicators } = q.data;
  const filteredModules = modules.filter((m: any) => typeFilter === "all" || m.store_type === typeFilter);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de indicadores</h1>
          <p className="text-slate-500">Gerencie os indicadores de cada módulo e defina metas padrão.</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(["all", "toyota", "lexus"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${typeFilter === t ? "bg-white shadow font-semibold" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t === "all" ? "Todos" : t === "toyota" ? "Toyota" : "Lexus"}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Novo indicador</div>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <Label>Módulo</Label>
            <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {filteredModules.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} {m.store_type === "lexus" ? "(Lexus)" : "(Toyota)"}</SelectItem>)}
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

      {filteredModules.map((m: any) => {
        const list = indicators.filter((i) => i.module_id === m.id);
        return (
          <Card key={m.id} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold flex items-center justify-between" style={{ color: m.color }}>
              <span>{m.name}</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">{m.store_type === "lexus" ? "Lexus" : "Toyota"}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b">
                  <th className="px-5 py-2">Subgrupo</th>
                  <th className="py-2">Indicador</th>
                  <th className="py-2 text-right">Pontuação</th>
                  <th className="py-2 text-right">Meta padrão</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2 text-right pr-3">Ordem</th>
                  <th className="py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <IndicatorRow
                    key={i.id}
                    indicator={i}
                    onSave={(patch) => update.mutate({ id: i.id, patch })}
                    onDelete={() => del.mutate(i.id)}
                  />
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-4 text-center text-slate-400 text-sm">Sem indicadores.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

function IndicatorRow({ indicator, onSave, onDelete }: { indicator: any; onSave: (patch: any) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    subgroup: indicator.subgroup ?? "",
    name: indicator.name,
    max_points: String(indicator.max_points),
    default_target: indicator.default_target != null ? String(indicator.default_target) : "",
    unit: indicator.unit,
    sort_order: String(indicator.sort_order),
  });

  if (editing) {
    return (
      <tr className="border-b bg-slate-50/60">
        <td className="px-5 py-2">
          <Input className="h-8" value={f.subgroup} onChange={(e) => setF({ ...f, subgroup: e.target.value })} />
        </td>
        <td className="py-2">
          <Input className="h-8" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </td>
        <td className="py-2">
          <Input className="h-8 text-right" type="number" step="any" value={f.max_points} onChange={(e) => setF({ ...f, max_points: e.target.value })} />
        </td>
        <td className="py-2">
          <Input className="h-8 text-right" type="number" step="any" value={f.default_target} onChange={(e) => setF({ ...f, default_target: e.target.value })} />
        </td>
        <td className="py-2">
          <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="py-2">
          <Input className="h-8 text-right" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
        </td>
        <td className="py-2">
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); onSave({
              subgroup: f.subgroup || null,
              name: f.name,
              max_points: Number(f.max_points),
              default_target: f.default_target === "" ? null : Number(f.default_target),
              unit: f.unit,
              sort_order: Number(f.sort_order),
            }); }}>
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-5 py-2 text-slate-600">{indicator.subgroup ?? "-"}</td>
      <td className="py-2 font-medium">{indicator.name}</td>
      <td className="py-2 text-right">{Number(indicator.max_points).toFixed(2)}</td>
      <td className="py-2 text-right">{indicator.default_target ?? "-"}</td>
      <td className="py-2 text-xs text-slate-500">{indicator.unit}</td>
      <td className="py-2 text-right pr-3 text-slate-500">{indicator.sort_order}</td>
      <td className="py-2">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => confirm("Remover indicador?") && onDelete()}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
