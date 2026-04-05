import { useState, useRef } from 'react';
import EditableCell, { type EditableCellHandle } from '@/components/ui/EditableCell';
import SelectCell, { type SelectCellHandle } from '@/components/ui/SelectCell';
import DatePickerCell, { type DatePickerCellHandle } from '@/components/ui/DatePickerCell';
import { formatCurrencyValue } from '@/lib/currency';
import type { Transaction, TransactionUpdate, TransactionType } from '@/types/transaction';
import type { Stock } from '@/types/stock';

interface TransactionRowProps {
  transaction: Transaction;
  stocks: Stock[];
  onUpdate: (id: string, updates: TransactionUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

const typeOptions: { value: TransactionType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

export default function TransactionRow({ transaction, stocks, onUpdate, onDelete, isNew }: TransactionRowProps) {
  const [confirming, setConfirming] = useState(false);

  // Refs for Tab navigation: Date → Stock → Type → Qty → Price → Fees → ExRate → Notes
  const dateRef = useRef<DatePickerCellHandle>(null);
  const stockRef = useRef<SelectCellHandle>(null);
  const typeRef = useRef<SelectCellHandle>(null);
  const qtyRef = useRef<EditableCellHandle>(null);
  const priceRef = useRef<EditableCellHandle>(null);
  const feesRef = useRef<EditableCellHandle>(null);
  const exRateRef = useRef<EditableCellHandle>(null);
  const notesRef = useRef<EditableCellHandle>(null);

  const refs = [dateRef, stockRef, typeRef, qtyRef, priceRef, feesRef, exRateRef, notesRef];

  const goTo = (index: number) => {
    if (index >= 0 && index < refs.length) {
      refs[index].current?.activate();
    }
  };

  const totalValue = transaction.quantity * transaction.price_per_share + transaction.fees;
  const currency = transaction.currency || 'USD';

  // Show exchange rate field only for USD stocks
  const showExchangeRate = currency === 'USD';

  const stockOptions = stocks
    .filter((s) => s.ticker.trim())
    .map((s) => ({
      value: s.id,
      label: `${s.ticker}${s.name ? ` (${s.name})` : ''}`,
    }));

  return (
    <tr className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-border-light)]/60 transition-colors duration-200 group">
      {/* 0: Date */}
      <td className="py-1.5 px-2 w-32">
        <DatePickerCell
          ref={dateRef}
          value={transaction.transaction_date}
          onSave={(v) => onUpdate(transaction.id, { transaction_date: v })}
          autoFocus={isNew}
          onTab={() => goTo(1)}
          onShiftTab={() => {}}
        />
      </td>
      {/* 1: Stock */}
      <td className="py-1.5 px-2">
        <SelectCell
          ref={stockRef}
          value={transaction.stock_id}
          options={stockOptions}
          onSave={(v) => onUpdate(transaction.id, { stock_id: v })}
          onTab={() => goTo(2)}
          onShiftTab={() => goTo(0)}
        />
      </td>
      {/* 2: Type */}
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          ref={typeRef}
          value={transaction.type}
          options={typeOptions}
          onSave={(v) => onUpdate(transaction.id, { type: v as TransactionType })}
          onTab={() => goTo(3)}
          onShiftTab={() => goTo(1)}
        />
      </td>
      {/* 3: Quantity */}
      <td className="py-1.5 px-2 w-24">
        <EditableCell
          ref={qtyRef}
          value={transaction.quantity}
          onSave={(v) => onUpdate(transaction.id, { quantity: parseFloat(v) || 0 })}
          type="number"
          min={0}
          placeholder="0"
          displayValue={transaction.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          onTab={() => goTo(4)}
          onShiftTab={() => goTo(2)}
        />
      </td>
      {/* 4: Price per share */}
      <td className="py-1.5 px-2 w-28">
        <EditableCell
          ref={priceRef}
          value={transaction.price_per_share}
          onSave={(v) => onUpdate(transaction.id, { price_per_share: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(transaction.price_per_share, currency)}
          onTab={() => goTo(5)}
          onShiftTab={() => goTo(3)}
        />
      </td>
      {/* 5: Fees */}
      <td className="py-1.5 px-2 w-24">
        <EditableCell
          ref={feesRef}
          value={transaction.fees}
          onSave={(v) => onUpdate(transaction.id, { fees: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(transaction.fees, currency)}
          onTab={() => goTo(showExchangeRate ? 6 : 7)}
          onShiftTab={() => goTo(4)}
        />
      </td>
      {/* Total (read-only) */}
      <td className={`py-1.5 px-2 w-28 text-right text-[13px] tabular-nums font-medium ${transaction.type === 'buy' ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive)]'}`}>
        {formatCurrencyValue(totalValue, currency)}
      </td>
      {/* 6: Exchange Rate (only for USD) */}
      <td className="py-1.5 px-2 w-24">
        {showExchangeRate ? (
          <EditableCell
            ref={exRateRef}
            value={transaction.exchange_rate || ''}
            onSave={(v) => onUpdate(transaction.id, { exchange_rate: v ? parseFloat(v) : null })}
            type="number"
            min={0}
            placeholder="—"
            onTab={() => goTo(7)}
            onShiftTab={() => goTo(5)}
          />
        ) : (
          <span className="text-[11px] text-[var(--color-text-muted)]">&mdash;</span>
        )}
      </td>
      {/* 7: Notes */}
      <td className="py-1.5 px-2">
        <EditableCell
          ref={notesRef}
          value={transaction.notes || ''}
          onSave={(v) => onUpdate(transaction.id, { notes: v || null })}
          placeholder="Notes"
          className="text-[var(--color-text-muted)]"
          onTab={() => {}}
          onShiftTab={() => goTo(showExchangeRate ? 6 : 5)}
        />
      </td>
      {/* Delete */}
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(transaction.id); setConfirming(false); }}
              className="text-[12px] text-[var(--color-negative)] hover:text-[var(--color-negative)]/80 cursor-pointer transition-colors duration-200"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer transition-colors duration-200"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] transition-all duration-200 cursor-pointer"
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
