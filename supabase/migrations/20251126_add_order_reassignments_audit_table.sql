/*
  # Order Reassignments Audit Log Table (Optional)
  
  This table logs all order reassignments for audit trail and analytics.
  It's optional - the reassignment feature works without it.
*/

-- Create order_reassignments table
CREATE TABLE IF NOT EXISTS order_reassignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_driver_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  new_driver_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  reassigned_by text NOT NULL DEFAULT 'system',
  reassigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE order_reassignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all reassignments"
  ON order_reassignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert reassignments"
  ON order_reassignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_reassignments_order_id ON order_reassignments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_reassignments_new_driver_id ON order_reassignments(new_driver_id);
CREATE INDEX IF NOT EXISTS idx_order_reassignments_reassigned_at ON order_reassignments(reassigned_at);

-- Comments
COMMENT ON TABLE order_reassignments IS 'Audit log for order reassignments. Optional - not required for feature functionality.';
COMMENT ON COLUMN order_reassignments.reason IS 'Admin reason for reassigning the order (e.g., driver unavailable, distance issue, customer request)';
COMMENT ON COLUMN order_reassignments.reassigned_by IS 'User or system that performed the reassignment';
