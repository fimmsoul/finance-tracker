import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useFamilyContext } from './FamilyContext';
import type { Transaction, TransactionUpdate, TransactionType } from '@/types/transaction';
import type { Stock, AccountType } from '@/types/stock';

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type WithMemberId = { member_id?: string | null };

function filterByMember<T extends WithMemberId>(items: T[], memberId: string | 'all'): T[] {
  if (memberId === 'all') return items;
  return items.filter((item) => item.member_id === memberId);
}

export function useTransactions(accountType?: AccountType) {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [stocksLoaded, setStocksLoaded] = useState(false);
  const { activeMemberId, selfMember } = useFamilyContext();

  // Filter stocks by active member
  const memberStocks = useMemo(
    () => filterByMember(allStocks, activeMemberId),
    [allStocks, activeMemberId],
  );

  // Filter transactions by active member
  const memberTransactions = useMemo(
    () => filterByMember(allTransactions, activeMemberId),
    [allTransactions, activeMemberId],
  );

  // Build a lookup map: stock_id -> { ticker, name, account_type, currency }
  const stockMap = useMemo(() => {
    const map: Record<string, { ticker: string; name: string | null; account_type: AccountType; currency: string }> = {};
    for (const s of allStocks) {
      map[s.id] = { ticker: s.ticker, name: s.name, account_type: s.account_type, currency: s.currency };
    }
    return map;
  }, [allStocks]);

  // Enrich transactions with stock info
  const enrichedTransactions = useMemo(() => {
    let filtered = memberTransactions;

    // Filter by account type if specified
    if (accountType) {
      const stockIdsByAccountType = new Set(
        allStocks.filter((s) => s.account_type === accountType).map((s) => s.id)
      );
      filtered = memberTransactions.filter((t) => stockIdsByAccountType.has(t.stock_id));
    }

    return filtered.map((t) => {
      const stock = stockMap[t.stock_id];
      return {
        ...t,
        ticker: stock?.ticker || '—',
        stock_name: stock?.name || '',
        account_type: stock?.account_type,
        currency: stock?.currency || 'USD',
      };
    });
  }, [memberTransactions, stockMap, accountType, allStocks]);

  const fetchStocks = useCallback(async () => {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .order('ticker', { ascending: true });

    if (error) {
      console.error('Error fetching stocks for transactions:', error.message);
      setStocksLoaded(true);
      return;
    }
    setAllStocks(data || []);
    setStocksLoaded(true);
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error.message);
      return;
    }
    setAllTransactions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStocks();
    fetchTransactions();
  }, [fetchStocks, fetchTransactions]);

  // Recalculate stock position using Weighted Average Cost method
  const recalculateStockPosition = useCallback(async (stockId: string) => {
    const { data: stock, error: stockError } = await supabase
      .from('stocks')
      .select('quantity, buy_price, base_quantity, base_cost')
      .eq('id', stockId)
      .single();

    if (stockError) {
      console.error('Error fetching stock for recalculation:', stockError.message);
      return;
    }

    const { data: txns, error } = await supabase
      .from('stock_transactions')
      .select('*')
      .eq('stock_id', stockId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching transactions for recalculation:', error.message);
      return;
    }

    const baseQty = stock.base_quantity ?? stock.quantity ?? 0;
    const baseCost = stock.base_cost ?? (stock.quantity ?? 0) * (stock.buy_price ?? 0);

    let totalQty = Number(baseQty);
    let totalCost = Number(baseCost);

    for (const txn of txns || []) {
      const qty = Number(txn.quantity);
      const price = Number(txn.price_per_share);
      const fees = Number(txn.fees) || 0;

      if (txn.type === 'buy') {
        totalCost += qty * price + fees;
        totalQty += qty;
      } else if (txn.type === 'sell') {
        if (totalQty > 0) {
          const avgCost = totalCost / totalQty;
          totalCost -= qty * avgCost;
          totalQty -= qty;
        }
      }
    }

    const avgBuyPrice = totalQty > 0 ? totalCost / totalQty : 0;
    const finalQty = Math.max(0, totalQty);

    const hasMeaningfulTransactions = (txns || []).some((t) => Number(t.quantity) > 0);
    const hadPreExistingPosition = Number(baseQty) > 0;

    if (finalQty === 0 && (hasMeaningfulTransactions || hadPreExistingPosition)) {
      const { error: deleteError } = await supabase
        .from('stocks')
        .delete()
        .eq('id', stockId);

      if (deleteError) {
        console.error('Error deleting sold-out stock:', deleteError.message);
      }
      return;
    }

    const updates: Record<string, number> = {
      quantity: finalQty,
      buy_price: Math.max(0, avgBuyPrice),
    };

    if (stock.base_quantity === null || stock.base_quantity === undefined) {
      updates.base_quantity = Number(baseQty);
      updates.base_cost = Number(baseCost);
    }

    const { error: updateError } = await supabase
      .from('stocks')
      .update(updates)
      .eq('id', stockId);

    if (updateError) {
      console.error('Error updating stock position:', updateError.message);
    }
  }, []);

  const getInsertMemberId = () => {
    if (activeMemberId === 'all') return selfMember?.id ?? null;
    return activeMemberId;
  };

  const addTransaction = useCallback(async (stockId: string, type: TransactionType = 'buy') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const memberId = getInsertMemberId();

    const { data, error } = await supabase
      .from('stock_transactions')
      .insert({
        user_id: user.id,
        stock_id: stockId,
        transaction_date: todayString(),
        type,
        quantity: 0,
        price_per_share: 0,
        fees: 0,
        exchange_rate: null,
        notes: null,
        member_id: memberId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding transaction:', error.message);
      return null;
    }
    setAllTransactions((prev) => [data, ...prev]);

    await recalculateStockPosition(stockId);

    return data as Transaction;
  }, [recalculateStockPosition, activeMemberId, selfMember]);

  const updateTransaction = useCallback(async (id: string, updates: TransactionUpdate) => {
    const txn = allTransactions.find((t) => t.id === id);
    if (!txn) return;

    const { error } = await supabase
      .from('stock_transactions')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating transaction:', error.message);
      return;
    }

    setAllTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    await recalculateStockPosition(txn.stock_id);

    if (updates.stock_id && updates.stock_id !== txn.stock_id) {
      await recalculateStockPosition(updates.stock_id);
    }
  }, [allTransactions, recalculateStockPosition]);

  const deleteTransaction = useCallback(async (id: string) => {
    const txn = allTransactions.find((t) => t.id === id);
    if (!txn) return;

    const { error } = await supabase
      .from('stock_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transaction:', error.message);
      return;
    }

    setAllTransactions((prev) => prev.filter((t) => t.id !== id));

    await recalculateStockPosition(txn.stock_id);
  }, [allTransactions, recalculateStockPosition]);

  // Filter stocks by account type for the dropdown
  const filteredStocks = useMemo(() => {
    if (!accountType) return memberStocks;
    return memberStocks.filter((s) => s.account_type === accountType);
  }, [memberStocks, accountType]);

  const createStock = useCallback(async (ticker: string = '', currency: string = 'USD') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const memberId = getInsertMemberId();

    const { data, error } = await supabase
      .from('stocks')
      .insert({
        user_id: user.id,
        ticker,
        name: '',
        quantity: 0,
        buy_price: 0,
        current_price: 0,
        currency,
        account_type: accountType || 'general',
        sort_order: 0,
        member_id: memberId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stock:', error.message);
      return null;
    }

    setAllStocks((prev) => [...prev, data]);
    return data as Stock;
  }, [accountType, activeMemberId, selfMember]);

  return {
    transactions: enrichedTransactions,
    stocks: filteredStocks,
    allStocks: memberStocks,
    loading,
    stocksLoaded,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    createStock,
  };
}
