import { useSharedCrypto } from '@/hooks/DataContext';
import CryptoTable from './CryptoTable';
import { StockTableSkeleton } from '@/components/ui/Skeleton';

export default function CryptoView() {
  const {
    cryptos,
    loading,
    addCrypto,
    updateCrypto,
    deleteCrypto,
    reorderCryptos,
  } = useSharedCrypto();

  if (loading) {
    return <StockTableSkeleton />;
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--color-text)] mb-5">Crypto Holdings</h3>
      <CryptoTable
        cryptos={cryptos}
        onAdd={addCrypto}
        onUpdate={updateCrypto}
        onDelete={deleteCrypto}
        onReorder={reorderCryptos}
      />
    </div>
  );
}
