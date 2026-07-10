-- Add pickup OTP fields to orders for pickup confirmation

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS pickup_otp varchar,
  ADD COLUMN IF NOT EXISTS pickup_otp_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_otp_expires_at timestamptz;

-- Grant authenticated role ability to update their own orders for pickup otp verification if you need RLS policies adjusted separately.

-- Note: Run this migration in your Supabase SQL editor or migration runner.
