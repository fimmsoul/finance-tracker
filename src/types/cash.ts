export interface CashAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'savings' | 'cash' | 'money_market';
  balance: number;
  currency: string;
  notes: string | null;
  position: 'attacker' | 'midfielder' | 'defender';
  member_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CashAccountInsert = Omit<CashAccount, 'id' | 'created_at' | 'updated_at'>;
export type CashAccountUpdate = Partial<Omit<CashAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const cashTypeLabels: Record<CashAccount['type'], string> = {
  bank: 'Bank',
  savings: 'Savings',
  cash: 'Cash',
  money_market: 'Money Market',
};
