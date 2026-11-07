import { create } from 'zustand';
import {
  CoopInputMode,
  CoopJoinRequest,
  CoopPlayer,
  CoopSlot,
  CoopControlMessage,
  CoopInputPacket,
} from '../types/coop';
import { UserProfile } from '../types';
import { webrtcManager } from '../lib/webrtcManager';
import { coopClient } from '../lib/coopClient';

interface CoopState {
  isCoopHost: boolean;
  isCoopActive: boolean;
  hostUserId: string | null;
  mySlot: CoopSlot | null;
  myInputMode: CoopInputMode;
  players: CoopPlayer[];
  pendingRequests: CoopJoinRequest[];
  driverStatus: {
    vigemAvailable: boolean;
    vigemInitError: string | null;
    user32Available: boolean;
  } | null;
  isPanelOpen: boolean;
  isRequested: boolean;
  activeGamepadName: string | null;

  // Actions
  init: () => void;
  checkDriverStatus: () => Promise<void>;
  startHostCoop: (hostUserId: string) => void;
  stopHostCoop: () => void;
  requestJoin: (hostUserId: string, currentUser: UserProfile, mode: CoopInputMode, requestedSlot?: CoopSlot) => void;
  cancelJoinRequest: () => void;
  leaveCoop: () => void;
  acceptRequest: (requestId: string, slot?: CoopSlot) => Promise<void>;
  denyRequest: (requestId: string) => void;
  kickPlayer: (slot: CoopSlot) => Promise<void>;
  togglePausePlayer: (slot: CoopSlot) => Promise<void>;
  changePlayerMode: (slot: CoopSlot, mode: CoopInputMode) => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  setMyInputMode: (mode: CoopInputMode) => void;
  panicDisconnect: () => Promise<void>;
}

let isInitialized = false;

