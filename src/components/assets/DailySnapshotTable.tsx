import { useRef, useEffect, useState } from 'react';
import { formatCurrencyValue } from '@/lib/currency';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import type { DailySnapshot } from '@/types/snapshot';
import { snapshotCategories } from '@/types/snapshot';

interface LiveTotals {
  stocks_value: number;
  cash_value: number;
  gold_value: number;
  crypto_value: number;
  bonds_value: number;
  real_estate_value: number;
  total_value: number;
}

interface DailySnapshotTableProps {
  snapshots: DailySnapshot[];
  loading: boolean;
  onDelete?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  todayLiveTotals?: LiveTotals;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DailySnapshotTable({
  snapshots,
  loading,
  onDelete,
  onRefresh,
  todayLiveTotals,
}: DailySnapshotTableProps) {
  const { convertBetween, displayCurrency } = useCurrencyContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };


  const convertValue = (usdValue: number): number => {
    return convertBetween(usdValue, 'USD', displayCurrency);
  };

  const today = todayString();

  /**
   * For today's column, use live-computed values (same math as Dashboard).
   * For past days, use stored DB values converted from USD.
   */
  const getCellValue = (snap: DailySnapshot, key: string): number => {
    const isToday = snap.snapshot_date === today;
    const rawUsd = isToday && todayLiveTotals
      ? (todayLiveTotals as unknown as Record<string, number>)[key] ?? 0
      : (snap as unknown as Record<string, number>)[key] ?? 0;
    return convertValue(rawUsd);
  };

  const getTotalValue = (snap: DailySnapshot): number => {
    const isToday = snap.snapshot_date === today;
    const rawUsd = isToday && todayLiveTotals
      ? todayLiveTotals.total_value
      : snap.total_value;
    return convertValue(rawUsd);
  };

  const getRawTotal = (snap: DailySnapshot): number => {
    const isToday = snap.snapshot_date === today;
    return isToday && todayLiveTotals
      ? todayLiveTotals.total_value
      : snap.total_value;
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete?.(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-clear confirmation after 3s
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Daily Asset Record</h3>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Recording...' : 'Record Today'}
          </button>
        )}
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm">
          No snapshots yet. Your first daily record will be created automatically.
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-left sticky left-0 bg-white z-10 min-w-[100px]">
                  Category
                </th>
                {snapshots.map((snap) => (
                  <th
                    key={snap.id}
                    className="py-2 px-3 text-xs font-medium text-gray-400 tracking-wider text-right min-w-[100px] whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{formatDateLabel(snap.snapshot_date)}</span>
                      {snap.snapshot_date === today && (
                        <span className="text-[9px] text-emerald-500 font-normal">today</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshotCategories.map((cat) => (
                <tr key={cat.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 px-3 text-sm text-gray-600 font-medium sticky left-0 bg-white z-10">
                    {cat.label}
                  </td>
                  {snapshots.map((snap) => {
                    const displayValue = getCellValue(snap, cat.key);
                    const isToday = snap.snapshot_date === today;
                    const rawUsd = isToday && todayLiveTotals
                      ? (todayLiveTotals as unknown as Record<string, number>)[cat.key] ?? 0
                      : (snap[cat.key] as number);
                    return (
                      <td key={snap.id} className="py-2 px-3 text-sm text-right tabular-nums text-gray-700">
                        {rawUsd > 0 ? formatCurrencyValue(displayValue, displayCurrency) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="py-2.5 px-3 text-sm text-gray-900 sticky left-0 bg-white z-10">
                  Total
                </td>
                {snapshots.map((snap) => {
                  const displayTotal = getTotalValue(snap);
                  return (
                    <td key={snap.id} className="py-2.5 px-3 text-sm text-right tabular-nums text-gray-900">
                      {formatCurrencyValue(displayTotal, displayCurrency)}
                    </td>
                  );
                })}
              </tr>
              {/* Day-over-day change row */}
              <tr className="border-t border-gray-100">
                <td className="py-2 px-3 text-xs text-gray-400 sticky left-0 bg-white z-10">
                  Change
                </td>
                {snapshots.map((snap, idx) => {
                  // Descending order: previous day is idx + 1
                  if (idx === snapshots.length - 1) {
                    return (
                      <td key={snap.id} className="py-2 px-3 text-xs text-right text-gray-300">
                        —
                      </td>
                    );
                  }
                  const currentRaw = getRawTotal(snap);
                  const prevRaw = getRawTotal(snapshots[idx + 1]);
                  const change = currentRaw - prevRaw;
                  const displayChange = convertValue(change);
                  const changePct = prevRaw > 0 ? (change / prevRaw) * 100 : 0;
                  const isPositive = change >= 0;

                  return (
                    <td
                      key={snap.id}
                      className={`py-2 px-3 text-xs text-right tabular-nums ${
                        isPositive ? 'text-red-500' : 'text-blue-500'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {formatCurrencyValue(displayChange, displayCurrency)}
                      <br />
                      <span className="opacity-60">
                        ({isPositive ? '+' : ''}
                        {changePct.toFixed(1)}%)
                      </span>
                    </td>
                  );
                })}
              </tr>
              {/* Delete row */}
              {onDelete && (
                <tr className="border-t border-gray-100">
                  <td className="py-1.5 px-3 text-xs text-gray-300 sticky left-0 bg-white z-10" />
                  {snapshots.map((snap) => (
                    <td key={snap.id} className="py-1.5 px-3 text-right">
                      <button
                        onClick={() => handleDelete(snap.id)}
                        className={`text-[10px] transition-colors cursor-pointer ${
                          confirmDeleteId === snap.id
                            ? 'text-red-500 font-medium'
                            : 'text-gray-300 hover:text-gray-400'
                        }`}
                        title={confirmDeleteId === snap.id ? 'Click again to confirm' : 'Delete this snapshot'}
                      >
                        {confirmDeleteId === snap.id ? 'confirm?' : 'delete'}
                      </button>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
