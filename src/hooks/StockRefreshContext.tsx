import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

type RefreshInterval = 30 | 60 | 300; // seconds

// Check if US stock market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
function isMarketOpen(): boolean {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Weekend check (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  // Market hours: 9:30 AM (570 min) to 4:00 PM (960 min) ET
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

interface StockRefreshContextValue {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (value: RefreshInterval) => void;
  marketOpen: boolean;
  lastUpdated: Date | null;
  setLastUpdated: (date: Date | null) => void;
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
  refreshStatus: string | null;
  setRefreshStatus: (status: string | null) => void;
  triggerRefresh: () => void;
  refreshTrigger: number;
}

const StockRefreshContext = createContext<StockRefreshContextValue | null>(null);

const STORAGE_KEYS = {
  autoRefresh: 'stock-auto-refresh',
  refreshInterval: 'stock-refresh-interval',
};

function loadSavedSettings(): { autoRefresh: boolean; refreshInterval: RefreshInterval } {
  if (typeof window === 'undefined') {
    return { autoRefresh: false, refreshInterval: 60 };
  }

  const savedAutoRefresh = localStorage.getItem(STORAGE_KEYS.autoRefresh);
  const savedInterval = localStorage.getItem(STORAGE_KEYS.refreshInterval);

  return {
    autoRefresh: savedAutoRefresh === 'true',
    refreshInterval: (savedInterval ? Number(savedInterval) : 60) as RefreshInterval,
  };
}

export function StockRefreshProvider({ children }: { children: ReactNode }) {
  const [autoRefresh, setAutoRefreshState] = useState(() => loadSavedSettings().autoRefresh);
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval>(() => loadSavedSettings().refreshInterval);
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wrapper functions that persist to localStorage
  const setAutoRefresh = useCallback((value: boolean) => {
    setAutoRefreshState(value);
    localStorage.setItem(STORAGE_KEYS.autoRefresh, String(value));
  }, []);

  const setRefreshInterval = useCallback((value: RefreshInterval) => {
    setRefreshIntervalState(value);
    localStorage.setItem(STORAGE_KEYS.refreshInterval, String(value));
  }, []);

  // Check market status periodically
  useEffect(() => {
    const checkMarket = () => setMarketOpen(isMarketOpen());
    checkMarket();
    const marketCheckInterval = setInterval(checkMarket, 60000);
    return () => clearInterval(marketCheckInterval);
  }, []);

  // Trigger refresh function
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Auto-refresh polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh && marketOpen) {
      intervalRef.current = setInterval(() => {
        if (isMarketOpen()) {
          triggerRefresh();
        } else {
          setMarketOpen(false);
        }
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, marketOpen, triggerRefresh]);

  return (
    <StockRefreshContext.Provider
      value={{
        autoRefresh,
        setAutoRefresh,
        refreshInterval,
        setRefreshInterval,
        marketOpen,
        lastUpdated,
        setLastUpdated,
        refreshing,
        setRefreshing,
        refreshStatus,
        setRefreshStatus,
        triggerRefresh,
        refreshTrigger,
      }}
    >
      {children}
    </StockRefreshContext.Provider>
  );
}

export function useStockRefresh() {
  const context = useContext(StockRefreshContext);
  if (!context) {
    throw new Error('useStockRefresh must be used within a StockRefreshProvider');
  }
  return context;
}
