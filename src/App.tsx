import React, { useState, useEffect } from 'react';
import { Hash, Plus, UserPlus, Sparkles, Key } from 'lucide-react';
import { ServerRail } from './components/layout/ServerRail';
import { ChannelSidebar } from './components/layout/ChannelSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { MemberSidebar } from './components/layout/MemberSidebar';
import { ChatArea } from './components/chat/ChatArea';
import { VoiceRoom } from './components/voice/VoiceRoom';
import { DirectMessagesView } from './components/direct-messages/DirectMessagesView';
import { DiscordTitleBar } from './components/layout/DiscordTitleBar';
import { ProfileModal } from './components/modals/ProfileModal';
import { ChannelModal } from './components/modals/ChannelModal';
import { ServerSettingsModal } from './components/modals/ServerSettingsModal';
import { InviteModal } from './components/modals/InviteModal';
import { JoinServerModal } from './components/modals/JoinServerModal';
import { CreateServerModal } from './components/modals/CreateServerModal';
import { GifPickerModal } from './components/modals/GifPickerModal';
import { EmojiPickerModal } from './components/modals/EmojiPickerModal';
import { AuthModal } from './components/auth/AuthModal';
import { LiveKitVoiceManager } from './components/voice/LiveKitVoiceManager';
import { realtimeService } from './lib/realtimeService';
import { authService } from './lib/authService';
import { useServerStore } from './store/useServerStore';
import { useChatStore } from './store/useChatStore';
import { useAuthStore } from './store/useAuthStore';
import { useDMStore } from './store/useDMStore';
import { useGlobalKeybinds } from './hooks/useGlobalKeybinds';
import { ChannelType } from './types';

