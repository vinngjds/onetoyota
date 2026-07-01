
ALTER TABLE public.store_indicator_targets
  ADD COLUMN IF NOT EXISTS period_year int,
  ADD COLUMN IF NOT EXISTS period_month int;

-- Drop old unique (store_id, indicator_id) if exists
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.store_indicator_targets'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (store_id, indicator_id)';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.store_indicator_targets DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Unique treating NULL month/year as "default anual"
CREATE UNIQUE INDEX IF NOT EXISTS store_indicator_targets_unique_scope
  ON public.store_indicator_targets (
    store_id,
    indicator_id,
    COALESCE(period_year, -1),
    COALESCE(period_month, -1)
  );
