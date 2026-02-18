-- ============================================================
-- Finance Tracker - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor
-- ============================================================

-- Updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STOCKS TABLE
-- ============================================================
CREATE TABLE stocks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker        TEXT NOT NULL,
  name          TEXT,
  quantity      NUMERIC(15, 4) NOT NULL DEFAULT 0,
  buy_price     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  current_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stocks" ON stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stocks" ON stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stocks" ON stocks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stocks" ON stocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER stocks_updated_at BEFORE UPDATE ON stocks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_stocks_user_id ON stocks(user_id);

-- ============================================================
-- CASH ACCOUNTS TABLE
-- ============================================================
CREATE TABLE cash_accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'bank',
  balance     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash accounts" ON cash_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash accounts" ON cash_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash accounts" ON cash_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash accounts" ON cash_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cash_accounts_updated_at BEFORE UPDATE ON cash_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_cash_accounts_user_id ON cash_accounts(user_id);

-- ============================================================
-- OTHER ASSETS TABLE
-- ============================================================
CREATE TABLE assets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  purchase_value  NUMERIC(15, 2),
  current_value   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON assets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON assets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_assets_user_id ON assets(user_id);

-- ============================================================
-- DAILY ASSET SNAPSHOTS TABLE
-- Records daily portfolio valuations by category (all in USD base)
-- ============================================================
CREATE TABLE daily_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  stocks_value    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  cash_value      NUMERIC(18, 2) NOT NULL DEFAULT 0,
  gold_value      NUMERIC(18, 2) NOT NULL DEFAULT 0,
  crypto_value    NUMERIC(18, 2) NOT NULL DEFAULT 0,
  bonds_value     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  real_estate_value NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_value     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON daily_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON daily_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON daily_snapshots FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapshots" ON daily_snapshots FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER daily_snapshots_updated_at BEFORE UPDATE ON daily_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_daily_snapshots_user_date ON daily_snapshots(user_id, snapshot_date DESC);

-- ============================================================
-- DIVIDENDS TABLE
-- Records dividend payments linked to stocks
-- ============================================================
CREATE TABLE dividends (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id        UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  received_date   DATE NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  foreign_tax     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  dps             NUMERIC(15, 6) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dividends" ON dividends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dividends" ON dividends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dividends" ON dividends FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own dividends" ON dividends FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER dividends_updated_at BEFORE UPDATE ON dividends FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_dividends_user_id ON dividends(user_id);
CREATE INDEX idx_dividends_stock_id ON dividends(stock_id);
CREATE INDEX idx_dividends_date ON dividends(user_id, received_date DESC);

-- ============================================================
-- OTHER INCOMES TABLE
-- Records non-dividend passive income (rental, interest, etc.)
-- ============================================================
CREATE TABLE other_incomes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  received_date   DATE NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE other_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own incomes" ON other_incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incomes" ON other_incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incomes" ON other_incomes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own incomes" ON other_incomes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER other_incomes_updated_at BEFORE UPDATE ON other_incomes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_other_incomes_user_id ON other_incomes(user_id);
CREATE INDEX idx_other_incomes_date ON other_incomes(user_id, received_date DESC);

-- ============================================================
-- PORTFOLIO VIEWS TABLE
-- User-defined portfolio tabs (each can contain multiple custom groups)
-- ============================================================
CREATE TABLE portfolio_views (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portfolio_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio views" ON portfolio_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio views" ON portfolio_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio views" ON portfolio_views FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio views" ON portfolio_views FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER portfolio_views_updated_at BEFORE UPDATE ON portfolio_views FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_portfolio_views_user_id ON portfolio_views(user_id);

-- ============================================================
-- CUSTOM GROUPS TABLE
-- User-defined asset groupings for custom portfolio views
-- ============================================================
CREATE TABLE custom_groups (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_id     UUID REFERENCES portfolio_views(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'purple',
  asset_ids   TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom groups" ON custom_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom groups" ON custom_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom groups" ON custom_groups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom groups" ON custom_groups FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER custom_groups_updated_at BEFORE UPDATE ON custom_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_custom_groups_user_id ON custom_groups(user_id);
CREATE INDEX idx_custom_groups_view_id ON custom_groups(view_id);
