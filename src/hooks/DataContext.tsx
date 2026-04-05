import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Stock, StockUpdate, AccountType } from '@/types/stock';
import type { CashAccount, CashAccountUpdate } from '@/types/cash';
import type { Asset, AssetUpdate } from '@/types/asset';
import type { Crypto, CryptoUpdate } from '@/types/crypto';
import type { CustomGroup, CustomGroupInsert, CustomGroupUpdate } from '@/types/customGroup';
import type { PortfolioView, PortfolioViewUpdate } from '@/types/portfolioView';
import { useFamilyContext } from './FamilyContext';

/* ───── helpers ───── */
type WithMemberId = { member_id?: string | null };

function filterByMember<T extends WithMemberId>(items: T[], memberId: string | 'all'): T[] {
  if (memberId === 'all') return items;
  return items.filter((item) => item.member_id === memberId);
}

/* ───── context type ───── */
interface DataContextType {
  // Stocks
  generalStocks: Stock[];
  isaStocks: Stock[];
  stocksLoading: boolean;
  addStock: (accountType: AccountType) => Promise<Stock | null>;
  updateStock: (id: string, updates: StockUpdate) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  reorderStocks: (accountType: AccountType, reordered: Stock[]) => Promise<void>;
  // Cash
  accounts: CashAccount[];
  cashLoading: boolean;
  addAccount: () => Promise<CashAccount | null>;
  updateAccount: (id: string, updates: CashAccountUpdate) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  // Assets
  assets: Asset[];
  assetsLoading: boolean;
  addAsset: () => Promise<Asset | null>;
  updateAsset: (id: string, updates: AssetUpdate) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  // Crypto
  cryptos: Crypto[];
  cryptosLoading: boolean;
  addCrypto: () => Promise<Crypto | null>;
  updateCrypto: (id: string, updates: CryptoUpdate) => Promise<void>;
  deleteCrypto: (id: string) => Promise<void>;
  reorderCryptos: (reordered: Crypto[]) => Promise<void>;
  // Portfolio Views (dynamic tabs)
  portfolioViews: PortfolioView[];
  portfolioViewsLoading: boolean;
  addPortfolioView: (name: string) => Promise<PortfolioView | null>;
  updatePortfolioView: (id: string, updates: PortfolioViewUpdate) => Promise<void>;
  deletePortfolioView: (id: string) => Promise<void>;
  // Custom Groups
  customGroups: CustomGroup[];
  customGroupsLoading: boolean;
  addCustomGroup: (data: Omit<CustomGroupInsert, 'user_id'>) => Promise<CustomGroup | null>;
  updateCustomGroup: (id: string, updates: CustomGroupUpdate) => Promise<void>;
  deleteCustomGroup: (id: string) => Promise<void>;
  // Data version
  dataVersion: number;
}

const DataContext = createContext<DataContextType | null>(null);

