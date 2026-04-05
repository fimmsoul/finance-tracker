-- ============================================================
-- Family Members Feature Migration
-- ============================================================

-- 1. Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'self',  -- 'self', 'spouse', 'child', 'parent', 'sibling', 'other'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for family_members
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own family members"
  ON family_members FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_family_members_user_id ON family_members(user_id);

-- 2. Add member_id to all asset tables (nullable initially for migration)
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE cash_accounts ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE cryptos ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE dividends ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE other_incomes ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;

-- 3. Add member_id to daily_snapshots for per-member snapshots
ALTER TABLE daily_snapshots ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES family_members(id) ON DELETE SET NULL;

-- Drop the old unique constraint and create a new one that includes member_id
-- (member_id = NULL means "family total" snapshot)
ALTER TABLE daily_snapshots DROP CONSTRAINT IF EXISTS daily_snapshots_user_id_snapshot_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_snapshots_user_member_date_idx
  ON daily_snapshots(user_id, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'), snapshot_date);

-- 4. Indexes for member_id on all tables
CREATE INDEX IF NOT EXISTS idx_stocks_member_id ON stocks(member_id);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_member_id ON cash_accounts(member_id);
CREATE INDEX IF NOT EXISTS idx_assets_member_id ON assets(member_id);
CREATE INDEX IF NOT EXISTS idx_cryptos_member_id ON cryptos(member_id);
CREATE INDEX IF NOT EXISTS idx_dividends_member_id ON dividends(member_id);
CREATE INDEX IF NOT EXISTS idx_other_incomes_member_id ON other_incomes(member_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_member_id ON stock_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_member_id ON daily_snapshots(member_id);
