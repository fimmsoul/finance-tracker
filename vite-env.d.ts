/// <reference types="vite/client" />

interface StockPriceResult {
  success: boolean;
  data?: Record<string, { price: number; currency: string } | null>;
  error?: string;
}

interface Window {
  electronAPI: {
    onAuthCallback: (callback: (url: string) => void) => void;
    openExternal: (url: string) => void;
    fetchStockPrices: (tickers: string[]) => Promise<StockPriceResult>;
  };
}
