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
      // 1. Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (existingUser) {
        return { user: null, error: 'Username is already taken. Please choose another.' };
      }

      // 2. Validate invite code if provided
      let matchedServerId: string | undefined;
      if (inviteCode && inviteCode.trim()) {
        const { data: invite } = await supabase
          .from('invitations')
          .select('*')
          .eq('code', inviteCode.trim())
          .maybeSingle();

        if (invite) {
          if (invite.max_uses && invite.uses >= invite.max_uses) {
            return { user: null, error: 'This invite code has reached its maximum uses.' };
          }
          if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return { user: null, error: 'This invite code has expired.' };
          }
          matchedServerId = invite.server_id;
        }
      }

      // 3. Supabase Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.toLowerCase().trim(),
            display_name: displayName.trim() || username,
            email: email.trim().toLowerCase(),
            is_admin: Boolean(isAdminSetup),
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

      // 4. Save username -> email mapping in local cache for instant username logins
      try {
        const userCache = JSON.parse(localStorage.getItem('squadspace_users_cache') || '{}');
        userCache[username.toLowerCase().trim()] = email.trim().toLowerCase();
        localStorage.setItem('squadspace_users_cache', JSON.stringify(userCache));
      } catch {}

      // 5. Create Profile Record
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: username.toLowerCase().trim(),
          display_name: displayName.trim() || username,
          email: email.trim().toLowerCase(),
          avatar_url: avatarUrl,
          status: 'online',
          is_admin: Boolean(isAdminSetup),
        });

      if (profileErr) {
        console.warn('Profile record note:', profileErr.message);
      }

      // 6. Server Setup / Membership
      const { data: existingServers } = await supabase.from('servers').select('id').limit(1);
      let serverId = matchedServerId || existingServers?.[0]?.id;

      if (!serverId) {
        // Create initial default server if none exists yet
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
          role: isAdminSetup ? 'owner' : 'member',
        });

        // Ensure at least one invitation exists
        const { data: existingInv } = await supabase.from('invitations').select('id').limit(1);
        if (!existingInv || existingInv.length === 0) {
          const initialCode = 'sqd-' + Math.random().toString(36).substring(2, 8);
          await supabase.from('invitations').insert({
            code: initialCode,
            server_id: serverId,
            creator_id: authData.user.id,
            max_uses: 50,
            uses: 0,
          });
        }
      }

      if (inviteCode && inviteCode.trim()) {
        await supabase
          .from('invitations')
          .update({ uses: 1 })
          .eq('code', inviteCode.trim());
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

      // If user typed username instead of email, lookup email from cache or profiles
      if (!emailOrUsername.includes('@')) {
        const cleanName = emailOrUsername.toLowerCase().trim();

        // 1. Check local cache
        try {
          const userCache = JSON.parse(localStorage.getItem('squadspace_users_cache') || '{}');
          if (userCache[cleanName]) {
            email = userCache[cleanName];
          }
        } catch {}

        // 2. Query profiles if not resolved yet
        if (!email.includes('@')) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', cleanName)
            .maybeSingle();

          if (profile && (profile as any).email) {
            email = (profile as any).email;
          } else {
            email = `${cleanName}@squadspace.internal`;
          }
        }
      }

      let authRes = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // If failed and was username, try with raw username or common patterns
      if (authRes.error && !emailOrUsername.includes('@')) {
        const cleanName = emailOrUsername.toLowerCase().trim();
        const testRes = await supabase.auth.signInWithPassword({
          email: `${cleanName}@gmail.com`,
          password,
        });
        if (!testRes.error && testRes.data.user) {
          authRes = testRes;
        }
      }

      const { data: authData, error: authError } = authRes;

      if (authError || !authData?.user) {
        if (authError?.message.toLowerCase().includes('email not confirmed')) {
          return {
            user: null,
            error: 'Email confirmation is pending. To allow instant login without email verification, go to Supabase Dashboard -> Authentication -> Providers -> Email and turn OFF "Confirm email".',
          };
        }
        return { user: null, error: authError?.message || 'Invalid email/username or password.' };
      }

      // Fetch Profile Details
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      const meta = authData.user.user_metadata || {};
      const userProfile: UserProfile = {
        id: authData.user.id,
        username: profile?.username || meta.username || authData.user.email?.split('@')[0] || 'user',
        displayName: profile?.display_name || meta.display_name || profile?.username || meta.username || 'Squad Member',
        avatarUrl: profile?.avatar_url || meta.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${meta.username || authData.user.id}`,
        status: 'online',
        customStatus: profile?.custom_status,
        aboutMe: profile?.about_me,
        isAdmin: Boolean(profile?.is_admin || meta.is_admin),
      };

      // Set online status in database if profile exists
      if (profile) {
        await supabase.from('profiles').update({ status: 'online' }).eq('id', authData.user.id);
      } else {
        // Attempt insert in background
        Promise.resolve(
          supabase.from('profiles').upsert({
            id: userProfile.id,
            username: userProfile.username,
            display_name: userProfile.displayName,
            avatar_url: userProfile.avatarUrl,
            status: 'online',
            is_admin: userProfile.isAdmin,
            email: authData.user.email,
          })
        ).catch(() => {});
      }

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
      const { data: invite } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', code.trim())
        .maybeSingle();

      const { data: servers } = await supabase.from('servers').select('id').limit(1);
      const serverId = invite?.server_id || servers?.[0]?.id;

      if (!serverId) {
        return { success: false, error: 'No active server found to join.' };
      }

      await supabase.from('server_members').upsert({
        server_id: serverId,
        user_id: userId,
        role: 'member',
      });

      if (invite) {
        await supabase
          .from('invitations')
          .update({ uses: (invite.uses || 0) + 1 })
          .eq('code', code.trim());
      }

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
