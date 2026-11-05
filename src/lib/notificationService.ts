/**
 * Notification Service for SquadSpace
 * Handles browser desktop notifications, sound alerts (Web Audio API synth chime),
 * and page title unread badges.
 */

let originalTitle = document.title;
let unreadCount = 0;

export const notificationService = {
  /**
   * Request permission for browser notifications
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Play Discord-inspired subtle audio chime using Web Audio API
   * Zero external MP3/WAV assets needed!
   */
  playNotificationChime() {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Harmonic chord: F5 -> A5 -> C6 chime
      osc.frequency.setValueAtTime(698.46, ctx.currentTime); // F5
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.08); // A5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.16); // C6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy catch
    }
  },

  /**
   * Trigger message or mention notification
   */
  notify(params: {
    title: string;
    body: string;
    channelId?: string;
    isMention?: boolean;
    isDM?: boolean;
  }) {
    const isWindowFocused = document.hasFocus() && !document.hidden;

    // If user is actively looking at the app, don't spam notifications
    if (isWindowFocused) return;

    // 1. Play sound
    this.playNotificationChime();

    // 2. Update page title with unread badge
    unreadCount += 1;
    document.title = `(${unreadCount}) SquadSpace`;

    // 3. Desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(params.title, {
          body: params.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          silent: true, // We already played our custom chime
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        // notification catch
      }
    }
  },

  /**
   * Clear unread badge when user returns
   */
  clearUnread() {
    unreadCount = 0;
    document.title = originalTitle;
  },
};

// Listen for window focus to clear unread counts
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    notificationService.clearUnread();
  });
}
