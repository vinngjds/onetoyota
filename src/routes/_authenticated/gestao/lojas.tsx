import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gestao/lojas")({
  component: GestaoLojas,
});

function GestaoLojas() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const storesQ = useQuery({
    queryKey: ["gestao-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const usersQ = useQuery({
    queryKey: ["gestao-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: assigns }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("store_assignments").select("*"),
      ]);
      return { profiles: profiles ?? [], roles: roles ?? [], assigns: assigns ?? [] };
    },
  });

  const addStore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").insert({ name, code: code || null });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setCode(""); qc.invalidateQueries({ queryKey: ["gestao-stores"] }); qc.invalidateQueries({ queryKey: ["my-stores"] }); toast.success("Loja criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delStore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-stores"] }); qc.invalidateQueries({ queryKey: ["my-stores"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStore = useMutation({
    mutationFn: async (p: { id: string; name: string; code: string | null }) => {
      const { error } = await supabase.from("stores").update({ name: p.name, code: p.code }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gestao-stores"] }); qc.invalidateQueries({ queryKey: ["my-stores"] }); toast.success("Loja atualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async (p: { store_id: string; user_id: string }) => {
      const { error } = await supabase.from("store_assignments").insert(p);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-users"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-users"] }),
  });

  const setRole = useMutation({
    mutationFn: async (p: { user_id: string; role: "lt" | "gestao"; add: boolean }) => {
      if (p.add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: p.user_id, role: p.role });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", p.user_id).eq("role", p.role);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gestao-users"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const stores = storesQ.data ?? [];
  const { profiles = [], roles = [], assigns = [] } = usersQ.data ?? {};

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Lojas & Líderes de Transformação</h1>
        <p className="text-slate-500">Cadastre lojas e atribua LTs. Uma LT pode ser vinculada a várias lojas.</p>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Nova loja</div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Kuruma Vitória" />
          </div>
          <div className="w-40">
            <Label>Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="opcional" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => addStore.mutate()} disabled={!name || addStore.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {stores.map((s) => {
          const storeAssigns = assigns.filter((a) => a.store_id === s.id);
          return (
            <Card key={s.id} className="p-5">
              <StoreHeader
                store={s}
                onSave={(name, code) => updateStore.mutate({ id: s.id, name, code: code || null })}
                onDelete={() => confirm("Remover loja?") && delStore.mutate(s.id)}
              />

              <div className="mt-4">
                <div className="text-xs uppercase text-slate-500 mb-2">LTs atribuídas</div>
                <div className="flex flex-wrap gap-2">
                  {storeAssigns.length === 0 && <div className="text-sm text-slate-400">Ninguém atribuído.</div>}
                  {storeAssigns.map((a) => {
                    const p = profiles.find((x) => x.id === a.user_id);
                    return (
                      <div key={a.id} className="flex items-center gap-1 bg-slate-100 rounded-full pl-3 pr-1 py-1 text-xs">
                        {p?.full_name ?? a.user_id.slice(0, 8)}
                        <button onClick={() => unassign.mutate(a.id)} className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2 items-end">
                  <Select onValueChange={(uid) => assign.mutate({ store_id: s.id, user_id: uid })}>
                    <SelectTrigger className="w-64"><SelectValue placeholder="Atribuir LT..." /></SelectTrigger>
                    <SelectContent>
                      {profiles
                        .filter((p) => !storeAssigns.some((a) => a.user_id === p.id))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Perfis de acesso</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b">
              <th className="py-2">Usuário</th>
              <th className="py-2">Papéis</th>
              <th className="py-2 w-40">Ação</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const userRoles = roles.filter((r) => r.user_id === p.id).map((r) => r.role);
              const isG = userRoles.includes("gestao");
              return (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="py-2">{p.full_name || p.id.slice(0, 8)}</td>
                  <td className="py-2 text-xs text-slate-600">{userRoles.join(", ") || "-"}</td>
                  <td className="py-2">
                    <Button size="sm" variant={isG ? "outline" : "default"} onClick={() => setRole.mutate({ user_id: p.id, role: "gestao", add: !isG })}>
                      {isG ? "Remover Gestão" : "Promover a Gestão"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
