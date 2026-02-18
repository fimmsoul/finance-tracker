import { useState } from 'react';
import EditableCell from '@/components/ui/EditableCell';
import SelectCell from '@/components/ui/SelectCell';
import { formatCurrencyValue, currencyOptions } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Asset, AssetUpdate } from '@/types/asset';

const categoryOptions = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'gold', label: 'Gold' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'collectible', label: 'Collectible' },
  { value: 'other', label: 'Other' },
];

interface AssetRowProps {
  asset: Asset;
  onUpdate: (id: string, updates: AssetUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

export default function AssetRow({ asset, onUpdate, onDelete, isNew }: AssetRowProps) {
  const [confirming, setConfirming] = useState(false);
  const { convert, displayCurrency } = useCurrencyContext();

  const gain = asset.purchase_value != null ? asset.current_value - asset.purchase_value : null;
  const displayGain = gain != null ? convert(gain, asset.currency) : null;
  const displayValue = convert(asset.current_value, asset.currency);

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-100/60 transition-colors group">
      <td className="py-1.5 px-2">
        <EditableCell
          value={asset.name}
          onSave={(v) => onUpdate(asset.id, { name: v })}
          placeholder="Asset name"
          autoFocus={isNew}
        />
      </td>
      <td className="py-1.5 px-2 w-32">
        <SelectCell
          value={asset.category}
          options={categoryOptions}
          onSave={(v) => onUpdate(asset.id, { category: v as Asset['category'] })}
        />
      </td>
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          value={asset.currency}
          options={currencyOptions.map((c) => ({ value: c.value, label: c.value }))}
          onSave={(v) => onUpdate(asset.id, { currency: v })}
        />
      </td>
      <td className="py-1.5 px-2 w-32">
        <EditableCell
          value={asset.purchase_value ?? ''}
          onSave={(v) => onUpdate(asset.id, { purchase_value: v ? parseFloat(v) || 0 : null })}
          type="number"
          min={0}
          displayValue={asset.purchase_value != null ? formatCurrencyValue(asset.purchase_value, asset.currency) : ''}
          placeholder="Optional"
        />
      </td>
      <td className="py-1.5 px-2 w-36">
        <EditableCell
          value={asset.current_value}
          onSave={(v) => onUpdate(asset.id, { current_value: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(asset.current_value, asset.currency)}
        />
      </td>
      <td className="py-1.5 px-2 w-32 text-right text-sm tabular-nums">
        {formatCurrencyValue(displayValue, displayCurrency)}
      </td>
      <td className="py-1.5 px-2 w-28 text-right text-sm tabular-nums">
        {displayGain != null ? (
          <span className={displayGain >= 0 ? 'text-emerald-600' : 'text-red-500'}>
            {displayGain >= 0 ? '+' : ''}{formatCurrencyValue(displayGain, displayCurrency)}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className="py-1.5 px-2">
        <EditableCell
          value={asset.notes || ''}
          onSave={(v) => onUpdate(asset.id, { notes: v || null })}
          placeholder="Notes"
          className="text-gray-400"
        />
      </td>
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(asset.id); setConfirming(false); }}
              className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}
