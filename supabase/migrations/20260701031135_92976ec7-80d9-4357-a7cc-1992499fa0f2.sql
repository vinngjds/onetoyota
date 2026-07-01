
CREATE TYPE public.app_role AS ENUM ('lt', 'gestao');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_assignments TO authenticated;
GRANT ALL ON public.store_assignments TO service_role;
ALTER TABLE public.store_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4C6EF5',
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  subgroup TEXT,
  name TEXT NOT NULL,
  max_points NUMERIC(10,4) NOT NULL DEFAULT 0,
  default_target NUMERIC(14,4),
  unit TEXT NOT NULL DEFAULT 'percent',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicators TO authenticated;
GRANT ALL ON public.indicators TO service_role;
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.store_indicator_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  target NUMERIC(14,4) NOT NULL,
  UNIQUE(store_id, indicator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_indicator_targets TO authenticated;
GRANT ALL ON public.store_indicator_targets TO service_role;
ALTER TABLE public.store_indicator_targets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.indicator_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  realizado NUMERIC(14,4),
  projecao NUMERIC(14,4),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, indicator_id, period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicator_entries TO authenticated;
GRANT ALL ON public.indicator_entries TO service_role;
ALTER TABLE public.indicator_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.classification_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score NUMERIC(10,4) NOT NULL,
  letter TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#22C55E'
);
GRANT SELECT ON public.classification_bands TO authenticated;
GRANT ALL ON public.classification_bands TO service_role;
ALTER TABLE public.classification_bands ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'gestao'));
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "user_roles self select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'gestao'));
CREATE POLICY "user_roles gestao all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));

CREATE POLICY "stores gestao all" ON public.stores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));
CREATE POLICY "stores lt select assigned" ON public.stores FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'gestao') OR EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = stores.id AND sa.user_id = auth.uid())
);

CREATE POLICY "assign gestao all" ON public.store_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));
CREATE POLICY "assign self select" ON public.store_assignments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'gestao'));

CREATE POLICY "modules read auth" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules gestao write" ON public.modules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));

CREATE POLICY "indicators read auth" ON public.indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "indicators gestao write" ON public.indicators FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));

CREATE POLICY "targets gestao all" ON public.store_indicator_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));
CREATE POLICY "targets lt read" ON public.store_indicator_targets FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'gestao') OR EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = store_indicator_targets.store_id AND sa.user_id = auth.uid())
);

CREATE POLICY "entries gestao all" ON public.indicator_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));
CREATE POLICY "entries lt select" ON public.indicator_entries FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'gestao') OR EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = indicator_entries.store_id AND sa.user_id = auth.uid())
);
CREATE POLICY "entries lt insert" ON public.indicator_entries FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = indicator_entries.store_id AND sa.user_id = auth.uid())
);
CREATE POLICY "entries lt update" ON public.indicator_entries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = indicator_entries.store_id AND sa.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.store_assignments sa WHERE sa.store_id = indicator_entries.store_id AND sa.user_id = auth.uid())
);

CREATE POLICY "bands read auth" ON public.classification_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "bands gestao write" ON public.classification_bands FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestao')) WITH CHECK (public.has_role(auth.uid(),'gestao'));

-- SEED
INSERT INTO public.modules (slug, name, color, sort_order) VALUES
  ('seguranca-qualidade-esg','Segurança, Qualidade e ESG','#4C6EF5',1),
  ('vendas','Vendas','#22C55E',2),
  ('retencao','Retenção','#F59E0B',3),
  ('value-chain','Value Chain','#8B5CF6',4);

INSERT INTO public.classification_bands (min_score, letter, color) VALUES
  (90,'A','#22C55E'),(75,'B','#F59E0B'),(60,'C','#EF4444'),(0,'D','#6B7280');

-- HANDLE NEW USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'lt') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
