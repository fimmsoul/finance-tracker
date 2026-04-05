import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useFamilyContext } from './FamilyContext';
import type { OtherIncome, OtherIncomeUpdate } from '@/types/income';

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

export function useOtherIncomes() {
  const [allIncomes, setAllIncomes] = useState<OtherIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeMemberId, selfMember } = useFamilyContext();

  const incomes = useMemo(
    () => filterByMember(allIncomes, activeMemberId),
    [allIncomes, activeMemberId],
  );

  const fetchIncomes = useCallback(async () => {
    const { data, error } = await supabase
      .from('other_incomes')
      .select('*')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching other incomes:', error.message);
      return;
    }
    setAllIncomes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  const getInsertMemberId = () => {
    if (activeMemberId === 'all') return selfMember?.id ?? null;
    return activeMemberId;
  };

  const addIncome = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const memberId = getInsertMemberId();

    const { data, error } = await supabase
      .from('other_incomes')
      .insert({
        user_id: user.id,
        source: '',
        category: 'other',
        received_date: todayString(),
        amount: 0,
        currency: 'USD',
        member_id: memberId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding income:', error.message);
      return null;
    }
    setAllIncomes((prev) => [data, ...prev]);
    return data as OtherIncome;
  }, [activeMemberId, selfMember]);

  const updateIncome = useCallback(async (id: string, updates: OtherIncomeUpdate) => {
    const { error } = await supabase
      .from('other_incomes')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating income:', error.message);
      return;
    }
    setAllIncomes((prev) =>
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
    setAllIncomes((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, i) => sum + i.amount, 0),
    [incomes]
  );

  return { incomes, loading, addIncome, updateIncome, deleteIncome, totalIncome };
}
