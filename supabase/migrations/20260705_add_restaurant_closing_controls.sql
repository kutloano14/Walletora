BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS closing_time time without time zone NOT NULL DEFAULT '22:00:00';

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_temporarily_closed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.closing_time IS
  'Daily local closing time shown to customers.';

COMMENT ON COLUMN public.restaurants.is_temporarily_closed IS
  'Manual override for immediate closure even before the configured closing time.';

COMMIT;
