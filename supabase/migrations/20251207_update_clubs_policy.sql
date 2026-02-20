-- Enable Row Level Security
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Admins have full access to update clubs
DROP POLICY IF EXISTS "Admins can update clubs" ON clubs;

CREATE POLICY "Admins can update clubs"
  ON clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'officer', 'advisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'officer', 'advisor')
    )
  );
