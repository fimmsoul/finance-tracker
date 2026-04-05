import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDataContext } from './DataContext';
import { useCurrencyContext } from './CurrencyContext';
import { useFamilyContext } from './FamilyContext';
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

type WithMemberId = { member_id?: string | null };

function filterByMember<T extends WithMemberId>(items: T[], memberId: string | null): T[] {
  if (memberId === null) return items; // null = all combined
  return items.filter((item) => item.member_id === memberId);
}

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

  for (const c of cryptos) {
    cryptoTotal += convertBetween(c.quantity * c.current_price, c.currency, 'USD');
  }

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

/** Upsert a single snapshot row (insert or update) */
async function upsertSnapshot(
  userId: string,
  today: string,
  memberId: string | null,
  totals: ReturnType<typeof computeTotals>,
) {
  let existingQuery = supabase
    .from('daily_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('snapshot_date', today);

  if (memberId) {
    existingQuery = existingQuery.eq('member_id', memberId);
  } else {
    existingQuery = existingQuery.is('member_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('daily_snapshots')
      .update(totals)
      .eq('id', existing.id);
    if (error) console.error('Error updating snapshot:', error.message);
  } else {
    const { error } = await supabase
      .from('daily_snapshots')
      .insert({
        user_id: userId,
        snapshot_date: today,
        member_id: memberId,
        ...totals,
      });
    if (error) console.error('Error inserting snapshot:', error.message);
  }
}

export function useDailySnapshots(
  dataVersion: number = 0,
  ratesLastUpdated: string | null = null,
) {
  const { generalStocks, isaStocks, accounts, assets, cryptos, stocksLoading, cashLoading, assetsLoading, cryptosLoading } = useDataContext();
  const { convertBetween, rates } = useCurrencyContext();
  const { activeMemberId, members } = useFamilyContext();

  const dataReady = !stocksLoading && !cashLoading && !assetsLoading && !cryptosLoading;

  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const initialRecordDone = useRef(false);
  const prevRatesUpdated = useRef<string | null>(null);

  // All stocks combined (unfiltered — from DataContext which already gives filtered views)
  // We need raw ALL data for recording all members. Access via context's filtered data
  // by using generalStocks/isaStocks which are filtered by activeMemberId.
  // For recordAllSnapshots we need the raw data, so we'll fetch from DataContext's raw.
  // Actually DataContext exposes filtered views. Let's use supabase directly for the full record.

  const allStocksForView = [...generalStocks, ...isaStocks];

  // Fetch snapshots filtered by active member (for display)
  const fetchSnapshots = useCallback(async () => {
    let query = supabase
      .from('daily_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false });

    if (activeMemberId === 'all') {
      query = query.is('member_id', null);
    } else {
      query = query.eq('member_id', activeMemberId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching snapshots:', error.message);
    } else {
      setSnapshots(data || []);
    }
    setLoading(false);
  }, [activeMemberId]);

  // Record today's snapshot for the CURRENT active member only (used for debounced updates)
  const recordToday = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayString();
    const totals = computeTotals(allStocksForView, accounts, assets, cryptos, convertBetween);
    const memberId = activeMemberId === 'all' ? null : activeMemberId;

    await upsertSnapshot(user.id, today, memberId, totals);
    await fetchSnapshots();
  }, [allStocksForView, accounts, assets, cryptos, convertBetween, fetchSnapshots, activeMemberId]);

  // Record today's snapshot for ALL members + combined (used on app open / rate refresh)
  const recordAllSnapshots = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayString();

    // Fetch ALL raw data (unfiltered) for snapshot computation
    const [stocksRes, cashRes, assetsRes, cryptosRes] = await Promise.all([
      supabase.from('stocks').select('*').eq('user_id', user.id),
      supabase.from('cash_accounts').select('*').eq('user_id', user.id),
      supabase.from('assets').select('*').eq('user_id', user.id),
      supabase.from('cryptos').select('*').eq('user_id', user.id),
    ]);

    const rawStocks = (stocksRes.data || []) as Stock[];
    const rawCash = (cashRes.data || []) as CashAccount[];
    const rawAssets = (assetsRes.data || []) as Asset[];
    const rawCryptos = (cryptosRes.data || []) as Crypto[];

    // 1) Record combined (ALL) snapshot — member_id = NULL
    const combinedTotals = computeTotals(rawStocks, rawCash, rawAssets, rawCryptos, convertBetween);
    await upsertSnapshot(user.id, today, null, combinedTotals);

    // 2) Record per-member snapshots
    for (const member of members) {
      const mStocks = filterByMember(rawStocks, member.id);
      const mCash = filterByMember(rawCash, member.id);
      const mAssets = filterByMember(rawAssets, member.id);
      const mCryptos = filterByMember(rawCryptos, member.id);
      const memberTotals = computeTotals(mStocks, mCash, mAssets, mCryptos, convertBetween);
      await upsertSnapshot(user.id, today, member.id, memberTotals);
    }

    await fetchSnapshots();
  }, [members, convertBetween, fetchSnapshots]);

  const deleteSnapshot = useCallback(async (id: string) => {
    const { error } = await supabase.from('daily_snapshots').delete().eq('id', id);
    if (error) {
      console.error('Error deleting snapshot:', error.message);
      return;
    }
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Record ALL snapshots on app open
  useEffect(() => {
    if (!loading && dataReady && rates && Object.keys(rates).length > 1 && members.length > 0 && !initialRecordDone.current) {
      initialRecordDone.current = true;
      recordAllSnapshots();
    }
  }, [loading, dataReady, rates, members, recordAllSnapshots]);

  // Re-record all when exchange rates refresh
  useEffect(() => {
    if (!ratesLastUpdated || !dataReady) return;
    if (prevRatesUpdated.current === null) {
      prevRatesUpdated.current = ratesLastUpdated;
      return;
    }
    if (prevRatesUpdated.current !== ratesLastUpdated) {
      prevRatesUpdated.current = ratesLastUpdated;
      recordAllSnapshots();
    }
  }, [ratesLastUpdated, dataReady, recordAllSnapshots]);

  // Auto-update current member on data change (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dataVersion === 0) return;
    if (!dataReady || !rates || Object.keys(rates).length <= 1) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      recordAllSnapshots();
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dataVersion, dataReady, rates, recordAllSnapshots]);

  const todayLiveTotals = computeTotals(allStocksForView, accounts, assets, cryptos, convertBetween);

  return { snapshots, loading, recordToday, deleteSnapshot, todayLiveTotals };
}
