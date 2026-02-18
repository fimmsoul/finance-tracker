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
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  lime: '#84cc16',
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
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
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
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              Avg: <span className="font-medium text-gray-700">{formatCurrency(avgDps, activeCurrency)}</span>
            </span>
            {dpsChange !== null && (
              <span className={dpsChange >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                {dpsChange >= 0 ? '+' : ''}{dpsChange.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ticker tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-gray-100">
        {tickers.map((ticker, i) => {
          const isActive = ticker === activeTicker;
          const color = COLOR_LIST[i % COLOR_LIST.length];
          const label = getTickerLabel(ticker);
          const fullName = tickerName[ticker] || ticker;
          return (
            <button
              key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              title={`${ticker}${fullName !== ticker ? ` — ${fullName}` : ''}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              style={isActive ? { backgroundColor: color } : undefined}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getFullYear().toString().slice(2)}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
              }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(val) => formatCurrencyShort(val, activeCurrency)}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
              stroke="#9ca3af"
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
      <div className="mt-3 text-xs text-gray-400 text-center">
        {chartData.length} dividend payment{chartData.length !== 1 ? 's' : ''} recorded
      </div>
    </div>
  );
}
