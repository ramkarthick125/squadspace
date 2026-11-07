import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile } from '../types';
import { realtimeService } from './realtimeService';

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
      let serverId = matchedServerId;

      // If user did NOT join via invite code, create their own private server!
      if (!serverId) {
        const personalServerName = `${displayName.trim() || username}'s Server`;
        const { data: newServer } = await supabase
          .from('servers')
          .insert({
            name: personalServerName,
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
          role: matchedServerId ? 'member' : 'owner',
        });

        // Ensure at least one invitation exists for this server
        const { data: existingInv } = await supabase
          .from('invitations')
          .select('id')
          .eq('server_id', serverId)
          .limit(1);

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
  async joinServerWithCode(code: string, userId: string): Promise<{ success: boolean; error?: string; serverId?: string }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not connected.' };

    try {
      const { data: invite, error: invErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', code.trim())
        .maybeSingle();

      if (invErr || !invite || !invite.server_id) {
        return { success: false, error: 'Invalid or expired invite code.' };
      }

      if (invite.max_uses && invite.uses >= invite.max_uses) {
        return { success: false, error: 'This invite code has reached its maximum uses.' };
      }

      const serverId = invite.server_id;

      await supabase.from('server_members').upsert({
        server_id: serverId,
        user_id: userId,
        role: 'member',
      });

      await supabase
        .from('invitations')
        .update({ uses: (invite.uses || 0) + 1 })
        .eq('code', code.trim());

      // Save to local user servers list
      try {
        const { data: server } = await supabase.from('servers').select('*').eq('id', serverId).maybeSingle();
        if (server) {
          const userServers = JSON.parse(localStorage.getItem(`squadspace_user_servers_${userId}`) || '[]');
          if (!userServers.some((s: any) => s.id === server.id)) {
            userServers.push({
              id: server.id,
              name: server.name,
              icon: '🚀',
              ownerId: server.owner_id,
              createdAt: server.created_at,
            });
            localStorage.setItem(`squadspace_user_servers_${userId}`, JSON.stringify(userServers));
          }
        }

        // Fetch user profile and broadcast live member joined
        const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (userProfile) {
          realtimeService.broadcastMemberJoined(serverId, {
            id: userProfile.id,
            username: userProfile.username,
            displayName: userProfile.display_name,
            avatarUrl: userProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userProfile.username}`,
            status: userProfile.status || 'online',
            customStatus: userProfile.custom_status,
            aboutMe: userProfile.about_me,
            isAdmin: Boolean(userProfile.is_admin),
          });
        }
      } catch {}

      return { success: true, serverId };
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
   * Request password reset link or recovery code
   */
  async requestPasswordReset(emailOrUsername: string): Promise<{ success: boolean; error?: string; email?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Database is not connected.' };
    }

    try {
      let email = emailOrUsername.trim().toLowerCase();

      // If user typed username instead of email, lookup email from profiles or local cache
      if (!email.includes('@')) {
        const cleanName = email;

        // 1. Check local cache first
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
            .select('email')
            .eq('username', cleanName)
            .maybeSingle();

          if (profile && (profile as any).email) {
            email = (profile as any).email;
          }
        }
      }

      if (!email.includes('@')) {
        return {
          success: false,
          error: `Could not find an email associated with username "${emailOrUsername}". Please enter your full registered email address.`,
        };
      }

      // Determine redirect URL:
      // On web browser, use window.location.origin
      // In Electron or local file:, fallback to public Vercel production URL
      let redirectUrl = 'https://squadspace-flame.vercel.app';
      if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
        redirectUrl = window.location.origin;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            success: false,
            error: 'For security, please wait a minute before requesting another reset email.',
            email,
          };
        }
        return { success: false, error: error.message, email };
      }

      return { success: true, email };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send password reset email.' };
    }
  },

  /**
   * Verify recovery OTP code (e.g. 6-digit code or email token)
   */
  async verifyRecoveryOtp(email: string, token: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'recovery',
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to verify recovery code.' };
    }
  },

  /**
   * Update password for recovery or logged in session
   */
  async updateUserPassword(newPassword: string): Promise<{ user: UserProfile | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      const saved = localStorage.getItem('squadspace_local_user');
      if (saved) {
        try {
          return { user: JSON.parse(saved) };
        } catch {}
      }
      return { user: null };
    }

    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error || !data.user) {
        return { user: null, error: error?.message || 'Failed to update password.' };
      }

      // Fetch updated user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const meta = data.user.user_metadata || {};
      const userProfile: UserProfile = {
        id: data.user.id,
        username: profile?.username || meta.username || data.user.email?.split('@')[0] || 'user',
        displayName: profile?.display_name || meta.display_name || profile?.username || meta.username || 'Squad Member',
        avatarUrl: profile?.avatar_url || meta.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${meta.username || data.user.id}`,
        status: 'online',
        customStatus: profile?.custom_status,
        aboutMe: profile?.about_me,
        isAdmin: Boolean(profile?.is_admin || meta.is_admin),
      };

      // Mark online in database
      await supabase.from('profiles').update({ status: 'online' }).eq('id', data.user.id);

      return { user: userProfile };
    } catch (err: any) {
      return { user: null, error: err.message || 'Failed to set new password.' };
    }
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
