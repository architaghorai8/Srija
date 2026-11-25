import { type FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
  ShieldAlert,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { UserCategory, UserProfile } from '../types';
import { DnaLogo } from './DnaLogo';

interface AuthPagesProps {
  initialView?: 'login' | 'register' | 'forgot';
  onBackToSplash: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'India',
  'Australia',
  'Japan',
  'Brazil',
  'France',
  'Norway',
  'Netherlands',
  'South Africa',
  'Kenya',
  'Singapore',
  'Other',
];

const USER_CATEGORIES: UserCategory[] = [
  'Student',
  'Researcher',
  'Scientist',
  'Teacher',
  'General user',
];

function evaluatePasswordStrength(pwd: string): { score: number; label: string; checks: string[] } {
  const checks: string[] = [];
  if (pwd.length >= 8) checks.push('8+ characters');
  if (/[A-Z]/.test(pwd)) checks.push('Uppercase letter');
  if (/[a-z]/.test(pwd)) checks.push('Lowercase letter');
  if (/[0-9]/.test(pwd)) checks.push('Number');
  if (/[^A-Za-z0-9]/.test(pwd)) checks.push('Special symbol');

  const score = checks.length;
  const label = score <= 2 ? 'Weak' : score <= 4 ? 'Moderate' : 'Strong';
  return { score, label, checks };
}

export function AuthPages({ initialView = 'login', onBackToSplash, onAuthSuccess }: AuthPagesProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'verify'>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);

  // Register state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('United States');
  const [userCategory, setUserCategory] = useState<UserCategory>('Researcher');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  // Email verification state
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [previewVerifyToken, setPreviewVerifyToken] = useState<string | null>(null);

  // Forgot/Reset password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [previewResetToken, setPreviewResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  const strength = useMemo(() => evaluatePasswordStrength(regPassword), [regPassword]);

  async function handleGoogleCheck() {
    setError(null);
    try {
      const res = await apiRequest<{ configured: boolean; message: string }>('/api/auth/google-status');
      setGoogleNotice(res.message);
    } catch (err) {
      setGoogleNotice(err instanceof Error ? err.message : 'Unable to check Google authentication status.');
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setAuthToken(res.token);
      if (!rememberEmail) {
        setLoginEmail('');
      }
      onAuthSuccess(res.user);
    } catch (err) {
      const typed = err as Error & { code?: string; email?: string };
      if (typed.code === 'EMAIL_NOT_VERIFIED' && typed.email) {
        setVerifyEmail(typed.email);
        setView('verify');
        setError(typed.message);
      } else {
        setError(typed.message || 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (regPassword !== confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Please accept both the Terms & Conditions and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{
        message: string;
        email: string;
        previewVerificationToken?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email: regEmail,
          phone,
          institution,
          country,
          userCategory,
          password: regPassword,
          confirmPassword,
          acceptedTerms,
          acceptedPrivacy,
        }),
      });
      setVerifyEmail(res.email);
      setPreviewVerifyToken(res.previewVerificationToken || null);
      setVerifyToken(res.previewVerificationToken || '');
      setSuccessMsg(res.message);
      setView('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: verifyEmail, token: verifyToken }),
      });
      setSuccessMsg(res.message);
      setLoginEmail(verifyEmail);
      setView('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; previewVerificationToken?: string }>(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          body: JSON.stringify({ email: verifyEmail }),
        }
      );
      setSuccessMsg(res.message);
      if (res.previewVerificationToken) {
        setPreviewVerifyToken(res.previewVerificationToken);
        setVerifyToken(res.previewVerificationToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; previewResetToken?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setSuccessMsg(res.message);
      if (res.previewResetToken) {
        setPreviewResetToken(res.previewResetToken);
        setResetToken(res.previewResetToken);
      }
      setResetStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail,
          token: resetToken,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      setSuccessMsg(res.message);
      setLoginEmail(forgotEmail);
      setResetStep('request');
      setView('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6FAF8] flex flex-col lg:flex-row">
      {/* Left Botanical & Scientific Panel */}
      <aside className="lg:w-[42%] bg-[#06291F] text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <img
            src="/src/assets/images/lab_water_sampling_1795608908424.jpg"
            alt="Biologist collecting environmental DNA river water sample"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06291F] via-[#06291F]/80 to-[#06291F]/70" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToSplash}
            className="inline-flex items-center gap-2 text-sm text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>
          <DnaLogo size={32} inverted />
        </div>

        <div className="relative z-10 my-10 space-y-5">
          <p className="text-sm font-medium text-emerald-300">Discover · Identify · Conserve</p>
          <h1 className="text-3xl lg:text-4xl font-semibold leading-tight text-white [text-wrap:balance]">
            eDNA BioScope Research Workspace
          </h1>
          <p className="text-sm lg:text-base text-emerald-100/80 leading-relaxed max-w-md">
            Private, account-isolated environmental DNA analysis, taxonomic hierarchy exploration, and
            biodiversity assessment designed for researchers, educators, and conservation teams.
          </p>
        </div>

        <div className="relative z-10 border-t border-emerald-400/20 pt-5 text-xs text-emerald-200/75 flex flex-wrap gap-x-4 gap-y-1">
          <span>FASTA / FASTQ / CSV / TXT</span>
          <span aria-hidden="true">·</span>
          <span>Shannon H&apos; &amp; Simpson Metrics</span>
          <span aria-hidden="true">·</span>
          <span>PDF &amp; CSV Reporting</span>
        </div>
      </aside>

      {/* Right Authentication Form Canvas */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-lg bg-white border border-[#D8E6DF] rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Segmented Switch between Login / Register */}
          {(view === 'login' || view === 'register') && (
            <div className="flex items-center gap-1 p-1 bg-[#F0F7F4] rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                  view === 'login' ? 'bg-white text-[#064E3B] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('register');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                  view === 'register' ? 'bg-white text-[#064E3B] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {googleNotice && (
            <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{googleNotice}</span>
            </div>
          )}

          {/* LOGIN VIEW */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#141E1A]">Welcome back</h2>
                <p className="text-sm text-slate-600 mt-1">Sign in to access your eDNA datasets and biodiversity metrics.</p>
              </div>

              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="researcher@university.edu"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showLoginPwd ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPwd(!showLoginPwd)}
                    aria-label={showLoginPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                  >
                    {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginEmail);
                    setError(null);
                    setSuccessMsg(null);
                    setView('forgot');
                  }}
                  className="text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#064E3B] hover:bg-[#053F30] disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Login'}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleCheck}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-medium text-sm transition-colors cursor-pointer"
              >
                Continue with Google
              </button>

              <p className="text-center text-sm text-slate-600 pt-1">
                New to eDNA BioScope?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView('register');
                  }}
                  className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                >
                  Register now
                </button>
              </p>
            </form>
          )}

          {/* REGISTRATION VIEW */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <h2 className="text-2xl font-semibold text-[#141E1A]">Researcher Registration</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Create your private scientific account. Immediate access after email verification.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Elena Vance"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email address *</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="elena@ecology.org"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone number (optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 014 8821"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Institution / organization (optional)
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Alpine Limnology Institute"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Country *</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">User category *</label>
                  <select
                    value={userCategory}
                    onChange={(e) => setUserCategory(e.target.value as UserCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white"
                  >
                    {USER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showRegPwd ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 8 chars, mixed"
                      className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPwd(!showRegPwd)}
                      aria-label="Toggle password visibility"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 p-1 cursor-pointer"
                    >
                      {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Confirm password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      aria-label="Toggle confirm password visibility"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 p-1 cursor-pointer"
                    >
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Strength Meter */}
              {regPassword.length > 0 && (
                <div className="p-2.5 rounded-lg bg-[#F6FAF8] border border-[#D8E6DF] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Password strength</span>
                    <span
                      className={`font-semibold ${
                        strength.score <= 2
                          ? 'text-rose-700'
                          : strength.score <= 4
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {strength.label} ({strength.score}/5)
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 h-1.5">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <div
                        key={idx}
                        className={`rounded-full ${
                          idx <= strength.score
                            ? strength.score <= 2
                              ? 'bg-rose-500'
                              : strength.score <= 4
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Requires 8+ chars, uppercase, lowercase, number, and special character.
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-1 text-xs text-slate-700">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>I accept the Terms and Conditions for scientific data processing.</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>I accept the Privacy Policy regarding account metadata and private datasets.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#064E3B] hover:bg-[#053F30] disabled:opacity-60 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={handleGoogleCheck}
                className="w-full py-2 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Sign up with Google
              </button>
            </form>
          )}

          {/* EMAIL VERIFICATION VIEW */}
          {view === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <MailCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#141E1A]">Verify Your Email</h2>
                  <p className="text-xs text-slate-600">Account activation check for {verifyEmail}</p>
                </div>
              </div>

              {previewVerifyToken && (
                <div className="p-3 rounded-lg bg-[#F0F7F4] border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">Preview Email Verification Token (SMTP not configured)</p>
                  <p className="font-mono break-all text-[11px]">{previewVerifyToken}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Token</label>
                <input
                  type="text"
                  required
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Paste verification token"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white font-semibold text-sm cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="py-2.5 px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
                >
                  Resend Token
                </button>
              </div>

              <button
                type="button"
                onClick={() => setView('login')}
                className="text-xs text-emerald-700 hover:underline cursor-pointer"
              >
                Return to Sign In
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#141E1A]">Password Recovery</h2>
                  <p className="text-xs text-slate-600">Reset access to your research account</p>
                </div>
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="researcher@university.edu"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white font-semibold text-sm cursor-pointer"
                  >
                    {loading ? 'Requesting...' : 'Send Reset Token'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-3.5">
                  {previewResetToken && (
                    <div className="p-3 rounded-lg bg-[#F0F7F4] border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <p className="font-semibold">Preview Reset Token (SMTP not configured)</p>
                      <p className="font-mono break-all text-[11px]">{previewResetToken}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Reset Token</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#064E3B] hover:bg-[#053F30] text-white font-semibold text-sm cursor-pointer"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setResetStep('request');
                  setError(null);
                  setView('login');
                }}
                className="text-xs text-emerald-700 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
