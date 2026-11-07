/**
 * SquadSpace Co-op Remote Play Host Injection Engine
 * 
 * Provides:
 * 1. ViGEmBus Virtual Xbox 360 controller emulation for Player 2, Player 3, Player 4 (XInput)
 * 2. Windows SendInput / user32.dll mouse & keyboard injection via koffi
 * 3. Slot isolation, permission gates, and Panic Disconnect
 */

let ViGEmClient = null;
let client = null;
let vigemAvailable = false;
let vigemInitError = null;

try {
  ViGEmClient = require('vigemclient');
  client = new ViGEmClient();
  const connectErr = client.connect();
  if (connectErr) {
    vigemInitError = connectErr.message || String(connectErr);
    vigemAvailable = false;
  } else {
    vigemAvailable = true;
  }
} catch (err) {
  vigemInitError = err.message;
  vigemAvailable = false;
}

// User32 native hooks for Keyboard & Mouse injection
let user32 = null;
let keybd_event = null;
let mouse_event = null;
let SetCursorPos = null;
let GetSystemMetrics = null;
let user32Available = false;

try {
  const koffi = require('koffi');
  user32 = koffi.load('user32.dll');
  keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)');
  mouse_event = user32.func('void __stdcall mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr dwExtraInfo)');
  SetCursorPos = user32.func('bool __stdcall SetCursorPos(int x, int y)');
  GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int nIndex)');
  user32Available = true;
} catch (err) {
  console.warn('user32 hooks failed to initialize:', err);
}

// Virtual controllers mapped by slot (2, 3, 4)
const activeControllers = new Map();

// Permissions and paused state mapped by slot
const slotStates = new Map();

// Windows Mouse Flags
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_ABSOLUTE = 0x8000;

// Windows Key Flags
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;

// Virtual Key Code Map
const VK_MAP = {
  // Navigation & Control
  Backspace: 0x08,
  Tab: 0x09,
  Enter: 0x0D,
  ShiftLeft: 0x10,
  ShiftRight: 0x10,
  ControlLeft: 0x11,
  ControlRight: 0x11,
  AltLeft: 0x12,
  AltRight: 0x12,
  Pause: 0x13,
  CapsLock: 0x14,
  Escape: 0x1B,
  Space: 0x20,
  PageUp: 0x21,
  PageDown: 0x22,
  End: 0x23,
  Home: 0x24,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  PrintScreen: 0x2C,
  Insert: 0x2D,
  Delete: 0x2E,

  // Digits
  Digit0: 0x30,
  Digit1: 0x31,
  Digit2: 0x32,
  Digit3: 0x33,
  Digit4: 0x34,
  Digit5: 0x35,
  Digit6: 0x36,
  Digit7: 0x37,
  Digit8: 0x38,
  Digit9: 0x39,

  // Letters
  KeyA: 0x41,
  KeyB: 0x42,
  KeyC: 0x43,
  KeyD: 0x44,
  KeyE: 0x45,
  KeyF: 0x46,
  KeyG: 0x47,
  KeyH: 0x48,
  KeyI: 0x49,
  KeyJ: 0x4A,
  KeyK: 0x4B,
  KeyL: 0x4C,
  KeyM: 0x4D,
  KeyN: 0x4E,
  KeyO: 0x4F,
  KeyP: 0x50,
  KeyQ: 0x51,
  KeyR: 0x52,
  KeyS: 0x53,
  KeyT: 0x54,
  KeyU: 0x55,
  KeyV: 0x56,
  KeyW: 0x57,
  KeyX: 0x58,
  KeyY: 0x59,
  KeyZ: 0x5A,

  // Numpad
  Numpad0: 0x60,
  Numpad1: 0x61,
  Numpad2: 0x62,
  Numpad3: 0x63,
  Numpad4: 0x64,
  Numpad5: 0x65,
  Numpad6: 0x66,
  Numpad7: 0x67,
  Numpad8: 0x68,
  Numpad9: 0x69,
  NumpadMultiply: 0x6A,
  NumpadAdd: 0x6B,
  NumpadSubtract: 0x6D,
  NumpadDecimal: 0x6E,
  NumpadDivide: 0x6F,

  // Function Keys
  F1: 0x70,
  F2: 0x71,
  F3: 0x72,
  F4: 0x73,
  F5: 0x74,
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  F11: 0x7A,
  F12: 0x7B,

  // Punctuation
  Semicolon: 0xBA,
  Equal: 0xBB,
  Comma: 0xBC,
  Minus: 0xBD,
  Period: 0xBE,
  Slash: 0xBF,
  Backquote: 0xC0,
  BracketLeft: 0xDB,
  Backslash: 0xDC,
  BracketRight: 0xDD,
  Quote: 0xDE,
};

