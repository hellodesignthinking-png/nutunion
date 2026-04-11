-- ============================================
-- 021: Portfolio System
-- Create portfolios table for user career items
-- Extend profiles with search-related fields
-- ============================================

-- Add columns to profiles for search (using ADD COLUMN IF NOT EXISTS)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_hours int;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_fields text[] DEFAULT '{}';

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'project' CHECK (category IN ('project', 'award', 'certification', 'education', 'experience', 'other')),
  tags text[] DEFAULT '{}',
  image_url text,
  external_link text,
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'nutunion')),
  started_at date,
  ended_at date,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_category ON portfolios(category);
CREATE INDEX IF NOT EXISTS idx_portfolios_source ON portfolios(source);
CREATE INDEX IF NOT EXISTS idx_portfolios_created_at ON portfolios(created_at DESC);

-- Enable RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Owners can select, insert, update, delete their own portfolios
CREATE POLICY "portfolio_owner_full" ON portfolios
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Portfolios are publicly readable (select only)
CREATE POLICY "portfolio_public_read" ON portfolios
  FOR SELECT USING (true);
