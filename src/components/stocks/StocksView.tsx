import { useState, useMemo } from 'react';
import { useSharedStocks } from '@/hooks/DataContext';
import { useDividends } from '@/hooks/useDividends';
import { useTransactions } from '@/hooks/useTransactions';
import StockTable from './StockTable';
import StockPerformance from './StockPerformance';
import DpsTrendsChart from '@/components/income/DpsTrendsChart';
import { TransactionTable } from '@/components/transactions';
import { StockTableSkeleton, PerformanceSkeleton } from '@/components/ui/Skeleton';
import type { AccountType } from '@/types/stock';

type ViewMode = 'holdings' | 'transactions';

const viewModes: { id: ViewMode; label: string }[] = [
  { id: 'holdings', label: 'Holdings' },
  { id: 'transactions', label: 'Transactions' },
];

const accountTabs: { id: AccountType; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'isa', label: 'ISA' },
];

function StockTab({ accountType, visible }: { accountType: AccountType; visible: boolean }) {
  const { stocks, loading, addStock, updateStock, deleteStock, reorderStocks, totalValue, totalCost } = useSharedStocks(accountType);

  return (
    <div
      className={`transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pointer-events-none absolute'}`}
    >
      {loading ? (
        <>
          <StockTableSkeleton />
          <PerformanceSkeleton />
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-5">Stock Holdings</h3>
          <StockTable
            stocks={stocks}
            onAdd={addStock}
            onUpdate={updateStock}
            onDelete={deleteStock}
            onReorder={reorderStocks}
            totalValue={totalValue}
            totalCost={totalCost}
          />
          <StockPerformance accountType={accountType} />
        </>
      )}
    </div>
  );
}

function TransactionsTab({ accountType, visible }: { accountType: AccountType; visible: boolean }) {
  const { transactions, stocks, loading, stocksLoaded, addTransaction, updateTransaction, deleteTransaction, createStock } = useTransactions(accountType);

  return (
    <div
      className={`transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pointer-events-none absolute'}`}
    >
      {loading || !stocksLoaded ? (
        <StockTableSkeleton />
      ) : (
        <TransactionTable
          transactions={transactions}
          stocks={stocks}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
          onCreateStock={createStock}
        />
      )}
    </div>
  );
}

export default function StocksView() {
  const [viewMode, setViewMode] = useState<ViewMode>('holdings');
  const [activeTab, setActiveTab] = useState<AccountType>('general');
  const { dividends, stocks: allStocks, loading: dividendsLoading, stocksLoaded } = useDividends();

  // Filter dividends by account type based on which stock they belong to
  // Only filter when stocks are loaded to avoid showing empty chart during loading
  const filteredDividends = useMemo(() => {
    if (!stocksLoaded) return [];
    const stockIdsByAccountType = new Set(
      allStocks.filter((s) => s.account_type === activeTab).map((s) => s.id)
    );
    return dividends.filter((d) => stockIdsByAccountType.has(d.stock_id));
  }, [dividends, allStocks, activeTab, stocksLoaded]);

  return (
    <div>
      {/* Primary Segment Control: Holdings / Transactions */}
      <div className="inline-flex p-1 bg-[var(--color-bg-sidebar)] rounded-lg mb-4">
        {viewModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              viewMode === mode.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Secondary Segment Control: General / ISA */}
      <div className="inline-flex p-1 bg-[var(--color-bg-sidebar)] rounded-lg mb-6 ml-4">
        {accountTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content based on view mode */}
      <div className="relative">
        {viewMode === 'holdings' ? (
          // Holdings view with stock tables
          accountTabs.map((tab) => (
            <StockTab
              key={tab.id}
              accountType={tab.id}
              visible={activeTab === tab.id}
            />
          ))
        ) : (
          // Transactions view
          accountTabs.map((tab) => (
            <TransactionsTab
              key={tab.id}
              accountType={tab.id}
              visible={activeTab === tab.id}
            />
          ))
        )}
      </div>

      {/* DPS Trends Chart - only show in Holdings mode */}
      {viewMode === 'holdings' && (
        <div className="mt-14 pt-6 border-t border-[var(--color-border)]">
          <h3 className="text-base font-semibold text-[var(--color-text)] mb-5">DPS Trends</h3>
          {dividendsLoading || !stocksLoaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)] rounded-full animate-spin" />
            </div>
          ) : (
            <DpsTrendsChart dividends={filteredDividends} />
          )}
        </div>
      )}
    </div>
  );
}
