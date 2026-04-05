import { useAuth } from '@/hooks/useAuth';
import { CurrencyProvider } from '@/hooks/CurrencyContext';
import { FamilyProvider } from '@/hooks/FamilyContext';
import { DataProvider } from '@/hooks/DataContext';
import { StockRefreshProvider } from '@/hooks/StockRefreshContext';
import LoginScreen from '@/components/auth/LoginScreen';
import AppShell from '@/components/layout/AppShell';

export default function App() {
  const { session, user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
        <div className="w-6 h-6 border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !user) {
    return <LoginScreen onSignIn={signIn} />;
  }

  return (
    <CurrencyProvider>
      <FamilyProvider>
        <DataProvider>
          <StockRefreshProvider>
            <AppShell user={user} onSignOut={signOut} />
          </StockRefreshProvider>
        </DataProvider>
      </FamilyProvider>
    </CurrencyProvider>
  );
}
