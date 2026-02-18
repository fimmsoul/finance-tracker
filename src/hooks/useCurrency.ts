import { useState, useEffect, useCallback, useRef } from 'react';
import type { CurrencyCode } from '@/lib/currency';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastFetched: string; // ISO date string
}

const CACHE_KEY = 'finance_tracker_exchange_rates';
const DISPLAY_CURRENCY_KEY = 'finance_tracker_display_currency';
const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

/**
 * Fixed 6-hour refresh schedule: 00:00, 06:00, 12:00, 18:00
 * Returns the most recent refresh boundary as a Date.
 */
function lastRefreshBoundary(): Date {
  const now = new Date();
  const hour = now.getHours();
  const boundary = new Date(now);
  boundary.setMinutes(0, 0, 0);
  // Round down to nearest 6-hour slot
  boundary.setHours(Math.floor(hour / 6) * 6);
  return boundary;
}

/**
 * Returns ms until the next 6-hour boundary.
 */
function msUntilNextRefresh(): number {
  const now = new Date();
  const next = new Date(now);
  const hour = now.getHours();
  const nextSlot = (Math.floor(hour / 6) + 1) * 6;
  if (nextSlot >= 24) {
    // Next day midnight
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(nextSlot, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

/**
 * Cache is valid if it was fetched after the most recent 6-hour boundary.
 */
function isCacheValid(cached: ExchangeRates | null): boolean {
  if (!cached || !cached.lastFetched) return false;
  const lastFetched = new Date(cached.lastFetched);
  const boundary = lastRefreshBoundary();
  return lastFetched.getTime() >= boundary.getTime();
}

function getCachedRates(): ExchangeRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedRates(rates: ExchangeRates) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
}

export function useCurrency() {
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(() => {
    return (localStorage.getItem(DISPLAY_CURRENCY_KEY) as CurrencyCode) || 'USD';
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRates = useCallback(async () => {
    // Check cache first
    const cached = getCachedRates();
    if (isCacheValid(cached)) {
      setRates(cached!.rates);
      setLastUpdated(cached!.lastFetched);
      setLoading(false);
      return;
    }

    // Fetch fresh rates
    try {
      const response = await fetch(API_URL);
      const data = await response.json();

      const exchangeRates: ExchangeRates = {
        base: 'USD',
        rates: data.rates,
        lastFetched: new Date().toISOString(),
      };

      setCachedRates(exchangeRates);
      setRates(data.rates);
      setLastUpdated(exchangeRates.lastFetched);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      // Fall back to cached data even if stale
      if (cached) {
        setRates(cached.rates);
        setLastUpdated(cached.lastFetched);
      }
    }
    setLoading(false);
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Schedule refresh at next 6-hour boundary, then every 6 hours after that
  useEffect(() => {
    const scheduleNext = () => {
      const ms = msUntilNextRefresh();
      // Add a small buffer (30s) to ensure we're past the boundary
      timerRef.current = setTimeout(() => {
        fetchRates();
        // After the first boundary, schedule every 6 hours
        timerRef.current = setInterval(() => {
          fetchRates();
        }, 6 * 60 * 60 * 1000) as unknown as ReturnType<typeof setTimeout>;
      }, ms + 30_000);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        clearInterval(timerRef.current as unknown as ReturnType<typeof setInterval>);
      }
    };
  }, [fetchRates]);

  const setDisplayCurrency = useCallback((currency: CurrencyCode) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
  }, []);

  // Convert an amount from one currency to the display currency
  const convert = useCallback(
    (amount: number, fromCurrency: string): number => {
      if (fromCurrency === displayCurrency) return amount;

      // Convert to USD first (base), then to display currency
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[displayCurrency] || 1;
      const amountInUsd = amount / fromRate;
      return amountInUsd * toRate;
    },
    [rates, displayCurrency]
  );

  // Convert between any two currencies
  const convertBetween = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string): number => {
      if (fromCurrency === toCurrency) return amount;
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[toCurrency] || 1;
      const amountInUsd = amount / fromRate;
      return amountInUsd * toRate;
    },
    [rates]
  );

  return {
    rates,
    displayCurrency,
    setDisplayCurrency,
    convert,
    convertBetween,
    loading,
    lastUpdated,
    refreshRates: fetchRates,
  };
}
