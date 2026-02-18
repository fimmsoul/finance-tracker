import { useState, useMemo } from 'react';
import DividendRow from './DividendRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Dividend, DividendUpdate } from '@/types/dividend';
import type { Stock } from '@/types/stock';

interface DividendTableProps {
  dividends: Dividend[];
  stocks: Stock[];
  onAdd: (stockId: string) => Promise<Dividend | null>;
  onUpdate: (id: string, updates: DividendUpdate) => void;
  onDelete: (id: string) => void;
}

export default function DividendTable({
  dividends,
  stocks,
  onAdd,
  onUpdate,
  onDelete,
}: DividendTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const [addingStockId, setAddingStockId] = useState<string>('');
  const { convert, displayCurrency } = useCurrencyContext();

  const totalConverted = useMemo(() => {
    return dividends.reduce((sum, d) => sum + convert(d.amount, d.currency), 0);
  }, [dividends, convert]);

  // Default to first stock with a ticker
  const availableStocks = stocks.filter((s) => s.ticker.trim());
  const defaultStockId = availableStocks[0]?.id || '';

  const handleAdd = async () => {
    const stockId = addingStockId || defaultStockId;
    if (!stockId) return;
    const dividend = await onAdd(stockId);
    if (dividend) setNewId(dividend.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Dividends</h3>
        <div className="flex items-center gap-2">
          {availableStocks.length > 0 && (
            <select
              value={addingStockId || defaultStockId}
              onChange={(e) => setAddingStockId(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-emerald-400"
            >
              {availableStocks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ticker}{s.name ? ` — ${s.name}` : ''}{s.account_type !== 'general' ? ` [${s.account_type.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleAdd}
            disabled={availableStocks.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Dividend
          </button>
        </div>
      </div>

      {availableStocks.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          Add stocks first, then record dividends here.
        </div>
      ) : dividends.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          No dividends recorded yet. Select a stock and click + Add Dividend.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Stock</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Ccy</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">DPS</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Foreign Tax</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Net</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">In {displayCurrency}</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <DividendRow
                  key={d.id}
                  dividend={d}
                  stocks={stocks}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isNew={d.id === newId}
                />
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-gray-200 text-right text-sm text-gray-500">
            Total Dividends: <span className="tabular-nums font-medium text-gray-700">{formatCurrencyValue(totalConverted, displayCurrency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
