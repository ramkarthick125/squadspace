import { create } from 'zustand';

export type VoiceInputMode = 'open_mic' | 'push_to_talk';

export interface KeybindConfig {
  pushToTalk: string;     // e.g. 'ControlRight', 'KeyT', 'Backquote', 'Space'
  toggleMute: string;     // e.g. 'Ctrl+Shift+M'
  toggleDeafen: string;   // e.g. 'Ctrl+Shift+D'
}

interface SettingsState {
  inputMode: VoiceInputMode;
  keybinds: KeybindConfig;
  pttReleaseDelay: number; // in milliseconds (default 200ms)
  isPttPressed: boolean;

  setInputMode: (mode: VoiceInputMode) => void;
  setKeybind: (action: keyof KeybindConfig, key: string) => void;
  setPttReleaseDelay: (ms: number) => void;
  setPttPressed: (pressed: boolean) => void;
  resetKeybinds: () => void;
}

const DEFAULT_KEYBINDS: KeybindConfig = {
  pushToTalk: 'ControlRight',
  toggleMute: 'Ctrl+Shift+M',
  toggleDeafen: 'Ctrl+Shift+D',
};

const STORAGE_KEY = 'squadspace_user_settings_v1';

function loadInitialSettings(): { inputMode: VoiceInputMode; keybinds: KeybindConfig; pttReleaseDelay: number } {
  if (typeof window === 'undefined') {
    return { inputMode: 'open_mic', keybinds: DEFAULT_KEYBINDS, pttReleaseDelay: 200 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        inputMode: parsed.inputMode || 'open_mic',
        keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds || {}) },
        pttReleaseDelay: typeof parsed.pttReleaseDelay === 'number' ? parsed.pttReleaseDelay : 200,
      };
    }
  } catch {}
  return { inputMode: 'open_mic', keybinds: DEFAULT_KEYBINDS, pttReleaseDelay: 200 };
}

function persistSettings(data: { inputMode: VoiceInputMode; keybinds: KeybindConfig; pttReleaseDelay: number }) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }
}

const initial = loadInitialSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  inputMode: initial.inputMode,
  keybinds: initial.keybinds,
  pttReleaseDelay: initial.pttReleaseDelay,
  isPttPressed: false,

  setInputMode: (inputMode) => {
    set({ inputMode });
    persistSettings({
      inputMode,
      keybinds: get().keybinds,
      pttReleaseDelay: get().pttReleaseDelay,
    });
  },

  setKeybind: (action, key) => {
    const updated = { ...get().keybinds, [action]: key };
    set({ keybinds: updated });
    persistSettings({
      inputMode: get().inputMode,
      keybinds: updated,
      pttReleaseDelay: get().pttReleaseDelay,
    });
  },

  setPttReleaseDelay: (pttReleaseDelay) => {
    set({ pttReleaseDelay });
    persistSettings({
      inputMode: get().inputMode,
      keybinds: get().keybinds,
      pttReleaseDelay,
    });
  },

  setPttPressed: (isPttPressed) => set({ isPttPressed }),

  resetKeybinds: () => {
    set({ keybinds: DEFAULT_KEYBINDS });
    persistSettings({
      inputMode: get().inputMode,
      keybinds: DEFAULT_KEYBINDS,
      pttReleaseDelay: get().pttReleaseDelay,
    });
  },
}));

/**
 * Helper to display human-friendly key names
 */
export function formatKeyDisplay(code: string): string {
  if (!code) return 'None';
  if (code === 'ControlRight') return 'Right Ctrl';
  if (code === 'ControlLeft') return 'Left Ctrl';
  if (code === 'ShiftRight') return 'Right Shift';
  if (code === 'ShiftLeft') return 'Left Shift';
  if (code === 'AltRight') return 'Right Alt';
  if (code === 'AltLeft') return 'Left Alt';
  if (code === 'Backquote') return '` (Tilde)';
  if (code === 'Space') return 'Space';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
