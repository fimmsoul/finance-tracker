import { useMemo } from 'react';
import { useDividends } from '@/hooks/useDividends';
import { useOtherIncomes } from '@/hooks/useOtherIncomes';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { formatCurrencyValue } from '@/lib/currency';
import DividendTable from './DividendTable';
import DividendsByStock from './DividendsByStock';
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
        <div className="w-5 h-5 border-2 border-blue-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-6 p-4 rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        <div>
          <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">Total Passive Income</div>
          <div className="text-xl font-semibold text-[var(--color-text)] tabular-nums mt-0.5">
            {formatCurrencyValue(totalAll, displayCurrency)}
          </div>
        </div>
        <div className="h-8 w-px bg-[var(--color-border)]" />
        <div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Dividends</div>
          <div className="text-[13px] font-medium text-[var(--color-text-secondary)] tabular-nums">
            {formatCurrencyValue(
              dividends.reduce((sum, d) => sum + convert(d.amount, d.currency), 0),
              displayCurrency
            )}
          </div>
        </div>
        <div className="h-8 w-px bg-[var(--color-border)]" />
        <div>
          <div className="text-[11px] text-[var(--color-text-muted)]">Other</div>
          <div className="text-[13px] font-medium text-[var(--color-text-secondary)] tabular-nums">
            {formatCurrencyValue(
              incomes.reduce((sum, i) => sum + convert(i.amount, i.currency), 0),
              displayCurrency
            )}
          </div>
        </div>
      </div>

      {/* Dividends by Stock summary */}
      {dividends.length > 0 && (
        <DividendsByStock dividends={dividends} stocks={stocks} />
      )}

      {/* Divider */}
      <div className="border-t border-[var(--color-border)]" />

      {/* Dividends section */}
      <DividendTable
        dividends={dividends}
        stocks={stocks}
        onAdd={addDividend}
        onUpdate={updateDividend}
        onDelete={deleteDividend}
      />

      {/* Divider */}
      <div className="border-t border-[var(--color-border)]" />

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
