import { useState, useMemo } from 'react';
import { useSharedStocks } from '@/hooks/DataContext';
import { useDividends } from '@/hooks/useDividends';
import StockTable from './StockTable';
import StockPerformance from './StockPerformance';
import DpsTrendsChart from '@/components/income/DpsTrendsChart';
import { StockTableSkeleton, PerformanceSkeleton } from '@/components/ui/Skeleton';
import type { AccountType } from '@/types/stock';

const tabs: { id: AccountType; label: string }[] = [
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
          <h3 className="text-base font-semibold text-gray-800 mb-5">Stock Holdings</h3>
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

export default function StocksView() {
  const [activeTab, setActiveTab] = useState<AccountType>('general');
  const { dividends, stocks: allStocks, loading: dividendsLoading } = useDividends();

  // Filter dividends by account type based on which stock they belong to
  const filteredDividends = useMemo(() => {
    const stockIdsByAccountType = new Set(
      allStocks.filter((s) => s.account_type === activeTab).map((s) => s.id)
    );
    return dividends.filter((d) => stockIdsByAccountType.has(d.stock_id));
  }, [dividends, allStocks, activeTab]);

  return (
    <div>
      {/* Segment Control */}
      <div className="inline-flex p-1 bg-gray-100 rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Both tabs mounted, only active one visible */}
      <div className="relative">
        {tabs.map((tab) => (
          <StockTab
            key={tab.id}
            accountType={tab.id}
            visible={activeTab === tab.id}
          />
        ))}
      </div>

      {/* DPS Trends Chart */}
      <div className="mt-14 pt-6 border-t border-gray-200">
        <h3 className="text-base font-semibold text-gray-800 mb-5">DPS Trends</h3>
        {dividendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <DpsTrendsChart dividends={filteredDividends} />
        )}
      </div>
    </div>
  );
}
