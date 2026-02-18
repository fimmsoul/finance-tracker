import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { OtherIncome, OtherIncomeUpdate } from '@/types/income';

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useOtherIncomes() {
  const [incomes, setIncomes] = useState<OtherIncome[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncomes = useCallback(async () => {
    const { data, error } = await supabase
      .from('other_incomes')
      .select('*')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching other incomes:', error.message);
      return;
    }
    setIncomes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  const addIncome = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('other_incomes')
      .insert({
        user_id: user.id,
        source: '',
        category: 'other',
        received_date: todayString(),
        amount: 0,
        currency: 'USD',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding income:', error.message);
      return null;
    }
    setIncomes((prev) => [data, ...prev]);
    return data as OtherIncome;
  }, []);

  const updateIncome = useCallback(async (id: string, updates: OtherIncomeUpdate) => {
    const { error } = await supabase
      .from('other_incomes')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating income:', error.message);
      return;
    }
    setIncomes((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
  }, []);

  const deleteIncome = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('other_incomes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting income:', error.message);
      return;
    }
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, i) => sum + i.amount, 0),
    [incomes]
  );

  return { incomes, loading, addIncome, updateIncome, deleteIncome, totalIncome };
}
