/// <reference types="vite/client" />

interface StockPriceResult {
  success: boolean;
  data?: Record<string, { price: number; currency: string } | null>;
  error?: string;
}

interface UpdateCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

interface Window {
  electronAPI: {
    onAuthCallback: (callback: (url: string) => void) => void;
    openExternal: (url: string) => void;
    fetchStockPrices: (tickers: string[]) => Promise<StockPriceResult>;
    // Auto-update
    getAppVersion: () => Promise<string>;
    checkForUpdates: () => Promise<UpdateCheckResult>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => void;
    onUpdateAvailable: (callback: (version: string) => void) => void;
    onUpdateDownloadProgress: (callback: (percent: number) => void) => void;
    onUpdateDownloaded: (callback: () => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
  };
}
