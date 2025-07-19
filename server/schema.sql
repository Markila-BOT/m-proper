-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY, --TODO: do not use gen_random_uuid() or long id
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('residential', 'commercial')),
  units INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can customize this based on your auth requirements)
CREATE POLICY "Allow all operations on properties" ON properties
  FOR ALL USING (true); 