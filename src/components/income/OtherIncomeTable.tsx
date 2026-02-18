import { useState, useMemo } from 'react';
import OtherIncomeRow from './OtherIncomeRow';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { OtherIncome, OtherIncomeUpdate } from '@/types/income';

interface OtherIncomeTableProps {
  incomes: OtherIncome[];
  onAdd: () => Promise<OtherIncome | null>;
  onUpdate: (id: string, updates: OtherIncomeUpdate) => void;
  onDelete: (id: string) => void;
}

export default function OtherIncomeTable({
  incomes,
  onAdd,
  onUpdate,
  onDelete,
}: OtherIncomeTableProps) {
  const [newId, setNewId] = useState<string | null>(null);
  const { convert, displayCurrency } = useCurrencyContext();

  const totalConverted = useMemo(() => {
    return incomes.reduce((sum, i) => sum + convert(i.amount, i.currency), 0);
  }, [incomes, convert]);

  const handleAdd = async () => {
    const income = await onAdd();
    if (income) setNewId(income.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Other Income</h3>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Income
        </button>
      </div>

      {incomes.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          No income recorded yet. Click + Add Income to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Ccy</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">In {displayCurrency}</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <OtherIncomeRow
                  key={income.id}
                  income={income}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isNew={income.id === newId}
                />
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-gray-200 text-right text-sm text-gray-500">
            Total Income: <span className="tabular-nums font-medium text-gray-700">{formatCurrencyValue(totalConverted, displayCurrency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
