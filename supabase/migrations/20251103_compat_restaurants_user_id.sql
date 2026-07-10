-- Migration: 20251103 - compatibility for policies referencing restaurants.user_id
-- Purpose: Some older policies/migrations reference `restaurants.user_id`,
-- but the current schema uses `owner_id`. To avoid runtime errors while
-- you update RLS policies, this migration will add a computed (generated)
-- `user_id` column that mirrors `owner_id` (only if owner_id exists and
-- user_id does not). This keeps existing policies working without immediate
-- policy edits.

BEGIN;

-- Only proceed when owner_id exists and user_id does NOT exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'user_id'
  ) THEN

    -- Add a generated column `user_id` that mirrors `owner_id`.
    -- This is a non-invasive compatibility shim so RLS policies that
    -- still reference `user_id` keep working.
    ALTER TABLE public.restaurants
      ADD COLUMN user_id uuid GENERATED ALWAYS AS (owner_id) STORED;

    -- Add an index to match older migration expectations (safe if it already exists)
    CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);

  END IF;
END
$$;

COMMIT;

-- NEXT STEPS / NOTES
-- 1) This migration is a temporary compatibility shim. Recommended long-term
--    approach: update your RLS policies and application code to reference
--    `owner_id` instead of `user_id` and then remove this generated column.
--
-- 2) To update RLS policies, you'll typically DROP the old policies and
--    CREATE new ones referencing `owner_id`, for example:
--
-- DROP POLICY IF EXISTS "Restaurants owner policy" ON public.restaurants;
-- CREATE POLICY "Restaurants owner policy" ON public.restaurants
--   FOR ALL
--   USING (owner_id = auth.uid())
--   WITH CHECK (owner_id = auth.uid());
--
-- (Policy names vary — inspect your Supabase project's policies and adapt.)
--
-- 3) If you prefer to directly change policies instead of adding a shim,
--    I can generate DROP/CREATE statements for each policy once you share
--    the existing policy names or allow me to list them (requires DB access).
--
-- 4) If you want, I can also create a migration that renames/removes the
--    legacy user_id column later (after policies are updated).
