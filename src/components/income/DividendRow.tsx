import { useState, useRef } from 'react';
import EditableCell, { type EditableCellHandle } from '@/components/ui/EditableCell';
import SelectCell, { type SelectCellHandle } from '@/components/ui/SelectCell';
import DatePickerCell, { type DatePickerCellHandle } from '@/components/ui/DatePickerCell';
import { formatCurrencyValue, currencyOptions } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Dividend, DividendUpdate } from '@/types/dividend';
import type { Stock } from '@/types/stock';

interface DividendRowProps {
  dividend: Dividend;
  stocks: Stock[];
  onUpdate: (id: string, updates: DividendUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

export default function DividendRow({ dividend, stocks, onUpdate, onDelete, isNew }: DividendRowProps) {
  const [confirming, setConfirming] = useState(false);
  const { convert, displayCurrency } = useCurrencyContext();

  // Refs for Tab navigation: Date → Stock → Currency → DPS → Amount → ForeignTax → Notes
  const dateRef = useRef<DatePickerCellHandle>(null);
  const stockRef = useRef<SelectCellHandle>(null);
  const currencyRef = useRef<SelectCellHandle>(null);
  const dpsRef = useRef<EditableCellHandle>(null);
  const amountRef = useRef<EditableCellHandle>(null);
  const foreignTaxRef = useRef<EditableCellHandle>(null);
  const notesRef = useRef<EditableCellHandle>(null);

  const refs = [dateRef, stockRef, currencyRef, dpsRef, amountRef, foreignTaxRef, notesRef];

  const goTo = (index: number) => {
    if (index >= 0 && index < refs.length) {
      refs[index].current?.activate();
    }
  };

  const netAmount = dividend.amount - dividend.foreign_tax;
  const displayNet = convert(netAmount, dividend.currency);

  const stockOptions = stocks
    .filter((s) => s.ticker.trim())
    .map((s) => ({
      value: s.id,
      label: `${s.ticker}${s.name ? ` (${s.name})` : ''}${s.account_type !== 'general' ? ` [${s.account_type.toUpperCase()}]` : ''}`,
    }));

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-100/60 transition-colors group">
      {/* 0: Date */}
      <td className="py-1.5 px-2 w-32">
        <DatePickerCell
          ref={dateRef}
          value={dividend.received_date}
          onSave={(v) => onUpdate(dividend.id, { received_date: v })}
          autoFocus={isNew}
          onTab={() => goTo(1)}
          onShiftTab={() => {}}
        />
      </td>
      {/* 1: Stock */}
      <td className="py-1.5 px-2">
        <SelectCell
          ref={stockRef}
          value={dividend.stock_id}
          options={stockOptions}
          onSave={(v) => onUpdate(dividend.id, { stock_id: v })}
          onTab={() => goTo(2)}
          onShiftTab={() => goTo(0)}
        />
      </td>
      {/* 2: Currency */}
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          ref={currencyRef}
          value={dividend.currency}
          options={currencyOptions.map((c) => ({ value: c.value, label: c.value }))}
          onSave={(v) => onUpdate(dividend.id, { currency: v })}
          onTab={() => goTo(3)}
          onShiftTab={() => goTo(1)}
        />
      </td>
      {/* 3: DPS */}
      <td className="py-1.5 px-2 w-24">
        <EditableCell
          ref={dpsRef}
          value={dividend.dps}
          onSave={(v) => onUpdate(dividend.id, { dps: parseFloat(v) || 0 })}
          type="number"
          min={0}
          placeholder="0"
          displayValue={formatCurrencyValue(dividend.dps, dividend.currency)}
          onTab={() => goTo(4)}
          onShiftTab={() => goTo(2)}
        />
      </td>
      {/* 4: Amount */}
      <td className="py-1.5 px-2 w-28">
        <EditableCell
          ref={amountRef}
          value={dividend.amount}
          onSave={(v) => onUpdate(dividend.id, { amount: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(dividend.amount, dividend.currency)}
          onTab={() => goTo(5)}
          onShiftTab={() => goTo(3)}
        />
      </td>
      {/* 5: Foreign Tax */}
      <td className="py-1.5 px-2 w-28">
        <EditableCell
          ref={foreignTaxRef}
          value={dividend.foreign_tax}
          onSave={(v) => onUpdate(dividend.id, { foreign_tax: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(dividend.foreign_tax, dividend.currency)}
          onTab={() => goTo(6)}
          onShiftTab={() => goTo(4)}
        />
      </td>
      {/* Net (read-only) */}
      <td className="py-1.5 px-2 w-28 text-right text-sm tabular-nums font-medium text-gray-700">
        {formatCurrencyValue(netAmount, dividend.currency)}
      </td>
      {/* In displayCurrency (read-only) */}
      <td className="py-1.5 px-2 w-28 text-right text-sm tabular-nums text-gray-400">
        {dividend.currency !== displayCurrency && formatCurrencyValue(displayNet, displayCurrency)}
      </td>
      {/* 6: Notes */}
      <td className="py-1.5 px-2">
        <EditableCell
          ref={notesRef}
          value={dividend.notes || ''}
          onSave={(v) => onUpdate(dividend.id, { notes: v || null })}
          placeholder="Notes"
          className="text-gray-400"
          onTab={() => {}}
          onShiftTab={() => goTo(5)}
        />
      </td>
      {/* Delete */}
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(dividend.id); setConfirming(false); }}
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
