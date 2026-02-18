import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Dividend, DividendUpdate } from '@/types/dividend';
import type { Stock } from '@/types/stock';

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useDividends() {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  // Build a lookup map: stock_id → { ticker, name }
  const stockMap = useMemo(() => {
    const map: Record<string, { ticker: string; name: string | null }> = {};
    for (const s of stocks) {
      map[s.id] = { ticker: s.ticker, name: s.name };
    }
    return map;
  }, [stocks]);

  // Enrich dividends with stock info
  const enrichedDividends = useMemo(() => {
    return dividends.map((d) => {
      const stock = stockMap[d.stock_id];
      return {
        ...d,
        ticker: stock?.ticker || '—',
        stock_name: stock?.name || '',
      };
    });
  }, [dividends, stockMap]);

  const fetchStocks = useCallback(async () => {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .order('ticker', { ascending: true });

    if (error) {
      console.error('Error fetching stocks for dividends:', error.message);
      return;
    }
    setStocks(data || []);
  }, []);

  const fetchDividends = useCallback(async () => {
    const { data, error } = await supabase
      .from('dividends')
      .select('*')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching dividends:', error.message);
      return;
    }
    setDividends(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStocks();
    fetchDividends();
  }, [fetchStocks, fetchDividends]);

  const addDividend = useCallback(async (stockId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Find the stock's currency to use as default
    const stock = stocks.find((s) => s.id === stockId);
    const currency = stock?.currency || 'USD';

    const { data, error } = await supabase
      .from('dividends')
      .insert({
        user_id: user.id,
        stock_id: stockId,
        received_date: todayString(),
        amount: 0,
        foreign_tax: 0,
        dps: 0,
        currency,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding dividend:', error.message);
      return null;
    }
    setDividends((prev) => [data, ...prev]);
    return data as Dividend;
  }, [stocks]);

  const updateDividend = useCallback(async (id: string, updates: DividendUpdate) => {
    const { error } = await supabase
      .from('dividends')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating dividend:', error.message);
      return;
    }
    setDividends((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  const deleteDividend = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('dividends')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting dividend:', error.message);
      return;
    }
    setDividends((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const totalDividends = useMemo(
    () => dividends.reduce((sum, d) => sum + d.amount, 0),
    [dividends]
  );

  return {
    dividends: enrichedDividends,
    stocks,
    loading,
    addDividend,
    updateDividend,
    deleteDividend,
    totalDividends,
  };
}
