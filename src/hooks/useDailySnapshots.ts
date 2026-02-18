import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDataContext } from './DataContext';
import { useCurrencyContext } from './CurrencyContext';
import type { DailySnapshot } from '@/types/snapshot';
import type { Stock } from '@/types/stock';
import type { CashAccount } from '@/types/cash';
import type { Asset } from '@/types/asset';
import type { Crypto } from '@/types/crypto';

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateToString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateToString(d);
}

function getMissingDates(lastDate: string, today: string): string[] {
  const missing: string[] = [];
  let current = addDays(lastDate, 1);
  while (current < today) {
    missing.push(current);
    current = addDays(current, 1);
  }
  return missing;
}

/**
 * Computes totals in USD using the same convertBetween used by Dashboard.
 * Reads from shared in-memory state — no Supabase fetch.
 */
function computeTotals(
  allStocks: Stock[],
  accounts: CashAccount[],
  assets: Asset[],
  cryptos: Crypto[],
  convertBetween: (amount: number, from: string, to: string) => number,
) {
  let stocksTotal = 0;
  for (const s of allStocks) {
    stocksTotal += convertBetween(s.quantity * s.current_price, s.currency, 'USD');
  }

  let cashTotal = 0;
  for (const a of accounts) {
    cashTotal += convertBetween(a.balance, a.currency, 'USD');
  }

  let goldTotal = 0;
  let cryptoTotal = 0;
  let bondsTotal = 0;
  let realEstateTotal = 0;
  let otherAssetsTotal = 0;

  // Include crypto from dedicated crypto table
  for (const c of cryptos) {
    cryptoTotal += convertBetween(c.quantity * c.current_price, c.currency, 'USD');
  }

  // Include assets by category
  for (const a of assets) {
    const usdValue = convertBetween(a.current_value, a.currency, 'USD');
    switch (a.category) {
      case 'gold':
        goldTotal += usdValue;
        break;
      case 'crypto':
        cryptoTotal += usdValue;
        break;
      case 'bonds':
        bondsTotal += usdValue;
        break;
      case 'real_estate':
        realEstateTotal += usdValue;
        break;
      default:
        otherAssetsTotal += usdValue;
        break;
    }
  }

  const total = stocksTotal + cashTotal + goldTotal + cryptoTotal + bondsTotal + realEstateTotal + otherAssetsTotal;

  return {
    stocks_value: stocksTotal,
    cash_value: cashTotal,
    gold_value: goldTotal,
    crypto_value: cryptoTotal,
    bonds_value: bondsTotal,
    real_estate_value: realEstateTotal,
    total_value: total,
  };
}

/**
 * @param dataVersion - bump counter from DataContext; when it changes, today's snapshot is re-recorded
 * @param ratesLastUpdated - ISO string of when rates were last fetched; triggers re-record on rate refresh
 */
export function useDailySnapshots(
  dataVersion: number = 0,
  ratesLastUpdated: string | null = null,
) {
  const { generalStocks, isaStocks, accounts, assets, cryptos, stocksLoading, cashLoading, assetsLoading, cryptosLoading } = useDataContext();
  const { convertBetween, rates } = useCurrencyContext();

  // 모든 데이터가 로드되었는지 확인
  const dataReady = !stocksLoading && !cashLoading && !assetsLoading && !cryptosLoading;

  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const initialRecordDone = useRef(false);
  const prevRatesUpdated = useRef<string | null>(null);

  const allStocks = [...generalStocks, ...isaStocks];

  const fetchSnapshots = useCallback(async () => {
    const { data, error } = await supabase
      .from('daily_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false });

    if (error) {
      console.error('Error fetching snapshots:', error.message);
    } else {
      setSnapshots(data || []);
    }
    setLoading(false);
  }, []);

  // Upsert today's snapshot and fill any missing dates
  const recordToday = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayString();
    const totals = computeTotals(allStocks, accounts, assets, cryptos, convertBetween);

    // 오늘 스냅샷 기록 (현재 계산된 값)
    const { error } = await supabase
      .from('daily_snapshots')
      .upsert(
        {
          user_id: user.id,
          snapshot_date: today,
          ...totals,
        },
        { onConflict: 'user_id,snapshot_date' },
      );

    if (error) {
      console.error('Error recording snapshot:', error.message);
    } else {
      await fetchSnapshots();
    }
  }, [allStocks, accounts, assets, cryptos, convertBetween, fetchSnapshots]);

  const deleteSnapshot = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('daily_snapshots').delete().eq('id', id);
      if (error) {
        console.error('Error deleting snapshot:', error.message);
        return;
      }
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    },
    [],
  );

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Always upsert today's snapshot on app open (with latest rates)
  // 환율과 자산 데이터가 모두 로드된 후에만 기록
  useEffect(() => {
    if (!loading && dataReady && rates && Object.keys(rates).length > 1 && !initialRecordDone.current) {
      initialRecordDone.current = true;
      recordToday();
    }
  }, [loading, dataReady, rates, recordToday]);

  // Re-record when exchange rates refresh (6-hour boundary)
  useEffect(() => {
    if (!ratesLastUpdated || !dataReady) return;
    if (prevRatesUpdated.current === null) {
      prevRatesUpdated.current = ratesLastUpdated;
      return;
    }
    if (prevRatesUpdated.current !== ratesLastUpdated) {
      prevRatesUpdated.current = ratesLastUpdated;
      recordToday();
    }
  }, [ratesLastUpdated, dataReady, recordToday]);

  // Auto-update today's snapshot when data changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dataVersion === 0) return;
    if (!dataReady || !rates || Object.keys(rates).length <= 1) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recordToday();
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dataVersion, dataReady, rates, recordToday]);

  // Live-computed totals for today (same data + same convertBetween as Dashboard)
  // DailySnapshotTable uses this for today's column to guarantee match with Dashboard
  const todayLiveTotals = computeTotals(allStocks, accounts, assets, cryptos, convertBetween);

  return { snapshots, loading, recordToday, deleteSnapshot, todayLiveTotals };
}
