import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { useSharedStocks } from '@/hooks/DataContext';
import { useFamilyContext } from '@/hooks/FamilyContext';
import { PerformanceSkeleton } from '@/components/ui/Skeleton';
import type { AccountType } from '@/types/stock';
import type { Dividend } from '@/types/dividend';

interface StockPerformanceProps {
  accountType: AccountType;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type WithMemberId = { member_id?: string | null };

function filterByMember<T extends WithMemberId>(items: T[], memberId: string | 'all'): T[] {
  if (memberId === 'all') return items;
  return items.filter((item) => item.member_id === memberId);
}

export default function StockPerformance({ accountType }: StockPerformanceProps) {
  const { stocks, loading: stocksLoading } = useSharedStocks(accountType);
  const { activeMemberId } = useFamilyContext();
  const [allDividends, setAllDividends] = useState<Dividend[]>([]);
  const [dividendsLoading, setDividendsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { convertBetween } = useCurrencyContext();

  const dividends = useMemo(
    () => filterByMember(allDividends, activeMemberId),
    [allDividends, activeMemberId],
  );

  const fetchDividends = useCallback(async () => {
    const { data, error } = await supabase
      .from('dividends')
      .select('*')
      .order('received_date', { ascending: true });

    if (!error && data) setAllDividends(data);
    setDividendsLoading(false);
  }, []);

  useEffect(() => {
    fetchDividends();
  }, [fetchDividends]);

  const loading = stocksLoading || dividendsLoading;

  // Filter stocks with actual tickers
  const validStocks = useMemo(
    () => stocks.filter((s) => s.ticker.trim()),
    [stocks],
  );

  // Group dividends by stock_id, filtered by selected year
  const dividendsByStock = useMemo(() => {
    const map: Record<string, Dividend[]> = {};
    for (const d of dividends) {
      const year = new Date(d.received_date + 'T00:00:00').getFullYear();
      if (year !== selectedYear) continue;
      if (!map[d.stock_id]) map[d.stock_id] = [];
      map[d.stock_id].push(d);
    }
    return map;
  }, [dividends, selectedYear]);

  // Available years from dividend data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const d of dividends) {
      years.add(new Date(d.received_date + 'T00:00:00').getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [dividends]);

  // All-time dividends by stock (for cumulative metrics)
  const allTimeDividendsByStock = useMemo(() => {
    const map: Record<string, Dividend[]> = {};
    for (const d of dividends) {
      if (!map[d.stock_id]) map[d.stock_id] = [];
      map[d.stock_id].push(d);
    }
    return map;
  }, [dividends]);

  // Per-stock metrics — all values in the stock's NATIVE currency
  const stockMetrics = useMemo(() => {
    return validStocks.map((stock) => {
      const stockDividends = dividendsByStock[stock.id] || [];
      const allTimeDividends = allTimeDividendsByStock[stock.id] || [];
      const ccy = stock.currency; // native currency for this stock

      // Investment cost (native currency)
      const investmentCost = stock.quantity * stock.buy_price;
      // Current value (native currency)
      const currentValue = stock.quantity * stock.current_price;
      // Stock gain/loss (native currency)
      const stockGain = currentValue - investmentCost;
      // Price return %
      const priceReturnPct = investmentCost > 0 ? (stockGain / investmentCost) * 100 : 0;

      // Monthly dividends (net after foreign tax) — convert to stock's native currency
      const monthlyDividends = Array(12).fill(0);
      let annualDividendTotal = 0;
      let annualForeignTax = 0;

      for (const d of stockDividends) {
        const month = new Date(d.received_date + 'T00:00:00').getMonth();
        const net = d.amount - d.foreign_tax;
        // Convert dividend to the stock's native currency
        const netInNative = convertBetween(net, d.currency, ccy);
        monthlyDividends[month] += netInNative;
        annualDividendTotal += netInNative;
        annualForeignTax += convertBetween(d.foreign_tax, d.currency, ccy);
      }

      // Cumulative (all-time) dividends
      let cumulativeDividendTotal = 0;
      for (const d of allTimeDividends) {
        const net = d.amount - d.foreign_tax;
        cumulativeDividendTotal += convertBetween(net, d.currency, ccy);
      }

      // YoC (Yield on Cost) = annual dividends / investment cost
      const yoc = investmentCost > 0 ? (annualDividendTotal / investmentCost) * 100 : 0;

      // RoC (Return of Capital) = annual dividends / investment cost
      const roc = investmentCost > 0 ? (annualDividendTotal / investmentCost) * 100 : 0;

      // Cumulative RoC = all-time dividends / investment cost
      const cumulativeRoc = investmentCost > 0 ? (cumulativeDividendTotal / investmentCost) * 100 : 0;

      // Total Revenue = stock gain + dividends (all in native currency)
      const totalRevenue = stockGain + annualDividendTotal;

      // Cumulative Total Revenue = stock gain + all-time dividends
      const cumulativeTotalRevenue = stockGain + cumulativeDividendTotal;

      // TR (Total Return %) = total revenue / investment cost
      const trPct = investmentCost > 0 ? (totalRevenue / investmentCost) * 100 : 0;

      // Cumulative TR % = cumulative total revenue / investment cost
      const cumulativeTrPct = investmentCost > 0 ? (cumulativeTotalRevenue / investmentCost) * 100 : 0;

      return {
        stock,
        ccy,
        investmentCost,
        currentValue,
        stockGain,
        priceReturnPct,
        monthlyDividends,
        annualDividendTotal,
        annualForeignTax,
        cumulativeDividendTotal,
        yoc,
        roc,
        cumulativeRoc,
        totalRevenue,
        cumulativeTotalRevenue,
        trPct,
        cumulativeTrPct,
      };
    });
  }, [validStocks, dividendsByStock, allTimeDividendsByStock, convertBetween]);

  // Sort: stocks with dividends first (left), without dividends last (right)
  const sortedMetrics = useMemo(() => {
    return [...stockMetrics].sort((a, b) => {
      const aHas = a.annualDividendTotal > 0 ? 0 : 1;
      const bHas = b.annualDividendTotal > 0 ? 0 : 1;
      return aHas - bHas;
    });
  }, [stockMetrics]);

  // Find which months have any data across all stocks
  const activeMonths = useMemo(() => {
    const months = new Set<number>();
    for (const m of sortedMetrics) {
      for (let i = 0; i < 12; i++) {
        if (m.monthlyDividends[i] > 0) months.add(i);
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [stockMetrics]);

  if (loading) {
    return <PerformanceSkeleton />;
  }

  if (validStocks.length === 0) return null;

  return (
    <div className="mt-14 pt-6 border-t border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-[var(--color-text)]">Stock Performance Summary</h3>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="text-[12px] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer transition-colors duration-200"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider sticky left-0 bg-[var(--color-bg)] z-10 min-w-[160px] relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">
                Metric
              </th>
              {sortedMetrics.map((m) => {
                // Korean tickers start with digits (e.g. 005930.KS) — show short name instead
                const isNumericTicker = /^\d/.test(m.stock.ticker);
                const label = isNumericTicker && m.stock.name
                  ? m.stock.name.length > 8 ? m.stock.name.slice(0, 8) + '…' : m.stock.name
                  : m.stock.ticker;
                return (
                  <th
                    key={m.stock.id}
                    className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider text-right min-w-[120px]"
                    title={`${m.stock.ticker}${m.stock.name ? ` — ${m.stock.name}` : ''}`}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Investment Cost */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Investment Cost</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-text)]">
                  {formatCurrencyValue(m.investmentCost, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Current Value */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Current Value</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-text)]">
                  {formatCurrencyValue(m.currentValue, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Quantity */}
            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg-sidebar)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Quantity</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-text)]">
                  {m.stock.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </td>
              ))}
            </tr>

            {/* Monthly Dividends Header */}
            {activeMonths.length > 0 && (
              <>
                <tr className="border-b border-[var(--color-border)] bg-green-50">
                  <td className="py-1.5 px-3 text-[var(--color-text-secondary)] font-medium sticky left-0 bg-green-50 z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Monthly Dividends</td>
                  {sortedMetrics.map((m) => (
                    <td key={m.stock.id} className="py-1.5 px-3" />
                  ))}
                </tr>
                {activeMonths.map((monthIdx) => (
                  <tr key={monthIdx} className="border-b border-[var(--color-border-light)]">
                    <td className="py-1 px-3 text-[var(--color-text-muted)] text-[11px] pl-6 sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">
                      {MONTH_LABELS[monthIdx]}
                    </td>
                    {sortedMetrics.map((m) => (
                      <td key={m.stock.id} className="py-1 px-3 text-right tabular-nums text-[var(--color-text-secondary)] text-[11px]">
                        {m.monthlyDividends[monthIdx] > 0
                          ? formatCurrencyValue(m.monthlyDividends[monthIdx], m.ccy)
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}

            {/* Annual Total Dividends */}
            <tr className="border-b border-[var(--color-border)] bg-green-100">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] font-medium sticky left-0 bg-green-100 z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Annual Dividends</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums font-medium text-[var(--color-positive)]">
                  {formatCurrencyValue(m.annualDividendTotal, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Stock Gain/Loss */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Stock Gain/Loss</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className={`py-1.5 px-3 text-right tabular-nums ${m.stockGain >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.stockGain >= 0 ? '+' : ''}{formatCurrencyValue(m.stockGain, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Price Return % */}
            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg-sidebar)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Price Return %</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className={`py-1.5 px-3 text-right tabular-nums font-medium ${m.priceReturnPct >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.priceReturnPct >= 0 ? '+' : ''}{m.priceReturnPct.toFixed(2)}%
                </td>
              ))}
            </tr>

            {/* YoC */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">YoC (Yield on Cost)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-positive)]">
                  {m.yoc.toFixed(2)}%
                </td>
              ))}
            </tr>

            {/* RoC */}
            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg-sidebar)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">RoC (Annual)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-positive)]">
                  {m.roc.toFixed(2)}%
                </td>
              ))}
            </tr>

            {/* Total Revenue (Annual) */}
            <tr className="border-b border-[var(--color-border)] bg-slate-100">
              <td className="py-2 px-3 text-[var(--color-text)] font-medium sticky left-0 bg-slate-100 z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-slate-300">Total Revenue (Annual)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className={`py-2 px-3 text-right tabular-nums font-semibold ${m.totalRevenue >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.totalRevenue >= 0 ? '+' : ''}{formatCurrencyValue(m.totalRevenue, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Cumulative Section Header */}
            <tr className="border-b border-[var(--color-border)] bg-violet-50">
              <td className="py-1.5 px-3 text-violet-700 font-medium sticky left-0 bg-violet-50 z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Cumulative (All-Time)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3" />
              ))}
            </tr>

            {/* Cumulative Dividends */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] pl-6 sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Total Dividends</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-[var(--color-positive)] font-medium">
                  {formatCurrencyValue(m.cumulativeDividendTotal, m.ccy)}
                </td>
              ))}
            </tr>

            {/* Cumulative RoC */}
            <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-sidebar)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] pl-6 sticky left-0 bg-[var(--color-bg-sidebar)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">RoC (Cumulative)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className="py-1.5 px-3 text-right tabular-nums text-violet-600 font-medium">
                  {m.cumulativeRoc.toFixed(2)}%
                </td>
              ))}
            </tr>

            {/* Cumulative TR % */}
            <tr className="border-b border-[var(--color-border-light)]">
              <td className="py-1.5 px-3 text-[var(--color-text-secondary)] pl-6 sticky left-0 bg-[var(--color-bg)] z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-[var(--color-border)]">Total Return %</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className={`py-1.5 px-3 text-right tabular-nums font-medium ${m.cumulativeTrPct >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.cumulativeTrPct >= 0 ? '+' : ''}{m.cumulativeTrPct.toFixed(2)}%
                </td>
              ))}
            </tr>

            {/* Cumulative Total Revenue */}
            <tr className="border-t-2 border-[var(--color-border)] bg-violet-100">
              <td className="py-2 px-3 text-[var(--color-text)] font-semibold sticky left-0 bg-violet-100 z-10 relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-slate-300">Total Revenue (All-Time)</td>
              {sortedMetrics.map((m) => (
                <td key={m.stock.id} className={`py-2 px-3 text-right tabular-nums font-bold text-base ${m.cumulativeTotalRevenue >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {m.cumulativeTotalRevenue >= 0 ? '+' : ''}{formatCurrencyValue(m.cumulativeTotalRevenue, m.ccy)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
