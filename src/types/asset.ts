export interface Asset {
  id: string;
  user_id: string;
  name: string;
  category: 'real_estate' | 'crypto' | 'gold' | 'bonds' | 'vehicle' | 'collectible' | 'other';
  purchase_value: number | null;
  current_value: number;
  currency: string;
  notes: string | null;
  position: 'attacker' | 'midfielder' | 'defender';
  created_at: string;
  updated_at: string;
}

export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;
export type AssetUpdate = Partial<Omit<Asset, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const assetCategoryLabels: Record<Asset['category'], string> = {
  real_estate: 'Real Estate',
  crypto: 'Crypto',
  gold: 'Gold',
  bonds: 'Bonds',
  vehicle: 'Vehicle',
  collectible: 'Collectible',
  other: 'Other',
};
