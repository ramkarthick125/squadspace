import { create } from 'zustand';
import { GamingActivity, UserProfile, UserStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

let authListenerInitialized = false;

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isPasswordRecovery: boolean;
  
  setIsPasswordRecovery: (isRecovery: boolean) => void;
  checkSession: () => Promise<void>;
  updateStatus: (status: UserStatus) => Promise<void>;
  updateCustomStatus: (status: string) => Promise<void>;
  updateGamingActivity: (activity?: GamingActivity) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  login: (user: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  isPasswordRecovery: false,

  setIsPasswordRecovery: (isRecovery: boolean) => set({ isPasswordRecovery: isRecovery }),

  checkSession: async () => {
    set({ isLoadingAuth: true });

    if (!isSupabaseConfigured || !supabase) {
      // Local fallback without Supabase
      const saved = localStorage.getItem('squadspace_local_user');
      if (saved) {
        try {
          const user = JSON.parse(saved);
          set({ currentUser: user, isAuthenticated: true, isLoadingAuth: false });
          return;
        } catch {}
      }
      set({ currentUser: null, isAuthenticated: false, isLoadingAuth: false });
      return;
    }

    if (!authListenerInitialized) {
      authListenerInitialized = true;
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true });
        } else if (event === 'SIGNED_OUT') {
          set({ currentUser: null, isAuthenticated: false, isPasswordRecovery: false });
        }
      });

      if (typeof window !== 'undefined' && window.location.hash) {
        if (window.location.hash.includes('type=recovery')) {
          set({ isPasswordRecovery: true });
        }
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch real profile from Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const user: UserProfile = {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`,
            status: profile.status || 'online',
            customStatus: profile.custom_status,
            aboutMe: profile.about_me,
            isAdmin: Boolean(profile.is_admin),
          };

          // Mark online in database
          await supabase.from('profiles').update({ status: 'online' }).eq('id', profile.id);

          set({ currentUser: user, isAuthenticated: true, isLoadingAuth: false });
          return;
        } else {
          // Fallback to session user metadata if profile table row not yet created
          const meta = session.user.user_metadata || {};
          const user: UserProfile = {
            id: session.user.id,
            username: meta.username || session.user.email?.split('@')[0] || 'user',
            displayName: meta.display_name || meta.username || 'Squad Member',
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${meta.username || session.user.id}`,
            status: 'online',
            isAdmin: Boolean(meta.is_admin),
          };

          // Attempt to insert profile in background
          Promise.resolve(
            supabase.from('profiles').upsert({
              id: user.id,
              username: user.username,
              display_name: user.displayName,
              avatar_url: user.avatarUrl,
              status: 'online',
              is_admin: user.isAdmin,
            })
          ).catch(() => {});

          set({ currentUser: user, isAuthenticated: true, isLoadingAuth: false });
          return;
        }
      }

      set({ currentUser: null, isAuthenticated: false, isLoadingAuth: false });
    } catch (err) {
      console.warn('Session check note:', err);
      set({ currentUser: null, isAuthenticated: false, isLoadingAuth: false });
    }
  },

  updateStatus: async (status: UserStatus) => {
    const user = get().currentUser;
    if (!user) return;

    const updated = { ...user, status };
    set({ currentUser: updated });

    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({ status }).eq('id', user.id);
    } else {
      localStorage.setItem('squadspace_local_user', JSON.stringify(updated));
    }
  },

  updateCustomStatus: async (customStatus: string) => {
    const user = get().currentUser;
    if (!user) return;

    const updated = { ...user, customStatus };
    set({ currentUser: updated });

    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({ custom_status: customStatus }).eq('id', user.id);
    } else {
      localStorage.setItem('squadspace_local_user', JSON.stringify(updated));
    }
  },

  updateGamingActivity: async (gamingActivity?: GamingActivity) => {
    const user = get().currentUser;
    if (!user) return;

    const updated = { ...user, gamingActivity };
    set({ currentUser: updated });

    if (isSupabaseConfigured && supabase) {
      if (gamingActivity) {
        await supabase.from('user_activities').upsert({
          user_id: user.id,
          game: gamingActivity.game,
          details: gamingActivity.details,
          started_at: gamingActivity.startedAt,
        });
      } else {
        await supabase.from('user_activities').delete().eq('user_id', user.id);
      }
    } else {
      localStorage.setItem('squadspace_local_user', JSON.stringify(updated));
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const user = get().currentUser;
    if (!user) return;

    const updated = { ...user, ...updates };
    set({ currentUser: updated });

    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({
        display_name: updates.displayName,
        about_me: updates.aboutMe,
        avatar_url: updates.avatarUrl,
      }).eq('id', user.id);
    } else {
      localStorage.setItem('squadspace_local_user', JSON.stringify(updated));
    }
  },

  logout: async () => {
    const user = get().currentUser;
    if (user && isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').update({ status: 'offline' }).eq('id', user.id);
        await supabase.auth.signOut();
      } catch {}
    }
    localStorage.removeItem('squadspace_local_user');
    set({ currentUser: null, isAuthenticated: false });
  },

  login: (user: UserProfile) => {
    localStorage.setItem('squadspace_local_user', JSON.stringify(user));
    set({ currentUser: user, isAuthenticated: true });
  },
}));
