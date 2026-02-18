import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Listen for OAuth callback from Electron main process
    if (window.electronAPI) {
      window.electronAPI.onAuthCallback(async (url: string) => {
        // Extract tokens from the URL hash fragment
        // URL format: financetracker://auth/callback#access_token=...&refresh_token=...
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;

        const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.error('Failed to set session:', error.message);
          }
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'financetracker://auth/callback',
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('Sign in error:', error.message);
      return;
    }

    if (data?.url) {
      if (window.electronAPI) {
        window.electronAPI.openExternal(data.url);
      } else {
        // Fallback for dev in browser
        window.location.href = data.url;
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signOut,
  };
}