class CoopHostEngine {
  constructor() {
    this.screenWidth = 1920;
    this.screenHeight = 1080;
    this.updateScreenDimensions();
  }

  updateScreenDimensions() {
    if (GetSystemMetrics) {
      try {
        const w = GetSystemMetrics(0); // SM_CXSCREEN
        const h = GetSystemMetrics(1); // SM_CYSCREEN
        if (w > 0 && h > 0) {
          this.screenWidth = w;
          this.screenHeight = h;
        }
      } catch (err) {
        console.warn('Failed to get screen metrics:', err);
      }
    }
  }

  getDriverStatus() {
    return {
      vigemAvailable,
      vigemInitError,
      user32Available,
    };
  }

  connectSlot(slot, inputMode) {
    this.slotDisconnect(slot);

    slotStates.set(slot, {
      inputMode,
      isPaused: false,
    });

    if (inputMode === 'gamepad') {
      if (!vigemAvailable || !client) {
        console.warn(`ViGEm driver not available to connect virtual controller for slot ${slot}`);
        return { success: false, error: 'ViGEm driver not installed on host' };
      }

      try {
        const controller = client.createX360Controller();
        const err = controller.connect();
        if (err) {
          console.error(`Failed to connect Xbox 360 controller for slot ${slot}:`, err);
          return { success: false, error: String(err) };
        }
        activeControllers.set(slot, controller);
        console.log(`[Co-op] Virtual Xbox 360 Controller connected for Slot ${slot}!`);
        return { success: true };
      } catch (err) {
        console.error(`Exception creating controller for slot ${slot}:`, err);
        return { success: false, error: err.message };
      }
    }

    // Keyboard & Mouse mode
    return { success: true };
  }

  slotDisconnect(slot) {
    if (activeControllers.has(slot)) {
      try {
        const controller = activeControllers.get(slot);
        controller.disconnect();
        console.log(`[Co-op] Virtual Xbox 360 Controller disconnected for Slot ${slot}`);
      } catch (err) {
        console.error(`Error disconnecting controller for slot ${slot}:`, err);
      }
      activeControllers.delete(slot);
    }
    slotStates.delete(slot);
  }

  setSlotPause(slot, isPaused) {
    if (slotStates.has(slot)) {
      const state = slotStates.get(slot);
      state.isPaused = isPaused;
      slotStates.set(slot, state);
    }
  }

  setSlotMode(slot, inputMode) {
    if (slotStates.has(slot)) {
      this.connectSlot(slot, inputMode);
    }
  }

