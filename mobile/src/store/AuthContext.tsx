import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';
import type { UserProfile } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  /** true once Firebase has emitted the first auth state */
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, extra?: { phone?: string; subject?: string; grade_level?: string[] }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function isAdminUser(p: UserProfile | null, email?: string | null): boolean {
  return (
    p?.role === 'admin' ||
    p?.isAdmin === true ||
    (email ?? '').toLowerCase().trim() === 'gergesnabil101@gmail.com'
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const p = await api.get<UserProfile>('/api/user/profile');
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile();
      } else {
        setProfile(null);
      }
      setInitialized(true);
    });
    return unsub;
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await api.post('/api/auth/sync-claims').catch(() => null);
      await fetchProfile();
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  const register = useCallback(
    async (name: string, email: string, password: string, extra?: { phone?: string; subject?: string; grade_level?: string[] }) => {
      setLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() }).catch(() => null);
        await api.post('/api/auth/register-profile', {
          name: name.trim(),
          email: email.trim(),
          phone: extra?.phone || '',
          subject: extra?.subject || '',
          grade_level: extra?.grade_level || [],
        });
        await api.post('/api/admin/notify-registration', { name: name.trim(), email: email.trim() }).catch(() => null);
        await fetchProfile();
      } finally {
        setLoading(false);
      }
    },
    [fetchProfile]
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      initialized,
      signIn,
      register,
      resetPassword,
      logout,
      refreshProfile: fetchProfile,
    }),
    [user, profile, loading, initialized, signIn, register, resetPassword, logout, fetchProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { isAdminUser };
