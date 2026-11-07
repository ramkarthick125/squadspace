/**
 * Client-Side Input Capture Engine for Co-op Remote Play
 * 
 * Captures:
 * 1. Gamepad inputs via W3C Gamepad API (60-120Hz polling loop)
 * 2. Keyboard & Mouse inputs over the stream container
 * Sends raw input packets directly over WebRTC DataChannel to the host.
 */

import { CoopGamepadState, CoopKeyboardState, CoopMouseState, CoopSlot } from '../types/coop';
import { webrtcManager } from './webrtcManager';

type GamepadStateCallback = (state: CoopGamepadState, connectedName: string | null) => void;

class CoopClientEngine {
  private hostUserId: string | null = null;
  private mySlot: CoopSlot | null = null;
  private inputMode: 'gamepad' | 'keyboard_mouse' = 'gamepad';
  private isActive: boolean = false;

  // Gamepad polling
  private rafId: number | null = null;
  private activeGamepadIndex: number | null = null;
  private lastGamepadSerialized: string = '';
  private onGamepadStateChange: GamepadStateCallback | null = null;

  // Keyboard / Mouse container ref
  private containerEl: HTMLElement | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  private boundContextMenu: ((e: MouseEvent) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', (e) => {
        console.log(`[Co-op] Gamepad connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
        if (this.activeGamepadIndex === null) {
          this.activeGamepadIndex = e.gamepad.index;
        }
      });

      window.addEventListener('gamepaddisconnected', (e) => {
        console.log(`[Co-op] Gamepad disconnected: (index ${e.gamepad.index})`);
        if (this.activeGamepadIndex === e.gamepad.index) {
          this.activeGamepadIndex = null;
        }
      });
    }
  }

  public start(hostUserId: string, slot: CoopSlot, inputMode: 'gamepad' | 'keyboard_mouse', containerEl?: HTMLElement | null) {
    this.stop();
    this.hostUserId = hostUserId;
    this.mySlot = slot;
    this.inputMode = inputMode;
    this.isActive = true;

    if (inputMode === 'gamepad') {
      this.startGamepadPolling();
    } else if (inputMode === 'keyboard_mouse' && containerEl) {
      this.attachKeyboardMouse(containerEl);
    }
  }

  public setMode(mode: 'gamepad' | 'keyboard_mouse', containerEl?: HTMLElement | null) {
    this.inputMode = mode;
    if (!this.isActive) return;

    if (mode === 'gamepad') {
      this.detachKeyboardMouse();
      this.startGamepadPolling();
    } else {
      this.stopGamepadPolling();
      if (containerEl) this.attachKeyboardMouse(containerEl);
    }
  }

  public stop() {
    this.isActive = false;
    this.stopGamepadPolling();
    this.detachKeyboardMouse();
    this.hostUserId = null;
    this.mySlot = null;
  }

  public setGamepadPreviewListener(cb: GamepadStateCallback | null) {
    this.onGamepadStateChange = cb;
  }

  public getConnectedGamepadName(): string | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        return gp.id;
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Gamepad Polling Loop
  // --------------------------------------------------------------------------

  private startGamepadPolling() {
    if (this.rafId) return;

    const poll = () => {
      if (!this.isActive || this.inputMode !== 'gamepad') {
        this.rafId = null;
        return;
      }

      this.pollGamepadState();
      this.rafId = requestAnimationFrame(poll);
    };

    this.rafId = requestAnimationFrame(poll);
  }

  private stopGamepadPolling() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private applyDeadzone(value: number, deadzone = 0.08): number {
    if (Math.abs(value) < deadzone) return 0;
    const sign = Math.sign(value);
    const scaled = (Math.abs(value) - deadzone) / (1 - deadzone);
    return Math.max(-1, Math.min(1, sign * scaled));
  }

  private pollGamepadState() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;

    if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
      gp = gamepads[this.activeGamepadIndex];
    } else {
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i]?.connected) {
          gp = gamepads[i];
          this.activeGamepadIndex = i;
          break;
        }
      }
    }

    if (!gp) {
      if (this.onGamepadStateChange) this.onGamepadStateChange(this.getEmptyGamepadState(), null);
      return;
    }

    // HTML5 Gamepad standard mapping:
    // Axes: 0=LeftX, 1=LeftY, 2=RightX, 3=RightY
    // In HTML5, Y is -1 (UP) to +1 (DOWN).
    // In XInput / ViGEm, Y is +1 (UP) to -1 (DOWN), so we invert Y!
    const leftX = this.applyDeadzone(gp.axes[0] || 0);
    const leftY = -this.applyDeadzone(gp.axes[1] || 0);
    const rightX = this.applyDeadzone(gp.axes[2] || 0);
    const rightY = -this.applyDeadzone(gp.axes[3] || 0);

    // Triggers: Buttons 6 (LT) & 7 (RT)
    const leftTrigger = gp.buttons[6] ? gp.buttons[6].value : 0;
    const rightTrigger = gp.buttons[7] ? gp.buttons[7].value : 0;

    // Buttons
    const buttons = {
      A: Boolean(gp.buttons[0]?.pressed),
      B: Boolean(gp.buttons[1]?.pressed),
      X: Boolean(gp.buttons[2]?.pressed),
      Y: Boolean(gp.buttons[3]?.pressed),
      leftShoulder: Boolean(gp.buttons[4]?.pressed),
      rightShoulder: Boolean(gp.buttons[5]?.pressed),
      back: Boolean(gp.buttons[8]?.pressed),
      start: Boolean(gp.buttons[9]?.pressed),
      leftThumb: Boolean(gp.buttons[10]?.pressed),
      rightThumb: Boolean(gp.buttons[11]?.pressed),
      dpadUp: Boolean(gp.buttons[12]?.pressed),
      dpadDown: Boolean(gp.buttons[13]?.pressed),
      dpadLeft: Boolean(gp.buttons[14]?.pressed),
      dpadRight: Boolean(gp.buttons[15]?.pressed),
      guide: Boolean(gp.buttons[16]?.pressed),
    };

    const state: CoopGamepadState = {
      axes: { leftX, leftY, rightX, rightY },
      triggers: { left: leftTrigger, right: rightTrigger },
      buttons,
    };

    if (this.onGamepadStateChange) {
      this.onGamepadStateChange(state, gp.id);
    }

    // Deduplicate / Only send if values changed or periodically
    const serialized = JSON.stringify(state);
    if (serialized !== this.lastGamepadSerialized) {
      this.lastGamepadSerialized = serialized;
      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:gamepad',
          slot: this.mySlot,
          data: state,
        });
      }
    }
  }

  private getEmptyGamepadState(): CoopGamepadState {
    return {
      axes: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 },
      triggers: { left: 0, right: 0 },
      buttons: {
        A: false,
        B: false,
        X: false,
        Y: false,
        leftShoulder: false,
        rightShoulder: false,
        back: false,
        start: false,
        leftThumb: false,
        rightThumb: false,
        dpadUp: false,
        dpadDown: false,
        dpadLeft: false,
        dpadRight: false,
        guide: false,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Keyboard & Mouse Input Capture
  // --------------------------------------------------------------------------

  public attachKeyboardMouse(containerEl: HTMLElement) {
    this.detachKeyboardMouse();
    this.containerEl = containerEl;

    // Keyboard events
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      // Do not block F11 / F12 / DevTools
      if (e.key === 'F12' || e.key === 'F11') return;

      e.preventDefault();
      e.stopPropagation();

      const keyState: CoopKeyboardState = {
        event: 'keydown',
        code: e.code,
        key: e.key,
        keyCode: e.keyCode || e.which,
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:keyboard',
          slot: this.mySlot,
          data: keyState,
        });
      }
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      if (e.key === 'F12' || e.key === 'F11') return;

      e.preventDefault();
      e.stopPropagation();

      const keyState: CoopKeyboardState = {
        event: 'keyup',
        code: e.code,
        key: e.key,
        keyCode: e.keyCode || e.which,
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:keyboard',
          slot: this.mySlot,
          data: keyState,
        });
      }
    };

    // Mouse events
    this.boundMouseMove = (e: MouseEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      if (!this.containerEl) return;

      const rect = this.containerEl.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const mouseState: CoopMouseState = {
        event: 'move',
        normX,
        normY,
        deltaX: e.movementX,
        deltaY: e.movementY,
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:mouse',
          slot: this.mySlot,
          data: mouseState,
        });
      }
    };

    this.boundMouseDown = (e: MouseEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      e.preventDefault();

      let button: 'left' | 'right' | 'middle' = 'left';
      if (e.button === 2) button = 'right';
      else if (e.button === 1) button = 'middle';

      const mouseState: CoopMouseState = {
        event: 'down',
        button,
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:mouse',
          slot: this.mySlot,
          data: mouseState,
        });
      }
    };

    this.boundMouseUp = (e: MouseEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      e.preventDefault();

      let button: 'left' | 'right' | 'middle' = 'left';
      if (e.button === 2) button = 'right';
      else if (e.button === 1) button = 'middle';

      const mouseState: CoopMouseState = {
        event: 'up',
        button,
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:mouse',
          slot: this.mySlot,
          data: mouseState,
        });
      }
    };

    this.boundWheel = (e: WheelEvent) => {
      if (!this.isActive || this.inputMode !== 'keyboard_mouse') return;
      e.preventDefault();

      const mouseState: CoopMouseState = {
        event: 'wheel',
        wheelDelta: Math.round(-e.deltaY),
      };

      if (this.hostUserId && this.mySlot) {
        webrtcManager.sendCoopInput(this.hostUserId, {
          type: 'input:mouse',
          slot: this.mySlot,
          data: mouseState,
        });
      }
    };

    this.boundContextMenu = (e: MouseEvent) => {
      if (this.isActive && this.inputMode === 'keyboard_mouse') {
        e.preventDefault();
      }
    };

    // Attach listeners
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    containerEl.addEventListener('mousemove', this.boundMouseMove);
    containerEl.addEventListener('mousedown', this.boundMouseDown);
    containerEl.addEventListener('mouseup', this.boundMouseUp);
    containerEl.addEventListener('wheel', this.boundWheel, { passive: false });
    containerEl.addEventListener('contextmenu', this.boundContextMenu);
  }

  public detachKeyboardMouse() {
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    if (this.containerEl) {
      if (this.boundMouseMove) this.containerEl.removeEventListener('mousemove', this.boundMouseMove);
      if (this.boundMouseDown) this.containerEl.removeEventListener('mousedown', this.boundMouseDown);
      if (this.boundMouseUp) this.containerEl.removeEventListener('mouseup', this.boundMouseUp);
      if (this.boundWheel) this.containerEl.removeEventListener('wheel', this.boundWheel);
      if (this.boundContextMenu) this.containerEl.removeEventListener('contextmenu', this.boundContextMenu);
    }

    this.boundKeyDown = null;
    this.boundKeyUp = null;
    this.boundMouseMove = null;
    this.boundMouseDown = null;
    this.boundMouseUp = null;
    this.boundWheel = null;
    this.boundContextMenu = null;
    this.containerEl = null;
  }
}

export const coopClient = new CoopClientEngine();
