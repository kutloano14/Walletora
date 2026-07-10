-- Dynamic delivery pricing function.
-- Uses distance plus load signals so larger/heavier orders pay a fairer fee.

CREATE OR REPLACE FUNCTION public.calculate_dynamic_delivery_fee(
  p_distance_km numeric,
  p_total_units integer,
  p_estimated_weight_kg numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_distance_km numeric := GREATEST(COALESCE(p_distance_km, 0), 0);
  v_units integer := GREATEST(COALESCE(p_total_units, 0), 0);
  v_weight numeric := GREATEST(COALESCE(p_estimated_weight_kg, 0), 0);

  v_base_fee numeric := 10;
  v_distance_fee numeric := 0;
  v_handling_fee numeric := 0;
  v_load_fee numeric := 0;
  v_bulk_fee numeric := 0;
  v_total numeric := 0;
BEGIN
  -- Piecewise distance fee: short trips stay affordable, long trips scale appropriately.
  v_distance_fee :=
      LEAST(v_distance_km, 3) * 1.8
    + LEAST(GREATEST(v_distance_km - 3, 0), 7) * 2.4
    + GREATEST(v_distance_km - 10, 0) * 3.2;

  -- More units increase handling time and packing complexity.
  IF v_units > 3 THEN
    v_handling_fee := LEAST((v_units - 3) * 0.9, 10);
  END IF;

  -- Load tiers for heavier orders.
  IF v_weight > 20 THEN
    v_load_fee := 14;
  ELSIF v_weight > 10 THEN
    v_load_fee := 8;
  ELSIF v_weight > 4 THEN
    v_load_fee := 4;
  END IF;

  -- Very large unit counts receive additional bulk handling fee.
  IF v_units > 20 THEN
    v_bulk_fee := LEAST((v_units - 20) * 0.35, 12);
  END IF;

  v_total := v_base_fee + v_distance_fee + v_handling_fee + v_load_fee + v_bulk_fee;

  -- Global floor/cap to avoid absurd outcomes.
  v_total := LEAST(GREATEST(v_total, 12), 120);

  RETURN ROUND(v_total::numeric, 2);
END;
$$;
