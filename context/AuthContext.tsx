import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { googleLoginApi, LoginResponse, loginApi, logoutApi } from '@/api/authApi';
import { clearTokens, loadTokens, saveTokens, setSessionExpiredHandler } from '@/api/client';
import { getMeApi, User } from '@/api/userApi';

interface AuthState {
  user: User | null;
  /** true while the stored session is being restored on app start */
  initializing: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Restore session on start
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    (async () => {
      try {
        const { accessToken, refreshToken } = await loadTokens();
        if (accessToken || refreshToken) {
          setUser(await getMeApi());
        }
      } catch {
        await clearTokens();
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const startSession = useCallback(async (data: LoginResponse) => {
    await saveTokens(data.accessToken, data.refreshToken);
    let profile = data.user;
    try {
      profile = await getMeApi(); // includes stats
    } catch {
      // keep the basic profile from the login response
    }
    setUser(profile);
    return profile;
  }, []);

  const login = useCallback(
    async (username: string, password: string) => startSession(await loginApi(username, password)),
    [startSession]
  );

  const loginWithGoogle = useCallback(async (idToken: string) => startSession(await googleLoginApi(idToken)), [startSession]);

  const logout = useCallback(async () => {
    await logoutApi();
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await getMeApi());
    } catch {
      // ignore — keeps the current profile
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, loginWithGoogle, logout, refreshUser, setUser }),
    [user, initializing, login, loginWithGoogle, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
