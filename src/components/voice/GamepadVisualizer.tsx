import React, { useEffect, useState } from 'react';
import { coopClient } from '../../lib/coopClient';
import { CoopGamepadState } from '../../types/coop';
import { Gamepad2 } from 'lucide-react';

export const GamepadVisualizer: React.FC<{ slot: number; isPaused?: boolean }> = ({ slot, isPaused }) => {
  const [gpState, setGpState] = useState<CoopGamepadState | null>(null);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  useEffect(() => {
    coopClient.setGamepadPreviewListener((state, name) => {
      setGpState(state);
      setGamepadName(name);
    });

    return () => {
      coopClient.setGamepadPreviewListener(null);
    };
  }, []);

  if (!gpState) return null;

  const { axes, buttons, triggers } = gpState;

  return (
    <div className="flex items-center gap-2 bg-[#111214]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#3f4147] shadow-xl text-xs select-none">
      <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
        <Gamepad2 className="w-4 h-4 animate-pulse" />
        <span>P{slot}</span>
      </div>

      <div className="h-3 w-px bg-zinc-700" />

      {/* Left Stick Visualizer */}
      <div className="relative w-5 h-5 rounded-full border border-zinc-600 bg-zinc-800/80 flex items-center justify-center">
        <div
          className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm transition-transform duration-75"
          style={{
            transform: `translate(${axes.leftX * 6}px, ${-axes.leftY * 6}px)`,
          }}
        />
      </div>

      {/* DPad Indicators */}
      <div className="flex gap-0.5 text-[9px] font-mono text-zinc-400">
        <span className={buttons.dpadUp ? 'text-white font-bold' : 'opacity-40'}>▲</span>
        <span className={buttons.dpadDown ? 'text-white font-bold' : 'opacity-40'}>▼</span>
        <span className={buttons.dpadLeft ? 'text-white font-bold' : 'opacity-40'}>◄</span>
        <span className={buttons.dpadRight ? 'text-white font-bold' : 'opacity-40'}>►</span>
      </div>

      {/* ABXY Buttons */}
      <div className="flex items-center gap-1 font-bold text-[10px]">
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            buttons.A ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          A
        </span>
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            buttons.B ? 'bg-red-500 text-white' : 'bg-zinc-800 text-red-400 border border-red-500/30'
          }`}
        >
          B
        </span>
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            buttons.X ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-blue-400 border border-blue-500/30'
          }`}
        >
          X
        </span>
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
            buttons.Y ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-amber-300 border border-amber-400/30'
          }`}
        >
          Y
        </span>
      </div>

      {/* Triggers indicator */}
      {(triggers.left > 0.1 || triggers.right > 0.1) && (
        <div className="flex items-center gap-1 text-[9px] text-zinc-400">
          {triggers.left > 0.1 && <span className="bg-zinc-700 px-1 rounded">LT</span>}
          {triggers.right > 0.1 && <span className="bg-zinc-700 px-1 rounded">RT</span>}
        </div>
      )}

      {isPaused && (
        <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-medium">
          Input Paused by Host
        </span>
      )}
    </div>
  );
};
