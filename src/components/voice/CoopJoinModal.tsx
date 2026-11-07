import React, { useState, useEffect } from 'react';
import { useCoopStore } from '../../store/useCoopStore';
import { CoopInputMode, CoopSlot } from '../../types/coop';
import { UserProfile } from '../../types';
import { coopClient } from '../../lib/coopClient';
import {
  Gamepad2,
  Keyboard,
  X,
  CheckCircle2,
  Loader2,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface CoopJoinModalProps {
  hostUserId: string;
  hostName: string;
  currentUser: UserProfile;
  onClose: () => void;
}

export const CoopJoinModal: React.FC<CoopJoinModalProps> = ({
  hostUserId,
  hostName,
  currentUser,
  onClose,
}) => {
  const {
    mySlot,
    myInputMode,
    isRequested,
    requestJoin,
    cancelJoinRequest,
    leaveCoop,
    setMyInputMode,
  } = useCoopStore();

  const [selectedMode, setSelectedMode] = useState<CoopInputMode>(myInputMode || 'gamepad');
  const [preferredSlot, setPreferredSlot] = useState<CoopSlot | undefined>(undefined);
  const [detectedGamepad, setDetectedGamepad] = useState<string | null>(null);

  useEffect(() => {
    const checkGp = () => {
      const name = coopClient.getConnectedGamepadName();
      setDetectedGamepad(name);
    };

    checkGp();
    const interval = setInterval(checkGp, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendRequest = () => {
    setMyInputMode(selectedMode);
    requestJoin(hostUserId, currentUser, selectedMode, preferredSlot);
  };

  const isPlaying = mySlot !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#313338] border border-[#3f4147] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#2b2d31] border-b border-[#3f4147] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                Co-op Remote Play
                <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Parsec Style
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Play multiplayer games with {hostName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {isPlaying ? (
            /* Active Playing State */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
                  <Gamepad2 className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="font-bold text-white text-sm">
                  You are Connected as Player {mySlot}!
                </h4>
                <p className="text-zinc-300 text-xs">
                  Your inputs are currently injected on {hostName}&apos;s PC via virtual Xbox 360 controller.
                </p>
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Mode: {myInputMode === 'gamepad' ? 'Xbox Gamepad' : 'Keyboard & Mouse'}
                </div>
              </div>

              <button
                onClick={() => {
                  leaveCoop();
                  onClose();
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" /> Disconnect & Leave Game
              </button>
            </div>
          ) : isRequested ? (
            /* Request Pending State */
            <div className="p-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h4 className="font-bold text-white text-sm">Request Sent to {hostName}</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Waiting for the host to approve your co-op connection...
              </p>
              <button
                onClick={cancelJoinRequest}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold py-2 px-4 rounded-xl transition-colors text-xs"
              >
                Cancel Request
              </button>
            </div>
          ) : (
            /* Setup & Selection State */
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Choose Your Input Device
                </label>

                {/* Gamepad Option */}
                <div
                  onClick={() => setSelectedMode('gamepad')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedMode === 'gamepad'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-[#2b2d31] border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Gamepad2 className={`w-5 h-5 ${selectedMode === 'gamepad' ? 'text-indigo-400' : 'text-zinc-400'}`} />
                      <div>
                        <div className="font-semibold text-xs">Xbox / PC Gamepad</div>
                        <div className="text-[11px] text-zinc-400">
                          Recommended for Overcooked, It Takes Two, FIFA, etc.
                        </div>
                      </div>
                    </div>
                    {selectedMode === 'gamepad' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </div>

                  {/* Detected Gamepad Status */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-700/40 flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-zinc-300 font-mono truncate">
                      {detectedGamepad ? `Detected: ${detectedGamepad}` : 'Plug in any Xbox, PS4/PS5, or USB controller'}
                    </span>
                  </div>
                </div>

                {/* Keyboard & Mouse Option */}
                <div
                  onClick={() => setSelectedMode('keyboard_mouse')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedMode === 'keyboard_mouse'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-[#2b2d31] border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <Keyboard className={`w-5 h-5 ${selectedMode === 'keyboard_mouse' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                      <div>
                        <div className="font-semibold text-xs">Keyboard & Mouse</div>
                        <div className="text-[11px] text-zinc-400">
                          Control the game window with your keyboard and mouse clicks
                        </div>
                      </div>
                    </div>
                    {selectedMode === 'keyboard_mouse' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Slot Preference */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Player Slot Preference
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Auto', val: undefined },
                    { label: 'P2', val: 2 as CoopSlot },
                    { label: 'P3', val: 3 as CoopSlot },
                    { label: 'P4', val: 4 as CoopSlot },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setPreferredSlot(item.val)}
                      className={`py-2 rounded-lg font-semibold text-xs border transition-colors ${
                        preferredSlot === item.val
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-[#2b2d31] text-zinc-300 border-zinc-700/60 hover:border-zinc-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSendRequest}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-lg shadow-indigo-600/30"
              >
                <Sparkles className="w-4 h-4" /> Request to Play
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
