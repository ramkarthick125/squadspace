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
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', true)
        .limit(1);

      if (error) {
        console.warn('checkAdminExists error:', error);
        return false;
      }
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
      return { user: null, error: 'Database is not connected.' };
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
          return {
            user: null,
            error: 'A Founder Administrator account already exists for this server. Please join with an invite code or log in.',
          };
        }
      } else {
        if (!inviteCode || !inviteCode.trim()) {
          return {
            user: null,
            error: 'Registration is invite-only. Please enter a valid invite code from your server administrator.',
          };
        }

        const { data: invite, error: inviteErr } = await supabase
          .from('invitations')
          .select('*')
          .eq('code', inviteCode.trim())
          .maybeSingle();

        if (inviteErr || !invite) {
          return {
            user: null,
            error: `Invalid invite code "${inviteCode.trim()}". Please request an invite code from the server admin.`,
          };
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

      // If Supabase has "Confirm email" enabled, signIn to check session
      let session = authData.session;
      if (!session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInErr) {
          if (signInErr.message.toLowerCase().includes('email not confirmed')) {
            return {
              user: null,
              error: 'Email confirmation is required by Supabase. To enable instant signup for friends without emails, go to Supabase Dashboard -> Authentication -> Providers -> Email and turn OFF "Confirm email".',
            };
          }
          return { user: null, error: signInErr.message };
        }
        session = signInData.session;
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

      // 5. Server Setup / Membership
      if (isAdminSetup) {
        // Create server if none exists
        const { data: existingServers } = await supabase.from('servers').select('id').limit(1);
        let serverId = existingServers?.[0]?.id;

        if (!serverId) {
          const { data: newServer } = await supabase
            .from('servers')
            .insert({
              name: 'SquadSpace Hangout',
              owner_id: authData.user.id,
            })
            .select()
            .single();
          serverId = newServer?.id;
        }

        if (serverId) {
          await supabase.from('server_members').upsert({
            server_id: serverId,
            user_id: authData.user.id,
            role: 'owner',
          });

          // Generate first default invite code
          const initialCode = 'sqd-' + Math.random().toString(36).substring(2, 8);
          await supabase.from('invitations').insert({
            code: initialCode,
            server_id: serverId,
            creator_id: authData.user.id,
            max_uses: 25,
            uses: 0,
          });
        }
      } else if (inviteCode) {
        // Increment invite uses
        const { data: invRow } = await supabase
          .from('invitations')
          .select('uses, server_id')
          .eq('code', inviteCode.trim())
          .single();

        if (invRow) {
          await supabase
            .from('invitations')
            .update({ uses: (invRow.uses || 0) + 1 })
            .eq('code', inviteCode.trim());

          if (invRow.server_id) {
            await supabase.from('server_members').upsert({
              server_id: invRow.server_id,
              user_id: authData.user.id,
              role: 'member',
            });
          }
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
      return { user: null, error: 'Database is not connected.' };
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
          return { user: null, error: 'No account found with this username.' };
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        if (authError?.message.toLowerCase().includes('email not confirmed')) {
          return {
            user: null,
            error: 'Email confirmation is pending. To allow instant login without email verification, go to Supabase Dashboard -> Authentication -> Providers -> Email and turn OFF "Confirm email".',
          };
        }
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
   * Join server with invite code for an existing user
   */
  async joinServerWithCode(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not connected.' };

    try {
      const { data: invite, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', code.trim())
        .maybeSingle();

      if (error || !invite) {
        return { success: false, error: 'Invalid or expired invite code.' };
      }

      if (invite.max_uses && invite.uses >= invite.max_uses) {
        return { success: false, error: 'This invite code has reached its maximum uses.' };
      }

      const { data: servers } = await supabase.from('servers').select('id').limit(1);
      const serverId = invite.server_id || servers?.[0]?.id;

      if (serverId) {
        await supabase.from('server_members').upsert({
          server_id: serverId,
          user_id: userId,
          role: 'member',
        });
      }

      await supabase
        .from('invitations')
        .update({ uses: (invite.uses || 0) + 1 })
        .eq('code', code.trim());

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to join server.' };
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
    if (!isSupabaseConfigured || !supabase) return { success: true };

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
