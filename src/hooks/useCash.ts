import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CashAccount, CashAccountUpdate } from '@/types/cash';

export function useCash() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching cash accounts:', error.message);
      return;
    }
    setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('cash_accounts')
      .insert({
        user_id: user.id,
        name: '',
        type: 'bank',
        balance: 0,
        currency: 'USD',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding cash account:', error.message);
      return null;
    }
    setAccounts((prev) => [...prev, data]);
    return data as CashAccount;
  }, []);

  const updateAccount = useCallback(async (id: string, updates: CashAccountUpdate) => {
    const { error } = await supabase
      .from('cash_accounts')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating cash account:', error.message);
      return;
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('cash_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting cash account:', error.message);
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  );

  return { accounts, loading, addAccount, updateAccount, deleteAccount, totalBalance };
}
