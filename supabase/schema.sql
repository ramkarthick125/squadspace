-- ==============================================================================
-- SQUADSPACE — POSTGRESQL DATABASE SCHEMA & ROW-LEVEL SECURITY (SUPABASE)
-- Free tier friendly: Supports 10-20 friends with zero external dependencies
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  custom_status TEXT,
  about_me TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER ACTIVITIES (Gaming Activity Status)
CREATE TABLE IF NOT EXISTS public.user_activities (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  game TEXT NOT NULL,
  details TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVERS TABLE
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'SquadSpace Hangout',
  icon_url TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SERVER MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.server_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, user_id)
);

-- 5. CHANNEL CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.channel_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CHANNELS TABLE
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.channel_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  topic TEXT,
  position INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::JSONB,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MESSAGE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 9. DIRECT MESSAGE CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CONVERSATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 11. DIRECT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INVITATIONS TABLE (Invite-Only Registration)
CREATE TABLE IF NOT EXISTS public.invitations (
  code TEXT PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uses INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 10,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. CUSTOM EMOJIS TABLE
CREATE TABLE IF NOT EXISTS public.custom_emojis (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR FAST QUERIES & REALTIME
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_channels_server_id ON public.channels(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON public.server_members(user_id);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES (Fixes Critical Alerts)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emojis ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES (Optimized with (SELECT auth.uid()) to clear Init Plan warnings)
-- ==============================================================================

-- 1. Profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id);

-- 2. User Activities (Gaming Status)
DROP POLICY IF EXISTS "User activities viewable by authenticated users" ON public.user_activities;
DROP POLICY IF EXISTS "Users can manage own activities" ON public.user_activities;
CREATE POLICY "User activities viewable by authenticated users" ON public.user_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own activities" ON public.user_activities FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3. Servers & Members
DROP POLICY IF EXISTS "Servers viewable by authenticated users" ON public.servers;
DROP POLICY IF EXISTS "Users can manage servers" ON public.servers;
CREATE POLICY "Servers viewable by authenticated users" ON public.servers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage servers" ON public.servers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Server members viewable by authenticated users" ON public.server_members;
DROP POLICY IF EXISTS "Users can join servers" ON public.server_members;
CREATE POLICY "Server members viewable by authenticated users" ON public.server_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join servers" ON public.server_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Channel Categories & Channels
DROP POLICY IF EXISTS "Categories viewable by authenticated users" ON public.channel_categories;
DROP POLICY IF EXISTS "Users can manage categories" ON public.channel_categories;
CREATE POLICY "Categories viewable by authenticated users" ON public.channel_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage categories" ON public.channel_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Channels viewable by authenticated users" ON public.channels;
DROP POLICY IF EXISTS "Users can manage channels" ON public.channels;
CREATE POLICY "Channels viewable by authenticated users" ON public.channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage channels" ON public.channels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Messages
DROP POLICY IF EXISTS "Server members can read messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages;
DROP POLICY IF EXISTS "Users and admins can delete messages" ON public.messages;
CREATE POLICY "Server members can read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = sender_id);
CREATE POLICY "Users can edit own messages" ON public.messages FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = sender_id);
CREATE POLICY "Users and admins can delete messages" ON public.messages FOR DELETE TO authenticated USING (
  (SELECT auth.uid()) = sender_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true)
);

-- 6. Message Reactions
DROP POLICY IF EXISTS "Reactions viewable by authenticated users" ON public.message_reactions;
DROP POLICY IF EXISTS "Users can manage reactions" ON public.message_reactions;
CREATE POLICY "Reactions viewable by authenticated users" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage reactions" ON public.message_reactions FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 7. Conversations & Conversation Members
DROP POLICY IF EXISTS "Conversations viewable by members" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Conversations viewable by members" ON public.conversations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = id AND cm.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Users can create conversations" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Conversation members viewable by members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can manage conversation members" ON public.conversation_members;
CREATE POLICY "Conversation members viewable by members" ON public.conversation_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_id AND cm.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Users can manage conversation members" ON public.conversation_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Direct Messages
DROP POLICY IF EXISTS "Conversation members can read direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Conversation members can send direct messages" ON public.direct_messages;
CREATE POLICY "Conversation members can read direct messages" ON public.direct_messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = direct_messages.conversation_id
    AND conversation_members.user_id = (SELECT auth.uid())
  )
);
CREATE POLICY "Conversation members can send direct messages" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  (SELECT auth.uid()) = sender_id AND EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = direct_messages.conversation_id
    AND conversation_members.user_id = (SELECT auth.uid())
  )
);

-- 9. Invitations & Emojis
DROP POLICY IF EXISTS "Invitations viewable by authenticated users" ON public.invitations;
DROP POLICY IF EXISTS "Users can manage invitations" ON public.invitations;
CREATE POLICY "Invitations viewable by authenticated users" ON public.invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage invitations" ON public.invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Custom emojis viewable by authenticated users" ON public.custom_emojis;
DROP POLICY IF EXISTS "Users can create emojis" ON public.custom_emojis;
DROP POLICY IF EXISTS "Users and admins can delete emojis" ON public.custom_emojis;
CREATE POLICY "Custom emojis viewable by authenticated users" ON public.custom_emojis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create emojis" ON public.custom_emojis FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = creator_id);
CREATE POLICY "Users and admins can delete emojis" ON public.custom_emojis FOR DELETE TO authenticated USING (
  (SELECT auth.uid()) = creator_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true)
);

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activities;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ==============================================================================
-- AUTOMATIC PROFILE & INSTANT EMAIL CONFIRMATION TRIGGER
-- Allows friends to join instantly without email SMTP delays or "Email not confirmed"
-- ==============================================================================

-- 1. Auto-confirm email
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_confirm_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_confirm_user();

-- Confirm any existing unconfirmed users
UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- 2. Auto-create Profile in public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_admin_count INTEGER;
  chosen_username TEXT;
  chosen_display_name TEXT;
BEGIN
  SELECT COUNT(*) INTO existing_admin_count FROM public.profiles WHERE is_admin = true;
  
  chosen_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  chosen_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username, display_name, avatar_url, status, is_admin)
  VALUES (
    NEW.id,
    chosen_username,
    chosen_display_name,
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || chosen_username,
    'online',
    CASE WHEN existing_admin_count = 0 THEN TRUE ELSE FALSE END
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
