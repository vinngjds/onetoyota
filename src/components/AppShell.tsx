import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsGestao, usePeriod, setPeriod, useSelectedStoreId, setSelectedStoreId } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Shield,
  TrendingUp,
  Users,
  Package,
  Store,
  Settings2,
  LogOut,
  History,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MODULE_LINKS = [
  { slug: "seguranca-qualidade-esg", label: "Segurança, Qualidade e ESG", icon: Shield },
  { slug: "vendas", label: "Vendas", icon: TrendingUp },
  { slug: "retencao", label: "Retenção", icon: Users },
  { slug: "value-chain", label: "Value Chain", icon: Package },
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isGestao } = useIsGestao();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const period = usePeriod();
  const storeId = useSelectedStoreId();

  const storesQ = useQuery({
    queryKey: ["my-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name, code").order("name");
      if (error) throw error;
      return data;
    },
  });

  // auto-select first store if none
  if (storesQ.data && storesQ.data.length && !storeId) {
    setSelectedStoreId(storesQ.data[0].id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition ${
          active
            ? "bg-primary text-primary-foreground font-medium"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b">
          <div className="text-xl font-bold text-primary">Kuruma</div>
          <div className="text-xs text-slate-500 mt-0.5">Indicadores de Loja</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/historico" icon={History} label="Histórico" />

          {isGestao && (
            <>
              <div className="mt-4 mb-1 px-4 text-xs uppercase tracking-wide text-slate-400 font-semibold">
                Gestão
              </div>
              <NavItem to="/gestao" icon={LayoutDashboard} label="Consolidado" />
              <NavItem to="/gestao/lojas" icon={Store} label="Lojas & LTs" />
              <NavItem to="/gestao/indicadores" icon={Settings2} label="Indicadores" />
              <NavItem to="/gestao/metas" icon={Target} label="Metas por loja" />
            </>
          )}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Select
              value={storeId ?? undefined}
              onValueChange={(v) => setSelectedStoreId(v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={storesQ.data?.length ? "Selecionar loja" : "Sem lojas"} />
              </SelectTrigger>
              <SelectContent>
                {storesQ.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(period.month)}
              onValueChange={(v) => setPeriod({ ...period, month: Number(v) })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(period.year)}
              onValueChange={(v) => setPeriod({ ...period, year: Number(v) })}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
