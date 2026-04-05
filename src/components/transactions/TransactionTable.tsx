import { useState, useMemo } from 'react';
import TransactionRow from './TransactionRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Transaction, TransactionUpdate, TransactionType } from '@/types/transaction';
import type { Stock } from '@/types/stock';

interface TransactionTableProps {
  transactions: Transaction[];
  stocks: Stock[];
  onAdd: (stockId: string, type?: TransactionType) => Promise<Transaction | null>;
  onUpdate: (id: string, updates: TransactionUpdate) => void;
  onDelete: (id: string) => void;
  onCreateStock?: (ticker?: string, currency?: string) => Promise<Stock | null>;
}

const NEW_STOCK_VALUE = '__NEW_STOCK__';

export default function TransactionTable({
  transactions,
  stocks,
  onAdd,
  onUpdate,
  onDelete,
  onCreateStock,
}: TransactionTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const [addingStockId, setAddingStockId] = useState<string>('');
  const [addingType, setAddingType] = useState<TransactionType>('buy');
  const [showNewStockInput, setShowNewStockInput] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newCurrency, setNewCurrency] = useState<string>('USD');
  const { convert, displayCurrency } = useCurrencyContext();

  // Calculate total cost (buys - sells)
  const totalStats = useMemo(() => {
    let totalBuyValue = 0;
    let totalSellValue = 0;

    for (const t of transactions) {
      const value = t.quantity * t.price_per_share + t.fees;
      const converted = convert(value, t.currency || 'USD');
      if (t.type === 'buy') {
        totalBuyValue += converted;
      } else {
        totalSellValue += converted;
      }
    }

    return { totalBuyValue, totalSellValue, netCost: totalBuyValue - totalSellValue };
  }, [transactions, convert]);

  // Default to first stock with a ticker
  const availableStocks = stocks.filter((s) => s.ticker.trim());
  const defaultStockId = availableStocks[0]?.id || NEW_STOCK_VALUE;

  const handleStockChange = (value: string) => {
    if (value === NEW_STOCK_VALUE) {
      setShowNewStockInput(true);
      setAddingStockId('');
    } else {
      setShowNewStockInput(false);
      setAddingStockId(value);
    }
  };

  const handleAdd = async () => {
    let stockId = addingStockId || defaultStockId;

    // If creating a new stock
    if (stockId === NEW_STOCK_VALUE || showNewStockInput) {
      if (!onCreateStock) return;
      const newStock = await onCreateStock(newTicker.trim() || '', newCurrency);
      if (!newStock) return;
      stockId = newStock.id;
      setShowNewStockInput(false);
      setNewTicker('');
      setNewCurrency('USD');
      setAddingStockId('');
    }

    const transaction = await onAdd(stockId, addingType);
    if (transaction) setNewId(transaction.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-[var(--color-text)]">Transactions</h3>
        <div className="flex items-center gap-2">
          {showNewStockInput ? (
            <>
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (e.g., AAPL)"
                className="text-[12px] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-primary)] transition-colors duration-200 w-32"
                autoFocus
              />
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className="text-[12px] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-primary)] transition-colors duration-200 cursor-pointer"
              >
                <option value="USD">USD</option>
                <option value="KRW">KRW</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
              </select>
            </>
          ) : (
            <select
              value={addingStockId || defaultStockId}
              onChange={(e) => handleStockChange(e.target.value)}
              className="text-[12px] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-primary)] transition-colors duration-200 cursor-pointer"
            >
              {onCreateStock && (
                <option value={NEW_STOCK_VALUE}>➕ New Stock...</option>
              )}
              {availableStocks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ticker}{s.name ? ` — ${s.name}` : ''}
                </option>
              ))}
            </select>
          )}
          <select
            value={addingType}
            onChange={(e) => setAddingType(e.target.value as TransactionType)}
            className="text-[12px] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-primary)] transition-colors duration-200 cursor-pointer"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          {showNewStockInput && (
            <button
              onClick={() => { setShowNewStockInput(false); setNewTicker(''); setNewCurrency('USD'); }}
              className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer transition-colors duration-200"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAdd}
            disabled={showNewStockInput && !newTicker.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] bg-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/15 rounded-md transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Transaction
          </button>
        </div>
      </div>

      {availableStocks.length === 0 && !onCreateStock ? (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-[13px]">
          Add stocks first, then record transactions here.
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-[13px]">
          No transactions recorded yet. Select a stock and click + Add Transaction.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Date</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Stock</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Type</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Qty</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Price</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Fees</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Total</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Ex.Rate</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Notes</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  stocks={stocks}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isNew={t.id === newId}
                />
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-right text-[13px] text-[var(--color-text-secondary)]">
            <span className="mr-4">
              Total Buys: <span className="tabular-nums font-medium text-[var(--color-negative)]">{formatCurrencyValue(totalStats.totalBuyValue, displayCurrency)}</span>
            </span>
            <span className="mr-4">
              Total Sells: <span className="tabular-nums font-medium text-[var(--color-positive)]">{formatCurrencyValue(totalStats.totalSellValue, displayCurrency)}</span>
            </span>
            <span>
              Net Cost: <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCurrencyValue(totalStats.netCost, displayCurrency)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
