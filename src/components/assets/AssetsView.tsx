import { useSharedAssets, useDataContext } from '@/hooks/DataContext';
import { useDailySnapshots } from '@/hooks/useDailySnapshots';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import AssetTable from './AssetTable';
import DailySnapshotTable from './DailySnapshotTable';

export default function AssetsView() {
  const { assets, loading, addAsset, updateAsset, deleteAsset, totalValue } = useSharedAssets();
  const { dataVersion } = useDataContext();
  const { lastUpdated } = useCurrencyContext();
  const { snapshots, loading: snapshotsLoading, deleteSnapshot, todayLiveTotals, recordToday } = useDailySnapshots(dataVersion, lastUpdated);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Daily Asset Snapshot */}
      <DailySnapshotTable
        snapshots={snapshots}
        loading={snapshotsLoading}
        onDelete={deleteSnapshot}
        onRefresh={recordToday}
        todayLiveTotals={todayLiveTotals}
      />

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Existing assets table */}
      <AssetTable
        assets={assets}
        onAdd={addAsset}
        onUpdate={updateAsset}
        onDelete={deleteAsset}
        totalValue={totalValue}
      />
    </div>
  );
}
