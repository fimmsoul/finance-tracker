export interface DailySnapshot {
  id: string;
  user_id: string;
  snapshot_date: string; // YYYY-MM-DD
  stocks_value: number;
  cash_value: number;
  gold_value: number;
  crypto_value: number;
  bonds_value: number;
  real_estate_value: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export type DailySnapshotInsert = Omit<DailySnapshot, 'id' | 'created_at' | 'updated_at'>;

export const snapshotCategories = [
  { key: 'stocks_value' as const, label: 'Stocks' },
  { key: 'cash_value' as const, label: 'Cash' },
  { key: 'gold_value' as const, label: 'Gold' },
  { key: 'crypto_value' as const, label: 'Crypto' },
  { key: 'bonds_value' as const, label: 'Bonds' },
  { key: 'real_estate_value' as const, label: 'Real Estate' },
] as const;

export type SnapshotCategoryKey = (typeof snapshotCategories)[number]['key'];
