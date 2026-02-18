import { useMemo } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { useOtherIncomes } from '@/hooks/useOtherIncomes';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { formatCurrencyValue } from '@/lib/currency';
import DividendTable from './DividendTable';
import OtherIncomeTable from './OtherIncomeTable';

export default function IncomeView() {
  const {
    dividends,
    stocks,
    loading: dividendsLoading,
    addDividend,
    updateDividend,
    deleteDividend,
  } = useDividends();
  const {
    incomes,
    loading: incomesLoading,
    addIncome,
    updateIncome,
    deleteIncome,
  } = useOtherIncomes();
  const { convert, displayCurrency } = useCurrencyContext();

  const totalAll = useMemo(() => {
    const divTotal = dividends.reduce((sum, d) => sum + convert(d.amount, d.currency), 0);
    const incTotal = incomes.reduce((sum, i) => sum + convert(i.amount, i.currency), 0);
    return divTotal + incTotal;
  }, [dividends, incomes, convert]);

  if (dividendsLoading || incomesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-6 p-4 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-lg border border-gray-100">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Total Passive Income</div>
          <div className="text-xl font-semibold text-gray-900 tabular-nums mt-0.5">
            {formatCurrencyValue(totalAll, displayCurrency)}
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div>
          <div className="text-xs text-gray-400">Dividends</div>
          <div className="text-sm font-medium text-gray-700 tabular-nums">
            {formatCurrencyValue(
              dividends.reduce((sum, d) => sum + convert(d.amount, d.currency), 0),
              displayCurrency
            )}
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div>
          <div className="text-xs text-gray-400">Other</div>
          <div className="text-sm font-medium text-gray-700 tabular-nums">
            {formatCurrencyValue(
              incomes.reduce((sum, i) => sum + convert(i.amount, i.currency), 0),
              displayCurrency
            )}
          </div>
        </div>
      </div>

      {/* Dividends section */}
      <DividendTable
        dividends={dividends}
        stocks={stocks}
        onAdd={addDividend}
        onUpdate={updateDividend}
        onDelete={deleteDividend}
      />

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Other Income section */}
      <OtherIncomeTable
        incomes={incomes}
        onAdd={addIncome}
        onUpdate={updateIncome}
        onDelete={deleteIncome}
      />
    </div>
  );
}
