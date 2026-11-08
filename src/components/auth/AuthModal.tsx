import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  User,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { authService } from '../../lib/authService';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialInviteCode?: string;
}

type AuthTab = 'login' | 'register' | 'forgot_password' | 'enter_code' | 'set_new_password';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialInviteCode }) => {
  const isElectron = Boolean(window.electronAPI?.isElectron);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
  const setIsPasswordRecovery = useAuthStore((s) => s.setIsPasswordRecovery);

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [isFounderAdmin, setIsFounderAdmin] = useState(false);

  // Password Reset Specific States
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialInviteCode) {
      setInviteCode(initialInviteCode);
      setTab('register');
    }
  }, [initialInviteCode]);

  // When Supabase detects recovery token or magic link, switch directly to set_new_password
  useEffect(() => {
    if (isPasswordRecovery) {
      setTab('set_new_password');
      setError(null);
    }
  }, [isPasswordRecovery]);

  if (!isOpen) return null;

  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await authService.login({
          emailOrUsername: email.trim(),
          password,
        });

        if (res.error) {
          setError(res.error);
        } else {
          useAuthStore.setState({ currentUser: res.user, isAuthenticated: true });
          if (onClose) onClose();
        }
      } else if (tab === 'register') {
        if (!username.trim()) {
          setError('Username is required.');
          setLoading(false);
          return;
        }

        const res = await authService.register({
          email: email.trim(),
          password,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          inviteCode: inviteCode.trim(),
          isAdminSetup: isFounderAdmin,
        });

        if (res.error) {
          setError(res.error);
        } else {
          setSuccessMsg('Account created successfully! Welcome to SquadSpace.');
          useAuthStore.setState({ currentUser: res.user, isAuthenticated: true });
          setTimeout(() => {
            if (onClose) onClose();
          }, 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const identifier = (resetIdentifier || email).trim();
    if (!identifier) {
      setError('Please enter your registered email address or username.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.requestPasswordReset(identifier);
      if (res.success) {
        const resolvedEmail = res.email || identifier;
        setResetSentEmail(resolvedEmail);
        setSuccessMsg(
          `Password reset instructions sent to ${resolvedEmail}. Check your inbox and spam folder for the link or 6-digit recovery code.`
        );
      } else {
        setError(res.error || 'Failed to send password reset email.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const targetEmail = (resetSentEmail || resetIdentifier || email).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please provide your valid registered email address.');
      return;
    }

    if (!recoveryCode.trim()) {
      setError('Please enter the 6-digit recovery code or token sent to your email.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await authService.verifyRecoveryOtp(targetEmail, recoveryCode.trim());
      if (!verifyRes.success) {
        setError(verifyRes.error || 'Invalid or expired recovery code.');
        setLoading(false);
        return;
      }

      // Update password
      const updateRes = await authService.updateUserPassword(newPassword);
      if (updateRes.error || !updateRes.user) {
        setError(updateRes.error || 'Failed to update password.');
      } else {
        setSuccessMsg('Password updated successfully! Logging you in...');
        setIsPasswordRecovery(false);
        useAuthStore.setState({ currentUser: updateRes.user, isAuthenticated: true });
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPasswordDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const updateRes = await authService.updateUserPassword(newPassword);
      if (updateRes.error || !updateRes.user) {
        setError(updateRes.error || 'Failed to update password.');
      } else {
        // Clear recovery hash from window URL
        if (typeof window !== 'undefined' && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setSuccessMsg('Your password has been changed successfully! Welcome back.');
        setIsPasswordRecovery(false);
        useAuthStore.setState({ currentUser: updateRes.user, isAuthenticated: true });
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 ${isElectron ? 'top-7' : 'top-0'} z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4`}
    >
      <div className="w-full max-w-md bg-discord-chat rounded-2xl border border-discord-darkest shadow-2xl p-8 relative overflow-hidden">
        {/* Top-Right Close Button on Modal Card */}
        <button
          type="button"
          onClick={() => {
            if (onClose && isAuthenticated) {
              onClose();
            } else if (isElectron) {
              window.electronAPI?.close();
            } else if (onClose) {
              onClose();
            }
          }}
          title={isAuthenticated ? 'Close' : 'Exit SquadSpace'}
          className="absolute top-4 right-4 text-discord-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-discord-darkest transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Glow Accent */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-discord-blurple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-discord-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Branding & Header */}
        <div className="text-center mb-6">
          {tab === 'set_new_password' ? (
            <div className="w-14 h-14 bg-discord-green/20 border border-discord-green/30 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-discord-green/20 mb-3">
              <Lock className="w-7 h-7 text-discord-green" />
            </div>
          ) : tab === 'forgot_password' || tab === 'enter_code' ? (
            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/30 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
              <Key className="w-7 h-7 text-amber-400" />
            </div>
          ) : (
            <div className="w-14 h-14 bg-discord-blurple rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-discord-blurple/30 mb-3">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          )}

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {tab === 'set_new_password'
              ? 'Set New Password'
              : tab === 'forgot_password'
              ? 'Reset Your Password'
              : tab === 'enter_code'
              ? 'Enter Recovery Code'
              : 'SquadSpace'}
          </h2>
          <p className="text-xs text-discord-gray-400 mt-1">
            {tab === 'set_new_password'
              ? 'Your recovery session is verified. Enter your new password below.'
              : tab === 'forgot_password'
              ? 'Enter your email or username to receive password reset instructions.'
              : tab === 'enter_code'
              ? 'Enter the 6-digit code or token sent to your email to set a new password.'
              : 'Private squad voice, video & chat hangout.'}
          </p>

          {/* Segmented Control Tabs (Clean 2-tab switch: Log In & Register) */}
          {(tab === 'login' || tab === 'register') && (
            <div className="flex bg-discord-darkest rounded-xl p-1 mt-4 border border-discord-darkest">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-discord-blurple text-white shadow'
                    : 'text-discord-gray-400 hover:text-discord-gray-200'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-discord-blurple text-white shadow'
                    : 'text-discord-gray-400 hover:text-discord-gray-200'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {/* Back to Login link when in Forgot Password or Code mode */}
          {(tab === 'forgot_password' || tab === 'enter_code') && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-discord-blurple hover:text-discord-blurple-light transition-colors hover:underline font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Log In</span>
              </button>
            </div>
          )}

          {/* Invite Code Notice if prefilled */}
          {tab === 'register' && initialInviteCode && (
            <div className="mt-3 py-1 px-3 bg-discord-green/10 border border-discord-green/30 rounded-full inline-flex items-center gap-1.5 text-xs text-discord-green">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Joining with code: <strong className="font-mono">{initialInviteCode}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-discord-red/10 border border-discord-red/30 rounded-lg flex items-start gap-2 text-discord-red text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 bg-discord-green/10 border border-discord-green/30 rounded-lg flex items-center gap-2 text-discord-green text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1 & 2: LOGIN / REGISTER                                              */}
        {/* ========================================================================= */}
        {(tab === 'login' || tab === 'register') && (
          <form onSubmit={handleLoginOrRegister} className="space-y-3.5">
            {/* Email or Username */}
            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                {tab === 'login' ? 'Email or Username' : 'Email Address'} <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Mail className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={tab === 'login' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tab === 'login' ? 'Email address or username' : 'name@example.com'}
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            {/* Registration specific fields */}
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                    Username (Unique) <span className="text-discord-red">*</span>
                  </label>
                  <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                    <User className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. alex"
                      className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How your friends will see you"
                    className="w-full bg-discord-input rounded-lg text-sm text-discord-gray-100 px-3 py-2.5 border border-transparent focus:outline-none focus:border-discord-blurple"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider">
                      Invite Code
                    </label>
                    <span className="text-[10px] text-discord-gray-500">Optional for first founder</span>
                  </div>
                  <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                    <Key className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. sqd-a1b2c3 (Optional)"
                      className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 font-mono focus:outline-none uppercase"
                    />
                  </div>
                </div>

                {/* Founder / Admin toggle */}
                <div className="flex items-center gap-2 pt-1 select-none">
                  <input
                    type="checkbox"
                    id="founderToggle"
                    checked={isFounderAdmin}
                    onChange={(e) => setIsFounderAdmin(e.target.checked)}
                    className="rounded border-discord-darkest bg-discord-input text-discord-blurple focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="founderToggle" className="text-xs text-discord-gray-300 flex items-center gap-1 cursor-pointer">
                    <Shield className="w-3.5 h-3.5 text-discord-blurple-light" />
                    <span>Register as Server Founder / Administrator</span>
                  </label>
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider">
                  Password <span className="text-discord-red">*</span>
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot_password');
                      setResetIdentifier(email);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-discord-blurple hover:text-discord-blurple-light transition-colors hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-9 py-2.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-discord-gray-400 hover:text-discord-gray-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover active:bg-discord-blurple-hover/90 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{tab === 'login' ? 'Log In to SquadSpace' : 'Create Squad Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODE 3: FORGOT PASSWORD REQUEST                                            */}
        {/* ========================================================================= */}
        {tab === 'forgot_password' && (
          <form onSubmit={handleRequestPasswordReset} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                Email Address or Username <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Mail className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="e.g. alex or alex@example.com"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-discord-gray-500 mt-1.5">
                We'll resolve your account and send a secure reset link or 6-digit recovery code to your registered email.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover active:bg-discord-blurple-hover/90 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send Reset Instructions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-discord-gray-400 hover:text-discord-gray-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Log In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('enter_code');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-discord-blurple hover:text-discord-blurple-light transition-colors hover:underline cursor-pointer"
              >
                Have a 6-digit code?
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODE 4: ENTER RECOVERY OTP CODE DIRECTLY                                  */}
        {/* ========================================================================= */}
        {tab === 'enter_code' && (
          <form onSubmit={handleVerifyOtpAndReset} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                Registered Email <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Mail className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={resetSentEmail || resetIdentifier || email}
                  onChange={(e) => setResetSentEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                6-Digit Recovery Code or Token <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Key className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 font-mono focus:outline-none tracking-widest"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                New Password <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="•••••••••••• (min 6 characters)"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-9 py-2.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-discord-gray-400 hover:text-discord-gray-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                Confirm New Password <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-discord-green hover:bg-discord-green/90 active:bg-discord-green/80 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Verify Code & Reset Password</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setTab('forgot_password');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-discord-gray-400 hover:text-discord-gray-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Request a new code</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODE 5: SET NEW PASSWORD DIRECTLY (AFTER CLICKING MAGIC LINK)              */}
        {/* ========================================================================= */}
        {tab === 'set_new_password' && (
          <form onSubmit={handleSetNewPasswordDirect} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                New Password <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="•••••••••••• (min 6 characters)"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-9 py-2.5 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-discord-gray-400 hover:text-discord-gray-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                Confirm New Password <span className="text-discord-red">*</span>
              </label>
              <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover active:bg-discord-blurple-hover/90 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Save New Password & Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-discord-darkest/40 text-center text-xs text-discord-gray-400">
          {tab === 'login' ? (
            <div>
              <span>Need an account? </span>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className="text-discord-blurple-light hover:underline font-semibold cursor-pointer"
              >
                Register
              </button>
            </div>
          ) : tab === 'register' ? (
            <div>
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className="text-discord-blurple-light hover:underline font-semibold cursor-pointer"
              >
                Log In
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <span>SquadSpace secure account recovery via Supabase Auth</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
