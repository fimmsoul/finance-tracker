import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Stock, StockUpdate, AccountType } from '@/types/stock';

export function useStocks(accountType: AccountType = 'general') {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStocks = useCallback(async () => {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('account_type', accountType)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching stocks:', error.message);
      return;
    }
    setStocks(data || []);
    setLoading(false);
  }, [accountType]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const addStock = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const maxOrder = stocks.length > 0
      ? Math.max(...stocks.map((s) => s.sort_order ?? 0))
      : 0;

    // Optimistic: show the row immediately with a temp id
    const tempId = `temp-${Date.now()}`;
    const optimistic: Stock = {
      id: tempId,
      user_id: user.id,
      ticker: '',
      name: '',
      quantity: 0,
      buy_price: 0,
      current_price: 0,
      currency: 'USD',
      sort_order: maxOrder + 1,
      position: 'midfielder',
      account_type: accountType,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStocks((prev) => [...prev, optimistic]);

    // Insert in background, then swap temp id with real id
    const { data, error } = await supabase
      .from('stocks')
      .insert({
        user_id: user.id,
        ticker: '',
        name: '',
        quantity: 0,
        buy_price: 0,
        current_price: 0,
        currency: 'USD',
        sort_order: maxOrder + 1,
        account_type: accountType,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding stock:', error.message);
      setStocks((prev) => prev.filter((s) => s.id !== tempId));
      return null;
    }

    setStocks((prev) => prev.map((s) => (s.id === tempId ? data : s)));
    return data as Stock;
  }, [stocks, accountType]);

  const updateStock = useCallback(async (id: string, updates: StockUpdate) => {
    const { error } = await supabase
      .from('stocks')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating stock:', error.message);
      return;
    }
    setStocks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const deleteStock = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('stocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting stock:', error.message);
      return;
    }
    setStocks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderStocks = useCallback(async (reordered: Stock[]) => {
    // Optimistically update local state
    setStocks(reordered);

    // Batch update sort_order in Supabase
    const updates = reordered.map((stock, index) => ({
      id: stock.id,
      sort_order: index,
    }));

    for (const u of updates) {
      await supabase
        .from('stocks')
        .update({ sort_order: u.sort_order })
        .eq('id', u.id);
    }
  }, []);

  const totalValue = useMemo(
    () => stocks.reduce((sum, s) => sum + s.quantity * s.current_price, 0),
    [stocks]
  );

  const totalCost = useMemo(
    () => stocks.reduce((sum, s) => sum + s.quantity * s.buy_price, 0),
    [stocks]
  );

  return { stocks, loading, addStock, updateStock, deleteStock, reorderStocks, totalValue, totalCost };
}
