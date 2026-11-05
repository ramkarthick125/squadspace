import React, { useState, useEffect, useRef } from 'react';
import { X, Gamepad2, User, Lock, Sparkles, ShieldCheck, LogOut, Mic, Volume2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../lib/authService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogoutRequested?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onLogoutRequested }) => {
  const { currentUser, updateProfile, updateCustomStatus, updateGamingActivity, logout } = useAuthStore();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [aboutMe, setAboutMe] = useState(currentUser?.aboutMe || '');
  const [customStatus, setCustomStatus] = useState(currentUser?.customStatus || '');
  const [game, setGame] = useState(currentUser?.gamingActivity?.game || '');
  const [gameDetails, setGameDetails] = useState(currentUser?.gamingActivity?.details || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'voice' | 'security'>('profile');
  const [savedNotification, setSavedNotification] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setAboutMe(currentUser.aboutMe || '');
      setCustomStatus(currentUser.customStatus || '');
      setGame(currentUser.gamingActivity?.game || '');
      setGameDetails(currentUser.gamingActivity?.details || '');
    }
  }, [currentUser]);

  // Live Mic Test State
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testMicLevel, setTestMicLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testAnimRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  const stopMicTest = () => {
    if (testAnimRef.current) {
      cancelAnimationFrame(testAnimRef.current);
      testAnimRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
    setIsTestingMic(false);
    setTestMicLevel(0);
  };

  const startMicTest = async () => {
    try {
      stopMicTest();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      testAudioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const check = () => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const avg = sum / buffer.length;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setTestMicLevel(level);
        testAnimRef.current = requestAnimationFrame(check);
      };

      testAnimRef.current = requestAnimationFrame(check);
    } catch (err) {
      alert('Could not access microphone. Please allow microphone access in your browser.');
    }
  };

  if (!isOpen || !currentUser) return null;

  const handleSave = () => {
    updateProfile({
      displayName: displayName.trim() || currentUser.username,
      aboutMe: aboutMe.trim(),
    });

    updateCustomStatus(customStatus.trim());

    if (game.trim()) {
      updateGamingActivity({
        game: game.trim(),
        details: gameDetails.trim() || undefined,
        startedAt: currentUser.gamingActivity?.startedAt || new Date().toISOString(),
      });
    } else {
      updateGamingActivity(undefined);
    }

    setSavedNotification(true);
    setTimeout(() => {
      setSavedNotification(false);
      onClose();
    }, 800);
  };

  const presetGames = ['Valorant', 'Minecraft', 'GTA V', 'League of Legends', 'Apex Legends', 'Studying', 'Watching a Movie'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-2xl bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl flex overflow-hidden max-h-[85vh]">
        {/* Modal Left Sidebar */}
        <div className="w-48 bg-discord-sidebar p-4 border-r border-discord-darkest/60 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider px-2 mb-2">
              User Settings
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => setActiveTab('activity')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'activity'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Activity / Game</span>
              </button>

              <button
                onClick={() => setActiveTab('voice')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'voice'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Voice & Video</span>
              </button>

              <button
                onClick={() => setActiveTab('security')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'security'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Security</span>
              </button>

              <div className="pt-2 border-t border-discord-darkest/60">
                <button
                  onClick={async () => {
                    await authService.logout(currentUser.id);
                    logout();
                    onClose();
                    if (onLogoutRequested) onLogoutRequested();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 text-discord-red hover:bg-discord-red/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-discord-gray-500 px-2">
            SquadSpace v1.0 • Private Friend Network
          </div>
        </div>

        {/* Modal Right Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-discord-chat">
          {/* Header */}
          <div className="h-12 px-6 flex items-center justify-between border-b border-discord-darkest/60">
            <h2 className="font-bold text-discord-gray-100 text-base">
              {activeTab === 'profile' && 'User Profile'}
              {activeTab === 'activity' && 'Gaming & Activity Status'}
              {activeTab === 'voice' && 'Voice & Video Settings'}
              {activeTab === 'security' && 'Account Security'}
            </h2>
            <button
              onClick={onClose}
              className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {activeTab === 'profile' && (
              <>
                {/* Profile Preview Card */}
                <div className="bg-discord-sidebar rounded-lg p-4 flex items-center gap-4 border border-discord-darkest">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-discord-blurple"
                  />
                  <div>
                    <h3 className="font-bold text-white text-lg">{displayName || currentUser.username}</h3>
                    <p className="text-xs text-discord-gray-400">@{currentUser.username}</p>
                    {customStatus && (
                      <p className="text-xs text-discord-blurple-light mt-1 italic">
                        "{customStatus}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                  />
                </div>

                {/* Custom Status */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Custom Status
                  </label>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="e.g. 🚀 Coding SquadSpace or AFK eating ramen"
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                  />
                </div>

                {/* About Me */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    About Me
                  </label>
                  <textarea
                    rows={3}
                    value={aboutMe}
                    onChange={(e) => setAboutMe(e.target.value)}
                    placeholder="Tell your squad what games you love, your setup, or what you are up to."
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-discord-blurple resize-none"
                  />
                </div>
              </>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <p className="text-xs text-discord-gray-300">
                  Set what game or activity you are playing so your friends know when to squad up!
                </p>

                {/* Game Quick Presets */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                    Popular Quick Picks
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetGames.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGame(g)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          game === g
                            ? 'bg-discord-green text-white'
                            : 'bg-discord-sidebar hover:bg-discord-hover text-discord-gray-200'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Game Name */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Game / Activity Name
                  </label>
                  <input
                    type="text"
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    placeholder="e.g. Valorant, Minecraft, or Custom Game"
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                  />
                </div>

                {/* Activity Details */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Details / Party Status
                  </label>
                  <input
                    type="text"
                    value={gameDetails}
                    onChange={(e) => setGameDetails(e.target.value)}
                    placeholder="e.g. Competitive - Need +2 or In Survival Mode"
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                  />
                </div>

                {game && (
                  <button
                    onClick={() => {
                      setGame('');
                      setGameDetails('');
                    }}
                    className="text-xs text-discord-red hover:underline"
                  >
                    Clear Current Activity
                  </button>
                )}
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-discord-gray-200 uppercase tracking-wider mb-2">
                    Microphone Test & Real Hardware Check
                  </h3>
                  <p className="text-xs text-discord-gray-400 mb-4">
                    Speak into your microphone. When the green bar bounces, SquadSpace is actively streaming your voice!
                  </p>

                  <div className="bg-discord-sidebar p-4 rounded-xl border border-discord-darkest space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-discord-gray-300">Live Input Volume</span>
                      <span className="text-xs font-mono text-discord-green font-bold">{testMicLevel}%</span>
                    </div>

                    {/* Realtime Decibel Green Meter Bar */}
                    <div className="w-full h-3 bg-discord-darkest rounded-full overflow-hidden p-0.5 border border-discord-darkest">
                      <div
                        className="h-full bg-gradient-to-r from-discord-green via-discord-yellow to-discord-red rounded-full transition-all duration-75"
                        style={{ width: `${testMicLevel}%` }}
                      />
                    </div>

                    <div className="pt-2">
                      {isTestingMic ? (
                        <button
                          type="button"
                          onClick={stopMicTest}
                          className="px-4 py-2 rounded-lg bg-discord-red hover:bg-discord-red-hover text-white text-xs font-bold transition-colors"
                        >
                          Stop Mic Test
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startMicTest}
                          className="px-4 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-bold transition-colors"
                        >
                          Let's Check (Test My Mic)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-discord-sidebar/60 border border-discord-darkest rounded-lg text-xs text-discord-gray-300 space-y-1">
                  <span className="font-semibold text-white block">Echo Cancellation & Noise Suppression</span>
                  <p className="text-discord-gray-400 text-[11px]">
                    Automatic gain control and WebRTC noise filters are enabled by default for studio-quality voice hangouts.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="p-3 bg-discord-sidebar rounded-lg border border-discord-darkest">
                  <div className="flex items-center gap-2 text-discord-green text-sm font-bold mb-1">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Supabase Authentication Active</span>
                  </div>
                  <p className="text-xs text-discord-gray-400">
                    Your password and tokens are securely encrypted via Supabase Auth with Row-Level Security.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new strong password"
                    className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-16 bg-discord-sidebar/80 px-6 flex items-center justify-between border-t border-discord-darkest/60">
            {savedNotification ? (
              <span className="text-discord-green text-xs font-semibold animate-pulse">
                Changes saved successfully!
              </span>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold shadow transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
