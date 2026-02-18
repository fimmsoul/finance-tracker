-- ============================================================
-- Migration: Add Portfolio Views (Dynamic Tabs)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create portfolio_views table
CREATE TABLE IF NOT EXISTS portfolio_views (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE portfolio_views ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Users can view own portfolio views" ON portfolio_views
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio views" ON portfolio_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio views" ON portfolio_views
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio views" ON portfolio_views
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Create trigger for updated_at
CREATE TRIGGER portfolio_views_updated_at
  BEFORE UPDATE ON portfolio_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Create index
CREATE INDEX idx_portfolio_views_user_id ON portfolio_views(user_id);

-- 6. Add view_id column to custom_groups
ALTER TABLE custom_groups
  ADD COLUMN IF NOT EXISTS view_id UUID REFERENCES portfolio_views(id) ON DELETE CASCADE;

-- 7. Create index for view_id
CREATE INDEX IF NOT EXISTS idx_custom_groups_view_id ON custom_groups(view_id);

-- ============================================================
-- Optional: Migrate existing custom_groups to a default view
-- Uncomment and run if you have existing data
-- ============================================================

-- -- Create a default portfolio view for each user who has custom groups
-- INSERT INTO portfolio_views (user_id, name, sort_order)
-- SELECT DISTINCT user_id, '커스텀 그룹', 0
-- FROM custom_groups
-- WHERE view_id IS NULL
-- ON CONFLICT DO NOTHING;

-- -- Link existing groups to their user's default view
-- UPDATE custom_groups cg
-- SET view_id = pv.id
-- FROM portfolio_views pv
-- WHERE cg.user_id = pv.user_id
--   AND cg.view_id IS NULL
--   AND pv.name = '커스텀 그룹';
