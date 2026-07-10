-- Add OTP support for deliveries

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS otp varchar(10),
  ADD COLUMN IF NOT EXISTS otp_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;

-- Optional: create an index on otp for lookups (if verifying by otp)
CREATE INDEX IF NOT EXISTS idx_deliveries_otp ON deliveries(otp);
