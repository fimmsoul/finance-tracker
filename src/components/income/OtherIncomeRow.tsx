import { useState, useRef } from 'react';
import EditableCell, { type EditableCellHandle } from '@/components/ui/EditableCell';
import SelectCell, { type SelectCellHandle } from '@/components/ui/SelectCell';
import DatePickerCell, { type DatePickerCellHandle } from '@/components/ui/DatePickerCell';
import { formatCurrencyValue, currencyOptions } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { OtherIncome, OtherIncomeUpdate, IncomeCategory } from '@/types/income';

const categoryOptions = [
  { value: 'rental', label: 'Rental' },
  { value: 'interest', label: 'Interest' },
  { value: 'royalty', label: 'Royalty' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'other', label: 'Other' },
];

interface OtherIncomeRowProps {
  income: OtherIncome;
  onUpdate: (id: string, updates: OtherIncomeUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

export default function OtherIncomeRow({ income, onUpdate, onDelete, isNew }: OtherIncomeRowProps) {
  const [confirming, setConfirming] = useState(false);
  const { convert, displayCurrency } = useCurrencyContext();

  // Refs for Tab navigation: Date -> Source -> Category -> Currency -> Amount -> Notes
  const dateRef = useRef<DatePickerCellHandle>(null);
  const sourceRef = useRef<EditableCellHandle>(null);
  const categoryRef = useRef<SelectCellHandle>(null);
  const currencyRef = useRef<SelectCellHandle>(null);
  const amountRef = useRef<EditableCellHandle>(null);
  const notesRef = useRef<EditableCellHandle>(null);

  const refs = [dateRef, sourceRef, categoryRef, currencyRef, amountRef, notesRef];

  const goTo = (index: number) => {
    if (index >= 0 && index < refs.length) {
      refs[index].current?.activate();
    }
  };

  const displayAmount = convert(income.amount, income.currency);

  return (
    <tr className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-sidebar)]/60 transition-colors duration-200 group">
      {/* 0: Date */}
      <td className="py-1.5 px-2 w-32">
        <DatePickerCell
          ref={dateRef}
          value={income.received_date}
          onSave={(v) => onUpdate(income.id, { received_date: v })}
          autoFocus={isNew}
          onTab={() => goTo(1)}
          onShiftTab={() => {}}
        />
      </td>
      {/* 1: Source */}
      <td className="py-1.5 px-2">
        <EditableCell
          ref={sourceRef}
          value={income.source}
          onSave={(v) => onUpdate(income.id, { source: v })}
          placeholder="Income source"
          onTab={() => goTo(2)}
          onShiftTab={() => goTo(0)}
        />
      </td>
      {/* 2: Category */}
      <td className="py-1.5 px-2 w-28">
        <SelectCell
          ref={categoryRef}
          value={income.category}
          options={categoryOptions}
          onSave={(v) => onUpdate(income.id, { category: v as IncomeCategory })}
          onTab={() => goTo(3)}
          onShiftTab={() => goTo(1)}
        />
      </td>
      {/* 3: Currency */}
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          ref={currencyRef}
          value={income.currency}
          options={currencyOptions.map((c) => ({ value: c.value, label: c.value }))}
          onSave={(v) => onUpdate(income.id, { currency: v })}
          onTab={() => goTo(4)}
          onShiftTab={() => goTo(2)}
        />
      </td>
      {/* 4: Amount */}
      <td className="py-1.5 px-2 w-32">
        <EditableCell
          ref={amountRef}
          value={income.amount}
          onSave={(v) => onUpdate(income.id, { amount: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(income.amount, income.currency)}
          onTab={() => goTo(5)}
          onShiftTab={() => goTo(3)}
        />
      </td>
      {/* In displayCurrency (read-only) */}
      <td className="py-1.5 px-2 w-28 text-right text-[13px] tabular-nums text-[var(--color-text-muted)]">
        {income.currency !== displayCurrency && formatCurrencyValue(displayAmount, displayCurrency)}
      </td>
      {/* 5: Notes */}
      <td className="py-1.5 px-2">
        <EditableCell
          ref={notesRef}
          value={income.notes || ''}
          onSave={(v) => onUpdate(income.id, { notes: v || null })}
          placeholder="Notes"
          className="text-[var(--color-text-muted)]"
          onTab={() => {}}
          onShiftTab={() => goTo(4)}
        />
      </td>
      {/* Delete */}
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(income.id); setConfirming(false); }}
              className="text-[12px] text-[var(--color-negative)] hover:text-red-700 cursor-pointer transition-colors duration-200"
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
