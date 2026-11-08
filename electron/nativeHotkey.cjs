const path = require('path');

let koffi = null;
let GetAsyncKeyState = null;

try {
  koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');
} catch (err) {
  console.warn('[NativeHotkey] Koffi FFI load warning:', err.message);
}

// Windows Virtual-Key Codes mapping
const VK_MAP = {
  // Mouse buttons
  mouse1: 0x01, // Left
  mouse2: 0x02, // Right
  mouse3: 0x04, // Middle click
  mouse4: 0x05, // XBUTTON1 (Back / Side 1)
  mouse5: 0x06, // XBUTTON2 (Forward / Side 2)

  // Modifiers
  shift: 0x10,
  shiftleft: 0xa0,
  shiftright: 0xa1,
  ctrl: 0x11,
  control: 0x11,
  controlleft: 0xa2,
  controlright: 0xa3,
  alt: 0x12,
  altleft: 0xa4,
  altright: 0xa5,

  // Common special keys
  backquote: 0xc0,
  tilde: 0xc0,
  '`': 0xc0,
  '~': 0xc0,
  space: 0x20,
  tab: 0x09,
  capslock: 0x14,
  escape: 0x1b,
  esc: 0x1b,
  enter: 0x0d,
  return: 0x0d,
  backspace: 0x08,

  // Arrow keys
  arrowleft: 0x25,
  arrowup: 0x26,
  arrowright: 0x27,
  arrowdown: 0x28,

  // Navigation
  pageup: 0x21,
  pagedown: 0x22,
  end: 0x23,
  home: 0x24,
  insert: 0x2d,
  delete: 0x2e,

  // OEM Punctuation
  minus: 0xbd,
  equal: 0xbb,
  bracketleft: 0xdb,
  bracketright: 0xdd,
  backslash: 0xdc,
  semicolon: 0xba,
  quote: 0xde,
  comma: 0xbc,
  period: 0xbe,
  slash: 0xbf,
};

// Digits 0-9
for (let i = 0; i <= 9; i++) {
  VK_MAP[`digit${i}`] = 0x30 + i;
  VK_MAP[`${i}`] = 0x30 + i;
  VK_MAP[`numpad${i}`] = 0x60 + i;
}

// Letters A-Z
for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i).toLowerCase();
  VK_MAP[ch] = 65 + i;
  VK_MAP[`key${ch}`] = 65 + i;
}

// Function keys F1-F24
for (let i = 1; i <= 24; i++) {
  VK_MAP[`f${i}`] = 0x6f + i;
}

function parseKeybind(bindString) {
  if (!bindString) return [];
  const parts = bindString.split('+').map((s) => s.trim().toLowerCase());
  const vks = [];
  for (const part of parts) {
    const vk = VK_MAP[part];
    if (vk) vks.push(vk);
  }
  return vks;
}

let pollInterval = null;
let currentTargetKey = 'ControlRight';
let currentTargetVks = [0xa3];
let isTargetDown = false;

// Track side mouse buttons for settings modal capture
let mouse4Down = false;
let mouse5Down = false;
let mouse3Down = false;

function setPttTarget(targetKey) {
  if (!targetKey) return;
  currentTargetKey = targetKey;
  currentTargetVks = parseKeybind(targetKey);
  isTargetDown = false;
}

function startPolling(emitCallback) {
  if (!GetAsyncKeyState) {
    console.warn('[NativeHotkey] Native hotkey polling unavailable.');
    return;
  }

  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(() => {
    try {
      // 1. Check current PTT keybind state
      if (currentTargetVks.length > 0) {
        let allDown = true;
        for (let i = 0; i < currentTargetVks.length; i++) {
          if ((GetAsyncKeyState(currentTargetVks[i]) & 0x8000) === 0) {
            allDown = false;
            break;
          }
        }

        if (allDown && !isTargetDown) {
          isTargetDown = true;
          emitCallback({ type: 'down', code: currentTargetKey });
        } else if (!allDown && isTargetDown) {
          isTargetDown = false;
          emitCallback({ type: 'up', code: currentTargetKey });
        }
      }

      // 2. Track gaming mouse buttons (Mouse4 / Mouse5 / Mouse3) for Settings rebind & universal support
      // Mouse 4 (VK_XBUTTON1 = 0x05)
      const m4 = (GetAsyncKeyState(0x05) & 0x8000) !== 0;
      if (m4 && !mouse4Down) {
        mouse4Down = true;
        if (currentTargetKey.toLowerCase() !== 'mouse4') {
          emitCallback({ type: 'down', code: 'Mouse4' });
        }
      } else if (!m4 && mouse4Down) {
        mouse4Down = false;
        if (currentTargetKey.toLowerCase() !== 'mouse4') {
          emitCallback({ type: 'up', code: 'Mouse4' });
        }
      }

      // Mouse 5 (VK_XBUTTON2 = 0x06)
      const m5 = (GetAsyncKeyState(0x06) & 0x8000) !== 0;
      if (m5 && !mouse5Down) {
        mouse5Down = true;
        if (currentTargetKey.toLowerCase() !== 'mouse5') {
          emitCallback({ type: 'down', code: 'Mouse5' });
        }
      } else if (!m5 && mouse5Down) {
        mouse5Down = false;
        if (currentTargetKey.toLowerCase() !== 'mouse5') {
          emitCallback({ type: 'up', code: 'Mouse5' });
        }
      }

      // Mouse 3 (Middle Click = 0x04)
      const m3 = (GetAsyncKeyState(0x04) & 0x8000) !== 0;
      if (m3 && !mouse3Down) {
        mouse3Down = true;
        if (currentTargetKey.toLowerCase() !== 'mouse3') {
          emitCallback({ type: 'down', code: 'Mouse3' });
        }
      } else if (!m3 && mouse3Down) {
        mouse3Down = false;
        if (currentTargetKey.toLowerCase() !== 'mouse3') {
          emitCallback({ type: 'up', code: 'Mouse3' });
        }
      }
    } catch {}
  }, 15);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

module.exports = {
  setPttTarget,
  startPolling,
  stopPolling,
};
