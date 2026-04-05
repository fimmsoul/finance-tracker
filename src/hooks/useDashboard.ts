import { useMemo, useCallback } from 'react';
import { useDataContext } from './DataContext';
import { useCurrencyContext } from './CurrencyContext';
import type { Position, DashboardItem } from '@/types/position';

export function useDashboard() {
  const {
    generalStocks,
    isaStocks,
    stocksLoading,
    updateStock,
    accounts,
    cashLoading,
    updateAccount,
    assets,
    assetsLoading,
    updateAsset,
    cryptos,
    cryptosLoading,
    updateCrypto,
  } = useDataContext();
  const { convert, convertBetween } = useCurrencyContext();

  const loading = stocksLoading || cashLoading || assetsLoading || cryptosLoading;
  const stocks = useMemo(() => [...generalStocks, ...isaStocks], [generalStocks, isaStocks]);

  // Build unified items
  const items = useMemo<DashboardItem[]>(() => {
    const result: DashboardItem[] = [];

    for (const s of stocks) {
      const nav = convert(s.quantity * s.current_price, s.currency);
      const cost = convert(s.quantity * s.buy_price, s.currency);
      const navKRW = convertBetween(s.quantity * s.current_price, s.currency, 'KRW');
      result.push({
        id: s.id,
        source: 'stock',
        name: s.ticker
          ? `${s.ticker.toUpperCase()}${s.name ? ' · ' + s.name : ''}${s.account_type === 'isa' ? ' (ISA)' : ''}`
          : (s.name || 'Untitled Stock') + (s.account_type === 'isa' ? ' (ISA)' : ''),
        position: s.position || 'midfielder',
        nav,
        cost,
        returnPct: cost > 0 ? ((nav - cost) / cost) * 100 : 0,
        navKRW,
        currency: s.currency,
      });
    }

    for (const a of accounts) {
      const nav = convert(a.balance, a.currency);
      const navKRW = convertBetween(a.balance, a.currency, 'KRW');
      result.push({
        id: a.id,
        source: 'cash',
        name: a.name || 'Cash',
        position: a.position || 'defender',
        nav,
        cost: nav, // cash has no cost basis
        returnPct: 0,
        navKRW,
        currency: a.currency,
      });
    }

    for (const a of assets) {
      const nav = convert(a.current_value, a.currency);
      const cost = convert(a.purchase_value || 0, a.currency);
      const navKRW = convertBetween(a.current_value, a.currency, 'KRW');
      result.push({
        id: a.id,
        source: 'asset',
        name: a.name || 'Untitled Asset',
        position: a.position || 'midfielder',
        nav,
        cost,
        returnPct: cost > 0 ? ((nav - cost) / cost) * 100 : 0,
        navKRW,
        currency: a.currency,
      });
    }

    for (const c of cryptos) {
      const nav = convert(c.quantity * c.current_price, c.currency);
      const cost = convert(c.quantity * c.buy_price, c.currency);
      const navKRW = convertBetween(c.quantity * c.current_price, c.currency, 'KRW');
      result.push({
        id: c.id,
        source: 'crypto',
        name: c.symbol
          ? `${c.symbol}${c.name ? ' · ' + c.name : ''}`
          : (c.name || 'Untitled Crypto'),
        position: c.position || 'attacker',
        nav,
        cost,
        returnPct: cost > 0 ? ((nav - cost) / cost) * 100 : 0,
        navKRW,
        currency: c.currency,
      });
    }

    return result;
  }, [stocks, accounts, assets, cryptos, convert, convertBetween]);

  const totalNAV = useMemo(() => items.reduce((s, i) => s + i.nav, 0), [items]);
  const totalNAVKRW = useMemo(() => items.reduce((s, i) => s + i.navKRW, 0), [items]);

  const grouped = useMemo(() => {
    const groups: Record<Position, DashboardItem[]> = {
      attacker: [],
      midfielder: [],
      defender: [],
    };
    for (const item of items) {
      groups[item.position].push(item);
    }
    return groups;
  }, [items]);

  const categoryStats = useMemo(() => {
    const stats: Record<Position, { nav: number; navKRW: number; cost: number; pct: number }> = {
      attacker: { nav: 0, navKRW: 0, cost: 0, pct: 0 },
      midfielder: { nav: 0, navKRW: 0, cost: 0, pct: 0 },
      defender: { nav: 0, navKRW: 0, cost: 0, pct: 0 },
    };
    for (const item of items) {
      stats[item.position].nav += item.nav;
      stats[item.position].navKRW += item.navKRW;
      stats[item.position].cost += item.cost;
    }
    const total = totalNAV || 1;
    stats.attacker.pct = (stats.attacker.nav / total) * 100;
    stats.midfielder.pct = (stats.midfielder.nav / total) * 100;
    stats.defender.pct = (stats.defender.nav / total) * 100;
    return stats;
  }, [items, totalNAV]);

  // Update position for any asset
  const updatePosition = useCallback(
    async (id: string, source: 'stock' | 'cash' | 'asset' | 'crypto', position: Position) => {
      if (source === 'stock') {
        await updateStock(id, { position } as any);
      } else if (source === 'cash') {
        await updateAccount(id, { position } as any);
      } else if (source === 'crypto') {
        await updateCrypto(id, { position } as any);
      } else {
        await updateAsset(id, { position } as any);
      }
    },
    [updateStock, updateAccount, updateAsset, updateCrypto],
  );

  return { items, grouped, categoryStats, totalNAV, totalNAVKRW, loading, updatePosition };
}
