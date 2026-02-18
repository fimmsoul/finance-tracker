import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import CryptoRow from './CryptoRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { toYahooTicker } from '@/types/crypto';
import type { Crypto, CryptoUpdate } from '@/types/crypto';

interface CryptoTableProps {
  cryptos: Crypto[];
  onAdd: () => Promise<Crypto | null>;
  onUpdate: (id: string, updates: CryptoUpdate) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: Crypto[]) => void;
}

export default function CryptoTable({
  cryptos,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: CryptoTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const { convertBetween } = useCurrencyContext();
  const isRefreshingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Calculate totals in both USD and KRW
  const { totalValue, totalCost, totalValueKRW } = useMemo(() => {
    let value = 0;
    let cost = 0;
    let krwValue = 0;
    for (const c of cryptos) {
      value += convertBetween(c.quantity * c.current_price, c.currency, 'USD');
      cost += convertBetween(c.quantity * c.buy_price, c.currency, 'USD');
      krwValue += convertBetween(c.quantity * c.current_price, c.currency, 'KRW');
    }
    return { totalValue: value, totalCost: cost, totalValueKRW: krwValue };
  }, [cryptos, convertBetween]);

  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

  const handleAdd = async () => {
    const crypto = await onAdd();
    if (crypto) setNewId(crypto.id);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = cryptos.findIndex((c) => c.id === active.id);
      const newIndex = cryptos.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...cryptos];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onReorder(reordered);
    },
    [cryptos, onReorder],
  );

  const handleRefreshPrices = useCallback(async () => {
    // Collect cryptos with non-empty symbols
    const validCryptos = cryptos.filter((c) => c.symbol.trim());
    if (validCryptos.length === 0) return;

    // Prevent multiple simultaneous calls
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    setRefreshing(true);
    setRefreshStatus(null);

    try {
      // Convert crypto symbols to Yahoo Finance format (BTC-USD)
      // Note: Yahoo Finance only supports USD as quote currency for most cryptos
      const tickers = validCryptos.map((c) => {
        // For stablecoins (USDT, USDC), use USD as the quote currency for Yahoo Finance
        const quoteCurrency = ['USDT', 'USDC'].includes(c.currency.toUpperCase()) ? 'USD' : c.currency;
        return toYahooTicker(c.symbol, quoteCurrency);
      });

      console.log('Fetching crypto prices for:', tickers);
      const result = await window.electronAPI.fetchStockPrices(tickers);
      console.log('Crypto price result:', result);

      if (result.success && result.data) {
        let updated = 0;
        for (const crypto of validCryptos) {
          const quoteCurrency = ['USDT', 'USDC'].includes(crypto.currency.toUpperCase()) ? 'USD' : crypto.currency;
          const ticker = toYahooTicker(crypto.symbol, quoteCurrency);
          const priceData = result.data[ticker];
          if (priceData) {
            onUpdate(crypto.id, { current_price: priceData.price });
            updated++;
          }
        }
        setRefreshStatus(`Updated ${updated} of ${validCryptos.length} cryptos`);
      } else {
        setRefreshStatus('Failed to fetch prices');
      }
    } catch (err) {
      console.error('Failed to refresh crypto prices:', err);
      setRefreshStatus('Error fetching prices');
    } finally {
      isRefreshingRef.current = false;
      setRefreshing(false);
      // Clear status message after 3 seconds
      setTimeout(() => setRefreshStatus(null), 3000);
    }
  }, [cryptos, onUpdate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {refreshStatus && (
            <span className="text-xs text-gray-400 animate-fade-in">{refreshStatus}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={refreshing || cryptos.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh Prices'}
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Crypto
          </button>
        </div>
      </div>

      {cryptos.length === 0 ? (
        <div className="text-center py-12 text-gray-300 text-sm">
          No cryptocurrencies yet. Click + Add Crypto to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 px-1 w-8"></th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Symbol</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Ccy</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Qty</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Buy Price</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Current</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Value (USD)</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Value (KRW)</th>
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Gain/Loss</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <SortableContext items={cryptos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {cryptos.map((crypto) => (
                    <CryptoRow
                      key={crypto.id}
                      crypto={crypto}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      isNew={crypto.id === newId}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>

          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <div className="text-gray-500">
              Total Cost: <span className="tabular-nums font-medium text-gray-700">{formatCurrencyValue(totalCost, 'USD')}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-gray-500">
                USD: <span className="tabular-nums font-medium text-gray-700">{formatCurrencyValue(totalValue, 'USD')}</span>
              </div>
              <div className="text-gray-500">
                KRW: <span className="tabular-nums font-medium text-gray-700">{formatCurrencyValue(totalValueKRW, 'KRW')}</span>
              </div>
              <div className={gain >= 0 ? 'text-red-500' : 'text-blue-500'}>
                <span className="tabular-nums font-medium">
                  {gain >= 0 ? '+' : ''}{formatCurrencyValue(gain, 'USD')}
                </span>
                <span className="text-xs ml-1 opacity-70">
                  ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
