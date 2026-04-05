import { useMemo } from 'react';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { Dividend } from '@/types/dividend';
import type { Stock } from '@/types/stock';

interface DividendsByStockProps {
  dividends: Dividend[];
  stocks: Stock[];
}

interface StockSummary {
  stockId: string;
  ticker: string;
  name: string | null;
  accountType: string;
  currency: string;
  paymentCount: number;
  totalAmount: number;
  totalForeignTax: number;
  totalNet: number;
  avgDps: number;
  lastPaymentDate: string;
}

export default function DividendsByStock({ dividends, stocks }: DividendsByStockProps) {
  const { convert, displayCurrency } = useCurrencyContext();

  const { stockSummaries, grandTotalAmount, grandTotalTax, grandTotalNet } = useMemo(() => {
    const stockMap = new Map<string, Stock>();
    stocks.forEach((s) => stockMap.set(s.id, s));

    const summaries = new Map<string, StockSummary>();

    dividends.forEach((d) => {
      const stock = stockMap.get(d.stock_id);
      if (!summaries.has(d.stock_id)) {
        summaries.set(d.stock_id, {
          stockId: d.stock_id,
          ticker: stock?.ticker || d.ticker || '—',
          name: stock?.name || d.stock_name || null,
          accountType: stock?.account_type || 'general',
          currency: d.currency,
          paymentCount: 0,
          totalAmount: 0,
          totalForeignTax: 0,
          totalNet: 0,
          avgDps: 0,
          lastPaymentDate: '',
        });
      }

      const summary = summaries.get(d.stock_id)!;
      summary.paymentCount += 1;
      summary.totalAmount += d.amount;
      summary.totalForeignTax += d.foreign_tax;
      summary.totalNet += d.amount - d.foreign_tax;

      if (d.dps > 0) {
        summary.avgDps = summary.avgDps === 0
          ? d.dps
          : (summary.avgDps * (summary.paymentCount - 1) + d.dps) / summary.paymentCount;
      }

      if (!summary.lastPaymentDate || d.received_date > summary.lastPaymentDate) {
        summary.lastPaymentDate = d.received_date;
      }
    });

    // Sort by total net (highest first)
    const sorted = Array.from(summaries.values()).sort((a, b) => {
      const aConverted = convert(a.totalNet, a.currency);
      const bConverted = convert(b.totalNet, b.currency);
      return bConverted - aConverted;
    });

    const totalAmount = sorted.reduce((sum, s) => sum + convert(s.totalAmount, s.currency), 0);
    const totalTax = sorted.reduce((sum, s) => sum + convert(s.totalForeignTax, s.currency), 0);
    const totalNet = sorted.reduce((sum, s) => sum + convert(s.totalNet, s.currency), 0);

    return { stockSummaries: sorted, grandTotalAmount: totalAmount, grandTotalTax: totalTax, grandTotalNet: totalNet };
  }, [dividends, stocks, convert]);

  if (stockSummaries.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-base font-medium text-[var(--color-text)] mb-3">Dividends by Stock</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Stock</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Payments</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Avg DPS</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Last Payment</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Amount</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Foreign Tax</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Net</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">In {displayCurrency}</th>
              <th className="py-2 px-2 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {stockSummaries.map((summary) => {
              const convertedNet = convert(summary.totalNet, summary.currency);
              const percentage = grandTotalNet > 0 ? (convertedNet / grandTotalNet) * 100 : 0;

              return (
                <tr
                  key={summary.stockId}
                  className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-sidebar)]/50 transition-colors duration-200"
                >
                  {/* Stock */}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--color-text)]">{summary.ticker}</span>
                      {summary.name && (
                        <span className="text-[12px] text-[var(--color-text-muted)] hidden sm:inline">{summary.name}</span>
                      )}
                      {summary.accountType !== 'general' && (
                        <span className="text-[11px] px-1 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded">
                          {summary.accountType.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Payment count */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-secondary)] text-right tabular-nums">
                    {summary.paymentCount}
                  </td>
                  {/* Avg DPS */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-secondary)] text-right tabular-nums">
                    {summary.avgDps > 0 ? formatCurrencyValue(summary.avgDps, summary.currency) : '—'}
                  </td>
                  {/* Last payment date */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-secondary)]">
                    {summary.lastPaymentDate || '—'}
                  </td>
                  {/* Amount */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-secondary)] text-right tabular-nums">
                    {formatCurrencyValue(summary.totalAmount, summary.currency)}
                  </td>
                  {/* Foreign Tax */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-muted)] text-right tabular-nums">
                    {summary.totalForeignTax > 0 ? formatCurrencyValue(summary.totalForeignTax, summary.currency) : '—'}
                  </td>
                  {/* Net */}
                  <td className="py-2 px-2 text-[13px] font-medium text-[var(--color-text)] text-right tabular-nums">
                    {formatCurrencyValue(summary.totalNet, summary.currency)}
                  </td>
                  {/* Net in display currency */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-muted)] text-right tabular-nums">
                    {summary.currency !== displayCurrency && formatCurrencyValue(convertedNet, displayCurrency)}
                  </td>
                  {/* Percentage */}
                  <td className="py-2 px-2 text-[13px] text-[var(--color-text-muted)] text-right tabular-nums">
                    {percentage.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex justify-end gap-6 text-[13px] text-[var(--color-text-secondary)]">
          <span>Amount: <span className="tabular-nums font-medium text-[var(--color-text-secondary)]">{formatCurrencyValue(grandTotalAmount, displayCurrency)}</span></span>
          <span>Tax: <span className="tabular-nums font-medium text-[var(--color-text-secondary)]">{formatCurrencyValue(grandTotalTax, displayCurrency)}</span></span>
          <span>Net: <span className="tabular-nums font-medium text-[var(--color-text)]">{formatCurrencyValue(grandTotalNet, displayCurrency)}</span></span>
        </div>
      </div>
    </div>
  );
}
