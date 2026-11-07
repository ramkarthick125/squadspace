import { UserProfile } from './index';

export type CoopInputMode = 'gamepad' | 'keyboard_mouse';
export type CoopSlot = 2 | 3 | 4;

export interface CoopPlayer {
  userId: string;
  user: UserProfile;
  slot: CoopSlot;
  inputMode: CoopInputMode;
  isPaused: boolean;
  connectedAt: string;
  latencyMs: number;
}

export interface CoopJoinRequest {
  requestId: string;
  userId: string;
  user: UserProfile;
  requestedMode: CoopInputMode;
  requestedSlot?: CoopSlot;
  timestamp: number;
}

export interface CoopGamepadState {
  axes: {
    leftX: number;     // -1.0 to 1.0
    leftY: number;     // -1.0 to 1.0
    rightX: number;    // -1.0 to 1.0
    rightY: number;    // -1.0 to 1.0
  };
  triggers: {
    left: number;      // 0.0 to 1.0
    right: number;     // 0.0 to 1.0
  };
  buttons: {
    A: boolean;
    B: boolean;
    X: boolean;
    Y: boolean;
    dpadUp: boolean;
    dpadDown: boolean;
    dpadLeft: boolean;
    dpadRight: boolean;
    leftShoulder: boolean;
    rightShoulder: boolean;
    leftThumb: boolean;
    rightThumb: boolean;
    start: boolean;
    back: boolean;
    guide?: boolean;
  };
}

export interface CoopKeyboardState {
  event: 'keydown' | 'keyup';
  code: string;       // e.g. "KeyW", "Space"
  key: string;        // e.g. "w", " "
  keyCode: number;    // JS / Windows virtual key code
}

export interface CoopMouseState {
  event: 'move' | 'down' | 'up' | 'wheel';
  normX?: number;     // 0.0 to 1.0
  normY?: number;     // 0.0 to 1.0
  deltaX?: number;    // relative movement for FPS games
  deltaY?: number;
  button?: 'left' | 'right' | 'middle';
  wheelDelta?: number;
}

export type CoopInputPacket =
  | {
      type: 'input:gamepad';
      slot: CoopSlot;
      data: CoopGamepadState;
    }
  | {
      type: 'input:keyboard';
      slot: CoopSlot;
      data: CoopKeyboardState;
    }
  | {
      type: 'input:mouse';
      slot: CoopSlot;
      data: CoopMouseState;
    };

export type CoopControlMessage =
  | {
      type: 'coop:request_join';
      requestId: string;
      user: UserProfile;
      inputMode: CoopInputMode;
      requestedSlot?: CoopSlot;
    }
  | {
      type: 'coop:response_join';
      requestId: string;
      accepted: boolean;
      slot?: CoopSlot;
      inputMode?: CoopInputMode;
      reason?: string;
    }
  | {
      type: 'coop:sync_players';
      players: CoopPlayer[];
      hostUserId: string;
    }
  | {
      type: 'coop:kick';
      slot: CoopSlot;
      userId: string;
    }
  | {
      type: 'coop:pause';
      slot: CoopSlot;
      isPaused: boolean;
    }
  | {
      type: 'coop:mode_update';
      slot: CoopSlot;
      inputMode: CoopInputMode;
    }
  | {
      type: 'coop:leave';
      slot: CoopSlot;
      userId: string;
    }
  | {
      type: 'coop:ping';
      timestamp: number;
    }
  | {
      type: 'coop:pong';
      timestamp: number;
    };
