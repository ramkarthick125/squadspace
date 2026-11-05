import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { Message, MessageReaction, UserProfile } from '../types';
import { useChatStore } from '../store/useChatStore';
import { useServerStore } from '../store/useServerStore';
import { notificationService } from './notificationService';

let messagesChannel: RealtimeChannel | null = null;
let broadcastChannel: RealtimeChannel | null = null;

export const realtimeService = {
  /**
   * Subscribe to real-time messages and reactions
   */
  initRealtimeSubscriptions(currentUser: UserProfile) {
    if (!isSupabaseConfigured || !supabase) {
      console.info('Supabase Realtime not enabled (mock fallback active).');
      return () => {};
    }

    // 1. Subscribe to Postgres Database Changes for Messages
    messagesChannel = supabase
      .channel('public:messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newRow = payload.new as any;
          // Don't re-add if we sent it locally already
          if (newRow.sender_id === currentUser.id) return;

          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newRow.sender_id)
            .single();

          const incomingMsg: Message = {
            id: newRow.id,
            channelId: newRow.channel_id,
            senderId: newRow.sender_id,
            sender: sender || {
              id: newRow.sender_id,
              username: 'user',
              displayName: 'Squad Member',
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              status: 'online',
            },
            content: newRow.content,
            attachments: newRow.attachments || [],
            reactions: [],
            isPinned: newRow.is_pinned,
            isEdited: newRow.is_edited,
            createdAt: newRow.created_at,
          };

          const store = useChatStore.getState();
          const existing = store.messagesByChannel[newRow.channel_id] || [];
          if (!existing.some((m) => m.id === incomingMsg.id)) {
            useChatStore.setState({
              messagesByChannel: {
                ...store.messagesByChannel,
                [newRow.channel_id]: [...existing, incomingMsg],
              },
            });

            // Trigger notification
            const channels = useServerStore.getState().channels;
            const channel = channels.find((c) => c.id === newRow.channel_id);
            notificationService.notify({
              title: `#${channel?.name || 'chat'} — ${incomingMsg.sender.displayName}`,
              body: incomingMsg.content,
              channelId: newRow.channel_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updatedRow = payload.new as any;
          const store = useChatStore.getState();
          const channelId = updatedRow.channel_id;
          const existing = store.messagesByChannel[channelId] || [];

          useChatStore.setState({
            messagesByChannel: {
              ...store.messagesByChannel,
              [channelId]: existing.map((m) =>
                m.id === updatedRow.id
                  ? { ...m, content: updatedRow.content, isEdited: updatedRow.is_edited, isPinned: updatedRow.is_pinned }
                  : m
              ),
            },
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) return;

          const store = useChatStore.getState();
          const updatedByChannel: Record<string, Message[]> = {};

          for (const [chId, msgs] of Object.entries(store.messagesByChannel)) {
            updatedByChannel[chId] = msgs.filter((m) => m.id !== deletedId);
          }

          useChatStore.setState({ messagesByChannel: updatedByChannel });
        }
      )
      .subscribe();

    // 2. Broadcast Channel for Live Typing & Presence
    broadcastChannel = supabase.channel('squadspace_broadcast', {
      config: { presence: { key: currentUser.id } },
    });

    broadcastChannel
      .on('broadcast', { event: 'typing' }, (event) => {
        const { channelId, username, isTyping } = event.payload;
        if (username === currentUser.username) return;
        useChatStore.getState().setTyping(channelId, username, isTyping);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = broadcastChannel?.presenceState();
        if (state) {
          // Sync online members
          const onlineUserIds = Object.keys(state);
          const serverStore = useServerStore.getState();
          serverStore.members.forEach((m) => {
            if (onlineUserIds.includes(m.id) && m.status === 'offline') {
              serverStore.updateMember(m.id, { status: 'online' });
            }
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

    return () => {
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (broadcastChannel) supabase.removeChannel(broadcastChannel);
    };
  },

  /**
   * Broadcast typing state to all connected peers
   */
  broadcastTyping(channelId: string, username: string, isTyping: boolean) {
    if (broadcastChannel) {
      broadcastChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { channelId, username, isTyping },
      });
    }
  },
};
