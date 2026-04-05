import type { AccountType } from './stock';

export type TransactionType = 'buy' | 'sell';

export interface Transaction {
  id: string;
  user_id: string;
  stock_id: string;
  // Denormalized stock info for display (filled from join or local lookup)
  ticker?: string;
  stock_name?: string;
  account_type?: AccountType;
  currency?: string;
  transaction_date: string;  // YYYY-MM-DD
  type: TransactionType;
  quantity: number;
  price_per_share: number;
  fees: number;
  exchange_rate: number | null;
  notes: string | null;
  member_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'ticker' | 'stock_name' | 'account_type' | 'currency'>;
export type TransactionUpdate = Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ticker' | 'stock_name' | 'account_type' | 'currency'>>;
