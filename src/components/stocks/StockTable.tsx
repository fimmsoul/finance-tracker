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
import StockRow from './StockRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { useStockRefresh } from '@/hooks/StockRefreshContext';
import type { Stock, StockUpdate } from '@/types/stock';

interface StockTableProps {
  stocks: Stock[];
  onAdd: () => Promise<Stock | null>;
  onUpdate: (id: string, updates: StockUpdate) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: Stock[]) => void;
  totalValue: number;
  totalCost: number;
}

export default function StockTable({
  stocks,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}: StockTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const { convertBetween } = useCurrencyContext();
  const {
    refreshing,
    setRefreshing,
    refreshStatus,
    setRefreshStatus,
    setLastUpdated,
    refreshTrigger,
  } = useStockRefresh();
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
    for (const s of stocks) {
      value += convertBetween(s.quantity * s.current_price, s.currency, 'USD');
      cost += convertBetween(s.quantity * s.buy_price, s.currency, 'USD');
      krwValue += convertBetween(s.quantity * s.current_price, s.currency, 'KRW');
    }
    return { totalValue: value, totalCost: cost, totalValueKRW: krwValue };
  }, [stocks, convertBetween]);

  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

  const handleAdd = async () => {
    const stock = await onAdd();
    if (stock) setNewId(stock.id);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = stocks.findIndex((s) => s.id === active.id);
      const newIndex = stocks.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...stocks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      onReorder(reordered);
    },
    [stocks, onReorder],
  );

  const handleRefreshPrices = useCallback(async () => {
    // Collect tickers that are non-empty
    const tickerStocks = stocks.filter((s) => s.ticker.trim());
    if (tickerStocks.length === 0) return;

    // Prevent multiple simultaneous calls using ref
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    setRefreshing(true);
    setRefreshStatus(null);

    try {
      const tickers = tickerStocks.map((s) => s.ticker.trim());
      const result = await window.electronAPI.fetchStockPrices(tickers);

      if (result.success && result.data) {
        let updated = 0;
        for (const stock of tickerStocks) {
          const priceData = result.data[stock.ticker.trim()];
          if (priceData) {
            onUpdate(stock.id, { current_price: priceData.price });
            updated++;
          }
        }
        setRefreshStatus(`Updated ${updated} of ${tickers.length} stocks`);
      } else {
        setRefreshStatus('Failed to fetch prices');
      }
    } catch (err) {
      console.error('Failed to refresh prices:', err);
      setRefreshStatus('Error fetching prices');
    } finally {
      isRefreshingRef.current = false;
      setRefreshing(false);
      setLastUpdated(new Date());
      // Clear status message after 3 seconds
      setTimeout(() => setRefreshStatus(null), 3000);
    }
  }, [stocks, onUpdate, setRefreshing, setRefreshStatus, setLastUpdated]);

  // Listen to refresh trigger from context (auto-refresh)
  const prevTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevTriggerRef.current && stocks.length > 0) {
      prevTriggerRef.current = refreshTrigger;
      handleRefreshPrices();
    }
  }, [refreshTrigger, stocks.length, handleRefreshPrices]);

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
            disabled={refreshing || stocks.length === 0}
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
            {refreshing ? 'Refreshing…' : 'Refresh Prices'}
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Stock
          </button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="text-center py-12 text-gray-300 text-sm">
          No stocks yet. Click + Add Stock to get started.
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
                  <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Ticker</th>
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
              <SortableContext items={stocks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {stocks.map((stock) => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      isNew={stock.id === newId}
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
