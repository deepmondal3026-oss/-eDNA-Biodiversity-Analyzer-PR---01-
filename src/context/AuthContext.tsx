import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  configureAuthPersistence,
  ensureUserProfile,
  googleProvider,
} from '../lib/firebase.ts';
import type { UserProfile } from '../types/edna.ts';

interface PendingRegistrationMeta {
  fullName: string;
  organization: string;
  country: string;
  researchInterests: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithEmail: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  registerWithEmail: (params: {
    fullName: string;
    email: string;
    password: string;
    organization?: string;
    country?: string;
    researchInterests?: string;
  }) => Promise<{ verificationSent: boolean }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthAndProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMeta, setPendingMeta] = useState<PendingRegistrationMeta | null>(null);

  const syncProfile = useCallback(
    async (firebaseUser: User | null, overrideMeta?: PendingRegistrationMeta | null) => {
      if (!firebaseUser) {
        setProfile(null);
        return;
      }
      if (!firebaseUser.emailVerified) {
        setProfile(null);
        return;
      }
      const meta = overrideMeta ?? pendingMeta;
      const ensured = await ensureUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        emailVerified: firebaseUser.emailVerified,
        fullName: meta?.fullName || firebaseUser.displayName || 'Researcher',
        organization: meta?.organization,
        country: meta?.country,
        researchInterests: meta?.researchInterests,
      });
      setProfile(ensured);
    },
    [pendingMeta]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        await syncProfile(firebaseUser);
      } catch (err) {
        console.error('Failed to sync user profile:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [syncProfile]);

  const loginWithEmail = async (email: string, password: string, rememberMe: boolean) => {
    await configureAuthPersistence(rememberMe);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await syncProfile(cred.user);
  };

  const registerWithEmail = async (params: {
    fullName: string;
    email: string;
    password: string;
    organization?: string;
    country?: string;
    researchInterests?: string;
  }) => {
    const meta: PendingRegistrationMeta = {
      fullName: params.fullName.trim(),
      organization: params.organization?.trim() ?? '',
      country: params.country?.trim() ?? '',
      researchInterests: params.researchInterests?.trim() ?? '',
    };
    setPendingMeta(meta);
    const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    await updateProfile(cred.user, { displayName: meta.fullName });
    await sendEmailVerification(cred.user);
    return { verificationSent: true };
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await syncProfile(cred.user);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setPendingMeta(null);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthAndProfile = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser({ ...refreshed } as User);
    await syncProfile(refreshed);
  };

  const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const isAdmin = Boolean(
    user?.emailVerified &&
      (profile?.role === 'admin' ||
        profile?.role === 'super_admin' ||
        user.email === BOOTSTRAP_ADMIN_EMAIL)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        resendVerificationEmail,
        refreshAuthAndProfile,
        requestPasswordReset,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
