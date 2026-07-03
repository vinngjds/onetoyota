import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

export function useIsGestao() {
  const userId = useCurrentUser();
  const q = useQuery({
    queryKey: ["is-gestao", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "gestao")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isGestao: q.data === true, loading: q.isLoading, userId };
}

const PERIOD_KEY = "kv:period";
const STORE_KEY = "kv:store";

export function getPeriod(): { year: number; month: number } {
  if (typeof window === "undefined") {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  const raw = localStorage.getItem(PERIOD_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
export function setPeriod(p: { year: number; month: number }) {
  localStorage.setItem(PERIOD_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("kv:period-change"));
}

export function getSelectedStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORE_KEY);
}
export function setSelectedStoreId(id: string) {
  localStorage.setItem(STORE_KEY, id);
  window.dispatchEvent(new Event("kv:store-change"));
}

export function usePeriod() {
  const [p, setP] = useState(getPeriod);
  useEffect(() => {
    const h = () => setP(getPeriod());
    window.addEventListener("kv:period-change", h);
    return () => window.removeEventListener("kv:period-change", h);
  }, []);
  return p;
}

export function useSelectedStoreId() {
  const [s, setS] = useState<string | null>(getSelectedStoreId);
  useEffect(() => {
    const h = () => setS(getSelectedStoreId());
    window.addEventListener("kv:store-change", h);
    return () => window.removeEventListener("kv:store-change", h);
  }, []);
  return s;
}

export type StoreType = "toyota" | "lexus";

export function useSelectedStoreType(): StoreType {
  const storeId = useSelectedStoreId();
  const q = useQuery({
    queryKey: ["store-type", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("store_type")
        .eq("id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return ((data as { store_type?: string } | null)?.store_type ?? "toyota") as StoreType;
    },
  });
  return (q.data ?? "toyota") as StoreType;
}
