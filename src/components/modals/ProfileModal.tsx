import React, { useState, useEffect, useRef } from 'react';
import { X, Gamepad2, User, Lock, Sparkles, ShieldCheck, LogOut, Mic, Volume2, Keyboard, RotateCcw, Radio, Key } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../lib/authService';
import { useSettingsStore, formatKeyDisplay, KeybindConfig } from '../../store/useSettingsStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogoutRequested?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onLogoutRequested }) => {
  const { currentUser, updateProfile, updateCustomStatus, updateGamingActivity, logout } = useAuthStore();
  const {
    inputMode,
    setInputMode,
    keybinds,
    setKeybind,
    pttReleaseDelay,
    setPttReleaseDelay,
    resetKeybinds,
  } = useSettingsStore();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [aboutMe, setAboutMe] = useState(currentUser?.aboutMe || '');
  const [customStatus, setCustomStatus] = useState(currentUser?.customStatus || '');
  const [game, setGame] = useState(currentUser?.gamingActivity?.game || '');
  const [gameDetails, setGameDetails] = useState(currentUser?.gamingActivity?.details || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'voice' | 'keybinds' | 'security'>('profile');
  const [savedNotification, setSavedNotification] = useState(false);
  const [recordingKeybindFor, setRecordingKeybindFor] = useState<keyof KeybindConfig | null>(null);

  // Security & Password Reset States
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  const handleUpdatePassword = async () => {
    setPasswordStatusMsg(null);
    if (newPasswordInput.length < 6) {
      setPasswordStatusMsg({ text: 'New password must be at least 6 characters long.', type: 'error' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordStatusMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await authService.changePassword(newPasswordInput);
      if (res.success) {
        setPasswordStatusMsg({ text: 'Password successfully updated!', type: 'success' });
        setNewPasswordInput('');
        setConfirmPasswordInput('');
      } else {
        setPasswordStatusMsg({ text: res.error || 'Failed to update password.', type: 'error' });
      }
    } catch (err: any) {
      setPasswordStatusMsg({ text: err.message || 'Error updating password.', type: 'error' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!currentUser) return;
    setPasswordStatusMsg(null);
    setIsSendingResetEmail(true);
    try {
      const res = await authService.requestPasswordReset(currentUser.username);
      if (res.success) {
        setPasswordStatusMsg({
          text: `Password reset instructions sent to ${res.email || 'your registered email'}! Please check your inbox.`,
          type: 'success',
        });
      } else {
        setPasswordStatusMsg({ text: res.error || 'Failed to send reset email.', type: 'error' });
      }
    } catch (err: any) {
      setPasswordStatusMsg({ text: err.message || 'Error sending reset email.', type: 'error' });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // Key & Gaming Mouse recording listener
  useEffect(() => {
    if (!recordingKeybindFor) return;

    const handleKeyRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record lonely Escape (use it to cancel recording)
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setRecordingKeybindFor(null);
        return;
      }

      // Build key combination
      let combo = '';
      if (e.ctrlKey) combo += 'Ctrl+';
      if (e.shiftKey) combo += 'Shift+';
      if (e.altKey) combo += 'Alt+';

      // Pick clean key identifier
      let key = e.code;
      if (key.startsWith('Key')) key = key.slice(3);
      combo += key;

      setKeybind(recordingKeybindFor, combo);
      if (recordingKeybindFor === 'pushToTalk') {
        setInputMode('push_to_talk');
      }
      setRecordingKeybindFor(null);
    };

    const handleMouseRecord = (e: MouseEvent) => {
      // Don't record normal left click so user can click to cancel or navigate
      if (e.button === 0) return;

      e.preventDefault();
      e.stopPropagation();

      let mouseKey = '';
      if (e.button === 1) mouseKey = 'Mouse3';
      else if (e.button === 2) mouseKey = 'Mouse2';
      else if (e.button === 3) mouseKey = 'Mouse4';
      else if (e.button === 4) mouseKey = 'Mouse5';
      else mouseKey = `Mouse${e.button + 1}`;

      let combo = '';
      if (e.ctrlKey) combo += 'Ctrl+';
      if (e.shiftKey) combo += 'Shift+';
      if (e.altKey) combo += 'Alt+';
      combo += mouseKey;

      setKeybind(recordingKeybindFor, combo);
      if (recordingKeybindFor === 'pushToTalk') {
        setInputMode('push_to_talk');
      }
      setRecordingKeybindFor(null);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Native Electron gaming mouse backward/forward command listener
    const unbindAppCommand = window.electronAPI?.onAppCommandMouse?.((mouseBtn) => {
      if (recordingKeybindFor) {
        setKeybind(recordingKeybindFor, mouseBtn);
        if (recordingKeybindFor === 'pushToTalk') {
          setInputMode('push_to_talk');
        }
        setRecordingKeybindFor(null);
      }
    });

    window.addEventListener('keydown', handleKeyRecord, { capture: true });
    window.addEventListener('mousedown', handleMouseRecord, { capture: true });
    window.addEventListener('pointerdown', handleMouseRecord, { capture: true });
    window.addEventListener('auxclick', handleMouseRecord, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyRecord, { capture: true });
      window.removeEventListener('mousedown', handleMouseRecord, { capture: true });
      window.removeEventListener('pointerdown', handleMouseRecord, { capture: true });
      window.removeEventListener('auxclick', handleMouseRecord, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      if (unbindAppCommand) unbindAppCommand();
    };
  }, [recordingKeybindFor, setKeybind, setInputMode]);

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
                onClick={() => setActiveTab('keybinds')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'keybinds'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                <span>Keybinds</span>
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
              {activeTab === 'keybinds' && 'Keybinds & Shortcuts'}
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
                {/* Input Mode Selector: Voice Activity vs Push to Talk */}
                <div>
                  <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
                    Input Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Voice Activity Card */}
                    <div
                      onClick={() => setInputMode('open_mic')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        inputMode === 'open_mic'
                          ? 'bg-discord-blurple/10 border-discord-blurple ring-1 ring-discord-blurple'
                          : 'bg-discord-sidebar/60 border-discord-darkest hover:border-discord-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-white">Voice Activity</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            inputMode === 'open_mic'
                              ? 'border-discord-blurple bg-discord-blurple text-white'
                              : 'border-discord-gray-500'
                          }`}
                        >
                          {inputMode === 'open_mic' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-discord-gray-400 leading-relaxed">
                        Transmits automatically when you speak. Ideal for relaxed hangouts.
                      </p>
                    </div>

                    {/* Push-to-Talk Card */}
                    <div
                      onClick={() => setInputMode('push_to_talk')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        inputMode === 'push_to_talk'
                          ? 'bg-discord-blurple/10 border-discord-blurple ring-1 ring-discord-blurple'
                          : 'bg-discord-sidebar/60 border-discord-darkest hover:border-discord-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-white">Push to Talk</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            inputMode === 'push_to_talk'
                              ? 'border-discord-blurple bg-discord-blurple text-white'
                              : 'border-discord-gray-500'
                          }`}
                        >
                          {inputMode === 'push_to_talk' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-discord-gray-400 leading-relaxed">
                        Hold down a key to transmit your voice. Best for competitive gaming and noisy rooms.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Push-to-Talk Configuration Details */}
                {inputMode === 'push_to_talk' && (
                  <div className="bg-discord-sidebar p-4 rounded-xl border border-discord-darkest space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-discord-gray-200 uppercase tracking-wider block">
                          Shortcut Key
                        </span>
                        <p className="text-[11px] text-discord-gray-400 mt-0.5">
                          Hold this key down to speak in voice channels.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecordingKeybindFor(recordingKeybindFor === 'pushToTalk' ? null : 'pushToTalk')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          recordingKeybindFor === 'pushToTalk'
                            ? 'bg-discord-red text-white border-discord-red animate-pulse'
                            : 'bg-discord-darkest hover:bg-discord-hover text-white border-[#313338]'
                        }`}
                      >
                        {recordingKeybindFor === 'pushToTalk'
                          ? 'Press key or click mouse...'
                          : formatKeyDisplay(keybinds.pushToTalk)}
                      </button>
                    </div>

                    {/* Quick presets for Gaming Mouse */}
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-discord-gray-400 mr-1 font-semibold">Quick Select:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse4');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse4'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        🖱️ Mouse 4 (Back)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse5');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse5'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        🖱️ Mouse 5 (Forward)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse3');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse3'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        Middle Click
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'ControlRight');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'ControlRight'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        Right Ctrl
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Backquote');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Backquote'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        ~ Tilde
                      </button>
                    </div>

                    {recordingKeybindFor === 'pushToTalk' && (
                      <p className="text-[11px] text-discord-yellow font-medium">
                        Press the key or mouse button (Mouse 4/5) you want to use for Push to Talk. Press Esc to cancel.
                      </p>
                    )}

                    {/* Release Delay Slider */}
                    <div className="pt-2 border-t border-discord-darkest/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-discord-gray-300">
                          Push to Talk Release Delay
                        </span>
                        <span className="text-xs font-mono text-discord-blurple font-bold">
                          {pttReleaseDelay} ms
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2000"
                        step="50"
                        value={pttReleaseDelay}
                        onChange={(e) => setPttReleaseDelay(Number(e.target.value))}
                        className="w-full accent-discord-blurple cursor-pointer"
                      />
                      <p className="text-[10px] text-discord-gray-400 mt-1">
                        Keeps the microphone active briefly after releasing the key so your words aren't cut off.
                      </p>
                    </div>
                  </div>
                )}

                {/* Microphone Test */}
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
                  <span className="font-semibold text-white block">Echo Cancellation & Studio Filters</span>
                  <p className="text-discord-gray-400 text-[11px]">
                    WebRTC zero-delay echo cancellation and background noise suppression are active across all voice channels.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'keybinds' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-discord-gray-200 uppercase tracking-wider">
                      Configurable Keybindings
                    </h3>
                    <p className="text-xs text-discord-gray-400 mt-1">
                      Configure your shortcut keys. In the desktop app, these work globally even while in full-screen games.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetKeybinds}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-discord-sidebar hover:bg-discord-hover text-discord-gray-300 hover:text-white text-xs font-semibold border border-discord-darkest transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Keybinds Table */}
                <div className="bg-discord-sidebar rounded-xl border border-discord-darkest overflow-hidden divide-y divide-discord-darkest/60">
                  {/* Push to Talk Keybind */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm text-white block">Push to Talk</span>
                        <span className="text-xs text-discord-gray-400">
                          Activates microphone while held down. Supports keyboard keys and Gaming Mouse buttons (Mouse 4, Mouse 5, Middle Click).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRecordingKeybindFor(recordingKeybindFor === 'pushToTalk' ? null : 'pushToTalk')
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          recordingKeybindFor === 'pushToTalk'
                            ? 'bg-discord-red text-white border-discord-red animate-pulse'
                            : 'bg-discord-darkest hover:bg-discord-hover text-white border-[#313338]'
                        }`}
                      >
                        {recordingKeybindFor === 'pushToTalk'
                          ? 'Click mouse or press key...'
                          : formatKeyDisplay(keybinds.pushToTalk)}
                      </button>
                    </div>

                    {/* Quick presets for Gaming Mouse */}
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-discord-gray-400 mr-1 font-semibold">Quick Select:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse4');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse4'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        🖱️ Mouse 4 (Back)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse5');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse5'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        🖱️ Mouse 5 (Forward)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Mouse3');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Mouse3'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        Middle Click
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'ControlRight');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'ControlRight'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        Right Ctrl
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKeybind('pushToTalk', 'Backquote');
                          setInputMode('push_to_talk');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          keybinds.pushToTalk === 'Backquote'
                            ? 'bg-discord-blurple text-white border-discord-blurple shadow'
                            : 'bg-discord-darkest hover:bg-discord-hover text-discord-gray-300 border-discord-darkest/80'
                        }`}
                      >
                        ` (Tilde)
                      </button>
                    </div>
                  </div>

                  {/* Toggle Mute Keybind */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white block">Toggle Mute</span>
                      <span className="text-xs text-discord-gray-400">
                        Mutes or unmutes your microphone
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRecordingKeybindFor(recordingKeybindFor === 'toggleMute' ? null : 'toggleMute')
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        recordingKeybindFor === 'toggleMute'
                          ? 'bg-discord-red text-white border-discord-red animate-pulse'
                          : 'bg-discord-darkest hover:bg-discord-hover text-white border-[#313338]'
                      }`}
                    >
                      {recordingKeybindFor === 'toggleMute'
                        ? 'Press keys...'
                        : formatKeyDisplay(keybinds.toggleMute)}
                    </button>
                  </div>

                  {/* Toggle Deafen Keybind */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-white block">Toggle Deafen</span>
                      <span className="text-xs text-discord-gray-400">
                        Mutes both microphone and incoming audio
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRecordingKeybindFor(recordingKeybindFor === 'toggleDeafen' ? null : 'toggleDeafen')
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        recordingKeybindFor === 'toggleDeafen'
                          ? 'bg-discord-red text-white border-discord-red animate-pulse'
                          : 'bg-discord-darkest hover:bg-discord-hover text-white border-[#313338]'
                      }`}
                    >
                      {recordingKeybindFor === 'toggleDeafen'
                        ? 'Press keys...'
                        : formatKeyDisplay(keybinds.toggleDeafen)}
                    </button>
                  </div>
                </div>

                {recordingKeybindFor && (
                  <div className="p-3 rounded-lg bg-discord-blurple/10 border border-discord-blurple text-xs text-discord-blurple-light">
                    Press any key or key combination (e.g. Right Ctrl, Space, T, Ctrl+M) to record the new keybind. Press Escape to cancel.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <div className="p-3 bg-discord-sidebar rounded-lg border border-discord-darkest">
                  <div className="flex items-center gap-2 text-discord-green text-sm font-bold mb-1">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Supabase Authentication Active</span>
                  </div>
                  <p className="text-xs text-discord-gray-400">
                    Your account is secured with Supabase Auth cryptographic hashing and Row-Level Security.
                  </p>
                </div>

                {passwordStatusMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      passwordStatusMsg.type === 'success'
                        ? 'bg-discord-green/10 border border-discord-green/30 text-discord-green'
                        : 'bg-discord-red/10 border border-discord-red/30 text-discord-red'
                    }`}
                  >
                    <span>{passwordStatusMsg.text}</span>
                  </div>
                )}

                {/* Section 1: Change Password */}
                <div className="bg-discord-sidebar/60 p-4 rounded-xl border border-discord-darkest space-y-3">
                  <h3 className="text-xs font-bold text-discord-gray-200 uppercase tracking-wider">
                    Change Password
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-discord-gray-300 mb-1">
                      New Password (min 6 characters)
                    </label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full bg-discord-input text-discord-gray-100 rounded-lg p-2.5 text-sm border border-transparent focus:border-discord-blurple focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-discord-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-discord-input text-discord-gray-100 rounded-lg p-2.5 text-sm border border-transparent focus:border-discord-blurple focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isUpdatingPassword || !newPasswordInput}
                    onClick={handleUpdatePassword}
                    className="px-4 py-2 bg-discord-blurple hover:bg-discord-blurple-hover active:bg-discord-blurple-hover/90 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
                  </button>
                </div>

                {/* Section 2: Forgot Password / Email Recovery */}
                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                    <Key className="w-4 h-4" />
                    <span>Forgot Your Password?</span>
                  </div>
                  <p className="text-xs text-discord-gray-300">
                    Lost or forgot your password? Click below to send a password reset magic link and 6-digit recovery code directly to your registered email address.
                  </p>
                  <button
                    type="button"
                    disabled={isSendingResetEmail}
                    onClick={handleSendResetEmail}
                    className="mt-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-black font-bold rounded-lg text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    {isSendingResetEmail ? (
                      <span>Sending Reset Instructions...</span>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Send Password Reset Email</span>
                      </>
                    )}
                  </button>
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
