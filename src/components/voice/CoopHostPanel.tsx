import React from 'react';
import { useCoopStore } from '../../store/useCoopStore';
import { CoopInputMode, CoopSlot } from '../../types/coop';
import {
  Gamepad2,
  Keyboard,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  UserX,
  ExternalLink,
  Users,
} from 'lucide-react';

export const CoopHostPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    isCoopHost,
    players,
    pendingRequests,
    driverStatus,
    acceptRequest,
    denyRequest,
    kickPlayer,
    togglePausePlayer,
    changePlayerMode,
    stopHostCoop,
    panicDisconnect,
  } = useCoopStore();

  const isDriverReady = Boolean(driverStatus?.vigemAvailable);

  const SLOTS: CoopSlot[] = [2, 3, 4];

  return (
    <div className="absolute top-16 right-4 w-96 max-h-[85vh] bg-[#2b2d31]/95 backdrop-blur-xl border border-[#3f4147] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#1e1f22]/80 border-b border-[#3f4147] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Co-op Remote Play
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Parsec Mode
              </span>
            </h3>
            <p className="text-xs text-zinc-400">Multiplayer Xbox & Keyboard Injection</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-700/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
        {/* Driver Status Card */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            isDriverReady
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          }`}
        >
          {isDriverReady ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-semibold text-xs">
              {isDriverReady ? 'ViGEmBus Driver Ready' : 'ViGEm Driver Recommended'}
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {isDriverReady
                ? 'Virtual Xbox 360 controllers are active. Games will detect remote players natively as Player 2, 3, and 4.'
                : 'To spawn virtual Xbox 360 controllers, install the free signed ViGEmBus kernel driver.'}
            </p>
            {!isDriverReady && (
              <a
                href="https://github.com/nefarius/ViGEmBus/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-amber-300 hover:text-white underline"
              >
                Download Official ViGEmBus Setup <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Panic Disconnect Banner */}
        <div className="bg-[#1e1f22] p-2.5 rounded-xl border border-zinc-700/50 flex items-center justify-between text-zinc-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-[11px]">
              Panic Hotkey: <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-white font-mono">Ctrl+Shift+P</kbd>
            </span>
          </div>
          <button
            onClick={() => panicDisconnect()}
            className="text-[10px] font-semibold bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white px-2.5 py-1 rounded-md transition-colors"
          >
            Emergency Stop
          </button>
        </div>

        {/* Pending Join Requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Incoming Requests ({pendingRequests.length})
            </div>
            {pendingRequests.map((req) => (
              <div
                key={req.requestId}
                className="bg-[#1e1f22] p-3 rounded-xl border border-amber-500/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={req.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-zinc-600"
                    />
                    <div>
                      <div className="font-semibold text-white text-xs">{req.user.displayName}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                        {req.requestedMode === 'gamepad' ? (
                          <>
                            <Gamepad2 className="w-3 h-3 text-indigo-400" /> Xbox Controller
                          </>
                        ) : (
                          <>
                            <Keyboard className="w-3 h-3 text-emerald-400" /> Keyboard & Mouse
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => acceptRequest(req.requestId)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1 px-2 rounded-lg text-xs transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => denyRequest(req.requestId)}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 py-1 px-3 rounded-lg text-xs transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Player Slots (1-4) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Player Slots (Max 4 Players)
          </div>

          {/* Slot 1: Host */}
          <div className="bg-[#1e1f22] p-2.5 rounded-xl border border-zinc-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs">
                P1
              </span>
              <div>
                <div className="font-semibold text-white text-xs">You (Host)</div>
                <div className="text-[10px] text-zinc-400">Primary Local Player</div>
              </div>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
              Host
            </span>
          </div>

          {/* Slots 2, 3, 4 */}
          {SLOTS.map((slotNum) => {
            const player = players.find((p) => p.slot === slotNum);

            if (player) {
              return (
                <div
                  key={slotNum}
                  className="bg-[#1e1f22] p-2.5 rounded-xl border border-zinc-700/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center text-xs">
                        P{slotNum}
                      </span>
                      <img
                        src={player.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                          {player.user.displayName}
                          {player.isPaused && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">
                              Paused
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          {player.inputMode === 'gamepad' ? 'Xbox 360 Controller' : 'Keyboard & Mouse'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePausePlayer(slotNum)}
                        title={player.isPaused ? 'Resume Input' : 'Pause Input'}
                        className={`p-1.5 rounded-md transition-colors ${
                          player.isPaused
                            ? 'bg-amber-600 text-white hover:bg-amber-500'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        {player.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => kickPlayer(slotNum)}
                        title="Disconnect Player"
                        className="p-1.5 bg-zinc-800 hover:bg-rose-600/80 text-zinc-400 hover:text-white rounded-md transition-colors"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mode switch */}
                  <div className="flex items-center gap-1 pt-1 border-t border-zinc-800">
                    <button
                      onClick={() => changePlayerMode(slotNum, 'gamepad')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-colors ${
                        player.inputMode === 'gamepad'
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Gamepad2 className="w-3 h-3" /> Controller
                    </button>
                    <button
                      onClick={() => changePlayerMode(slotNum, 'keyboard_mouse')}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-colors ${
                        player.inputMode === 'keyboard_mouse'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Keyboard className="w-3 h-3" /> Keyboard
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={slotNum}
                className="bg-[#1e1f22]/50 p-2.5 rounded-xl border border-dashed border-zinc-700/60 flex items-center justify-between text-zinc-500"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-500 font-bold flex items-center justify-center text-xs">
                    P{slotNum}
                  </span>
                  <span className="text-xs">Open Slot</span>
                </div>
                <span className="text-[10px] italic">Waiting for request...</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-[#1e1f22]/90 border-t border-[#3f4147] flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">
          {players.length} remote {players.length === 1 ? 'player' : 'players'} connected
        </span>
        <button
          onClick={() => {
            stopHostCoop();
            onClose();
          }}
          className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          End Co-op Session
        </button>
      </div>
    </div>
  );
};