export const useCoopStore = create<CoopState>((set, get) => ({
  isCoopHost: false,
  isCoopActive: false,
  hostUserId: null,
  mySlot: null,
  myInputMode: 'gamepad',
  players: [],
  pendingRequests: [],
  driverStatus: null,
  isPanelOpen: false,
  isRequested: false,
  activeGamepadName: null,

  init: () => {
    if (isInitialized) return;
    isInitialized = true;

    // Check driver if running in Electron
    get().checkDriverStatus();

    // Listen to global panic hotkey from Electron
    if (typeof window !== 'undefined' && window.electronAPI?.onCoopPanic) {
      window.electronAPI.onCoopPanic(() => {
        get().panicDisconnect();
      });
    }

    // Register WebRTC incoming message handler
    webrtcManager.onCoopMessage((senderPeerId: string, packet: any) => {
      const state = get();

      // 1. High-frequency gaming input packets (Host only)
      if (state.isCoopHost && packet.type && packet.type.startsWith('input:')) {
        const inputPacket = packet as CoopInputPacket;
        const targetSlot = inputPacket.slot;
        const activePlayer = state.players.find((p) => p.slot === targetSlot && p.userId === senderPeerId);

        if (activePlayer && !activePlayer.isPaused && window.electronAPI) {
          if (inputPacket.type === 'input:gamepad') {
            window.electronAPI.coopInjectGamepad?.(targetSlot, inputPacket.data);
          } else if (inputPacket.type === 'input:keyboard') {
            window.electronAPI.coopInjectKeyboard?.(targetSlot, inputPacket.data);
          } else if (inputPacket.type === 'input:mouse') {
            window.electronAPI.coopInjectMouse?.(targetSlot, inputPacket.data);
          }
        }
        return;
      }

      // 2. Control messages
      const controlMsg = packet as CoopControlMessage;
      if (!controlMsg || !controlMsg.type) return;

      switch (controlMsg.type) {
        case 'coop:request_join': {
          if (!state.isCoopHost) return;
          const req: CoopJoinRequest = {
            requestId: controlMsg.requestId,
            userId: controlMsg.user.id,
            user: controlMsg.user,
            requestedMode: controlMsg.inputMode,
            requestedSlot: controlMsg.requestedSlot,
            timestamp: Date.now(),
          };
          set((s) => ({
            pendingRequests: [...s.pendingRequests.filter((r) => r.userId !== req.userId), req],
            isPanelOpen: true, // Auto-open panel so host can accept
          }));
          break;
        }

        case 'coop:response_join': {
          if (controlMsg.accepted && controlMsg.slot && controlMsg.inputMode) {
            set({
              mySlot: controlMsg.slot,
              myInputMode: controlMsg.inputMode,
              isRequested: false,
            });
            if (state.hostUserId) {
              coopClient.start(state.hostUserId, controlMsg.slot, controlMsg.inputMode);
            }
          } else {
            set({ isRequested: false });
          }
          break;
        }

        case 'coop:sync_players': {
          set({
            players: controlMsg.players,
            isCoopActive: true,
            hostUserId: controlMsg.hostUserId,
          });

          // Verify if I was removed or mode changed
          const myPlayer = controlMsg.players.find((p) => p.userId === (webrtcManager as any).myUserId);
          if (myPlayer) {
            if (myPlayer.slot !== state.mySlot || myPlayer.inputMode !== state.myInputMode) {
              set({ mySlot: myPlayer.slot, myInputMode: myPlayer.inputMode });
              if (state.hostUserId) {
                coopClient.setMode(myPlayer.inputMode);
              }
            }
          } else if (state.mySlot && !state.isCoopHost) {
            // I was removed from slots
            coopClient.stop();
            set({ mySlot: null, isRequested: false });
          }
          break;
        }

        case 'coop:kick': {
          if (state.mySlot === controlMsg.slot) {
            coopClient.stop();
            set({ mySlot: null, isRequested: false });
          }
          break;
        }

        case 'coop:pause': {
          set((s) => ({
            players: s.players.map((p) =>
              p.slot === controlMsg.slot ? { ...p, isPaused: controlMsg.isPaused } : p
            ),
          }));
          break;
        }

        case 'coop:mode_update': {
          set((s) => ({
            players: s.players.map((p) =>
              p.slot === controlMsg.slot ? { ...p, inputMode: controlMsg.inputMode } : p
            ),
          }));
          if (state.mySlot === controlMsg.slot) {
            set({ myInputMode: controlMsg.inputMode });
            coopClient.setMode(controlMsg.inputMode);
          }
          break;
        }

        case 'coop:leave': {
          if (state.isCoopHost) {
            get().kickPlayer(controlMsg.slot);
          }
          break;
        }
      }
    });
  },

  checkDriverStatus: async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.coopGetDriverStatus) {
      try {
        const status = await window.electronAPI.coopGetDriverStatus();
        set({ driverStatus: status });
      } catch (err) {
        console.warn('Failed to query ViGEm driver status:', err);
      }
    }
  },

  startHostCoop: (hostUserId: string) => {
    set({
      isCoopHost: true,
      isCoopActive: true,
      hostUserId,
      players: [],
      pendingRequests: [],
      isPanelOpen: true,
    });
    get().checkDriverStatus();

    // Broadcast sync to voice room
    webrtcManager.sendCoopControl(null, {
      type: 'coop:sync_players',
      players: [],
      hostUserId,
    });
  },

  stopHostCoop: () => {
    const { players } = get();
    // Disconnect all virtual controllers
    if (window.electronAPI?.coopPanicDisconnectAll) {
      window.electronAPI.coopPanicDisconnectAll();
    }
    // Notify all players
    players.forEach((p) => {
      webrtcManager.sendCoopControl(p.userId, {
        type: 'coop:kick',
        slot: p.slot,
        userId: p.userId,
      });
    });

    set({
      isCoopHost: false,
      isCoopActive: false,
      players: [],
      pendingRequests: [],
      isPanelOpen: false,
    });
  },

  requestJoin: (hostUserId: string, currentUser: UserProfile, mode: CoopInputMode, requestedSlot?: CoopSlot) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    set({ isRequested: true, hostUserId, myInputMode: mode });

    webrtcManager.sendCoopControl(hostUserId, {
      type: 'coop:request_join',
      requestId,
      user: currentUser,
      inputMode: mode,
      requestedSlot,
    });
  },

  cancelJoinRequest: () => {
    set({ isRequested: false });
  },

  leaveCoop: () => {
    const { mySlot, hostUserId } = get();
    if (mySlot && hostUserId) {
      coopClient.stop();
      webrtcManager.sendCoopControl(hostUserId, {
        type: 'coop:leave',
        slot: mySlot,
        userId: (webrtcManager as any).myUserId,
      });
    }
    set({ mySlot: null, isRequested: false });
  },

  acceptRequest: async (requestId: string, chosenSlot?: CoopSlot) => {
    const { pendingRequests, players, hostUserId } = get();
    const req = pendingRequests.find((r) => r.requestId === requestId);
    if (!req) return;

    // Find first available slot (2, 3, or 4)
    let assignedSlot: CoopSlot = chosenSlot || req.requestedSlot || 2;
    const occupiedSlots = new Set(players.map((p) => p.slot));

    if (occupiedSlots.has(assignedSlot)) {
      const candidates: CoopSlot[] = [2, 3, 4];
      const free = candidates.find((s) => !occupiedSlots.has(s));
      if (!free) {
        console.warn('No available co-op slots (Max 4 players)');
        return;
      }
      assignedSlot = free;
    }

    // Connect virtual controller / prepare host slot
    if (window.electronAPI?.coopSlotConnect) {
      await window.electronAPI.coopSlotConnect(assignedSlot, req.requestedMode);
    }

    const newPlayer: CoopPlayer = {
      userId: req.userId,
      user: req.user,
      slot: assignedSlot,
      inputMode: req.requestedMode,
      isPaused: false,
      connectedAt: new Date().toISOString(),
      latencyMs: 15,
    };

    const updatedPlayers = [...players.filter((p) => p.slot !== assignedSlot), newPlayer].sort(
      (a, b) => a.slot - b.slot
    );

    set({
      players: updatedPlayers,
      pendingRequests: pendingRequests.filter((r) => r.requestId !== requestId),
    });

    // Send direct response to client
    webrtcManager.sendCoopControl(req.userId, {
      type: 'coop:response_join',
      requestId: req.requestId,
      accepted: true,
      slot: assignedSlot,
      inputMode: req.requestedMode,
    });

    // Broadcast updated player list to room
    webrtcManager.sendCoopControl(null, {
      type: 'coop:sync_players',
      players: updatedPlayers,
      hostUserId: hostUserId || '',
    });
  },

  denyRequest: (requestId: string) => {
    const { pendingRequests } = get();
    const req = pendingRequests.find((r) => r.requestId === requestId);
    if (req) {
      webrtcManager.sendCoopControl(req.userId, {
        type: 'coop:response_join',
        requestId: req.requestId,
        accepted: false,
        reason: 'Host declined request',
      });
    }
    set({ pendingRequests: pendingRequests.filter((r) => r.requestId !== requestId) });
  },

  kickPlayer: async (slot: CoopSlot) => {
    const { players, hostUserId } = get();
    const target = players.find((p) => p.slot === slot);
    if (!target) return;

    if (window.electronAPI?.coopSlotDisconnect) {
      await window.electronAPI.coopSlotDisconnect(slot);
    }

    const updatedPlayers = players.filter((p) => p.slot !== slot);
    set({ players: updatedPlayers });

    webrtcManager.sendCoopControl(target.userId, {
      type: 'coop:kick',
      slot,
      userId: target.userId,
    });

    webrtcManager.sendCoopControl(null, {
      type: 'coop:sync_players',
      players: updatedPlayers,
      hostUserId: hostUserId || '',
    });
  },

  togglePausePlayer: async (slot: CoopSlot) => {
    const { players } = get();
    const target = players.find((p) => p.slot === slot);
    if (!target) return;

    const nextPaused = !target.isPaused;
    if (window.electronAPI?.coopSetPause) {
      await window.electronAPI.coopSetPause(slot, nextPaused);
    }

    const updatedPlayers = players.map((p) =>
      p.slot === slot ? { ...p, isPaused: nextPaused } : p
    );
    set({ players: updatedPlayers });

    webrtcManager.sendCoopControl(null, {
      type: 'coop:pause',
      slot,
      isPaused: nextPaused,
    });
  },

  changePlayerMode: async (slot: CoopSlot, mode: CoopInputMode) => {
    const { players } = get();
    const target = players.find((p) => p.slot === slot);
    if (!target) return;

    if (window.electronAPI?.coopSetMode) {
      await window.electronAPI.coopSetMode(slot, mode);
    }

    const updatedPlayers = players.map((p) =>
      p.slot === slot ? { ...p, inputMode: mode } : p
    );
    set({ players: updatedPlayers });

    webrtcManager.sendCoopControl(null, {
      type: 'coop:mode_update',
      slot,
      inputMode: mode,
    });
  },

  setPanelOpen: (open: boolean) => set({ isPanelOpen: open }),
  setMyInputMode: (mode: CoopInputMode) => set({ myInputMode: mode }),

  panicDisconnect: async () => {
    console.warn('[Co-op] Panic Disconnect: Terminating all remote inputs immediately.');
    if (window.electronAPI?.coopPanicDisconnectAll) {
      await window.electronAPI.coopPanicDisconnectAll();
    }
    const { players } = get();
    players.forEach((p) => {
      webrtcManager.sendCoopControl(p.userId, {
        type: 'coop:kick',
        slot: p.slot,
        userId: p.userId,
      });
    });
    set({ players: [], pendingRequests: [] });
  },
}));
