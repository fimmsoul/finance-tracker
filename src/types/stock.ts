export type AccountType = 'general' | 'isa';

export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  quantity: number;
  buy_price: number;
  current_price: number;
  currency: string;
  notes: string | null;
  position: 'attacker' | 'midfielder' | 'defender';
  account_type: AccountType;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type StockInsert = Omit<Stock, 'id' | 'created_at' | 'updated_at'>;
export type StockUpdate = Partial<Omit<Stock, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
