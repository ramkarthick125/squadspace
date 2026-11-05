import React, { useState } from 'react';
import { Shield, Key, User, Mail, Lock, Sparkles, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../../lib/authService';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentUser, setIsAuthenticated } = useAuthStore() as any;

  const [mode, setMode] = useState<'login' | 'register' | 'admin-setup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
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
      } else {
        // Register or Admin Setup
        if (!username.trim()) {
          setError('Username is required.');
          setLoading(false);
          return;
        }

        const isAdmin = mode === 'admin-setup';
        const res = await authService.register({
          email: email.trim(),
          password,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          inviteCode: inviteCode.trim(),
          isAdminSetup: isAdmin,
        });

        if (res.error) {
          setError(res.error);
        } else {
          setSuccessMsg(isAdmin ? 'Admin account created successfully!' : 'Account registered successfully!');
          useAuthStore.setState({ currentUser: res.user, isAuthenticated: true });
          setTimeout(() => {
            if (onClose) onClose();
          }, 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4">
      <div className="w-full max-w-md bg-discord-chat rounded-2xl border border-discord-darkest shadow-2xl p-8 relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-discord-blurple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-discord-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Branding & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-discord-blurple rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-discord-blurple/30 mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'login' && 'Welcome back!'}
            {mode === 'register' && 'Create an account'}
            {mode === 'admin-setup' && 'Squad Administrator Setup'}
          </h2>
          <p className="text-xs text-discord-gray-400 mt-1">
            {mode === 'login' && 'Private Discord-style hangout for our close squad.'}
            {mode === 'register' && 'Enter your invite code to join this private server.'}
            {mode === 'admin-setup' && 'Initialize the founder account and squad server.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-discord-red/10 border border-discord-red/30 rounded-lg flex items-center gap-2 text-discord-red text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 bg-discord-green/10 border border-discord-green/30 rounded-lg flex items-center gap-2 text-discord-green text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email or Username for Login */}
          <div>
            <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
              {mode === 'login' ? 'Email or Username' : 'Email Address'}
            </label>
            <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
              <Mail className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
              <input
                type={mode === 'login' ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'login' ? 'name@example.com or username' : 'name@example.com'}
                className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Registration specific fields */}
          {mode !== 'login' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
                  Username (Unique)
                </label>
                <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                  <User className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. alex_gg"
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
                  placeholder="How you appear to friends"
                  className="w-full bg-discord-input rounded-lg text-sm text-discord-gray-100 px-3 py-2.5 border border-transparent focus:outline-none focus:border-discord-blurple"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider">
                      Invite Code <span className="text-discord-red">*</span>
                    </label>
                    <span className="text-[10px] text-discord-gray-500">Invite-only</span>
                  </div>
                  <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
                    <Key className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. squad-private-2026"
                      className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Password */}
          <div>
            <label className="block text-[11px] font-bold text-discord-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple">
              <Lock className="w-4 h-4 text-discord-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-transparent text-sm text-discord-gray-100 pl-9 pr-3 py-2.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover active:bg-discord-blurple-hover/90 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Log In'}
                  {mode === 'register' && 'Join SquadSpace'}
                  {mode === 'admin-setup' && 'Create Admin Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher Links */}
        <div className="mt-6 pt-4 border-t border-discord-divider/40 text-xs text-discord-gray-400 space-y-2">
          {mode === 'login' ? (
            <>
              <div>
                Need an account?{' '}
                <button
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-discord-blurple-light hover:underline font-semibold"
                >
                  Register with an invite code
                </button>
              </div>
              <div>
                First time server setup?{' '}
                <button
                  onClick={() => {
                    setMode('admin-setup');
                    setError(null);
                  }}
                  className="text-discord-green hover:underline font-semibold"
                >
                  Administrator setup
                </button>
              </div>
            </>
          ) : (
            <div>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-discord-blurple-light hover:underline font-semibold"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
