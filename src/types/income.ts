export type IncomeCategory = 'rental' | 'interest' | 'royalty' | 'freelance' | 'other';

export interface OtherIncome {
  id: string;
  user_id: string;
  source: string;
  category: IncomeCategory;
  received_date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OtherIncomeInsert = Omit<OtherIncome, 'id' | 'created_at' | 'updated_at'>;
export type OtherIncomeUpdate = Partial<Omit<OtherIncome, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  rental: 'Rental',
  interest: 'Interest',
  royalty: 'Royalty',
  freelance: 'Freelance',
  other: 'Other',
};
