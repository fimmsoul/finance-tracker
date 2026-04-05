import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { FamilyMember, FamilyMemberUpdate, Relationship, ActiveMemberFilter } from '@/types/family';

interface FamilyContextType {
  members: FamilyMember[];
  activeMemberId: ActiveMemberFilter;
  setActiveMemberId: (id: ActiveMemberFilter) => void;
  selfMember: FamilyMember | null;
  loading: boolean;
  initialized: boolean;
  addMember: (name: string, relationship: Relationship) => Promise<FamilyMember | null>;
  updateMember: (id: string, updates: FamilyMemberUpdate) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<ActiveMemberFilter>('all');
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Find the "self" member
  const selfMember = useMemo(
    () => members.find((m) => m.relationship === 'self') ?? null,
    [members],
  );

  // Initialize: fetch members, auto-create "Me" if needed, migrate existing data
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Fetch existing members
      const { data: existingMembers, error } = await supabase
        .from('family_members')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching family members:', error.message);
        setLoading(false);
        return;
      }

      if (existingMembers && existingMembers.length > 0) {
        // Members already exist
        if (!cancelled) {
          setMembers(existingMembers);
          // Default to "all" view
          setActiveMemberId('all');
          setInitialized(true);
          setLoading(false);
        }
        return;
      }

      // No members yet: create "Me" and migrate existing data
      console.log('[Family] First time setup: creating "Me" member...');
      const { data: selfData, error: selfError } = await supabase
        .from('family_members')
        .insert({
          user_id: user.id,
          name: 'Me',
          relationship: 'self',
          sort_order: 0,
        })
        .select()
        .single();

      if (selfError || !selfData) {
        console.error('Error creating self member:', selfError?.message);
        setLoading(false);
        return;
      }

      // Migrate all existing data to this member
      console.log('[Family] Migrating existing data to "Me" member...');
      const tables = ['stocks', 'cash_accounts', 'assets', 'cryptos', 'dividends', 'other_incomes', 'stock_transactions'];
      for (const table of tables) {
        const { error: migrateError } = await supabase
          .from(table)
          .update({ member_id: selfData.id })
          .eq('user_id', user.id)
          .is('member_id', null);

        if (migrateError) {
          console.error(`Error migrating ${table}:`, migrateError.message);
        }
      }

      // Also migrate existing daily_snapshots
      await supabase
        .from('daily_snapshots')
        .update({ member_id: selfData.id })
        .eq('user_id', user.id)
        .is('member_id', null);

      if (!cancelled) {
        setMembers([selfData]);
        setActiveMemberId('all');
        setInitialized(true);
        setLoading(false);
      }
      console.log('[Family] Setup complete');
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const addMember = useCallback(async (name: string, relationship: Relationship) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const maxOrder = members.length > 0 ? Math.max(...members.map((m) => m.sort_order)) : 0;

    const { data, error } = await supabase
      .from('family_members')
      .insert({
        user_id: user.id,
        name,
        relationship,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding family member:', error.message);
      return null;
    }

    setMembers((prev) => [...prev, data]);
    return data as FamilyMember;
  }, [members]);

  const updateMember = useCallback(async (id: string, updates: FamilyMemberUpdate) => {
    const { error } = await supabase.from('family_members').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating family member:', error.message);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const deleteMember = useCallback(async (id: string) => {
    // Don't allow deleting "self"
    const member = members.find((m) => m.id === id);
    if (member?.relationship === 'self') {
      console.error('Cannot delete self member');
      return;
    }

    const { error } = await supabase.from('family_members').delete().eq('id', id);
    if (error) {
      console.error('Error deleting family member:', error.message);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));

    // If active member was deleted, switch to "all"
    if (activeMemberId === id) {
      setActiveMemberId('all');
    }
  }, [members, activeMemberId]);

  const value = useMemo<FamilyContextType>(
    () => ({
      members,
      activeMemberId,
      setActiveMemberId,
      selfMember,
      loading,
      initialized,
      addMember,
      updateMember,
      deleteMember,
    }),
    [members, activeMemberId, selfMember, loading, initialized, addMember, updateMember, deleteMember],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamilyContext() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamilyContext must be used within a FamilyProvider');
  return ctx;
}
