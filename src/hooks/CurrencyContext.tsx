import { createContext, useContext, ReactNode } from 'react';
import { useCurrency } from './useCurrency';
import type { CurrencyCode } from '@/lib/currency';

interface CurrencyContextType {
  rates: Record<string, number>;
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
  convert: (amount: number, fromCurrency: string) => number;
  convertBetween: (amount: number, fromCurrency: string, toCurrency: string) => number;
  loading: boolean;
  lastUpdated: string | null;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useCurrency();

  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrencyContext must be used within a CurrencyProvider');
  }
  return context;
}
