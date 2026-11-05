# 🚀 SquadSpace — Private Discord-Style Communication Platform

> **A lightweight, beautiful, private Discord-inspired platform designed specifically for a close friend group of 10–20 people — running 100% free of charge.**

---

## 💰 100% Free-Tier Feasibility Analysis

SquadSpace is architected deliberately so that **not a single dollar is ever spent** on infrastructure or hosting. All services chosen operate on permanent free tiers with **hard caps** (meaning zero risk of surprise overages).

| Service | Role | Free Allowance | Group Usage (10–20 Friends) | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Web Frontend & PWA CDN | 100 GB bandwidth / month | ~1–2 GB / month | **$0 / mo** |
| **Supabase** | PostgreSQL, Realtime & Auth | 500 MB DB, 1 GB Storage, 200 Realtime WebSockets | Stores ~1,000,000 messages; only 10–20 active connections | **$0 / mo** |
| **P2P WebRTC Mesh (Primary)** | Direct Peer-to-Peer Voice & 2K Screen Share | **Unlimited** (Zero server minutes & zero cloud bandwidth) | 100% of casual voice & screen hangouts | **$0 / mo** |
| **LiveKit Cloud (Fallback)** | Multi-User WebRTC Voice & Screen Share | 5,000 participant mins/month, 50 GB downstream bandwidth, **Hard Cap** | Available on-demand for large streams or strict firewalls | **$0 / mo** |
| **Tenor / Giphy** | GIF Search & Previews | Free developer API | Negligible | **$0 / mo** |
| **PWA Engine** | Desktop App Installation | Native Browser & OS integration | Local device resource | **$0 / mo** |

### 🛡️ Why You Will Never Incur Surprise Charges
* **LiveKit Cloud's Build Tier** features **hard limits** rather than automatic pay-as-you-go bill spikes. If your friend group ever exceeds 5,000 minutes in a month, connections simply pause until the 1st of the next month.
* **Supabase Free Tier** has no credit-card required policy for starter projects.
* **Vercel Hobby Tier** provides unlimited automatic preview deployments with zero cost.

---

## ✨ Implemented Core Features

### 1. Discord-Inspired Dark Charcoal UI
- Authentic Discord dark palette (`#1e1f22`, `#2b2d31`, `#313338`, `#383a40`, Blurple `#5865f2`, Online `#23a55a`).
- Left server rail with active hover capsules.
- Channel category sidebar with collapsible text and voice groups.
- Bottom user tray with live avatar, custom status, quick mute, deafen, and user settings gear.
- Online & Offline member roster with active gaming activity badges.

### 2. Channels & Messaging
- Default text channels: `#general`, `#gaming`, `#memes`, `#random`, `#announcements`, `#media`.
- Real-time messages with timestamps, sender profile avatars, and admin tags.
- Message actions: **Reply**, **Pin**, **Edit own messages**, **Delete messages**, **Emoji reactions**.
- Custom server emojis (`:pepe_comfy:`, `:cat_vibing:`, `:poggers:`, `:hype_fire:`).
- GIF search & instant sharing powered by Tenor/Giphy.
- In-channel image and attachment uploads.

### 3. Voice Channels & WebRTC Audio (Hybrid Engine)
- **Direct P2P Mesh (Unlimited Free Mode)**: Uses browser `RTCPeerConnection` with Google STUN (`stun.l.google.com:19302`) to stream audio directly between friends. Consumes 0 server minutes and 0 server bandwidth.
- **LiveKit Cloud SFU (Fallback Mode)**: Central server relay available on-demand via header toggle.
- Connected member roster directly visible under channel names.
- Speaking activity indicators with pulsing green halos (`speaking-indicator`).
- In-room controls: Microphone Mute/Unmute, Deafen, Screen Sharing, Disconnect.
- **Separate text chat inside voice channels** (Discord-style slideout drawer).

### 4. 2K QHD Screen Sharing
- **Resolutions supported**:
  - *Bandwidth Saver*: 720p @ 15fps (~360 MB/hr)
  - *Balanced*: 720p @ 30fps (~675 MB/hr)
  - *Full HD*: 1080p @ 30fps (~1.3 GB/hr)
  - *Ultra 2K*: 2560 × 1440 @ 30fps (~5 Mbps)
  - *Ultra 2K Pro*: 2560 × 1440 @ 60fps (~8.5 Mbps) for competitive gaming
- Rendered live via hardware GPU acceleration in full-screen HTML5 `<video>` stage.
- System audio capture supported alongside video stream.

### 4. Direct Messaging & Friends System
- Private one-on-one direct message conversations.
- Friends dashboard with tabs: Online, All, and Add Friend.
- Real-time user statuses: Online, Idle, Do Not Disturb, and Invisible.

### 5. Gaming Activity Status
- Set what game or activity you are playing (e.g. *Valorant*, *Minecraft*, *GTA V*, *Studying*).
- Displays next to your name in the member list and in voice rooms.

### 6. Desktop PWA (Progressive Web App)
- Installable directly as a native standalone desktop app in Chrome, Edge, and mobile.
- Custom app manifest (`manifest.webmanifest`), icons, and service worker (`sw.js`).
- Caches UI assets while bypassing all real-time chat, voice, and database endpoints to keep latency instantaneous.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Database / Backend**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Voice / Video**: LiveKit WebRTC SDK
- **PWA**: Web App Manifest + Service Worker

---

## 🚀 Getting Started

### 1. Start Local Development
```bash
# Clone or open project
cd DiscordCopy

# Install dependencies
npm install

# Run Vite dev server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### 2. Desktop PWA Installation
- In Chrome or Edge, click the **"Install App"** button in the top navigation bar or the install icon in your address bar.
- SquadSpace will launch as a standalone desktop application window with its own taskbar icon!

### 3. Connecting Supabase & LiveKit
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Create a free project on [Supabase](https://supabase.com).
3. Paste the contents of `supabase/schema.sql` into the Supabase SQL Editor and click **Run**.
4. Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.
5. Create a free project on [LiveKit Cloud](https://livekit.io) and add your `VITE_LIVEKIT_URL`.
