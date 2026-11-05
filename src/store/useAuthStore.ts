import { create } from 'zustand';
import { GamingActivity, UserProfile, UserStatus } from '../types';
import { CURRENT_USER } from '../mock/initialData';

interface AuthState {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  updateStatus: (status: UserStatus) => void;
  updateCustomStatus: (status: string) => void;
  updateGamingActivity: (activity?: GamingActivity) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  logout: () => void;
  login: (username: string) => void;
}

const AUTH_STORAGE_KEY = 'squadspace_auth_session_v1';

function getInitialUser(): UserProfile {
  if (typeof window === 'undefined') return CURRENT_USER;
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return CURRENT_USER;
}

function persistUser(user: UserProfile | null) {
  if (typeof window !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {}
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: getInitialUser(),
  isAuthenticated: true,

  updateStatus: (status: UserStatus) => {
    const updated = { ...get().currentUser, status };
    set({ currentUser: updated });
    persistUser(updated);
  },

  updateCustomStatus: (customStatus: string) => {
    const updated = { ...get().currentUser, customStatus };
    set({ currentUser: updated });
    persistUser(updated);
  },

  updateGamingActivity: (gamingActivity?: GamingActivity) => {
    const updated = { ...get().currentUser, gamingActivity };
    set({ currentUser: updated });
    persistUser(updated);
  },

  updateProfile: (updates: Partial<UserProfile>) => {
    const updated = { ...get().currentUser, ...updates };
    set({ currentUser: updated });
    persistUser(updated);
  },

  logout: () => {
    const offlineUser: UserProfile = { ...get().currentUser, status: 'offline' };
    set({
      isAuthenticated: false,
      currentUser: offlineUser,
    });
    persistUser(null);
  },

  login: (username: string) => {
    const loggedInUser: UserProfile = {
      ...get().currentUser,
      username,
      displayName: username,
      status: 'online',
    };
    set({
      isAuthenticated: true,
      currentUser: loggedInUser,
    });
    persistUser(loggedInUser);
  },
}));
