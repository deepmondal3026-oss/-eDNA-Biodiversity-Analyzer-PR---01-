import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { BrandLogoIcon } from '../components/BrandMark.tsx';
import { useAuth } from '../context/AuthContext.tsx';

function getPasswordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return { score, label: labels[score] };
}

function mapFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Incorrect email or password. Please verify your credentials or reset your password.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 8 characters and include uppercase, numeric, or special characters.';
  }
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication → Sign-in method → Email/Password). Enable it there or use Continue with Google below.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing authentication.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  return msg;
}

export function RegisterPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { registerWithEmail, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [country, setCountry] = useState('');
  const [researchInterests, setResearchInterests] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8 || strength.score < 2) {
      setError('Password must be at least 8 characters and include mixed character types.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }
    if (!acceptTerms) {
      setError('You must accept the Terms and Conditions to create an account.');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({
        fullName,
        email,
        password,
        organization,
        country,
        researchInterests,
      });
      setSuccessMsg('Account created! A verification email has been sent to your inbox. Please verify your email before accessing the workspace.');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onNavigate('/dashboard');
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8F5] flex flex-col justify-center py-12 px-6">
      <div className="max-w-lg w-full mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#123D2B] mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Homepage
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <BrandLogoIcon className="w-9 h-9" />
            <div>
              <h1 className="text-xl font-bold text-[#123D2B]">Create Researcher Account</h1>
              <p className="text-xs text-slate-500">eDNA Biodiversity Explorer · Standard User Registration</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16834A]" />
              <div>
                <p>{successMsg}</p>
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard')}
                  className="mt-2 font-semibold text-[#123D2B] underline"
                >
                  Continue to Verification Screen
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-[#172B22] hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mb-5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative flex py-2 items-center mb-4">
            <div className="grow border-t border-slate-200" />
            <span className="shrink mx-3 text-xs text-slate-400">or register with email</span>
            <div className="grow border-t border-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#172B22] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Aarav Sharma"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B22] mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@institute.org"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 chars"
                    className="w-full px-3.5 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Strength: {strength.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`w-4 h-1 rounded-xs ${
                            strength.score >= step ? 'bg-[#16834A]' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">Confirm Password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">
                  Organization / Institution <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Marine Biology Institute"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">
                  Country <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172B22] mb-1">
                Research Interest <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={researchInterests}
                onChange={(e) => setResearchInterests(e.target.value)}
                placeholder="Estuarine fish metabarcoding, benthic macroinvertebrates"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#16834A] focus:ring-[#16834A]"
              />
              <span>
                I agree to the scientific data usage terms and understand that newly registered accounts receive
                standard researcher (<span className="font-mono">user</span>) permissions.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Register Account
            </button>
          </form>

          <p className="text-xs text-center text-slate-600 mt-6">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="font-semibold text-[#16834A] hover:underline"
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage({
  onNavigate,
  redirectAfter = '/dashboard',
}: {
  onNavigate: (path: string) => void;
  redirectAfter?: string;
}) {
  const { loginWithEmail, loginWithGoogle, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      await loginWithEmail(email, password, rememberMe);
      onNavigate(redirectAfter);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    if (!email.trim()) {
      setError('Enter your email address to receive a password reset link.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setInfoMsg(`Password reset email sent to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onNavigate(redirectAfter);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8F5] flex flex-col justify-center py-12 px-6">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#123D2B] mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Homepage
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <BrandLogoIcon className="w-9 h-9" />
            <div>
              <h1 className="text-xl font-bold text-[#123D2B]">
                {forgotMode ? 'Reset Password' : 'Sign In to Workspace'}
              </h1>
              <p className="text-xs text-slate-500">eDNA Biodiversity Explorer</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16834A]" />
              <span>{infoMsg}</span>
            </div>
          )}

          {forgotMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#172B22] mb-1">Account Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@institute.org"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setForgotMode(false)}
                className="w-full text-xs text-slate-600 hover:text-[#123D2B]"
              >
                Return to Sign In
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogle}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-[#172B22] hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mb-5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative flex py-2 items-center mb-4">
                <div className="grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-400">or sign in with email</span>
                <div className="grow border-t border-slate-200" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#172B22] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="researcher@institute.org"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#172B22] mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#16834A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-[#16834A]"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="font-medium text-[#16834A] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>
              </form>

              <p className="text-xs text-center text-slate-600 mt-6">
                New researcher?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="font-semibold text-[#16834A] hover:underline"
                >
                  Create an account
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailVerificationGate() {
  const { user, resendVerificationEmail, refreshAuthAndProfile, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');

  const handleResend = async () => {
    setSending(true);
    setMsg('');
    try {
      await resendVerificationEmail();
      setMsg('Verification email resent. Please check your inbox and spam folder.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    await refreshAuthAndProfile();
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <MailCheck className="w-10 h-10 text-[#16834A] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#123D2B] mb-2">Verify Your Email Address</h1>
        <p className="text-sm text-slate-600 mb-6">
          To protect scientific data integrity, please verify <span className="font-semibold">{user?.email}</span>{' '}
          by clicking the verification link sent to your email.
        </p>
        {msg && <div className="mb-4 p-3 rounded-lg bg-[#F5F8F5] border border-slate-200 text-xs text-[#172B22]">{msg}</div>}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={checking}
            onClick={handleRefresh}
            className="w-full py-2.5 px-4 rounded-lg bg-[#16834A] text-white text-sm font-semibold hover:bg-[#123D2B] transition-colors inline-flex items-center justify-center gap-2"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            I&apos;ve Verified — Continue
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={handleResend}
            className="w-full py-2 px-4 rounded-lg border border-slate-200 text-sm font-medium text-[#172B22] hover:bg-slate-50"
          >
            {sending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