  injectGamepad(slot, data) {
    const state = slotStates.get(slot);
    if (!state || state.isPaused || state.inputMode !== 'gamepad') return;

    const controller = activeControllers.get(slot);
    if (!controller) return;

    try {
      // Axes: -1.0 to 1.0
      if (data.axes) {
        if (typeof data.axes.leftX === 'number') controller.axis.leftX.setValue(data.axes.leftX);
        if (typeof data.axes.leftY === 'number') controller.axis.leftY.setValue(data.axes.leftY);
        if (typeof data.axes.rightX === 'number') controller.axis.rightX.setValue(data.axes.rightX);
        if (typeof data.axes.rightY === 'number') controller.axis.rightY.setValue(data.axes.rightY);
      }

      // Triggers: 0.0 to 1.0
      if (data.triggers) {
        if (typeof data.triggers.left === 'number') controller.axis.leftTrigger.setValue(data.triggers.left);
        if (typeof data.triggers.right === 'number') controller.axis.rightTrigger.setValue(data.triggers.right);
      }

      // Buttons
      if (data.buttons) {
        const b = data.buttons;
        if (controller.button.A) controller.button.A.setValue(!!b.A);
        if (controller.button.B) controller.button.B.setValue(!!b.B);
        if (controller.button.X) controller.button.X.setValue(!!b.X);
        if (controller.button.Y) controller.button.Y.setValue(!!b.Y);
        if (controller.button.LEFT_SHOULDER) controller.button.LEFT_SHOULDER.setValue(!!b.leftShoulder);
        if (controller.button.RIGHT_SHOULDER) controller.button.RIGHT_SHOULDER.setValue(!!b.rightShoulder);
        if (controller.button.LEFT_THUMB) controller.button.LEFT_THUMB.setValue(!!b.leftThumb);
        if (controller.button.RIGHT_THUMB) controller.button.RIGHT_THUMB.setValue(!!b.rightThumb);
        if (controller.button.START) controller.button.START.setValue(!!b.start);
        if (controller.button.BACK) controller.button.BACK.setValue(!!b.back);
        if (controller.button.DPAD_UP) controller.button.DPAD_UP.setValue(!!b.dpadUp);
        if (controller.button.DPAD_DOWN) controller.button.DPAD_DOWN.setValue(!!b.dpadDown);
        if (controller.button.DPAD_LEFT) controller.button.DPAD_LEFT.setValue(!!b.dpadLeft);
        if (controller.button.DPAD_RIGHT) controller.button.DPAD_RIGHT.setValue(!!b.dpadRight);
        if (controller.button.GUIDE && typeof b.guide === 'boolean') controller.button.GUIDE.setValue(b.guide);
      }
    } catch (err) {
      // Ignore transient frame errors
    }
  }

  injectKeyboard(slot, data) {
    const state = slotStates.get(slot);
    if (!state || state.isPaused || state.inputMode !== 'keyboard_mouse') return;
    if (!keybd_event) return;

    let vk = VK_MAP[data.code];
    if (!vk && typeof data.keyCode === 'number' && data.keyCode > 0) {
      vk = data.keyCode;
    }
    if (!vk) return;

    const isKeyUp = data.event === 'keyup';
    const flags = isKeyUp ? KEYEVENTF_KEYUP : 0;

    try {
      keybd_event(vk, 0, flags, 0);
    } catch (err) {
      console.warn('Keyboard injection error:', err);
    }
  }

  injectMouse(slot, data) {
    const state = slotStates.get(slot);
    if (!state || state.isPaused || state.inputMode !== 'keyboard_mouse') return;
    if (!mouse_event) return;

    try {
      if (data.event === 'move') {
        if (typeof data.normX === 'number' && typeof data.normY === 'number') {
          // Absolute coordinates mapped to primary monitor
          const targetX = Math.round(data.normX * this.screenWidth);
          const targetY = Math.round(data.normY * this.screenHeight);
          if (SetCursorPos) {
            SetCursorPos(targetX, targetY);
          } else {
            const absX = Math.round((data.normX * 65535));
            const absY = Math.round((data.normY * 65535));
            mouse_event(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE, absX, absY, 0, 0);
          }
        } else if (typeof data.deltaX === 'number' && typeof data.deltaY === 'number') {
          // Relative movement
          mouse_event(MOUSEEVENTF_MOVE, data.deltaX, data.deltaY, 0, 0);
        }
      } else if (data.event === 'down' || data.event === 'up') {
        const isUp = data.event === 'up';
        let flag = 0;
        if (data.button === 'left') {
          flag = isUp ? MOUSEEVENTF_LEFTUP : MOUSEEVENTF_LEFTDOWN;
        } else if (data.button === 'right') {
          flag = isUp ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_RIGHTDOWN;
        } else if (data.button === 'middle') {
          flag = isUp ? MOUSEEVENTF_MIDDLEUP : MOUSEEVENTF_MIDDLEDOWN;
        }
        if (flag) {
          mouse_event(flag, 0, 0, 0, 0);
        }
      } else if (data.event === 'wheel' && typeof data.wheelDelta === 'number') {
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, data.wheelDelta, 0);
      }
    } catch (err) {
      console.warn('Mouse injection error:', err);
    }
  }

  panicDisconnectAll() {
    console.log('[Co-op] PANIC DISCONNECT TRIGGERED: Severing all remote inputs');
    for (const [slot, controller] of activeControllers.entries()) {
      try {
        controller.disconnect();
      } catch (err) {}
    }
    activeControllers.clear();
    slotStates.clear();
  }
}

const coopHost = new CoopHostEngine();
module.exports = coopHost;
