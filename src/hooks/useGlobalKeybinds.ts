import { useEffect, useRef } from 'react';
import { useSettingsStore, KeybindConfig } from '../store/useSettingsStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { webrtcManager } from '../lib/webrtcManager';
import { sounds } from '../lib/soundEffects';

/**
 * Normalizes keyboard event to match keybind strings (e.g. 'ControlRight', 'Ctrl+Shift+M')
 */
export function matchesKeybind(e: KeyboardEvent, bind: string): boolean {
  if (!bind) return false;

  const parts = bind.split('+').map((p) => p.trim());
  const keyPart = parts[parts.length - 1];
  const requiresCtrl = parts.includes('Ctrl') || parts.includes('Control');
  const requiresShift = parts.includes('Shift');
  const requiresAlt = parts.includes('Alt');

  // Check modifiers
  if (requiresCtrl && !e.ctrlKey && !e.metaKey) return false;
  if (requiresShift && !e.shiftKey) return false;
  if (requiresAlt && !e.altKey) return false;

  // Check key code or key name
  if (
    e.code === keyPart ||
    e.key.toLowerCase() === keyPart.toLowerCase() ||
    e.code.toLowerCase() === keyPart.toLowerCase()
  ) {
    return true;
  }

  return false;
}

export function useGlobalKeybinds() {
  const { inputMode, keybinds, pttReleaseDelay, isPttPressed, setPttPressed } = useSettingsStore();
  const { activeVoiceChannelId, toggleMute, toggleDeafen } = useVoiceStore();

  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPttDownRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a text field (unless it's a pure modifier like CtrlRight)
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // 1. Push to Talk Key
      if (inputMode === 'push_to_talk' && activeVoiceChannelId) {
        if (matchesKeybind(e, keybinds.pushToTalk)) {
          // Allow PTT even while focusing input if it's Right Ctrl / mouse / F-key
          if (!isInput || keybinds.pushToTalk.includes('Control') || keybinds.pushToTalk.includes('Alt')) {
            if (releaseTimeoutRef.current) {
              clearTimeout(releaseTimeoutRef.current);
              releaseTimeoutRef.current = null;
            }

            if (!isPttDownRef.current) {
              isPttDownRef.current = true;
              setPttPressed(true);
              webrtcManager.setPttActive(true);
              sounds.playPttActivate();
            }
          }
        }
      }

      // If user is actively typing in a chat input, skip shortcut keys like Mute/Deafen
      if (isInput) return;

      // 2. Toggle Mute Key
      if (matchesKeybind(e, keybinds.toggleMute)) {
        e.preventDefault();
        toggleMute();
      }

      // 3. Toggle Deafen Key
      if (matchesKeybind(e, keybinds.toggleDeafen)) {
        e.preventDefault();
        toggleDeafen();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (inputMode === 'push_to_talk' && activeVoiceChannelId) {
        if (matchesKeybind(e, keybinds.pushToTalk)) {
          if (isPttDownRef.current) {
            // Discord PTT release delay (grace period)
            if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
            releaseTimeoutRef.current = setTimeout(() => {
              isPttDownRef.current = false;
              setPttPressed(false);
              webrtcManager.setPttActive(false);
              sounds.playPttDeactivate();
            }, Math.max(50, pttReleaseDelay));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
    };
  }, [inputMode, keybinds, pttReleaseDelay, activeVoiceChannelId, toggleMute, toggleDeafen, setPttPressed]);
}
