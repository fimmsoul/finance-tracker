import { useState, useMemo } from 'react';
import AssetRow from './AssetRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Asset, AssetUpdate } from '@/types/asset';

interface AssetTableProps {
  assets: Asset[];
  onAdd: () => Promise<Asset | null>;
  onUpdate: (id: string, updates: AssetUpdate) => void;
  onDelete: (id: string) => void;
  totalValue: number;
}

export default function AssetTable({
  assets,
  onAdd,
  onUpdate,
  onDelete,
}: AssetTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const { convert, displayCurrency } = useCurrencyContext();

  const totalValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + convert(a.current_value, a.currency), 0);
  }, [assets, convert]);

  const handleAdd = async () => {
    const asset = await onAdd();
    if (asset) setNewId(asset.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] bg-[var(--color-primary-light)] hover:bg-blue-100 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)] text-[13px]">
          No assets yet. Click + Add Asset to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Asset</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Category</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Ccy</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Purchase</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Current</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">In {displayCurrency}</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Gain/Loss</th>
                <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Notes</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isNew={asset.id === newId}
                />
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-right text-[13px] text-[var(--color-text-secondary)]">
            Total: <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCurrencyValue(totalValue, displayCurrency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
