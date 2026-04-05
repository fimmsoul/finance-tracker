import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { Dividend } from '@/types/dividend';

interface DpsTrendsChartProps {
  dividends: Dividend[];
}

const COLORS: Record<string, string> = {
  blue: '#2563EB',
  slate: '#475569',
  amber: '#D97706',
  red: '#DC2626',
  violet: '#7C3AED',
  teal: '#0D9488',
  cyan: '#0891B2',
  green: '#16A34A',
};

const COLOR_LIST = Object.values(COLORS);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  KRW: '₩',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
};

function formatCurrency(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  if (currency === 'KRW') {
    return `${symbol}${Math.round(value).toLocaleString()}`;
  }
  return `${symbol}${value.toFixed(4)}`;
}

function formatCurrencyShort(value: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  if (currency === 'KRW') {
    return `${symbol}${Math.round(value).toLocaleString()}`;
  }
  return `${symbol}${value.toFixed(2)}`;
}

export default function DpsTrendsChart({ dividends }: DpsTrendsChartProps) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Get unique tickers with DPS data, their chart data, currency, and name
  const { tickerData, tickerCurrency, tickerName } = useMemo(() => {
    const dataByTicker: Record<string, { date: string; dps: number }[]> = {};
    const currencyByTicker: Record<string, string> = {};
    const nameByTicker: Record<string, string> = {};

    dividends.forEach((d) => {
      if (!d.ticker || d.dps <= 0) return;

      if (!dataByTicker[d.ticker]) {
        dataByTicker[d.ticker] = [];
        currencyByTicker[d.ticker] = d.currency;
        nameByTicker[d.ticker] = d.stock_name || d.ticker;
      }
      dataByTicker[d.ticker].push({
        date: d.received_date,
        dps: d.dps,
      });
    });

    // Sort each ticker's data by date
    Object.keys(dataByTicker).forEach((ticker) => {
      dataByTicker[ticker].sort((a, b) => a.date.localeCompare(b.date));
    });

    return { tickerData: dataByTicker, tickerCurrency: currencyByTicker, tickerName: nameByTicker };
  }, [dividends]);

  // Helper to get display label for a ticker
  const getTickerLabel = (ticker: string): string => {
    const isKoreanTicker = /^\d/.test(ticker);
    if (isKoreanTicker && tickerName[ticker]) {
      const name = tickerName[ticker];
      return name.length > 8 ? name.slice(0, 8) + '…' : name;
    }
    return ticker;
  };

  const tickers = useMemo(() => Object.keys(tickerData).sort(), [tickerData]);

  // Set initial selected ticker
  const activeTicker = selectedTicker && tickers.includes(selectedTicker)
    ? selectedTicker
    : tickers[0] || null;

  const chartData = activeTicker ? tickerData[activeTicker] : [];
  const activeCurrency = activeTicker ? tickerCurrency[activeTicker] : 'USD';

  // Calculate average DPS for reference line
  const avgDps = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((sum, d) => sum + d.dps, 0) / chartData.length;
  }, [chartData]);

  // Calculate DPS change percentage
  const dpsChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].dps;
    const last = chartData[chartData.length - 1].dps;
    return ((last - first) / first) * 100;
  }, [chartData]);

  if (tickers.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)] text-[13px]">
        No dividend DPS data to display
      </div>
    );
  }

  const colorIndex = activeTicker ? tickers.indexOf(activeTicker) % COLOR_LIST.length : 0;
  const activeColor = COLOR_LIST[colorIndex];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {activeTicker && chartData.length > 0 && (
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-[var(--color-text-secondary)]">
              Avg: <span className="font-medium text-[var(--color-text)]">{formatCurrency(avgDps, activeCurrency)}</span>
            </span>
            {dpsChange !== null && (
              <span className={dpsChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
                {dpsChange >= 0 ? '+' : ''}{dpsChange.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ticker tabs - segment control style */}
      <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-[var(--color-bg-sidebar)] rounded-lg">
        {tickers.map((ticker, i) => {
          const isActive = ticker === activeTicker;
          const label = getTickerLabel(ticker);
          const fullName = tickerName[ticker] || ticker;
          return (
            <button
              key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              title={`${ticker}${fullName !== ticker ? ` — ${fullName}` : ''}`}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-[var(--color-text)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/50'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getFullYear().toString().slice(2)}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
              }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              tickFormatter={(val) => formatCurrencyShort(val, activeCurrency)}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={{ stroke: 'var(--color-border)' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: 'var(--shadow-md)',
              }}
              formatter={(value) => [formatCurrency(value as number, activeCurrency), 'DPS']}
              labelFormatter={(label) => {
                const d = new Date(label);
                return d.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <ReferenceLine
              y={avgDps}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="dps"
              stroke={activeColor}
              strokeWidth={2.5}
              dot={{ r: 4, fill: activeColor, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: activeColor, strokeWidth: 2, stroke: 'white' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data points count */}
      <div className="mt-3 text-[11px] text-[var(--color-text-muted)] text-center">
        {chartData.length} dividend payment{chartData.length !== 1 ? 's' : ''} recorded
      </div>
    </div>
  );
}
