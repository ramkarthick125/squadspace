import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile } from '../types';

export interface RegisterParams {
  email: string;
  password: string;
  username: string;
  displayName: string;
  inviteCode?: string;
  isAdminSetup?: boolean;
}

export interface LoginParams {
  emailOrUsername: string;
  password: string;
}

export const authService = {
  /**
   * Check if any admin account has already been registered
   */
  async checkAdminExists(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1);
      return Boolean(data && data.length > 0);
    } catch {
      return false;
    }
  },

  /**
   * Register a new user with invite-only verification or founder admin setup
   */
  async register(params: RegisterParams): Promise<{ user: UserProfile | null; error?: string }> {
    const { email, password, username, displayName, inviteCode, isAdminSetup } = params;

    if (!isSupabaseConfigured || !supabase) {
      const localUser: UserProfile = {
        id: `usr-${Date.now()}`,
        username: username.toLowerCase().trim(),
        displayName: displayName.trim() || username,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
        status: 'online',
        isAdmin: Boolean(isAdminSetup),
      };
      localStorage.setItem('squadspace_local_user', JSON.stringify(localUser));
      return { user: localUser };
    }

    try {
      // 1. Validate Admin Setup or Invite Code
      if (isAdminSetup) {
        const { data: existingAdmin } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_admin', true)
          .limit(1);

        if (existingAdmin && existingAdmin.length > 0) {
          return { user: null, error: 'A Founder Administrator account already exists. Please log in or register with an invite code.' };
        }
      } else {
        if (!inviteCode) {
          return { user: null, error: 'Registration is invite-only. Please provide a valid invite code from your server admin.' };
        }

        const { data: invite, error: inviteErr } = await supabase
          .from('invitations')
          .select('*')
          .eq('code', inviteCode.trim())
          .single();

        if (inviteErr || !invite) {
          return { user: null, error: 'Invalid or expired invite code.' };
        }

        if (invite.max_uses && invite.uses >= invite.max_uses) {
          return { user: null, error: 'This invite code has reached its maximum uses.' };
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          return { user: null, error: 'This invite code has expired.' };
        }
      }

      // 2. Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (existingUser) {
        return { user: null, error: 'Username is already taken. Please choose another.' };
      }

      // 3. Supabase Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.toLowerCase().trim(),
            display_name: displayName.trim() || username,
          },
        },
      });

      if (authError || !authData.user) {
        return { user: null, error: authError?.message || 'Failed to create account.' };
      }

      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

      // 4. Create Profile Record
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: username.toLowerCase().trim(),
          display_name: displayName.trim() || username,
          avatar_url: avatarUrl,
          status: 'online',
          is_admin: Boolean(isAdminSetup),
        });

      if (profileErr) {
        console.error('Profile creation error:', profileErr);
      }

      // 5. If this is admin setup, create default server if not existing
      if (isAdminSetup) {
        await supabase.from('servers').upsert({
          name: 'SquadSpace Hangout',
          owner_id: authData.user.id,
        });
      }

      // 6. Increment Invite Code Uses if applicable
      if (inviteCode && !isAdminSetup) {
        try {
          await supabase.rpc('increment_invite_uses', { p_code: inviteCode.trim() });
        } catch {
          // fallback silent catch
        }
      }

      const newUser: UserProfile = {
        id: authData.user.id,
        username: username.toLowerCase().trim(),
        displayName: displayName.trim() || username,
        avatarUrl,
        status: 'online',
        isAdmin: Boolean(isAdminSetup),
      };

      return { user: newUser };
    } catch (err: any) {
      return { user: null, error: err.message || 'An unexpected error occurred during registration.' };
    }
  },

  /**
   * Log in user with email & password
   */
  async login(params: LoginParams): Promise<{ user: UserProfile | null; error?: string }> {
    const { emailOrUsername, password } = params;

    if (!isSupabaseConfigured || !supabase) {
      const saved = localStorage.getItem('squadspace_local_user');
      if (saved) {
        try {
          return { user: JSON.parse(saved) };
        } catch {}
      }
      const localUser: UserProfile = {
        id: `usr-${Date.now()}`,
        username: emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername,
        displayName: emailOrUsername.includes('@') ? emailOrUsername.split('@')[0] : emailOrUsername,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${emailOrUsername}`,
        status: 'online',
        isAdmin: true,
      };
      localStorage.setItem('squadspace_local_user', JSON.stringify(localUser));
      return { user: localUser };
    }

    try {
      let email = emailOrUsername.trim();

      // If user typed username instead of email, lookup email from profiles
      if (!emailOrUsername.includes('@')) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('username', emailOrUsername.toLowerCase().trim())
          .maybeSingle();

        if (!profile) {
          return { user: null, error: 'User not found with this username.' };
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { user: null, error: authError?.message || 'Invalid email or password.' };
      }

      // Fetch Profile Details
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const userProfile: UserProfile = profile
        ? {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`,
            status: 'online',
            customStatus: profile.custom_status,
            aboutMe: profile.about_me,
            isAdmin: Boolean(profile.is_admin),
          }
        : {
            id: authData.user.id,
            username: email.split('@')[0],
            displayName: email.split('@')[0],
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
            status: 'online',
          };

      // Set online status in database
      await supabase.from('profiles').update({ status: 'online' }).eq('id', authData.user.id);

      return { user: userProfile };
    } catch (err: any) {
      return { user: null, error: err.message || 'Login failed.' };
    }
  },

  /**
   * Log out current user
   */
  async logout(userId?: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      if (userId) {
        await supabase.from('profiles').update({ status: 'offline' }).eq('id', userId);
      }
      await supabase.auth.signOut();
    }
    localStorage.removeItem('squadspace_local_user');
  },

  /**
   * Change user password
   */
  async changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: true };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Upload Profile Avatar to Supabase Storage
   */
  async uploadAvatar(file: File, userId: string): Promise<{ url?: string; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      const localUrl = URL.createObjectURL(file);
      return { url: localUrl };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        return { error: uploadError.message };
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return { url: data.publicUrl };
    } catch (err: any) {
      return { error: err.message || 'Avatar upload failed' };
    }
  },
};
