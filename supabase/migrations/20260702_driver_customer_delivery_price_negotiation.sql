-- Delivery fee negotiation + driver interest tracking
-- Supports:
-- 1) Base fee and negotiable offers on orders
-- 2) Driver view/counter/accept tracking for customer visibility

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_base numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_offer_customer numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_offer_driver numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_offer_by text CHECK (delivery_fee_offer_by IN ('customer', 'driver')),
  ADD COLUMN IF NOT EXISTS delivery_fee_offer_updated_at timestamptz;

UPDATE public.orders
SET delivery_fee_base = COALESCE(delivery_fee_base, delivery_fee)
WHERE delivery_fee_base IS NULL;

CREATE TABLE IF NOT EXISTS public.order_driver_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'viewed' CHECK (status IN ('viewed', 'countered', 'rejected', 'accepted')),
  counter_offer numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_order_driver_interest_order_id ON public.order_driver_interest(order_id);
CREATE INDEX IF NOT EXISTS idx_order_driver_interest_driver_id ON public.order_driver_interest(driver_id);

ALTER TABLE public.order_driver_interest ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_driver_interest'
      AND policyname = 'Authenticated users can read order driver interest'
  ) THEN
    CREATE POLICY "Authenticated users can read order driver interest"
      ON public.order_driver_interest
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_driver_interest'
      AND policyname = 'Drivers can upsert own interest'
  ) THEN
    CREATE POLICY "Drivers can upsert own interest"
      ON public.order_driver_interest
      FOR INSERT
      TO authenticated
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_driver_interest'
      AND policyname = 'Drivers can update own interest'
  ) THEN
    CREATE POLICY "Drivers can update own interest"
      ON public.order_driver_interest
      FOR UPDATE
      TO authenticated
      USING (driver_id = auth.uid())
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;
