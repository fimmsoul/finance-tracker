import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { useFamilyContext } from '@/hooks/FamilyContext';
import Sidebar, { type View } from './Sidebar';
import Header from './Header';
import DashboardView from '@/components/dashboard/DashboardView';
import StocksView from '@/components/stocks/StocksView';
import { CryptoView } from '@/components/crypto';
import CashView from '@/components/cash/CashView';
import AssetsView from '@/components/assets/AssetsView';
import IncomeView from '@/components/income/IncomeView';
import SettingsView from '@/components/settings/SettingsView';

interface AppShellProps {
  user: User;
  onSignOut: () => void;
}

const viewTitles: Record<View, string> = {
  dashboard: 'Dashboard',
  stocks: 'Stocks',
  crypto: 'Crypto',
  cash: 'Cash & Bank Accounts',
  assets: 'Other Assets',
  income: 'Dividends & Income',
  settings: 'Settings',
};

const allViews: View[] = ['dashboard', 'assets', 'stocks', 'crypto', 'income', 'cash', 'settings'];

const viewComponents: Record<View, React.FC> = {
  dashboard: DashboardView,
  stocks: StocksView,
  crypto: CryptoView,
  cash: CashView,
  assets: AssetsView,
  income: IncomeView,
  settings: SettingsView,
};

export default function AppShell({ user, onSignOut }: AppShellProps) {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const mainRef = useRef<HTMLElement>(null);
  const { activeMemberId, members } = useFamilyContext();

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const memberKeys = useMemo(() => ['all', ...memberIds], [memberIds]);

  // Simple quick bump animation on member switch
  const prevMemberRef = useRef(activeMemberId);
  const [animClass, setAnimClass] = useState('');

  useEffect(() => {
    if (prevMemberRef.current === activeMemberId) return;

    const prevIdx = memberKeys.indexOf(prevMemberRef.current);
    const nextIdx = memberKeys.indexOf(activeMemberId);
    prevMemberRef.current = activeMemberId;

    // Apply a quick directional nudge
    const dir = nextIdx > prevIdx ? 'slide-in-from-right' : 'slide-in-from-left';
    setAnimClass(dir);

    const timer = setTimeout(() => setAnimClass(''), 250);
    return () => clearTimeout(timer);
  }, [activeMemberId, memberKeys]);

  const handleNavigate = useCallback((view: View) => {
    setActiveView(view);
    mainRef.current?.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar activeView={activeView} onNavigate={handleNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} title={viewTitles[activeView]} onSignOut={onSignOut} />
        <main ref={mainRef} className="flex-1 overflow-auto p-6 relative overflow-x-hidden">
          <div className={animClass}>
            {allViews.map((view) => {
              const Component = viewComponents[view];
              const isActive = activeView === view;
              return (
                <div
                  key={view}
                  className={
                    isActive
                      ? 'opacity-100 transition-opacity duration-200'
                      : 'opacity-0 h-0 overflow-hidden pointer-events-none absolute inset-0'
                  }
                >
                  <Component />
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
