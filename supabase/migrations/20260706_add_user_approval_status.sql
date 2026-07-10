-- Driver/restaurant onboarding approval flow.
-- Customers are auto-approved, while drivers/restaurants can be set to pending.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_approval_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.user_profiles
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status NOT IN ('pending', 'approved', 'rejected');
