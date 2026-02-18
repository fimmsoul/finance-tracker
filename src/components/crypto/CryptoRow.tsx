import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EditableCell, { type EditableCellHandle } from '@/components/ui/EditableCell';
import SelectCell, { type SelectCellHandle } from '@/components/ui/SelectCell';
import { formatNumber } from '@/lib/format';
import { formatCurrencyValue, currencyOptions } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Crypto, CryptoUpdate } from '@/types/crypto';

interface CryptoRowProps {
  crypto: Crypto;
  onUpdate: (id: string, updates: CryptoUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

export default function CryptoRow({ crypto, onUpdate, onDelete, isNew }: CryptoRowProps) {
  const [confirming, setConfirming] = useState(false);
  const { convertBetween } = useCurrencyContext();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: crypto.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Refs for Tab navigation: Symbol → Name → Currency → Qty → Buy Price → Current Price
  const symbolRef = useRef<EditableCellHandle>(null);
  const nameRef = useRef<EditableCellHandle>(null);
  const currencyRef = useRef<SelectCellHandle>(null);
  const qtyRef = useRef<EditableCellHandle>(null);
  const buyPriceRef = useRef<EditableCellHandle>(null);
  const currentPriceRef = useRef<EditableCellHandle>(null);

  const totalValue = crypto.quantity * crypto.current_price;
  const totalCost = crypto.quantity * crypto.buy_price;
  const gain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;

  const valueInUSD = convertBetween(totalValue, crypto.currency, 'USD');
  const valueInKRW = convertBetween(totalValue, crypto.currency, 'KRW');
  const gainInUSD = convertBetween(gain, crypto.currency, 'USD');

  const handleUpdate = (field: keyof CryptoUpdate, value: string) => {
    const numericFields = ['quantity', 'buy_price', 'current_price'];
    if (numericFields.includes(field)) {
      const num = parseFloat(value) || 0;
      onUpdate(crypto.id, { [field]: num });
    } else {
      onUpdate(crypto.id, { [field]: value });
    }
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-50 hover:bg-gray-100/60 transition-colors group"
    >
      <td className="py-1.5 px-1 w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>
      </td>
      <td className="py-1.5 px-2 w-20">
        <EditableCell
          ref={symbolRef}
          value={crypto.symbol}
          onSave={(v) => handleUpdate('symbol', v)}
          placeholder="BTC"
          autoFocus={isNew}
          className="font-medium uppercase"
          onTab={() => nameRef.current?.activate()}
          onShiftTab={() => {}}
        />
      </td>
      <td className="py-1.5 px-2">
        <EditableCell
          ref={nameRef}
          value={crypto.name || ''}
          onSave={(v) => handleUpdate('name', v)}
          placeholder="Bitcoin"
          onTab={() => currencyRef.current?.activate()}
          onShiftTab={() => symbolRef.current?.activate()}
        />
      </td>
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          ref={currencyRef}
          value={crypto.currency}
          options={currencyOptions.map((c) => ({ value: c.value, label: c.value }))}
          onSave={(v) => onUpdate(crypto.id, { currency: v })}
          onTab={() => qtyRef.current?.activate()}
          onShiftTab={() => nameRef.current?.activate()}
        />
      </td>
      <td className="py-1.5 px-2 w-24">
        <EditableCell
          ref={qtyRef}
          value={crypto.quantity}
          onSave={(v) => handleUpdate('quantity', v)}
          type="number"
          min={0}
          displayValue={formatNumber(crypto.quantity, 8)}
          onTab={() => buyPriceRef.current?.activate()}
          onShiftTab={() => currencyRef.current?.activate()}
        />
      </td>
      <td className="py-1.5 px-2 w-28">
        <EditableCell
          ref={buyPriceRef}
          value={crypto.buy_price}
          onSave={(v) => handleUpdate('buy_price', v)}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(crypto.buy_price, crypto.currency)}
          onTab={() => currentPriceRef.current?.activate()}
          onShiftTab={() => qtyRef.current?.activate()}
        />
      </td>
      <td className="py-1.5 px-2 w-28">
        <EditableCell
          ref={currentPriceRef}
          value={crypto.current_price}
          onSave={(v) => handleUpdate('current_price', v)}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(crypto.current_price, crypto.currency)}
          onTab={() => {}}
          onShiftTab={() => buyPriceRef.current?.activate()}
        />
      </td>
      <td className="py-1.5 px-2 w-28 text-right text-sm tabular-nums">
        {formatCurrencyValue(valueInUSD, 'USD')}
      </td>
      <td className="py-1.5 px-2 w-32 text-right text-sm tabular-nums">
        {formatCurrencyValue(valueInKRW, 'KRW')}
      </td>
      <td className="py-1.5 px-2 w-28 text-right text-sm tabular-nums">
        <span className={gain >= 0 ? 'text-red-500' : 'text-blue-500'}>
          {gainInUSD >= 0 ? '+' : ''}{formatCurrencyValue(gainInUSD, 'USD')}
          <span className="text-xs ml-1 opacity-60">
            ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
          </span>
        </span>
      </td>
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(crypto.id); setConfirming(false); }}
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
