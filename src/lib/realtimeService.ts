import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { Channel, Message, MessageReaction, UserProfile, VoiceParticipant } from '../types';
import { useChatStore } from '../store/useChatStore';
import { useServerStore } from '../store/useServerStore';
import { useVoiceStore } from '../store/useVoiceStore';
import { useDMStore } from '../store/useDMStore';
import { notificationService } from './notificationService';
import { sounds } from './soundEffects';

let broadcastChannel: RealtimeChannel | null = null;
let inboxChannel: RealtimeChannel | null = null;
let localBroadcast: BroadcastChannel | null = null;

export const realtimeService = {
  /**
   * Initialize real-time sync across devices (Supabase Broadcast) and tabs (Web BroadcastChannel)
   */
  initRealtimeSubscriptions(currentUser: UserProfile) {
    // 1. Local Cross-Tab Broadcast Channel (Instant 0ms latency for same-machine browsers)
    if (typeof window !== 'undefined') {
      try {
        localBroadcast = new BroadcastChannel('squadspace_universal_sync');
        localBroadcast.onmessage = (event) => {
          this.handleIncomingPayload(event.data, currentUser);
        };
      } catch {}
    }

    if (!isSupabaseConfigured || !supabase) {
      return () => {
        if (localBroadcast) localBroadcast.close();
      };
    }

    // 2. Global Supabase Realtime Broadcast Mesh
    try {
      broadcastChannel = supabase.channel('squadspace_global_mesh', {
        config: {
          broadcast: { self: false },
          presence: { key: currentUser.id },
        },
      });

      broadcastChannel
        .on('broadcast', { event: 'sync_event' }, (event) => {
          this.handleIncomingPayload(event.payload, currentUser);
        })
        .on('broadcast', { event: 'typing' }, (event) => {
          const { channelId, username, isTyping } = event.payload;
          if (username === currentUser.username) return;
          useChatStore.getState().setTyping(channelId, username, isTyping);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = broadcastChannel?.presenceState();
          if (state) {
            const onlineUserIds = Object.keys(state);
            const serverStore = useServerStore.getState();
            serverStore.members.forEach((m) => {
              if (m.id === currentUser.id) return; // Keep local user status controlled by user
              if (onlineUserIds.includes(m.id)) {
                const presenceList = state[m.id];
                const latestPresence = presenceList && presenceList[0] as any;
                const activeStatus = latestPresence?.status || 'online';
                if (m.status !== activeStatus) {
                  serverStore.updateMember(m.id, {
                    status: activeStatus,
                    customStatus: latestPresence?.customStatus ?? m.customStatus,
                    gamingActivity: latestPresence?.gamingActivity ?? m.gamingActivity,
                  });
                }
              } else if (m.status !== 'offline') {
                serverStore.updateMember(m.id, { status: 'offline' });
              }
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key && key !== currentUser.id) {
            useServerStore.getState().updateMember(key, { status: 'offline' });
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key && key !== currentUser.id && newPresences && newPresences[0]) {
            const pres = newPresences[0] as any;
            useServerStore.getState().updateMember(key, {
              status: pres.status || 'online',
              customStatus: pres.customStatus,
              gamingActivity: pres.gamingActivity,
            });
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await broadcastChannel?.track({
              userId: currentUser.id,
              username: currentUser.username,
              status: currentUser.status,
              customStatus: currentUser.customStatus,
              gamingActivity: currentUser.gamingActivity,
            });
          }
        });
    } catch (err) {
      console.warn('Global mesh setup note:', err);
    }

    // 3. Dedicated Personal User Inbox Channel (Direct peer-to-peer delivery for DMs & Friend requests)
    try {
      inboxChannel = supabase.channel(`user_inbox_${currentUser.id}`, {
        config: { broadcast: { self: false } },
      });

      inboxChannel
        .on('broadcast', { event: 'sync_event' }, (event) => {
          this.handleIncomingPayload(event.payload, currentUser);
        })
        .subscribe();
    } catch (err) {
      console.warn('Personal inbox setup note:', err);
    }

    const handleBeforeUnload = () => {
      try {
        broadcastChannel?.untrack();
        if (broadcastChannel && supabase) supabase.removeChannel(broadcastChannel);
      } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      if (localBroadcast) localBroadcast.close();
      if (broadcastChannel && supabase) supabase.removeChannel(broadcastChannel);
      if (inboxChannel && supabase) supabase.removeChannel(inboxChannel);
    };
  },

  /**
   * Handle incoming real-time payload from either WebSockets or Local Broadcast
   */
  handleIncomingPayload(payload: any, currentUser: UserProfile) {
    if (!payload || payload.senderId === currentUser.id) return;

    // Filter directed messages not intended for this user
    if (payload.recipientId && payload.recipientId !== currentUser.id) {
      return;
    }

    switch (payload.type) {
      // 1. Live Chat Message received
      case 'new_message': {
        const { message, channelId } = payload;
        const chatStore = useChatStore.getState();
        const existing = chatStore.messagesByChannel[channelId] || [];

        if (!existing.some((m) => m.id === message.id)) {
          useChatStore.setState({
            messagesByChannel: {
              ...chatStore.messagesByChannel,
              [channelId]: [...existing, message],
            },
          });

          // Play notification chime
          sounds.playNotificationChime();

          // Show desktop notification
          const channels = useServerStore.getState().channels;
          const ch = channels.find((c) => c.id === channelId);
          notificationService.notify({
            title: `#${ch?.name || 'chat'} — ${message.sender?.displayName || 'User'}`,
            body: message.content || 'Sent an attachment',
            channelId,
          });
        }
        break;
      }

      // 2. Chat Message Edited
      case 'message_edit': {
        const { channelId, messageId, content } = payload;
        const chatStore = useChatStore.getState();
        const existing = chatStore.messagesByChannel[channelId] || [];

        useChatStore.setState({
          messagesByChannel: {
            ...chatStore.messagesByChannel,
            [channelId]: existing.map((m) =>
              m.id === messageId ? { ...m, content, isEdited: true } : m
            ),
          },
        });
        break;
      }

      // 3. Chat Message Deleted
      case 'message_delete': {
        const { channelId, messageId } = payload;
        const chatStore = useChatStore.getState();
        const existing = chatStore.messagesByChannel[channelId] || [];

        useChatStore.setState({
          messagesByChannel: {
            ...chatStore.messagesByChannel,
            [channelId]: existing.filter((m) => m.id !== messageId),
          },
        });
        break;
      }

      // 4. Message Reaction
      case 'message_reaction': {
        const { channelId, messageId, emoji, userId } = payload;
        const chatStore = useChatStore.getState();
        chatStore.toggleReaction(channelId, messageId, emoji, userId);
        break;
      }

      // 5. Channel Lifecycle (Created, Deleted, Renamed)
      case 'channel_event': {
        const { action, channel, serverId } = payload;
        const serverStore = useServerStore.getState();
        if (serverStore.activeServerId !== serverId) return;

        if (action === 'created') {
          if (!serverStore.channels.some((c) => c.id === channel.id)) {
            const updated = [...serverStore.channels, channel];
            useServerStore.setState({ channels: updated });
            try {
              localStorage.setItem(`squadspace_channels_${serverId}`, JSON.stringify(updated));
            } catch {}
          }
        } else if (action === 'deleted') {
          const updated = serverStore.channels.filter((c) => c.id !== channel.id);
          useServerStore.setState({ channels: updated });
          try {
            localStorage.setItem(`squadspace_channels_${serverId}`, JSON.stringify(updated));
          } catch {}
        } else if (action === 'renamed') {
          const updated = serverStore.channels.map((c) =>
            c.id === channel.id ? { ...c, name: channel.name, topic: channel.topic } : c
          );
          useServerStore.setState({ channels: updated });
          try {
            localStorage.setItem(`squadspace_channels_${serverId}`, JSON.stringify(updated));
          } catch {}
        }
        break;
      }

      // 6. Voice Channel Presence & State
      case 'voice_state': {
        const { channelId, user, action, isMuted } = payload;
        const voiceStore = useVoiceStore.getState();
        const currentByChannel = { ...voiceStore.participantsByChannel };
        const list = currentByChannel[channelId] || [];

        if (action === 'joined') {
          if (!list.some((p) => p.userId === user.id)) {
            currentByChannel[channelId] = [
              ...list,
              {
                userId: user.id,
                user,
                isMuted: Boolean(isMuted),
                isDeafened: false,
                isSpeaking: false,
                isScreenSharing: false,
                joinedAt: new Date().toISOString(),
              },
            ];
            useVoiceStore.setState({ participantsByChannel: currentByChannel });
          }
        } else if (action === 'left') {
          currentByChannel[channelId] = list.filter((p) => p.userId !== user.id);
          useVoiceStore.setState({ participantsByChannel: currentByChannel });
        } else if (action === 'muted') {
          currentByChannel[channelId] = list.map((p) =>
            p.userId === user.id ? { ...p, isMuted: Boolean(isMuted) } : p
          );
          useVoiceStore.setState({ participantsByChannel: currentByChannel });
        }
        break;
      }

      // 7. Direct Message (DM)
      case 'new_dm': {
        const { message, conversationId, senderProfile } = payload;
        const profile = senderProfile || message.sender;
        useDMStore.getState().receiveIncomingDM(message, conversationId, profile);
        break;
      }

      // 7b. DM Edit
      case 'dm_edit': {
        const { conversationId, messageId, content } = payload;
        useDMStore.getState().receiveDMEdit(conversationId, messageId, content);
        break;
      }

      // 7c. DM Delete
      case 'dm_delete': {
        const { conversationId, messageId } = payload;
        useDMStore.getState().receiveDMDelete(conversationId, messageId);
        break;
      }

      // 7d. DM Reaction
      case 'dm_reaction': {
        const { conversationId, messageId, emoji, userId } = payload;
        useDMStore.getState().receiveDMReaction(conversationId, messageId, emoji, userId);
        break;
      }

      // 8. Friend Request
      case 'friend_request': {
        const { senderProfile } = payload;
        if (senderProfile) {
          useDMStore.getState().receiveFriendRequest(senderProfile);
        }
        break;
      }

      // 9. Server Member Joined
      case 'server_member_joined': {
        const { serverId, user } = payload;
        if (serverId && user) {
          useServerStore.getState().handleMemberJoined(serverId, user);
        }
        break;
      }
    }
  },

  /**
   * Broadcast message to all connected clients
   */
  broadcastMessage(message: Message) {
    this.sendUniversalPayload({
      type: 'new_message',
      senderId: message.senderId,
      channelId: message.channelId,
      message,
    });
  },

  broadcastMessageEdit(channelId: string, messageId: string, content: string, senderId: string) {
    this.sendUniversalPayload({
      type: 'message_edit',
      senderId,
      channelId,
      messageId,
      content,
    });
  },

  broadcastMessageDelete(channelId: string, messageId: string, senderId: string) {
    this.sendUniversalPayload({
      type: 'message_delete',
      senderId,
      channelId,
      messageId,
    });
  },

  broadcastReaction(channelId: string, messageId: string, emoji: string, userId: string) {
    this.sendUniversalPayload({
      type: 'message_reaction',
      senderId: userId,
      channelId,
      messageId,
      emoji,
      userId,
    });
  },

  broadcastChannelEvent(action: 'created' | 'deleted' | 'renamed', channel: any, serverId: string, senderId: string) {
    this.sendUniversalPayload({
      type: 'channel_event',
      senderId,
      action,
      channel,
      serverId,
    });
  },

  broadcastVoiceState(channelId: string, user: UserProfile, action: 'joined' | 'left' | 'muted', isMuted?: boolean) {
    this.sendUniversalPayload({
      type: 'voice_state',
      senderId: user.id,
      channelId,
      user,
      action,
      isMuted,
    });
  },

  broadcastDM(message: Message, conversationId: string, recipientId: string, senderProfile: UserProfile) {
    this.sendUniversalPayload(
      {
        type: 'new_dm',
        senderId: message.senderId,
        recipientId,
        conversationId,
        message,
        senderProfile,
      },
      recipientId
    );
  },

  broadcastDMEdit(conversationId: string, messageId: string, content: string, senderId: string, recipientId?: string) {
    this.sendUniversalPayload(
      {
        type: 'dm_edit',
        senderId,
        conversationId,
        messageId,
        content,
      },
      recipientId
    );
  },

  broadcastDMDelete(conversationId: string, messageId: string, senderId: string, recipientId?: string) {
    this.sendUniversalPayload(
      {
        type: 'dm_delete',
        senderId,
        conversationId,
        messageId,
      },
      recipientId
    );
  },

  broadcastDMReaction(conversationId: string, messageId: string, emoji: string, userId: string, recipientId?: string) {
    this.sendUniversalPayload(
      {
        type: 'dm_reaction',
        senderId: userId,
        conversationId,
        messageId,
        emoji,
        userId,
      },
      recipientId
    );
  },

  broadcastFriendRequest(senderProfile: UserProfile, recipientId: string) {
    this.sendUniversalPayload(
      {
        type: 'friend_request',
        senderId: senderProfile.id,
        recipientId,
        senderProfile,
      },
      recipientId
    );
  },

  broadcastMemberJoined(serverId: string, user: UserProfile) {
    this.sendUniversalPayload({
      type: 'server_member_joined',
      serverId,
      user,
      senderId: user.id,
    });
  },

  broadcastTyping(channelId: string, username: string, isTyping: boolean) {
    if (broadcastChannel) {
      broadcastChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { channelId, username, isTyping },
      });
    }
  },

  sendUniversalPayload(payload: any, targetUserId?: string) {
    // 1. Local cross-tab
    if (localBroadcast) {
      try {
        localBroadcast.postMessage(payload);
      } catch {}
    }

    // 2. Global Supabase broadcast
    if (broadcastChannel) {
      try {
        broadcastChannel.send({
          type: 'broadcast',
          event: 'sync_event',
          payload,
        });
      } catch {}
    }

    // 3. Targeted user inbox broadcast (direct deliverability)
    if (targetUserId && supabase) {
      try {
        const directInbox = supabase.channel(`user_inbox_${targetUserId}`);
        directInbox.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            directInbox.send({
              type: 'broadcast',
              event: 'sync_event',
              payload,
            });
          }
        });
      } catch {}
    }
  },
};
