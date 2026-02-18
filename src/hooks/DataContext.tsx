import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Stock, StockUpdate, AccountType } from '@/types/stock';
import type { CashAccount, CashAccountUpdate } from '@/types/cash';
import type { Asset, AssetUpdate } from '@/types/asset';
import type { Crypto, CryptoUpdate } from '@/types/crypto';
import type { CustomGroup, CustomGroupInsert, CustomGroupUpdate } from '@/types/customGroup';
import type { PortfolioView, PortfolioViewUpdate } from '@/types/portfolioView';

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
  // Data version — increments after every mutation so snapshot can auto-update
  dataVersion: number;
}

const DataContext = createContext<DataContextType | null>(null);

/* ───── provider ───── */
export function DataProvider({ children }: { children: ReactNode }) {
  /* — data version: bump after every mutation to signal snapshot refresh — */
  const [dataVersion, setDataVersion] = useState(0);
  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  /* — stocks — */
  const [generalStocks, setGeneralStocks] = useState<Stock[]>([]);
  const [isaStocks, setIsaStocks] = useState<Stock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);

  const fetchStocks = useCallback(async () => {
    const [generalRes, isaRes] = await Promise.all([
      supabase
        .from('stocks')
        .select('*')
        .eq('account_type', 'general')
        .order('sort_order', { ascending: true }),
      supabase
        .from('stocks')
        .select('*')
        .eq('account_type', 'isa')
        .order('sort_order', { ascending: true }),
    ]);

    if (generalRes.data) setGeneralStocks(generalRes.data);
    if (isaRes.data) setIsaStocks(isaRes.data);
    setStocksLoading(false);
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const setStocksFor = (accountType: AccountType) =>
    accountType === 'general' ? setGeneralStocks : setIsaStocks;
  const stocksFor = (accountType: AccountType) =>
    accountType === 'general' ? generalStocks : isaStocks;

  const addStock = useCallback(
    async (accountType: AccountType) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const current = accountType === 'general' ? generalStocks : isaStocks;
      const maxOrder = current.length > 0 ? Math.max(...current.map((s) => s.sort_order ?? 0)) : 0;

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
      setStocksFor(accountType)((prev) => [...prev, optimistic]);

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
        setStocksFor(accountType)((prev) => prev.filter((s) => s.id !== tempId));
        return null;
      }

      setStocksFor(accountType)((prev) => prev.map((s) => (s.id === tempId ? data : s)));
      bumpVersion();
      return data as Stock;
    },
    [generalStocks, isaStocks, bumpVersion],
  );

  const updateStock = useCallback(async (id: string, updates: StockUpdate) => {
    const { error } = await supabase.from('stocks').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating stock:', error.message);
      return;
    }
    const updater = (prev: Stock[]) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
    setGeneralStocks(updater);
    setIsaStocks(updater);
    bumpVersion();
  }, [bumpVersion]);

  const deleteStock = useCallback(async (id: string) => {
    const { error } = await supabase.from('stocks').delete().eq('id', id);
    if (error) {
      console.error('Error deleting stock:', error.message);
      return;
    }
    const filter = (prev: Stock[]) => prev.filter((s) => s.id !== id);
    setGeneralStocks(filter);
    setIsaStocks(filter);
    bumpVersion();
  }, [bumpVersion]);

  const reorderStocks = useCallback(async (accountType: AccountType, reordered: Stock[]) => {
    setStocksFor(accountType)(reordered);
    const updates = reordered.map((stock, index) => ({ id: stock.id, sort_order: index }));
    for (const u of updates) {
      await supabase.from('stocks').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
  }, []);

  /* — cash — */
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [cashLoading, setCashLoading] = useState(true);

  const fetchCash = useCallback(async () => {
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching cash accounts:', error.message);
      return;
    }
    setAccounts(data || []);
    setCashLoading(false);
  }, []);

  useEffect(() => {
    fetchCash();
  }, [fetchCash]);

  const addAccount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('cash_accounts')
      .insert({ user_id: user.id, name: '', type: 'bank', balance: 0, currency: 'USD' })
      .select()
      .single();

    if (error) {
      console.error('Error adding cash account:', error.message);
      return null;
    }
    setAccounts((prev) => [...prev, data]);
    bumpVersion();
    return data as CashAccount;
  }, [bumpVersion]);

  const updateAccount = useCallback(async (id: string, updates: CashAccountUpdate) => {
    const { error } = await supabase.from('cash_accounts').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating cash account:', error.message);
      return;
    }
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteAccount = useCallback(async (id: string) => {
    const { error } = await supabase.from('cash_accounts').delete().eq('id', id);
    if (error) {
      console.error('Error deleting cash account:', error.message);
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  /* — assets — */
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

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
    setAssetsLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const addAsset = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('assets')
      .insert({ user_id: user.id, name: '', category: 'other', current_value: 0, currency: 'USD' })
      .select()
      .single();

    if (error) {
      console.error('Error adding asset:', error.message);
      return null;
    }
    setAssets((prev) => [...prev, data]);
    bumpVersion();
    return data as Asset;
  }, [bumpVersion]);

  const updateAsset = useCallback(async (id: string, updates: AssetUpdate) => {
    const { error } = await supabase.from('assets').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating asset:', error.message);
      return;
    }
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) {
      console.error('Error deleting asset:', error.message);
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  /* — crypto — */
  const [cryptos, setCryptos] = useState<Crypto[]>([]);
  const [cryptosLoading, setCryptosLoading] = useState(true);

  const fetchCryptos = useCallback(async () => {
    const { data, error } = await supabase
      .from('cryptos')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Error fetching cryptos:', error.message);
      setCryptosLoading(false);
      return;
    }
    setCryptos(data || []);
    setCryptosLoading(false);
  }, []);

  useEffect(() => {
    fetchCryptos();
  }, [fetchCryptos]);

  const addCrypto = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const maxOrder = cryptos.length > 0 ? Math.max(...cryptos.map((c) => c.sort_order ?? 0)) : 0;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Crypto = {
      id: tempId,
      user_id: user.id,
      symbol: '',
      name: '',
      quantity: 0,
      buy_price: 0,
      current_price: 0,
      currency: 'USD',
      sort_order: maxOrder + 1,
      position: 'attacker',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCryptos((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('cryptos')
      .insert({
        user_id: user.id,
        symbol: '',
        name: '',
        quantity: 0,
        buy_price: 0,
        current_price: 0,
        currency: 'USD',
        sort_order: maxOrder + 1,
        position: 'attacker',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding crypto:', error.message);
      setCryptos((prev) => prev.filter((c) => c.id !== tempId));
      return null;
    }

    setCryptos((prev) => prev.map((c) => (c.id === tempId ? data : c)));
    bumpVersion();
    return data as Crypto;
  }, [cryptos, bumpVersion]);

  const updateCrypto = useCallback(async (id: string, updates: CryptoUpdate) => {
    const { error } = await supabase.from('cryptos').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating crypto:', error.message);
      return;
    }
    setCryptos((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    bumpVersion();
  }, [bumpVersion]);

  const deleteCrypto = useCallback(async (id: string) => {
    const { error } = await supabase.from('cryptos').delete().eq('id', id);
    if (error) {
      console.error('Error deleting crypto:', error.message);
      return;
    }
    setCryptos((prev) => prev.filter((c) => c.id !== id));
    bumpVersion();
  }, [bumpVersion]);

  const reorderCryptos = useCallback(async (reordered: Crypto[]) => {
    setCryptos(reordered);
    const updates = reordered.map((crypto, index) => ({ id: crypto.id, sort_order: index }));
    for (const u of updates) {
      await supabase.from('cryptos').update({ sort_order: u.sort_order }).eq('id', u.id);
    }
  }, []);

  /* — portfolio views (dynamic tabs) — */
  const [portfolioViews, setPortfolioViews] = useState<PortfolioView[]>([]);
  const [portfolioViewsLoading, setPortfolioViewsLoading] = useState(true);

  const fetchPortfolioViews = useCallback(async () => {
    const { data, error } = await supabase
      .from('portfolio_views')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Error fetching portfolio views:', error.message);
      setPortfolioViewsLoading(false);
      return;
    }
    setPortfolioViews(data || []);
    setPortfolioViewsLoading(false);
  }, []);

  useEffect(() => {
    fetchPortfolioViews();
  }, [fetchPortfolioViews]);

  const addPortfolioView = useCallback(async (name: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const maxOrder = portfolioViews.length > 0 ? Math.max(...portfolioViews.map((v) => v.sort_order)) : 0;

    const { data, error } = await supabase
      .from('portfolio_views')
      .insert({ user_id: user.id, name, sort_order: maxOrder + 1 })
      .select()
      .single();

    if (error) {
      console.error('Error adding portfolio view:', error.message);
      return null;
    }
    setPortfolioViews((prev) => [...prev, data]);
    return data as PortfolioView;
  }, [portfolioViews]);

  const updatePortfolioView = useCallback(async (id: string, updates: PortfolioViewUpdate) => {
    // Optimistic update
    setPortfolioViews((prev) => prev.map((v) => (v.id === id ? { ...v, ...updates } : v)));

    const { error } = await supabase.from('portfolio_views').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating portfolio view:', error.message);
      // Rollback
      const { data } = await supabase.from('portfolio_views').select('*').order('sort_order', { ascending: true });
      if (data) setPortfolioViews(data);
    }
  }, []);

  const deletePortfolioView = useCallback(async (id: string) => {
    const { error } = await supabase.from('portfolio_views').delete().eq('id', id);
    if (error) {
      console.error('Error deleting portfolio view:', error.message);
      return;
    }
    setPortfolioViews((prev) => prev.filter((v) => v.id !== id));
    // Also remove custom groups that belong to this view (cascade should handle DB, but update local state)
    setCustomGroups((prev) => prev.filter((g) => g.view_id !== id));
  }, []);

  /* — custom groups — */
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [customGroupsLoading, setCustomGroupsLoading] = useState(true);

  const fetchCustomGroups = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_groups')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching custom groups:', error.message);
      setCustomGroupsLoading(false);
      return;
    }
    setCustomGroups(data || []);
    setCustomGroupsLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomGroups();
  }, [fetchCustomGroups]);

  const addCustomGroup = useCallback(async (data: Omit<CustomGroupInsert, 'user_id'>) => {
    console.log('[addCustomGroup] Starting with data:', data);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('[addCustomGroup] No user found!');
      return null;
    }
    console.log('[addCustomGroup] User:', user.id);

    const insertData = { ...data, user_id: user.id };
    console.log('[addCustomGroup] Insert data:', insertData);

    const { data: newGroup, error } = await supabase
      .from('custom_groups')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[addCustomGroup] Error:', error);
      return null;
    }

    console.log('[addCustomGroup] Success:', newGroup);
    setCustomGroups((prev) => [...prev, newGroup]);
    return newGroup as CustomGroup;
  }, []);

  const updateCustomGroup = useCallback(async (id: string, updates: CustomGroupUpdate) => {
    // Optimistic update: update UI immediately for responsive feel
    setCustomGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));

    // Then sync to database
    const { error } = await supabase.from('custom_groups').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating custom group:', error.message);
      // Rollback: refetch on error
      const { data } = await supabase.from('custom_groups').select('*').order('created_at', { ascending: true });
      if (data) setCustomGroups(data);
    }
  }, []);

  const deleteCustomGroup = useCallback(async (id: string) => {
    const { error } = await supabase.from('custom_groups').delete().eq('id', id);
    if (error) {
      console.error('Error deleting custom group:', error.message);
      return;
    }
    setCustomGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  /* — value — */
  const value = useMemo<DataContextType>(
    () => ({
      generalStocks,
      isaStocks,
      stocksLoading,
      addStock,
      updateStock,
      deleteStock,
      reorderStocks,
      accounts,
      cashLoading,
      addAccount,
      updateAccount,
      deleteAccount,
      assets,
      assetsLoading,
      addAsset,
      updateAsset,
      deleteAsset,
      cryptos,
      cryptosLoading,
      addCrypto,
      updateCrypto,
      deleteCrypto,
      reorderCryptos,
      portfolioViews,
      portfolioViewsLoading,
      addPortfolioView,
      updatePortfolioView,
      deletePortfolioView,
      customGroups,
      customGroupsLoading,
      addCustomGroup,
      updateCustomGroup,
      deleteCustomGroup,
      dataVersion,
    }),
    [
      generalStocks,
      isaStocks,
      stocksLoading,
      addStock,
      updateStock,
      deleteStock,
      reorderStocks,
      accounts,
      cashLoading,
      addAccount,
      updateAccount,
      deleteAccount,
      assets,
      assetsLoading,
      addAsset,
      updateAsset,
      deleteAsset,
      cryptos,
      cryptosLoading,
      addCrypto,
      updateCrypto,
      deleteCrypto,
      reorderCryptos,
      portfolioViews,
      portfolioViewsLoading,
      addPortfolioView,
      updatePortfolioView,
      deletePortfolioView,
      customGroups,
      customGroupsLoading,
      addCustomGroup,
      updateCustomGroup,
      deleteCustomGroup,
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

/** Drop-in replacement for the old useStocks(accountType) hook */
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

  return {
    stocks,
    loading,
    addStock,
    updateStock: ctx.updateStock,
    deleteStock: ctx.deleteStock,
    reorderStocks,
    totalValue,
    totalCost,
  };
}

/** Drop-in replacement for the old useCash() hook */
export function useSharedCash() {
  const ctx = useDataContext();

  const totalBalance = useMemo(() => ctx.accounts.reduce((s, a) => s + a.balance, 0), [ctx.accounts]);

  return {
    accounts: ctx.accounts,
    loading: ctx.cashLoading,
    addAccount: ctx.addAccount,
    updateAccount: ctx.updateAccount,
    deleteAccount: ctx.deleteAccount,
    totalBalance,
  };
}

/** Drop-in replacement for the old useAssets() hook */
export function useSharedAssets() {
  const ctx = useDataContext();

  const totalValue = useMemo(() => ctx.assets.reduce((s, a) => s + a.current_value, 0), [ctx.assets]);
  const totalPurchaseValue = useMemo(
    () => ctx.assets.reduce((s, a) => s + (a.purchase_value || 0), 0),
    [ctx.assets],
  );

  return {
    assets: ctx.assets,
    loading: ctx.assetsLoading,
    addAsset: ctx.addAsset,
    updateAsset: ctx.updateAsset,
    deleteAsset: ctx.deleteAsset,
    totalValue,
    totalPurchaseValue,
  };
}

/** Hook for portfolio views (dynamic tabs) */
export function useSharedPortfolioViews() {
  const ctx = useDataContext();

  return {
    portfolioViews: ctx.portfolioViews,
    loading: ctx.portfolioViewsLoading,
    addPortfolioView: ctx.addPortfolioView,
    updatePortfolioView: ctx.updatePortfolioView,
    deletePortfolioView: ctx.deletePortfolioView,
  };
}

/** Hook for custom groups */
export function useSharedCustomGroups() {
  const ctx = useDataContext();

  return {
    customGroups: ctx.customGroups,
    loading: ctx.customGroupsLoading,
    addCustomGroup: ctx.addCustomGroup,
    updateCustomGroup: ctx.updateCustomGroup,
    deleteCustomGroup: ctx.deleteCustomGroup,
  };
}

/** Hook for crypto holdings */
export function useSharedCrypto() {
  const ctx = useDataContext();

  const totalValue = useMemo(
    () => ctx.cryptos.reduce((s, c) => s + c.quantity * c.current_price, 0),
    [ctx.cryptos],
  );
  const totalCost = useMemo(
    () => ctx.cryptos.reduce((s, c) => s + c.quantity * c.buy_price, 0),
    [ctx.cryptos],
  );

  return {
    cryptos: ctx.cryptos,
    loading: ctx.cryptosLoading,
    addCrypto: ctx.addCrypto,
    updateCrypto: ctx.updateCrypto,
    deleteCrypto: ctx.deleteCrypto,
    reorderCryptos: ctx.reorderCryptos,
    totalValue,
    totalCost,
  };
}
