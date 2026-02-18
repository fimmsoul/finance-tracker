import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Asset, AssetUpdate } from '@/types/asset';

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching assets:', error.message);
      return;
    }
    setAssets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const addAsset = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        name: '',
        category: 'other',
        current_value: 0,
        currency: 'USD',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding asset:', error.message);
      return null;
    }
    setAssets((prev) => [...prev, data]);
    return data as Asset;
  }, []);

  const updateAsset = useCallback(async (id: string, updates: AssetUpdate) => {
    const { error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating asset:', error.message);
      return;
    }
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting asset:', error.message);
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const totalValue = useMemo(
    () => assets.reduce((sum, a) => sum + a.current_value, 0),
    [assets]
  );

  const totalPurchaseValue = useMemo(
    () => assets.reduce((sum, a) => sum + (a.purchase_value || 0), 0),
    [assets]
  );

  return { assets, loading, addAsset, updateAsset, deleteAsset, totalValue, totalPurchaseValue };
}
