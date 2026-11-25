/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AdminControlCenter } from './pages/AdminControlCenter.tsx';
import { EmailVerificationGate, LoginPage, RegisterPage } from './pages/AuthPages.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { UserDashboard } from './pages/UserDashboard.tsx';

function AppRouter() {
  const { user, loading } = useAuth();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [search, setSearch] = useState<string>(() => window.location.search || '');

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || '/');
      setSearch(window.location.search || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (target: string) => {
    const url = new URL(target, window.location.origin);
    window.history.pushState({}, '', url.pathname + url.search);
    setPathname(url.pathname);
    setSearch(url.search);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (pathname === '/control-center') {
    return <AdminControlCenter onNavigate={navigate} />;
  }

  if (loading && (pathname === '/dashboard' || pathname === '/login' || pathname === '/register')) {
    return (
      <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#16834A]" />
      </div>
    );
  }

  if (pathname === '/register') {
    if (user && user.emailVerified) {
      return <UserDashboard onNavigate={navigate} />;
    }
    if (user && !user.emailVerified) {
      return <EmailVerificationGate />;
    }
    return <RegisterPage onNavigate={navigate} />;
  }

  if (pathname === '/login') {
    const params = new URLSearchParams(search);
    const nextPath = params.get('next') || '/dashboard';
    if (user && user.emailVerified) {
      return nextPath === '/control-center' ? (
        <AdminControlCenter onNavigate={navigate} />
      ) : (
        <UserDashboard onNavigate={navigate} />
      );
    }
    if (user && !user.emailVerified) {
      return <EmailVerificationGate />;
    }
    return <LoginPage onNavigate={navigate} redirectAfter={nextPath} />;
  }

  if (pathname === '/dashboard') {
    if (!user) {
      return <LoginPage onNavigate={navigate} redirectAfter="/dashboard" />;
    }
    if (!user.emailVerified) {
      return <EmailVerificationGate />;
    }
    return <UserDashboard onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} isAuthenticated={Boolean(user && user.emailVerified)} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
