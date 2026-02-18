-- Create cryptos table for cryptocurrency holdings
CREATE TABLE IF NOT EXISTS cryptos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL, -- BTC, ETH, SOL, etc.
  name TEXT, -- Bitcoin, Ethereum, etc.
  quantity NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  position TEXT NOT NULL DEFAULT 'midfielder' CHECK (position IN ('attacker', 'midfielder', 'defender')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cryptos ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only access their own data)
CREATE POLICY "Users can view own cryptos" ON cryptos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cryptos" ON cryptos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cryptos" ON cryptos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cryptos" ON cryptos
  FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_cryptos_user_id ON cryptos(user_id);
CREATE INDEX idx_cryptos_sort_order ON cryptos(user_id, sort_order);
