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

  const [hoveredSeat, setHoveredSeat] = useState<SeatDefinition | null>(null);
  const [nearestSeat, setNearestSeat] = useState<SeatDefinition | null>(null);
  const [isSitting, setIsSitting] = useState<boolean>(false);
  const [cameraView, setCameraView] = useState<'iso' | 'tv' | 'follow'>('iso');
  const [activeEmote, setActiveEmote] = useState<string | null>(null);

  // Initialize Three.js scene, Player Avatar Controller, and Loop
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
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 80);
    camera.position.set(11.0, 8.5, 11.0); // Cutaway isometric viewpoint
    cameraRef.current = camera;

    // 3. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(-0.8, 1.2, 0);
    controls.maxPolarAngle = Math.PI / 2.06;
    controls.minDistance = 3.0;
    controls.maxDistance = 25.0;
    controlsRef.current = controls;

    // 4. Room Scene & TV
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
      displayName: currentUser?.displayName || 'You',
      isLocal: true,
    });
    loungeScene.scene.add(localAvatar.group);

    const playerController = new LoungePlayerController(
      localAvatar,
      seatManager,
      camera
    );
    playerControllerRef.current = playerController;

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

      // Camera Follow Mode (tracks avatar smoothly while walking)
      if (cameraView === 'follow' && !playerController.isSitting) {
        const avatarPos = localAvatar.group.position;
        const targetCam = avatarPos.clone().add(new THREE.Vector3(3.8, 3.2, 3.8));
        camera.position.lerp(targetCam, 5 * delta);
        controls.target.lerp(avatarPos.clone().add(new THREE.Vector3(0, 0.9, 0)), 5 * delta);
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

  // Smooth Camera Transitions
  const animateCameraTo = (targetPos: THREE.Vector3, targetLook: THREE.Vector3) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 750;
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

  const setViewMode = (mode: 'iso' | 'tv' | 'follow') => {
    setCameraView(mode);
    if (mode === 'iso') {
      animateCameraTo(new THREE.Vector3(11.0, 8.5, 11.0), new THREE.Vector3(-0.8, 1.2, 0));
    } else if (mode === 'tv') {
      animateCameraTo(new THREE.Vector3(0.8, 2.35, 0), new THREE.Vector3(-7.28, 2.35, 0));
    } else if (mode === 'follow' && playerControllerRef.current) {
      const avatarPos = playerControllerRef.current.avatar.group.position;
      animateCameraTo(
        avatarPos.clone().add(new THREE.Vector3(3.8, 3.2, 3.8)),
        avatarPos.clone().add(new THREE.Vector3(0, 0.9, 0))
      );
    }
  };

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

  const occupiedCount = seatManagerRef.current ? seatManagerRef.current.getOccupancyCount() : 0;

  return (
    <div className="relative w-full h-full bg-[#0a0712] overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Glass Header HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold text-xs">#{channel.name} — 3D Gamer Lounge</span>
          <span className="text-xs text-purple-300 font-semibold bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
            {occupiedCount + (isSitting ? 0 : 1)} Avatars
          </span>
        </div>

        {/* View Switchers (Isometric, Follow, Focus TV) & Exit Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-2xl">
            <button
              onClick={() => setViewMode('iso')}
              title="Isometric Room View"
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
              onClick={() => setViewMode('follow')}
              title="Third-Person Follow Avatar"
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
              onClick={() => setViewMode('tv')}
              title="Focus Cinema TV Screen"
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

      {/* Proximity Sit Prompt (Press E) */}
      {!isSitting && nearestSeat && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md text-white text-xs px-5 py-2 rounded-full border border-emerald-400 shadow-2xl pointer-events-none animate-pulse flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nearestSeat.color }} />
          <span>Press <strong>E</strong> or click to sit in <strong>{nearestSeat.name}</strong></span>
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
          <span>You are seated! Press <strong>W</strong>, <strong>Space</strong>, or <strong>E</strong> to walk</span>
        </div>
      )}

      {/* Active Emote Float Notification */}
      {activeEmote && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-extrabold text-sm px-6 py-2 rounded-full shadow-2xl animate-bounce border border-purple-300">
          ✨ {activeEmote}!
        </div>
      )}

      {/* Bottom Controls Hotbar (WASD Guide, Emotes with Animations, TV Streaming, Mic/Deafen) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10 max-w-full px-4">
        {/* WASD Movement Hint Pill */}
        <div className="hidden lg:flex items-center gap-1.5 bg-black/70 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/10 text-[11px] text-gray-300">
          <span className="px-1.5 py-0.5 bg-white/15 rounded text-white font-mono font-bold">W</span>
          <span className="px-1.5 py-0.5 bg-white/15 rounded text-white font-mono font-bold">A</span>
          <span className="px-1.5 py-0.5 bg-white/15 rounded text-white font-mono font-bold">S</span>
          <span className="px-1.5 py-0.5 bg-white/15 rounded text-white font-mono font-bold">D</span>
          <span className="ml-1 text-gray-400">to move</span>
        </div>

        {/* Emotes Bar (Matching Reference Screenshot with real character animations!) */}
        <div className="flex items-center bg-black/80 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/15 shadow-2xl gap-1">
          <button
            onClick={() => handleTriggerEmote('Wave')}
            title="Press 1 to Wave"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>👋</span>
            <span className="hidden sm:inline">Wave (1)</span>
          </button>

          <button
            onClick={() => handleTriggerEmote('Dance')}
            title="Press 2 to Dance"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>💃</span>
            <span className="hidden sm:inline">Dance (2)</span>
          </button>

          <button
            onClick={() => handleTriggerEmote('Cheers')}
            title="Press 3 to Cheers"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>🥂</span>
            <span className="hidden sm:inline">Cheers (3)</span>
          </button>

          <button
            onClick={() => handleTriggerEmote('Laugh')}
            title="Press 4 to Laugh"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>😂</span>
            <span className="hidden sm:inline">Laugh (4)</span>
          </button>

          <div className="w-[1px] h-5 bg-white/15 mx-1" />

          {/* Screen Share on Virtual TV */}
          <button
            onClick={onToggleScreenShare}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer ${
              isScreenSharing
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <ScreenShare className="w-3.5 h-3.5" />
            <span>{isScreenSharing ? 'Stop Stream' : 'Stream on TV'}</span>
          </button>

          <div className="w-[1px] h-5 bg-white/15 mx-1" />

          {/* Voice Mute / Deafen controls */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl text-xs transition cursor-pointer ${
              isMuted
                ? 'bg-rose-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleDeafen}
            className={`p-2 rounded-xl text-xs transition cursor-pointer ${
              isDeafened
                ? 'bg-rose-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            <Headphones className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
