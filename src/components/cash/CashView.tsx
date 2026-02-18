import { useSharedCash } from '@/hooks/DataContext';
import CashTable from './CashTable';

export default function CashView() {
  const { accounts, loading, addAccount, updateAccount, deleteAccount, totalBalance } = useSharedCash();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CashTable
      accounts={accounts}
      onAdd={addAccount}
      onUpdate={updateAccount}
      onDelete={deleteAccount}
      totalBalance={totalBalance}
    />
  );
}
