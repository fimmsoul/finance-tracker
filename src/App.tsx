import { useAuth } from '@/hooks/useAuth';
import { CurrencyProvider } from '@/hooks/CurrencyContext';
import { DataProvider } from '@/hooks/DataContext';
import { StockRefreshProvider } from '@/hooks/StockRefreshContext';
import LoginScreen from '@/components/auth/LoginScreen';
import AppShell from '@/components/layout/AppShell';

export default function App() {
  const { session, user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAFAF8]">
        <div className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !user) {
    return <LoginScreen onSignIn={signIn} />;
  }

  return (
    <CurrencyProvider>
      <DataProvider>
        <StockRefreshProvider>
          <AppShell user={user} onSignOut={signOut} />
        </StockRefreshProvider>
      </DataProvider>
    </CurrencyProvider>
  );
}
