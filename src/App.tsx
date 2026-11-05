import React, { useState, useEffect } from 'react';
import { ServerRail } from './components/layout/ServerRail';
import { ChannelSidebar } from './components/layout/ChannelSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { MemberSidebar } from './components/layout/MemberSidebar';
import { ChatArea } from './components/chat/ChatArea';
import { VoiceRoom } from './components/voice/VoiceRoom';
import { DirectMessagesView } from './components/direct-messages/DirectMessagesView';
import { ProfileModal } from './components/modals/ProfileModal';
import { ChannelModal } from './components/modals/ChannelModal';
import { ServerSettingsModal } from './components/modals/ServerSettingsModal';
import { InviteModal } from './components/modals/InviteModal';
import { GifPickerModal } from './components/modals/GifPickerModal';
import { EmojiPickerModal } from './components/modals/EmojiPickerModal';
import { AuthModal } from './components/auth/AuthModal';
import { LiveKitVoiceManager } from './components/voice/LiveKitVoiceManager';
import { realtimeService } from './lib/realtimeService';
import { useServerStore } from './store/useServerStore';
import { useChatStore } from './store/useChatStore';
import { useAuthStore } from './store/useAuthStore';
import { ChannelType } from './types';

export function App() {
  const { channels, activeChannelId, activeView } = useServerStore();
  const { sendMessage, toggleReaction } = useChatStore();
  const { currentUser, isAuthenticated } = useAuthStore();

  // Layout states
  const [showMemberList, setShowMemberList] = useState(true);

  // Modals state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [channelModalCategoryId, setChannelModalCategoryId] = useState<string | undefined>();
  const [channelModalType, setChannelModalType] = useState<ChannelType>('text');
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [targetMessageIdForEmoji, setTargetMessageIdForEmoji] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // Initialize Supabase Realtime subscriptions
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
    if (!activeChannel) return;
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
    if (!activeChannel) return;

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-discord-darkest text-discord-gray-200 select-none font-sans">
      {/* LiveKit Voice SFU WebRTC Background Manager */}
      <LiveKitVoiceManager />

      {/* 1. Leftmost Server Rail */}
      <ServerRail
        onOpenServerSettings={() => setIsServerSettingsOpen(true)}
        onOpenCreateChannel={() => handleOpenCreateChannel()}
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
          />

          {/* Main Stage (Header + Chat or Voice Room) */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            <AppHeader
              channel={activeChannel}
              showMemberList={showMemberList}
              onToggleMemberList={() => setShowMemberList(!showMemberList)}
              onInstallPWA={handleInstallPWA}
              canInstallPWA={canInstallPWA}
            />

            <div className="flex-1 flex min-w-0 h-[calc(100vh-48px)] overflow-hidden">
              {/* Channel Content Stage */}
              {activeChannel?.type === 'text' ? (
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

      {/* Auth Modal (Triggered on Logout or when unauthenticated) */}
      <AuthModal
        isOpen={!isAuthenticated || isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
