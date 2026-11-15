import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Compass,
  Tv,
  Armchair,
  LogOut,
  Mic,
  MicOff,
  Headphones,
  ScreenShare,
  User,
  Shirt,
  HelpCircle,
  Settings,
  Send,
  Eye,
  Move,
  X,
} from 'lucide-react';
import { Channel, UserProfile, VoiceParticipant } from '../../../types';
import { LoungeScene } from './LoungeScene';
import { LoungeTV } from './LoungeTV';
import { LoungeSeatManager, SEAT_DEFINITIONS, SeatDefinition } from './LoungeSeats';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungePlayerController } from './LoungePlayerController';

interface Lounge3DViewProps {
  channel: Channel;
  currentUser: UserProfile | null;
  screenShareStream: MediaStream | null;
  screenSharingParticipant: any;
  participants: VoiceParticipant[];
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onExit: () => void;
}

export const Lounge3DView: React.FC<Lounge3DViewProps> = ({
  channel,
  currentUser,
  screenShareStream,
  screenSharingParticipant,
  participants,
  isMuted,
  isDeafened,
  isScreenSharing,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<LoungeScene | null>(null);
  const tvRef = useRef<LoungeTV | null>(null);
  const seatManagerRef = useRef<LoungeSeatManager | null>(null);
  const playerControllerRef = useRef<LoungePlayerController | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const localAvatarRef = useRef<LoungeAvatar | null>(null);

  // States
  const [hoveredSeat, setHoveredSeat] = useState<SeatDefinition | null>(null);
  const [nearestSeat, setNearestSeat] = useState<SeatDefinition | null>(null);
  const [isSitting, setIsSitting] = useState<boolean>(false);
  const [cameraView, setCameraView] = useState<'follow' | 'iso' | 'tv'>('iso');
  const cameraViewRef = useRef<'follow' | 'iso' | 'tv'>('iso');
  const [activeEmote, setActiveEmote] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Modals
  const [showOutfitModal, setShowOutfitModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [chatMessage, setChatMessage] = useState<string>('');

  // Outfit selection state (persisted in localStorage)
  const [outfit, setOutfit] = useState(() => {
    try {
      const saved = localStorage.getItem('squadspace_lounge_outfit');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      shirt: '#0f766e', // Teal t-shirt (matching user screenshot)
      pants: '#4d7c0f', // Olive green cargo shorts (matching user screenshot)
      hair: '#54321d',  // Chestnut brown hair
      skin: '#dca67a',  // Warm skin tone
    };
  });

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize Three.js scene, Avatar, and Render Loop
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Camera: Positioned matching the user's penthouse panoramic view (Image 2)
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 90);
    camera.position.set(0.0, 8.8, 12.5);
    cameraRef.current = camera;

    // 3. Orbit Controls (Completely free 360° mouse look with zero fighting)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.85;
    controls.target.set(0.0, 1.2, 0.4);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minPolarAngle = 0.15;
    controls.minDistance = 2.0;
    controls.maxDistance = 26.0;
    controlsRef.current = controls;

    // 4. Room Scene & Cinema TV
    const loungeScene = new LoungeScene();
    sceneRef.current = loungeScene;

    const loungeTV = new LoungeTV(loungeScene.tvMesh);
    tvRef.current = loungeTV;

    // 5. Seat Manager
    const seatManager = new LoungeSeatManager(loungeScene.scene);
    seatManagerRef.current = seatManager;

    // 6. Local Human Avatar & WASD Player Controller
    const localAvatar = new LoungeAvatar({
      userId: currentUser?.id || 'local-player',
      displayName: currentUser?.displayName || currentUser?.username || 'You',
      shirtColor: outfit.shirt,
      pantsColor: outfit.pants,
      hairColor: outfit.hair,
      skinColor: outfit.skin,
      isLocal: true,
    });
    loungeScene.scene.add(localAvatar.group);
    localAvatarRef.current = localAvatar;

    const playerController = new LoungePlayerController(
      localAvatar,
      seatManager,
      camera
    );
    playerControllerRef.current = playerController;

    // Broadcast synchronization across local tabs and network
    try {
      const bc = new BroadcastChannel('squadspace_lounge_sync');
      broadcastChannelRef.current = bc;

      playerController.onStateChange = (state) => {
        bc.postMessage({
          type: 'avatar_state',
          userId: currentUser?.id || 'local-player',
          displayName: currentUser?.displayName || currentUser?.username || 'You',
          outfit,
          ...state,
        });
      };

      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || data.userId === (currentUser?.id || 'local-player')) return;

        if (data.type === 'avatar_state') {
          let peerAvatar = seatManager.avatarMap.get(data.userId);
          if (!peerAvatar) {
            peerAvatar = new LoungeAvatar({
              userId: data.userId,
              displayName: data.displayName,
              shirtColor: data.outfit?.shirt,
              pantsColor: data.outfit?.pants,
              hairColor: data.outfit?.hair,
              skinColor: data.outfit?.skin,
              isLocal: false,
            });
            loungeScene.scene.add(peerAvatar.group);
            seatManager.avatarMap.set(data.userId, peerAvatar);
          }

          if (data.isSitting && data.seatId) {
            const seatDef = SEAT_DEFINITIONS.find((s) => s.id === data.seatId);
            if (seatDef) {
              peerAvatar.group.position.copy(seatDef.position);
              peerAvatar.setSitting(true, seatDef.lookAt);
            }
          } else {
            peerAvatar.setSitting(false);
            peerAvatar.group.position.set(data.position[0], data.position[1], data.position[2]);
            peerAvatar.group.rotation.y = data.rotationY;
            if (data.emote) {
              peerAvatar.playEmote(data.emote);
            }
          }
        } else if (data.type === 'avatar_emoji') {
          const peerAvatar = seatManager.avatarMap.get(data.userId);
          if (peerAvatar) peerAvatar.spawnFloatingEmoji(data.emoji);
        } else if (data.type === 'avatar_chat') {
          const peerAvatar = seatManager.avatarMap.get(data.userId);
          if (peerAvatar) peerAvatar.showSpeechBubble(data.message);
        }
      };
    } catch {}

    // Sync remote participants
    if (currentUser) {
      seatManager.syncParticipants(participants, currentUser.id);
    }

    // 7. Raycasting for Seat Clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(seatManager.getInteractiveMeshes());
      if (hits.length > 0) {
        const seatId = hits[0].object.userData.seatId;
        const seatDef = SEAT_DEFINITIONS.find((s) => s.id === seatId);
        setHoveredSeat(seatDef || null);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredSeat(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(seatManager.getInteractiveMeshes());
      if (hits.length > 0) {
        const seatId = hits[0].object.userData.seatId;
        playerController.sitInSeat(seatId);
        setIsSitting(true);
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // 8. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Main Animation Loop
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      playerController.update(delta);
      seatManager.update(delta);
      loungeScene.update();

      setIsSitting(playerController.isSitting);
      setNearestSeat(playerController.nearestSeat);
      setIsRunning(playerController.isRunning);

      // Smooth Follow Mode: Translates camera along with the avatar's movement WITHOUT fighting orbit angle!
      if (cameraViewRef.current === 'follow') {
        const avatarPos = localAvatar.group.position;
        const desiredTarget = new THREE.Vector3(avatarPos.x, avatarPos.y + 1.1, avatarPos.z);
        const targetDelta = desiredTarget.clone().sub(controls.target);

        // Translate camera smoothly as avatar moves
        if (targetDelta.lengthSq() > 0.000001) {
          controls.target.add(targetDelta);
          camera.position.add(targetDelta);
        }
      }

      controls.update();
      renderer.render(loungeScene.scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      playerController.dispose();
      loungeTV.dispose();
      seatManager.dispose();
      loungeScene.dispose();
      renderer.dispose();
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update TV Stream when screen share changes
  useEffect(() => {
    if (tvRef.current) {
      tvRef.current.setStream(
        screenShareStream,
        screenSharingParticipant?.user?.displayName || 'Live Screen'
      );
    }
  }, [screenShareStream, screenSharingParticipant]);

  // Sync participants
  useEffect(() => {
    if (seatManagerRef.current && currentUser) {
      seatManagerRef.current.syncParticipants(participants, currentUser.id);
    }
  }, [participants, currentUser]);

  // Update local avatar outfit
  const handleUpdateOutfit = (newOutfit: typeof outfit) => {
    setOutfit(newOutfit);
    try {
      localStorage.setItem('squadspace_lounge_outfit', JSON.stringify(newOutfit));
    } catch {}
    if (localAvatarRef.current) {
      localAvatarRef.current.setOutfit(
        newOutfit.shirt,
        newOutfit.pants,
        newOutfit.hair,
        newOutfit.skin
      );
    }
  };

  // Camera Mode Animations
  const animateCameraTo = (targetPos: THREE.Vector3, targetLook: THREE.Vector3) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 700;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1.0);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLook, ease);
      controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const setViewMode = (mode: 'follow' | 'iso' | 'tv') => {
    cameraViewRef.current = mode;
    setCameraView(mode);
    if (mode === 'iso') {
      animateCameraTo(new THREE.Vector3(0.0, 8.8, 12.5), new THREE.Vector3(0.0, 1.2, 0.4));
    } else if (mode === 'tv') {
      // Focus Cinema TV on LEFT wall at X = -7.32, Y = 2.5, Z = -0.6
      animateCameraTo(new THREE.Vector3(-2.8, 2.5, -0.6), new THREE.Vector3(-7.32, 2.5, -0.6));
    } else if (mode === 'follow' && playerControllerRef.current) {
      const avatarPos = playerControllerRef.current.avatar.group.position;
      animateCameraTo(
        new THREE.Vector3(avatarPos.x, avatarPos.y + 2.2, avatarPos.z + 3.8),
        new THREE.Vector3(avatarPos.x, avatarPos.y + 1.1, avatarPos.z)
      );
    }
  };

  // Keyboard shortcut listener for O (outfit), V (room view), F (follow)
  useEffect(() => {
    const handleLoungeKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'o') setShowOutfitModal((prev) => !prev);
      if (key === 'v') setViewMode(cameraView === 'iso' ? 'follow' : 'iso');
      if (key === 'f') setViewMode(cameraView === 'follow' ? 'iso' : 'follow');
    };
    window.addEventListener('keydown', handleLoungeKey);
    return () => window.removeEventListener('keydown', handleLoungeKey);
  }, [cameraView]);

  const handleStandUp = () => {
    if (playerControllerRef.current) {
      playerControllerRef.current.standUp();
      setIsSitting(false);
    }
  };

  const handleTriggerEmote = (emoteName: string) => {
    if (playerControllerRef.current) {
      playerControllerRef.current.playEmote(emoteName);
      setActiveEmote(emoteName);
      setTimeout(() => setActiveEmote(null), 3000);
    }
  };

  const handleSpawnEmoji = (emoji: string) => {
    if (localAvatarRef.current) {
      localAvatarRef.current.spawnFloatingEmoji(emoji);
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'avatar_emoji',
        userId: currentUser?.id || 'local-player',
        emoji,
      });
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    if (localAvatarRef.current) {
      localAvatarRef.current.showSpeechBubble(chatMessage.trim());
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'avatar_chat',
        userId: currentUser?.id || 'local-player',
        message: chatMessage.trim(),
      });
    }
    setChatMessage('');
  };

  const occupiedCount = seatManagerRef.current ? seatManagerRef.current.getOccupancyCount() : 0;

  return (
    <div className="relative w-full h-full bg-[#0a0712] overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Glass Header (Image 1 top bar) */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 bg-black/75 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold text-xs">#{channel.name} — 3D Hangout Lounge</span>
          <span className="text-xs text-purple-300 font-semibold bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
            {occupiedCount + (isSitting ? 0 : 1)} Avatars
          </span>
        </div>

        {/* Top Right Controls & View Switchers */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-black/75 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() => setViewMode('follow')}
              title="Third-Person Follow Avatar (Default)"
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cameraView === 'follow'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Follow</span>
            </button>

            <button
              onClick={() => setViewMode('iso')}
              title="Isometric Penthouse View"
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cameraView === 'iso'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Room</span>
            </button>

            <button
              onClick={() => setViewMode('tv')}
              title="Focus Cinema TV"
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                cameraView === 'tv'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>TV Screen</span>
            </button>
          </div>

          {isSitting && (
            <button
              onClick={handleStandUp}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-full text-xs font-bold border border-purple-400 backdrop-blur-md transition shadow cursor-pointer"
            >
              Stand Up
            </button>
          )}

          <button
            onClick={onExit}
            title="Return to standard 2D voice grid"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition shadow cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>2D View</span>
          </button>
        </div>
      </div>

      {/* Proximity Sit Prompt Pill: `[ E ] Sit` (Matching user screenshot exactly!) */}
      {!isSitting && nearestSeat && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-xl border border-white/20 shadow-2xl pointer-events-none flex items-center gap-2">
          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-emerald-400">E</span>
          <span className="font-semibold text-gray-200">Sit</span>
        </div>
      )}

      {/* Hovered Seat Ring Pill */}
      {hoveredSeat && !nearestSeat && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white text-xs px-4 py-1.5 rounded-full border border-purple-500/50 shadow-2xl pointer-events-none flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredSeat.color }} />
          <span>Click to sit in <strong>{hoveredSeat.name}</strong></span>
        </div>
      )}

      {/* Seated Notification */}
      {isSitting && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-purple-200 text-xs px-4 py-1.5 rounded-full border border-purple-500/50 shadow-2xl pointer-events-none flex items-center gap-2">
          <Armchair className="w-3.5 h-3.5 text-purple-400" />
          <span>You are seated! Press <strong>W</strong>, <strong>Space</strong>, or <strong>E</strong> to stand up</span>
        </div>
      )}

      {/* Active Emote Float Notification */}
      {activeEmote && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-extrabold text-sm px-6 py-2 rounded-full shadow-2xl animate-bounce border border-purple-300">
          ✨ {activeEmote}!
        </div>
      )}

      {/* BOTTOM ACTIONS BAR: Exact micup Dock Layout (Matching user screenshot) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10 max-w-[96vw]">
        {/* Main Floating Action Dock */}
        <div className="flex items-center bg-black/80 backdrop-blur-xl px-2 py-1.5 rounded-2xl border border-white/15 shadow-2xl gap-0.5 sm:gap-1">
          {/* 1 Wave */}
          <button
            onClick={() => handleTriggerEmote('Wave')}
            title="Press 1 to Wave"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <span className="text-sm">👋</span>
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">1</span> Wave
            </span>
          </button>

          {/* 2 Dance */}
          <button
            onClick={() => handleTriggerEmote('Dance')}
            title="Press 2 to Dance"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <span className="text-sm">💃</span>
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">2</span> Dance
            </span>
          </button>

          {/* T Slap */}
          <button
            onClick={() => handleTriggerEmote('Slap')}
            title="Press T to Slap"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <span className="text-sm">💥</span>
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">T</span> Slap
            </span>
          </button>

          {/* B Point */}
          <button
            onClick={() => handleTriggerEmote('Point')}
            title="Press B to Point"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <span className="text-sm">👉</span>
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">B</span> Point
            </span>
          </button>

          {/* K Wrestle / Cheers */}
          <button
            onClick={() => handleTriggerEmote('Wrestle')}
            title="Press K to Wrestle / Cheers"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <span className="text-sm">🏆</span>
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">K</span> Wrestle
            </span>
          </button>

          <div className="w-[1px] h-6 bg-white/15 mx-0.5" />

          {/* G Movement (Walk/Run toggle) */}
          <button
            onClick={() => {
              if (playerControllerRef.current) {
                playerControllerRef.current.isRunning = !playerControllerRef.current.isRunning;
                setIsRunning(playerControllerRef.current.isRunning);
              }
            }}
            title="Press G or Shift to toggle Run / Walk"
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-xl transition cursor-pointer min-w-[46px] ${
              isRunning ? 'bg-amber-500/20 text-amber-300' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Move className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">G</span> {isRunning ? 'Run' : 'Walk'}
            </span>
          </button>

          {/* O Outfit Customizer */}
          <button
            onClick={() => setShowOutfitModal(true)}
            title="Press O to customize your avatar"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <Shirt className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">O</span> Outfit
            </span>
          </button>

          {/* V Eyes / Room View */}
          <button
            onClick={() => setViewMode(cameraView === 'iso' ? 'follow' : 'iso')}
            title="Press V to toggle Room Overview / Follow View"
            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[46px]"
          >
            <Eye className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] text-gray-400 font-mono">V</span> Eyes
            </span>
          </button>

          {/* F Follow (Active in Follow view, user screenshot) */}
          <button
            onClick={() => setViewMode(cameraView === 'follow' ? 'iso' : 'follow')}
            title="Press F to toggle Follow Mode"
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-xl transition cursor-pointer min-w-[46px] ${
              cameraView === 'follow'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              <span className="text-[9px] opacity-75 font-mono">F</span> Follow
            </span>
          </button>

          <div className="w-[1px] h-6 bg-white/15 mx-0.5" />

          {/* ? Shortcuts */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            title="Keyboard shortcuts"
            className="flex flex-col items-center justify-center px-2 py-1 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-semibold">Shortcuts</span>
          </button>

          {/* Screen Share / TV Stream */}
          <button
            onClick={onToggleScreenShare}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer ${
              isScreenSharing
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <ScreenShare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isScreenSharing ? 'Stop Stream' : 'Stream on TV'}</span>
          </button>

          {/* Mic / Deafen buttons */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl text-xs transition cursor-pointer ${
              isMuted ? 'bg-rose-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`p-2 rounded-xl text-xs transition cursor-pointer ${
              isDeafened ? 'bg-rose-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <Headphones className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Emoji Reactions & Chat Box (Matching user screenshot) */}
        <div className="hidden md:flex flex-col gap-1 bg-black/80 backdrop-blur-xl p-2 rounded-2xl border border-white/15 shadow-2xl w-64">
          <div className="flex items-center justify-between px-1">
            {['😄', '😮', '😡', '🤬', '❤️', '👍', '🥳', '🔥'].map((em) => (
              <button
                key={em}
                onClick={() => handleSpawnEmoji(em)}
                title={`React ${em}`}
                className="hover:scale-125 transition-transform text-base cursor-pointer p-0.5"
              >
                {em}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Say something..."
              className="bg-transparent text-xs text-white placeholder-gray-400 focus:outline-none w-full"
            />
            <button
              type="submit"
              disabled={!chatMessage.trim()}
              className="text-purple-400 hover:text-purple-300 disabled:opacity-30 cursor-pointer p-0.5"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </div>

      {/* Outfit Customizer Modal ("Outfit O", user screenshot) */}
      {showOutfitModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#181226] border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-white">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base">Avatar Outfit & Style</h3>
              </div>
              <button
                onClick={() => setShowOutfitModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-300 font-semibold mb-2 block">T-Shirt Color</label>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Teal', col: '#0f766e' },
                  { name: 'Magenta', col: '#d946ef' },
                  { name: 'Indigo', col: '#6366f1' },
                  { name: 'Amber', col: '#f59e0b' },
                  { name: 'Emerald', col: '#10b981' },
                  { name: 'Charcoal', col: '#1e293b' },
                ].map((item) => (
                  <button
                    key={item.col}
                    onClick={() => handleUpdateOutfit({ ...outfit, shirt: item.col })}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                      outfit.shirt === item.col ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: item.col }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-300 font-semibold mb-2 block">Shorts / Pants Color</label>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Olive Green', col: '#4d7c0f' },
                  { name: 'Denim', col: '#1e293b' },
                  { name: 'Slate', col: '#334155' },
                  { name: 'Khaki', col: '#78716c' },
                  { name: 'Black', col: '#0f172a' },
                ].map((item) => (
                  <button
                    key={item.col}
                    onClick={() => handleUpdateOutfit({ ...outfit, pants: item.col })}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                      outfit.pants === item.col ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: item.col }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-300 font-semibold mb-2 block">Hair Color</label>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Chestnut Brown', col: '#54321d' },
                  { name: 'Jet Black', col: '#171717' },
                  { name: 'Blonde', col: '#eab308' },
                  { name: 'Ginger', col: '#c2410c' },
                  { name: 'Silver', col: '#94a3b8' },
                ].map((item) => (
                  <button
                    key={item.col}
                    onClick={() => handleUpdateOutfit({ ...outfit, hair: item.col })}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                      outfit.hair === item.col ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: item.col }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-300 font-semibold mb-2 block">Skin Tone</label>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Warm Natural', col: '#dca67a' },
                  { name: 'Light', col: '#ffd7ba' },
                  { name: 'Golden Olive', col: '#d4a373' },
                  { name: 'Caramel', col: '#a2704f' },
                  { name: 'Deep Bronze', col: '#6f4e37' },
                ].map((item) => (
                  <button
                    key={item.col}
                    onClick={() => handleUpdateOutfit({ ...outfit, skin: item.col })}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                      outfit.skin === item.col ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: item.col }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowOutfitModal(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#181226] border border-white/15 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base">Controls & Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Move Avatar</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">W A S D / Arrows</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Run / Walk Toggle</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">Shift / G</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Sit in Chair / Stand Up</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">E / Click</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Stand Up (while seated)</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">W / Space</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Wave Emote</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">1</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Dance Emote</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">2</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Slap Emote</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">T</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Point Emote</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">B</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Wrestle / Cheers</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">K</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Laugh Emote</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">4</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Toggle Follow Camera</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">F</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-gray-300">Outfit Customizer</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">O</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-300">Free 360° Look Around</span>
                <span className="font-mono bg-white/15 px-2 py-0.5 rounded text-white font-bold">Mouse Drag</span>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
