export interface Dividend {
  id: string;
  user_id: string;
  stock_id: string;
  // Denormalized stock info for display (filled from join or local lookup)
  ticker?: string;
  stock_name?: string;
  received_date: string; // YYYY-MM-DD
  amount: number;
  foreign_tax: number;
  dps: number; // Dividends per share
  currency: string;
  notes: string | null;
  member_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DividendInsert = Omit<Dividend, 'id' | 'created_at' | 'updated_at' | 'ticker' | 'stock_name'>;
export type DividendUpdate = Partial<Omit<Dividend, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ticker' | 'stock_name'>>;
