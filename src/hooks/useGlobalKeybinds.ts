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

/**
 * Matches mouse button event to mouse keybind strings (e.g. 'Mouse4', 'Mouse5', 'Mouse3')
 */
export function matchesMousebind(e: MouseEvent, bind: string): boolean {
  if (!bind) return false;

  let mouseKey = '';
  if (e.button === 1) mouseKey = 'Mouse3';
  else if (e.button === 2) mouseKey = 'Mouse2';
  else if (e.button === 3) mouseKey = 'Mouse4';
  else if (e.button === 4) mouseKey = 'Mouse5';
  else if (e.button === 0) mouseKey = 'Mouse1';
  else mouseKey = `Mouse${e.button + 1}`;

  const parts = bind.split('+').map((p) => p.trim());
  const mainPart = parts[parts.length - 1];
  const requiresCtrl = parts.includes('Ctrl') || parts.includes('Control');
  const requiresShift = parts.includes('Shift');
  const requiresAlt = parts.includes('Alt');

  if (requiresCtrl && !e.ctrlKey) return false;
  if (requiresShift && !e.shiftKey) return false;
  if (requiresAlt && !e.altKey) return false;

  return mainPart.toLowerCase() === mouseKey.toLowerCase();
}

export function useGlobalKeybinds() {
  const { inputMode, keybinds, pttReleaseDelay, isPttPressed, setPttPressed } = useSettingsStore();
  const { activeVoiceChannelId, toggleMute, toggleDeafen } = useVoiceStore();

  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPttDownRef = useRef(false);

  // Synchronize audio track state immediately whenever inputMode or voice connection changes
  useEffect(() => {
    webrtcManager.updateAudioTrackState();
  }, [inputMode, activeVoiceChannelId]);

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

    // Mouse Button PTT Handlers (Gaming Mouse 4 / Mouse 5 / Middle Click)
    const handleMouseDown = (e: MouseEvent) => {
      if (inputMode === 'push_to_talk' && activeVoiceChannelId) {
        if (matchesMousebind(e, keybinds.pushToTalk)) {
          // Avoid left click triggering PTT on interactive elements unless specifically configured
          if (e.button === 0) return;

          e.preventDefault();
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
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (inputMode === 'push_to_talk' && activeVoiceChannelId) {
        const isTargetButton = matchesMousebind(e, keybinds.pushToTalk);
        // If the target button was released OR no mouse buttons remain pressed at all (e.buttons === 0)
        if (isTargetButton || (isPttDownRef.current && e.buttons === 0)) {
          if (isPttDownRef.current) {
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

    // When window loses focus in web browser, release PTT (keep active in Electron for in-game global PTT)
    const handleWindowBlur = () => {
      if (inputMode === 'push_to_talk' && isPttDownRef.current && !window.electronAPI?.isElectron) {
        if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
        isPttDownRef.current = false;
        setPttPressed(false);
        webrtcManager.setPttActive(false);
        sounds.playPttDeactivate();
      }
    };

    // Global Low-Level OS Hook: Works in full-screen games, other apps, or anywhere on Windows!
    const unbindGlobalInput = window.electronAPI?.onGlobalInput?.(({ type, code }) => {
      if (inputMode !== 'push_to_talk' || !activeVoiceChannelId) return;

      const target = keybinds.pushToTalk;
      const isMatch =
        code === target ||
        code.toLowerCase() === target.toLowerCase() ||
        (code.startsWith('Key') && target.toLowerCase() === code.slice(3).toLowerCase()) ||
        (target.startsWith('Key') && code.toLowerCase() === target.slice(3).toLowerCase());

      if (!isMatch) return;

      if (type === 'down') {
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
      } else if (type === 'up') {
        if (isPttDownRef.current) {
          if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
          releaseTimeoutRef.current = setTimeout(() => {
            isPttDownRef.current = false;
            setPttPressed(false);
            webrtcManager.setPttActive(false);
            sounds.playPttDeactivate();
          }, Math.max(50, pttReleaseDelay));
        }
      }
    });

    // Native Electron gaming mouse backward/forward command listener
    const unbindAppCommand = window.electronAPI?.onAppCommandMouse?.((mouseBtn) => {
      if (inputMode === 'push_to_talk' && activeVoiceChannelId && keybinds.pushToTalk === mouseBtn) {
        if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
        if (!isPttDownRef.current) {
          isPttDownRef.current = true;
          setPttPressed(true);
          webrtcManager.setPttActive(true);
          sounds.playPttActivate();
        }
        // Auto-release after release delay once pulse stops
        releaseTimeoutRef.current = setTimeout(() => {
          isPttDownRef.current = false;
          setPttPressed(false);
          webrtcManager.setPttActive(false);
          sounds.playPttDeactivate();
        }, Math.max(250, pttReleaseDelay));
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    window.addEventListener('pointerdown', handleMouseDown, { capture: true });
    window.addEventListener('pointerup', handleMouseUp, { capture: true });
    window.addEventListener('pointercancel', handleWindowBlur);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      window.removeEventListener('pointerdown', handleMouseDown, { capture: true });
      window.removeEventListener('pointerup', handleMouseUp, { capture: true });
      window.removeEventListener('pointercancel', handleWindowBlur);
      window.removeEventListener('blur', handleWindowBlur);
      if (unbindAppCommand) unbindAppCommand();
      if (unbindGlobalInput) unbindGlobalInput();
      if (releaseTimeoutRef.current) clearTimeout(releaseTimeoutRef.current);
    };
  }, [inputMode, keybinds, pttReleaseDelay, activeVoiceChannelId, toggleMute, toggleDeafen, setPttPressed]);
}
