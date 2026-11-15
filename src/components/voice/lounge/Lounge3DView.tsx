import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Maximize2,
  Minimize2,
  Tv,
  Users,
  Compass,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Headphones,
  ScreenShare,
  Sparkles,
  Smile,
  LogOut,
  Armchair,
} from 'lucide-react';
import { Channel, UserProfile, VoiceParticipant } from '../../../types';
import { LoungeScene } from './LoungeScene';
import { LoungeTV } from './LoungeTV';
import { LoungeSeatManager, SEAT_DEFINITIONS, SeatDefinition } from './LoungeSeats';

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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [hoveredSeat, setHoveredSeat] = useState<SeatDefinition | null>(null);
  const [currentSeat, setCurrentSeat] = useState<SeatDefinition | null>(null);
  const [cameraView, setCameraView] = useState<'iso' | 'tv' | 'seat'>('iso');
  const [activeEmote, setActiveEmote] = useState<string | null>(null);

  // Initialize Three.js scene & rendering loop
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Camera (default isometric view matching reference screenshot)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(11.5, 9.0, 11.5);
    cameraRef.current = camera;

    // 3. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(-0.8, 1.2, 0);
    controls.maxPolarAngle = Math.PI / 2.06; // Prevent going underneath floor
    controls.minDistance = 3.5;
    controls.maxDistance = 24.0;
    controlsRef.current = controls;

    // 4. Scene & TV
    const loungeScene = new LoungeScene();
    sceneRef.current = loungeScene;

    const loungeTV = new LoungeTV(loungeScene.tvMesh);
    tvRef.current = loungeTV;

    // 5. Seat Manager
    const seatManager = new LoungeSeatManager(loungeScene.scene);
    seatManagerRef.current = seatManager;

    if (currentUser) {
      seatManager.syncParticipants(participants, currentUser.id);
      setCurrentSeat(seatManager.getMySeat());
    }

    // 6. Raycasting for Seat Clicks & Hover
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

    const handlePointerDown = () => {
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(seatManager.getInteractiveMeshes());
      if (hits.length > 0 && currentUser) {
        const seatId = hits[0].object.userData.seatId;
        const seatDef = SEAT_DEFINITIONS.find((s) => s.id === seatId);
        if (seatDef) {
          const success = seatManager.sitInSeat(seatId, {
            id: currentUser.id,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
          });
          if (success) {
            setCurrentSeat(seatDef);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    renderer.domElement.addEventListener('click', handleClick);

    // 7. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      loungeScene.update();
      renderer.render(loungeScene.scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      loungeTV.dispose();
      seatManager.dispose();
      loungeScene.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update TV Stream when screen share state changes
  useEffect(() => {
    if (tvRef.current) {
      tvRef.current.setStream(
        screenShareStream,
        screenSharingParticipant?.user?.displayName || 'Live Screen'
      );
    }
  }, [screenShareStream, screenSharingParticipant]);

  // Sync participants with 3D seat occupancy
  useEffect(() => {
    if (seatManagerRef.current && currentUser) {
      seatManagerRef.current.syncParticipants(participants, currentUser.id);
      setCurrentSeat(seatManagerRef.current.getMySeat());
    }
  }, [participants, currentUser]);

  // Smooth Camera Transitions for Presets
  const animateCameraTo = (targetPos: THREE.Vector3, targetLook: THREE.Vector3) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    let progress = 0;

    const duration = 750; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      progress = Math.min((now - startTime) / duration, 1.0);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // Ease in-out

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLook, ease);
      controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const setViewMode = (mode: 'iso' | 'tv' | 'seat') => {
    setCameraView(mode);
    if (mode === 'iso') {
      animateCameraTo(new THREE.Vector3(11.5, 9.0, 11.5), new THREE.Vector3(-0.8, 1.2, 0));
    } else if (mode === 'tv') {
      animateCameraTo(new THREE.Vector3(1.2, 2.35, 0), new THREE.Vector3(-7.38, 2.35, 0));
    } else if (mode === 'seat' && currentSeat) {
      // Zoom right to player's current chair looking at the big screen TV
      const camPos = currentSeat.position.clone().add(new THREE.Vector3(1.4, 0.8, 0.6));
      animateCameraTo(camPos, currentSeat.lookAt);
    }
  };

  const handleStandUp = () => {
    if (seatManagerRef.current) {
      seatManagerRef.current.standUp();
      setCurrentSeat(null);
    }
  };

  const triggerEmote = (emoteName: string) => {
    setActiveEmote(emoteName);
    setTimeout(() => setActiveEmote(null), 3000);
  };

  const occupiedCount = seatManagerRef.current ? seatManagerRef.current.getOccupancyCount() : 0;

  return (
    <div className="relative w-full h-full bg-[#0a0712] overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Glass Header HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-xl pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold text-xs">#{channel.name} — 3D Lounge</span>
          <span className="text-xs text-purple-300 font-medium bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
            {occupiedCount} / 12 Seats Taken
          </span>
        </div>

        {/* View Switchers (Isometric, Focus TV, My Seat) & Exit Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-xl">
            <button
              onClick={() => setViewMode('iso')}
              title="Isometric Room View"
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
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
              title="Focus Cinema TV Screen"
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                cameraView === 'tv'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>TV Screen</span>
            </button>

            {currentSeat && (
              <button
                onClick={() => setViewMode('seat')}
                title="View from my chair"
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                  cameraView === 'seat'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                <span>My Seat</span>
              </button>
            )}
          </div>

          {currentSeat && (
            <button
              onClick={handleStandUp}
              className="bg-black/60 hover:bg-white/10 text-gray-200 hover:text-white px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 backdrop-blur-md transition shadow"
            >
              Stand Up
            </button>
          )}

          <button
            onClick={onExit}
            title="Return to standard 2D voice grid"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/15 transition shadow cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>2D View</span>
          </button>
        </div>
      </div>

      {/* Hovered Seat Notification Pill */}
      {hoveredSeat && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md text-white text-xs px-4 py-1.5 rounded-full border border-purple-500/50 shadow-2xl pointer-events-none animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredSeat.color }} />
          <span>Click to sit in <strong>{hoveredSeat.name}</strong></span>
        </div>
      )}

      {/* Active Emote Float Notification */}
      {activeEmote && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-purple-600/90 backdrop-blur-md text-white font-bold text-sm px-5 py-2 rounded-full shadow-2xl animate-bounce border border-purple-400">
          ✨ {activeEmote}!
        </div>
      )}

      {/* Bottom Controls Hotbar (Emotes, TV Streaming, Voice Mute/Deafen) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {/* Emotes Bar (Matching Reference Screenshot) */}
        <div className="flex items-center bg-black/75 backdrop-blur-xl px-3 py-2 rounded-2xl border border-white/15 shadow-2xl gap-1.5">
          <button
            onClick={() => triggerEmote('Waved')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>👋</span>
            <span>Wave</span>
          </button>

          <button
            onClick={() => triggerEmote('Dancing')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>💃</span>
            <span>Dance</span>
          </button>

          <button
            onClick={() => triggerEmote('Cheers')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>🥂</span>
            <span>Cheers</span>
          </button>

          <button
            onClick={() => triggerEmote('Laughed')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>😂</span>
            <span>Laugh</span>
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
