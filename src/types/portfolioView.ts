export interface PortfolioView {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PortfolioViewInsert = Omit<PortfolioView, 'id' | 'created_at' | 'updated_at'>;
export type PortfolioViewUpdate = Partial<Omit<PortfolioView, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
