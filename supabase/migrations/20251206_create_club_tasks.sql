-- Create club_tasks table
CREATE TABLE IF NOT EXISTS club_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE club_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Admins have full access to all tasks
CREATE POLICY "Admins can do everything on club_tasks"
  ON club_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'officer', 'advisor')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_club_tasks_updated_at
    BEFORE UPDATE ON club_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
