import { useState } from 'react';
import EditableCell from '@/components/ui/EditableCell';
import SelectCell from '@/components/ui/SelectCell';
import { formatCurrencyValue, currencyOptions } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { CashAccount, CashAccountUpdate } from '@/types/cash';

const typeOptions = [
  { value: 'bank', label: 'Bank' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'money_market', label: 'Money Market' },
];

interface CashRowProps {
  account: CashAccount;
  onUpdate: (id: string, updates: CashAccountUpdate) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

export default function CashRow({ account, onUpdate, onDelete, isNew }: CashRowProps) {
  const [confirming, setConfirming] = useState(false);
  const { convert, displayCurrency } = useCurrencyContext();

  const displayBalance = convert(account.balance, account.currency);

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-100/60 transition-colors group">
      <td className="py-1.5 px-2">
        <EditableCell
          value={account.name}
          onSave={(v) => onUpdate(account.id, { name: v })}
          placeholder="Account name"
          autoFocus={isNew}
        />
      </td>
      <td className="py-1.5 px-2 w-32">
        <SelectCell
          value={account.type}
          options={typeOptions}
          onSave={(v) => onUpdate(account.id, { type: v as CashAccount['type'] })}
        />
      </td>
      <td className="py-1.5 px-2 w-20">
        <SelectCell
          value={account.currency}
          options={currencyOptions.map((c) => ({ value: c.value, label: c.value }))}
          onSave={(v) => onUpdate(account.id, { currency: v })}
        />
      </td>
      <td className="py-1.5 px-2 w-36">
        <EditableCell
          value={account.balance}
          onSave={(v) => onUpdate(account.id, { balance: parseFloat(v) || 0 })}
          type="number"
          min={0}
          displayValue={formatCurrencyValue(account.balance, account.currency)}
        />
      </td>
      <td className="py-1.5 px-2 w-32 text-right text-sm tabular-nums text-gray-400">
        {account.currency !== displayCurrency && formatCurrencyValue(displayBalance, displayCurrency)}
      </td>
      <td className="py-1.5 px-2">
        <EditableCell
          value={account.notes || ''}
          onSave={(v) => onUpdate(account.id, { notes: v || null })}
          placeholder="Notes"
          className="text-gray-400"
        />
      </td>
      <td className="py-1.5 px-2 w-10">
        {confirming ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(account.id); setConfirming(false); }}
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