/* ───── provider ───── */
export function DataProvider({ children }: { children: ReactNode }) {
  const { activeMemberId, selfMember, initialized } = useFamilyContext();

  const getInsertMemberId = () =>
    activeMemberId === 'all' ? selfMember?.id ?? null : activeMemberId;

  const [dataVersion, setDataVersion] = useState(0);
  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  /* ════════════════════════════════════════════════════
   * RAW state — always holds ALL data (no member filter)
   * ════════════════════════════════════════════════════ */

  const [allGeneralStocks, setAllGeneralStocks] = useState<Stock[]>([]);
  const [allIsaStocks, setAllIsaStocks] = useState<Stock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);

  const [allAccounts, setAllAccounts] = useState<CashAccount[]>([]);
  const [cashLoading, setCashLoading] = useState(true);

  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [allCryptos, setAllCryptos] = useState<Crypto[]>([]);
  const [cryptosLoading, setCryptosLoading] = useState(true);

  const [portfolioViews, setPortfolioViews] = useState<PortfolioView[]>([]);
  const [portfolioViewsLoading, setPortfolioViewsLoading] = useState(true);

  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [customGroupsLoading, setCustomGroupsLoading] = useState(true);

  /* ════════════════════════════════════════════════════
   * FILTERED views — derived from raw state + activeMemberId
   * Switching members = instant useMemo recalc, no network
   * ════════════════════════════════════════════════════ */

  const generalStocks = useMemo(
    () => filterByMember(allGeneralStocks, activeMemberId),
    [allGeneralStocks, activeMemberId],
  );
  const isaStocks = useMemo(
    () => filterByMember(allIsaStocks, activeMemberId),
    [allIsaStocks, activeMemberId],
  );
  const accounts = useMemo(
    () => filterByMember(allAccounts, activeMemberId),
    [allAccounts, activeMemberId],
  );
  const assets = useMemo(
    () => filterByMember(allAssets, activeMemberId),
    [allAssets, activeMemberId],
  );
  const cryptos = useMemo(
    () => filterByMember(allCryptos, activeMemberId),
    [allCryptos, activeMemberId],
  );

  /* ════════════════════════════════════════════════════
   * FETCH — always fetches ALL data (no member filter)
   * ════════════════════════════════════════════════════ */

  const fetchStocks = useCallback(async () => {
    if (!initialized) return;
    await supabase.from('stocks').delete().eq('quantity', 0).not('base_quantity', 'is', null);

    const [generalRes, isaRes] = await Promise.all([
      supabase.from('stocks').select('*').eq('account_type', 'general').order('sort_order', { ascending: true }),
      supabase.from('stocks').select('*').eq('account_type', 'isa').order('sort_order', { ascending: true }),
    ]);

    if (generalRes.data) setAllGeneralStocks(generalRes.data);
    if (isaRes.data) setAllIsaStocks(isaRes.data);
    setStocksLoading(false);
  }, [initialized]);

  const fetchCash = useCallback(async () => {
    if (!initialized) return;
    const { data, error } = await supabase.from('cash_accounts').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching cash accounts:', error.message); return; }
    setAllAccounts(data || []);
    setCashLoading(false);
  }, [initialized]);

  const fetchAssets = useCallback(async () => {
    if (!initialized) return;
    const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching assets:', error.message); return; }
    setAllAssets(data || []);
    setAssetsLoading(false);
  }, [initialized]);

  const fetchCryptos = useCallback(async () => {
    if (!initialized) return;
    const { data, error } = await supabase.from('cryptos').select('*').order('sort_order', { ascending: true });
    if (error) { console.error('Error fetching cryptos:', error.message); setCryptosLoading(false); return; }
    setAllCryptos(data || []);
    setCryptosLoading(false);
  }, [initialized]);

  const fetchPortfolioViews = useCallback(async () => {
    if (!initialized) return;
    const { data, error } = await supabase.from('portfolio_views').select('*').order('sort_order', { ascending: true });
    if (error) { console.error('Error fetching portfolio views:', error.message); setPortfolioViewsLoading(false); return; }
    setPortfolioViews(data || []);
    setPortfolioViewsLoading(false);
  }, [initialized]);

  const fetchCustomGroups = useCallback(async () => {
    if (!initialized) return;
    const { data, error } = await supabase.from('custom_groups').select('*').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching custom groups:', error.message); setCustomGroupsLoading(false); return; }
    setCustomGroups(data || []);
    setCustomGroupsLoading(false);
  }, [initialized]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => { fetchCash(); }, [fetchCash]);
  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { fetchCryptos(); }, [fetchCryptos]);
  useEffect(() => { fetchPortfolioViews(); }, [fetchPortfolioViews]);
  useEffect(() => { fetchCustomGroups(); }, [fetchCustomGroups]);

  /* ════════════════════════════════════════════════════
   * MUTATIONS — operate on ALL state, include member_id
   * ════════════════════════════════════════════════════ */

  const setAllStocksFor = (accountType: AccountType) =>
    accountType === 'general' ? setAllGeneralStocks : setAllIsaStocks;

  const addStock = useCallback(
    async (accountType: AccountType) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const currentAll = accountType === 'general' ? allGeneralStocks : allIsaStocks;
      const maxOrder = currentAll.length > 0 ? Math.max(...currentAll.map((s) => s.sort_order ?? 0)) : 0;
      const memberId = getInsertMemberId();

      const tempId = `temp-${Date.now()}`;
      const optimistic: Stock = {
        id: tempId, user_id: user.id, ticker: '', name: '', quantity: 0,
        buy_price: 0, current_price: 0, currency: 'USD', sort_order: maxOrder + 1,
        position: 'midfielder', account_type: accountType, notes: null,
        base_quantity: null, base_cost: null, member_id: memberId,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setAllStocksFor(accountType)((prev) => [...prev, optimistic]);

      const { data, error } = await supabase
        .from('stocks')
        .insert({
          user_id: user.id, ticker: '', name: '', quantity: 0, buy_price: 0, current_price: 0,
          currency: 'USD', sort_order: maxOrder + 1, account_type: accountType, member_id: memberId,
        })
        .select().single();

      if (error) {
        console.error('Error adding stock:', error.message);
        setAllStocksFor(accountType)((prev) => prev.filter((s) => s.id !== tempId));
        return null;
      }
      setAllStocksFor(accountType)((prev) => prev.map((s) => (s.id === tempId ? data : s)));
      bumpVersion();
      return data as Stock;
    },
    [allGeneralStocks, allIsaStocks, bumpVersion, activeMemberId, selfMember],
  );

  const updateStock = useCallback(async (id: string, updates: StockUpdate) => {
    // Auto-uppercase ticker
    if (updates.ticker) updates = { ...updates, ticker: updates.ticker.toUpperCase() };
    const { error } = await supabase.from('stocks').update(updates).eq('id', id);
    if (error) { console.error('Error updating stock:', error.message); return; }
    const updater = (prev: Stock[]) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setAllGeneralStocks(updater);
    setAllIsaStocks(updater);
    bumpVersion();
  }, [bumpVersion]);

  const deleteStock = useCallback(async (id: string) => {
    const { error } = await supabase.from('stocks').delete().eq('id', id);
    if (error) { console.error('Error deleting stock:', error.message); return; }
    const filter = (prev: Stock[]) => prev.filter((s) => s.id !== id);
    setAllGeneralStocks(filter);
    setAllIsaStocks(filter);
    bumpVersion();
  }, [bumpVersion]);

  const reorderStocks = useCallback(async (accountType: AccountType, reordered: Stock[]) => {
    // Merge reordered items back into the full array
    setAllStocksFor(accountType)((prev) => {
      const reorderedIds = new Set(reordered.map((s) => s.id));
      const others = prev.filter((s) => !reorderedIds.has(s.id));
      return [...others, ...reordered];
    });
    const updates = reordered.map((stock, index) => ({ id: stock.id, sort_order: index }));
    for (const u of updates) {
      await supabase.from('stocks').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
  }, []);

  /* — cash — */
  const addAccount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('cash_accounts')
      .insert({ user_id: user.id, name: '', type: 'bank', balance: 0, currency: 'USD', member_id: getInsertMemberId() })
      .select().single();
    if (error) { console.error('Error adding cash account:', error.message); return null; }
    setAllAccounts((prev) => [...prev, data]);
    bumpVersion();
    return data as CashAccount;
  }, [bumpVersion, activeMemberId, selfMember]);

  const updateAccount = useCallback(async (id: string, updates: CashAccountUpdate) => {
    const { error } = await supabase.from('cash_accounts').update(updates).eq('id', id);
    if (error) { console.error('Error updating cash account:', error.message); return; }
    setAllAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase.from('cash_accounts').delete().eq('id', id);
    if (error) { console.error('Error deleting cash account:', error.message); return; }
    setAllAccounts((prev) => prev.filter((a) => a.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  /* — assets — */
  const addAsset = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('assets')
      .insert({ user_id: user.id, name: '', category: 'other', current_value: 0, currency: 'USD', member_id: getInsertMemberId() })
      .select().single();
    if (error) { console.error('Error adding asset:', error.message); return null; }
    setAllAssets((prev) => [...prev, data]);
    bumpVersion();
    return data as Asset;
  }, [bumpVersion, activeMemberId, selfMember]);

  const updateAsset = useCallback(async (id: string, updates: AssetUpdate) => {
    const { error } = await supabase.from('assets').update(updates).eq('id', id);
    if (error) { console.error('Error updating asset:', error.message); return; }
    setAllAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) { console.error('Error deleting asset:', error.message); return; }
    setAllAssets((prev) => prev.filter((a) => a.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  /* — crypto — */
  const addCrypto = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const maxOrder = allCryptos.length > 0 ? Math.max(...allCryptos.map((c) => c.sort_order ?? 0)) : 0;
    const memberId = getInsertMemberId();

    const tempId = `temp-${Date.now()}`;
    const optimistic: Crypto = {
      id: tempId, user_id: user.id, symbol: '', name: '', quantity: 0,
      buy_price: 0, current_price: 0, currency: 'USD', sort_order: maxOrder + 1,
      position: 'attacker', notes: null, member_id: memberId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setAllCryptos((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('cryptos')
      .insert({
        user_id: user.id, symbol: '', name: '', quantity: 0, buy_price: 0, current_price: 0,
        currency: 'USD', sort_order: maxOrder + 1, position: 'attacker', member_id: memberId,
      })
      .select().single();

    if (error) {
      console.error('Error adding crypto:', error.message);
      setAllCryptos((prev) => prev.filter((c) => c.id !== tempId));
      return null;
    }
    setAllCryptos((prev) => prev.map((c) => (c.id === tempId ? data : c)));
    bumpVersion();
    return data as Crypto;
  }, [allCryptos, bumpVersion, activeMemberId, selfMember]);

  const updateCrypto = useCallback(async (id: string, updates: CryptoUpdate) => {
    const { error } = await supabase.from('cryptos').update(updates).eq('id', id);
    if (error) { console.error('Error updating crypto:', error.message); return; }
    setAllCryptos((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteCrypto = useCallback(async (id: string) => {
    const { error } = await supabase.from('cryptos').delete().eq('id', id);
    if (error) { console.error('Error deleting crypto:', error.message); return; }
    setAllCryptos((prev) => prev.filter((c) => c.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  const reorderCryptos = useCallback(async (reordered: Crypto[]) => {
    setAllCryptos((prev) => {
      const reorderedIds = new Set(reordered.map((c) => c.id));
      const others = prev.filter((c) => !reorderedIds.has(c.id));
      return [...others, ...reordered];
    });
    const updates = reordered.map((crypto, index) => ({ id: crypto.id, sort_order: index }));
    for (const u of updates) {
      await supabase.from('cryptos').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
  }, []);

  /* — portfolio views — */
  const addPortfolioView = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const maxOrder = portfolioViews.length > 0 ? Math.max(...portfolioViews.map((v) => v.sort_order)) : 0;
    const { data, error } = await supabase
      .from('portfolio_views').insert({ user_id: user.id, name, sort_order: maxOrder + 1 }).select().single();
    if (error) { console.error('Error adding portfolio view:', error.message); return null; }
    setPortfolioViews((prev) => [...prev, data]);
    return data as PortfolioView;
  }, [portfolioViews]);

  const updatePortfolioView = useCallback(async (id: string, updates: PortfolioViewUpdate) => {
    setPortfolioViews((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));
    const { error } = await supabase.from('portfolio_views').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating portfolio view:', error.message);
      const { data } = await supabase.from('portfolio_views').select('*').order('sort_order', { ascending: true });
      if (data) setPortfolioViews(data);
    }
  }, []);

  const deletePortfolioView = useCallback(async (id: string) => {
    const { error } = await supabase.from('portfolio_views').delete().eq('id', id);
    if (error) { console.error('Error deleting portfolio view:', error.message); return; }
    setPortfolioViews((prev) => prev.filter((v) => v.id !== id));
    setCustomGroups((prev) => prev.filter((g) => g.view_id !== id));
  }, []);

  /* — custom groups — */
  const addCustomGroup = useCallback(async (data: Omit<CustomGroupInsert, 'user_id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const insertData = { ...data, user_id: user.id };
    const { data: newGroup, error } = await supabase.from('custom_groups').insert(insertData).select().single();
    if (error) { console.error('[addCustomGroup] Error:', error); return null; }
    setCustomGroups((prev) => [...prev, newGroup]);
    return newGroup as CustomGroup;
  }, []);

  const updateCustomGroup = useCallback(async (id: string, updates: CustomGroupUpdate) => {
    setCustomGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    const { error } = await supabase.from('custom_groups').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating custom group:', error.message);
      const { data } = await supabase.from('custom_groups').select('*').order('created_at', { ascending: true });
      if (data) setCustomGroups(data);
    }
  }, []);

  const deleteCustomGroup = useCallback(async (id: string) => {
    const { error } = await supabase.from('custom_groups').delete().eq('id', id);
    if (error) { console.error('Error deleting custom group:', error.message); return; }
    setCustomGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  /* ═══ value ═══ */
  const value = useMemo<DataContextType>(
    () => ({
      generalStocks, isaStocks, stocksLoading,
      addStock, updateStock, deleteStock, reorderStocks,
      accounts, cashLoading, addAccount, updateAccount, deleteAccount,
      assets, assetsLoading, addAsset, updateAsset, deleteAsset,
      cryptos, cryptosLoading, addCrypto, updateCrypto, deleteCrypto, reorderCryptos,
      portfolioViews, portfolioViewsLoading, addPortfolioView, updatePortfolioView, deletePortfolioView,
      customGroups, customGroupsLoading, addCustomGroup, updateCustomGroup, deleteCustomGroup,
      dataVersion,
    }),
    [
      generalStocks, isaStocks, stocksLoading,
      addStock, updateStock, deleteStock, reorderStocks,
      accounts, cashLoading, addAccount, updateAccount, deleteAccount,
      assets, assetsLoading, addAsset, updateAsset, deleteAsset,
      cryptos, cryptosLoading, addCrypto, updateCrypto, deleteCrypto, reorderCryptos,
      portfolioViews, portfolioViewsLoading, addPortfolioView, updatePortfolioView, deletePortfolioView,
      customGroups, customGroupsLoading, addCustomGroup, updateCustomGroup, deleteCustomGroup,
      dataVersion,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/* ───── consumer hooks ───── */
export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataContext must be used within a DataProvider');
  return ctx;
}

export function useSharedStocks(accountType: AccountType) {
  const ctx = useDataContext();
  const stocks = accountType === 'general' ? ctx.generalStocks : ctx.isaStocks;
  const loading = ctx.stocksLoading;
  const addStock = useCallback(() => ctx.addStock(accountType), [ctx.addStock, accountType]);
  const reorderStocks = useCallback(
    (reordered: Stock[]) => ctx.reorderStocks(accountType, reordered),
    [ctx.reorderStocks, accountType],
  );
  const totalValue = useMemo(() => stocks.reduce((s, st) => s + st.quantity * st.current_price, 0), [stocks]);
  const totalCost = useMemo(() => stocks.reduce((s, st) => s + st.quantity * st.buy_price, 0), [stocks]);
  return { stocks, loading, addStock, updateStock: ctx.updateStock, deleteStock: ctx.deleteStock, reorderStocks, totalValue, totalCost };
}

export function useSharedCash() {
  const ctx = useDataContext();
  const totalBalance = useMemo(() => ctx.accounts.reduce((s, a) => s + a.balance, 0), [ctx.accounts]);
  return { accounts: ctx.accounts, loading: ctx.cashLoading, addAccount: ctx.addAccount, updateAccount: ctx.updateAccount, deleteAccount: ctx.deleteAccount, totalBalance };
}

export function useSharedAssets() {
  const ctx = useDataContext();
  const totalValue = useMemo(() => ctx.assets.reduce((s, a) => s + a.current_value, 0), [ctx.assets]);
  const totalPurchaseValue = useMemo(() => ctx.assets.reduce((s, a) => s + (a.purchase_value || 0), 0), [ctx.assets]);
  return { assets: ctx.assets, loading: ctx.assetsLoading, addAsset: ctx.addAsset, updateAsset: ctx.updateAsset, deleteAsset: ctx.deleteAsset, totalValue, totalPurchaseValue };
}

export function useSharedPortfolioViews() {
  const ctx = useDataContext();
  return { portfolioViews: ctx.portfolioViews, loading: ctx.portfolioViewsLoading, addPortfolioView: ctx.addPortfolioView, updatePortfolioView: ctx.updatePortfolioView, deletePortfolioView: ctx.deletePortfolioView };
}

export function useSharedCustomGroups() {
  const ctx = useDataContext();
  return { customGroups: ctx.customGroups, loading: ctx.customGroupsLoading, addCustomGroup: ctx.addCustomGroup, updateCustomGroup: ctx.updateCustomGroup, deleteCustomGroup: ctx.deleteCustomGroup };
}

export function useSharedCrypto() {
  const ctx = useDataContext();
  const totalValue = useMemo(() => ctx.cryptos.reduce((s, c) => s + c.quantity * c.current_price, 0), [ctx.cryptos]);
  const totalCost = useMemo(() => ctx.cryptos.reduce((s, c) => s + c.quantity * c.buy_price, 0), [ctx.cryptos]);
  return { cryptos: ctx.cryptos, loading: ctx.cryptosLoading, addCrypto: ctx.addCrypto, updateCrypto: ctx.updateCrypto, deleteCrypto: ctx.deleteCrypto, reorderCryptos: ctx.reorderCryptos, totalValue, totalCost };
}
