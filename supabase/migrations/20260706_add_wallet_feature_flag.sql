-- Feature flag for temporarily disabling wallet actions while keeping history and credit available.

CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wallet_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id, wallet_enabled)
VALUES (1, false)
ON CONFLICT (id)
DO UPDATE SET wallet_enabled = EXCLUDED.wallet_enabled,
              updated_at = now();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'Authenticated users can view app settings'
  ) THEN
    CREATE POLICY "Authenticated users can view app settings"
    ON app_settings FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