export function App() {
  useGlobalKeybinds();

  const { channels, activeChannelId, activeView, fetchServerData } = useServerStore();
  const { sendMessage, toggleReaction, fetchChannelMessages } = useChatStore();
  const { currentUser, isAuthenticated, isLoadingAuth, checkSession } = useAuthStore();

  // Layout states
  const [showMemberList, setShowMemberList] = useState(true);

  // Modals state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [channelModalCategoryId, setChannelModalCategoryId] = useState<string | undefined>();
  const [channelModalType, setChannelModalType] = useState<ChannelType>('text');
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [targetMessageIdForEmoji, setTargetMessageIdForEmoji] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [urlInviteCode, setUrlInviteCode] = useState<string | null>(null);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // 1. Check URL parameters for server invite links (e.g. ?invite=sqd-xxxxxx)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const inv = params.get('invite') || params.get('join') || params.get('code');
      if (inv) {
        setUrlInviteCode(inv.trim());
      }
    }
  }, []);

  // 2. Check Auth Session on initial load
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // 3. If authenticated and URL had an invite code, accept the invite
  useEffect(() => {
    if (isAuthenticated && currentUser && urlInviteCode) {
      authService.joinServerWithCode(urlInviteCode, currentUser.id).then((res) => {
        if (res.success) {
          fetchServerData();
          window.history.replaceState({}, document.title, window.location.pathname);
          setUrlInviteCode(null);
        }
      });
    }
  }, [isAuthenticated, currentUser?.id, urlInviteCode, fetchServerData]);

  // 4. Fetch server data when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchServerData();
      useDMStore.getState().initDMStore(currentUser);
    }
  }, [isAuthenticated, currentUser?.id, fetchServerData]);

  // 5. Fetch channel messages whenever active channel changes
  useEffect(() => {
    if (activeChannelId) {
      fetchChannelMessages(activeChannelId);
    }
  }, [activeChannelId, fetchChannelMessages]);

  // 6. Initialize Supabase Realtime subscriptions
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const cleanup = realtimeService.initRealtimeSubscriptions(currentUser);
      return () => cleanup && cleanup();
    }
  }, [isAuthenticated, currentUser?.id]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPWA(false);
    }
    setDeferredPrompt(null);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  const handleOpenCreateChannel = (categoryId?: string, defaultType: ChannelType = 'text') => {
    setChannelModalCategoryId(categoryId);
    setChannelModalType(defaultType);
    setIsChannelModalOpen(true);
  };

  const handleSelectGif = (gifUrl: string) => {
    if (!activeChannel || !currentUser) return;
    sendMessage(activeChannel.id, '', currentUser, [
      {
        id: `att-gif-${Date.now()}`,
        url: gifUrl,
        type: 'image',
        name: 'tenor.gif',
      },
    ]);
  };

  const handleSelectEmoji = (emoji: string) => {
    if (!activeChannel || !currentUser) return;

    if (targetMessageIdForEmoji) {
      toggleReaction(activeChannel.id, targetMessageIdForEmoji, emoji, currentUser.id);
      setTargetMessageIdForEmoji(null);
    } else {
      sendMessage(activeChannel.id, emoji, currentUser);
    }
  };

  const handleOpenEmojiForMessage = (messageId: string) => {
    setTargetMessageIdForEmoji(messageId);
    setIsEmojiPickerOpen(true);
  };

  // Loading state while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-discord-darkest text-discord-gray-200 select-none">
        <div className="w-16 h-16 rounded-3xl bg-discord-blurple flex items-center justify-center shadow-2xl mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-wide">Connecting to SquadSpace...</h2>
        <p className="text-xs text-discord-gray-400 mt-1">Preparing your private communications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-discord-darkest text-discord-gray-200 select-none font-sans">
      <DiscordTitleBar />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* LiveKit Voice SFU WebRTC Background Manager */}
        <LiveKitVoiceManager />

      {/* 1. Leftmost Server Rail */}
      <ServerRail
        onOpenServerSettings={() => setIsServerSettingsOpen(true)}
        onOpenCreateChannel={() => handleOpenCreateChannel()}
        onOpenJoinServer={() => setIsJoinServerOpen(true)}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
      />

      {/* 2. Direct Messages View or Server Workspace */}
      {activeView === 'dm' ? (
        <DirectMessagesView
          onOpenSettings={() => setIsProfileOpen(true)}
          onOpenEmojiPicker={() => {
            setTargetMessageIdForEmoji(null);
            setIsEmojiPickerOpen(true);
          }}
          onOpenGifPicker={() => setIsGifPickerOpen(true)}
        />
      ) : (
        /* Server Workspace View */
        <div className="flex-1 flex min-w-0 h-full overflow-hidden">
          {/* Channel Sidebar */}
          <ChannelSidebar
            onOpenSettings={() => setIsProfileOpen(true)}
            onOpenCreateChannel={handleOpenCreateChannel}
            onOpenServerSettings={() => setIsServerSettingsOpen(true)}
            onOpenInviteModal={() => setIsInviteOpen(true)}
            onOpenJoinServer={() => setIsJoinServerOpen(true)}
          />

          {/* Main Stage (Header + Chat, Voice Room, or Empty Server State) */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <AppHeader
              channel={activeChannel}
              showMemberList={showMemberList}
              onToggleMemberList={() => setShowMemberList(!showMemberList)}
              onInstallPWA={handleInstallPWA}
              canInstallPWA={canInstallPWA}
            />

            <div className="flex-1 flex min-w-0 h-[calc(100vh-48px)] overflow-hidden">
              {/* Empty Server Welcome State (When zero channels exist) */}
              {!activeChannel ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-discord-chat">
                  <div className="w-16 h-16 rounded-3xl bg-discord-blurple/20 flex items-center justify-center mb-4 text-discord-blurple shadow-lg">
                    <Hash className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">No Channels In This Server Yet</h3>
                  <p className="text-discord-gray-400 max-w-md text-sm mb-6 leading-relaxed">
                    Welcome to your private SquadSpace server! Start by creating your first text channel for chats or voice channel for hanging out.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenCreateChannel(undefined, 'text')}
                      className="px-5 py-2.5 bg-discord-blurple hover:bg-discord-blurple-hover text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Channel
                    </button>
                    <button
                      onClick={() => setIsInviteOpen(true)}
                      className="px-5 py-2.5 bg-discord-dark hover:bg-discord-hover text-discord-gray-200 text-sm font-semibold rounded-lg border border-discord-darkest transition flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      Invite Squad
                    </button>
                    <button
                      onClick={() => setIsJoinServerOpen(true)}
                      className="px-4 py-2.5 bg-discord-sidebar hover:bg-discord-hover text-discord-gray-300 text-sm font-semibold rounded-lg border border-discord-darkest transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Join with Code
                    </button>
                  </div>
                </div>
              ) : activeChannel.type === 'text' ? (
                <ChatArea
                  channel={activeChannel}
                  onOpenEmojiPicker={() => {
                    setTargetMessageIdForEmoji(null);
                    setIsEmojiPickerOpen(true);
                  }}
                  onOpenGifPicker={() => setIsGifPickerOpen(true)}
                  onOpenEmojiPickerForMessage={handleOpenEmojiForMessage}
                />
              ) : (
                <VoiceRoom
                  channel={activeChannel}
                  onOpenEmojiPicker={() => {
                    setTargetMessageIdForEmoji(null);
                    setIsEmojiPickerOpen(true);
                  }}
                  onOpenGifPicker={() => setIsGifPickerOpen(true)}
                  onOpenEmojiPickerForMessage={handleOpenEmojiForMessage}
                />
              )}

              {/* Right Sidebar: Members List */}
              {showMemberList && <MemberSidebar />}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogoutRequested={() => setIsAuthModalOpen(true)}
      />

      <ChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        defaultCategoryId={channelModalCategoryId}
        defaultType={channelModalType}
      />

      <ServerSettingsModal
        isOpen={isServerSettingsOpen}
        onClose={() => setIsServerSettingsOpen(false)}
      />

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <JoinServerModal
        isOpen={isJoinServerOpen}
        onClose={() => setIsJoinServerOpen(false)}
        initialCode={urlInviteCode || undefined}
      />

      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        onSwitchToJoin={() => setIsJoinServerOpen(true)}
      />

      <GifPickerModal
        isOpen={isGifPickerOpen}
        onClose={() => setIsGifPickerOpen(false)}
        onSelectGif={handleSelectGif}
      />

      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => {
          setIsEmojiPickerOpen(false);
          setTargetMessageIdForEmoji(null);
        }}
        onSelectEmoji={handleSelectEmoji}
      />

      {/* Auth Modal (Prompted when not logged in or on explicit logout) */}
      <AuthModal
        isOpen={!isAuthenticated || isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialInviteCode={urlInviteCode || undefined}
      />
      </div>
    </div>
  );
}

export default App;
