
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_type TEXT NOT NULL DEFAULT 'toyota'
  CHECK (store_type IN ('toyota','lexus'));

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS store_type TEXT NOT NULL DEFAULT 'toyota'
  CHECK (store_type IN ('toyota','lexus'));

UPDATE public.stores
   SET store_type = 'lexus'
 WHERE name IN ('Lexus Vitória','Lexus BH','Lexus BSB');

CREATE INDEX IF NOT EXISTS idx_stores_store_type ON public.stores(store_type);
CREATE INDEX IF NOT EXISTS idx_modules_store_type ON public.modules(store_type);
