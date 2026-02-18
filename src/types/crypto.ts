export interface Crypto {
  id: string;
  user_id: string;
  symbol: string; // e.g., BTC, ETH, SOL
  name: string | null; // e.g., Bitcoin, Ethereum
  quantity: number;
  buy_price: number;
  current_price: number;
  currency: string; // Quote currency (USD, KRW, etc.)
  notes: string | null;
  position: 'attacker' | 'midfielder' | 'defender';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CryptoInsert = Omit<Crypto, 'id' | 'created_at' | 'updated_at'>;
export type CryptoUpdate = Partial<Omit<Crypto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// Helper to convert symbol to Yahoo Finance ticker format
export function toYahooTicker(symbol: string, currency: string = 'USD'): string {
  return `${symbol.toUpperCase()}-${currency.toUpperCase()}`;
}
