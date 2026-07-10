-- Location overhaul: stronger customer/driver delivery location support

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS delivery_lng numeric(10,7),
  ADD COLUMN IF NOT EXISTS delivery_location_description text;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS driver_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS driver_lng numeric(10,7),
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_lat_lng ON public.orders(delivery_lat, delivery_lng);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_lat_lng ON public.deliveries(driver_lat, driver_lng);
