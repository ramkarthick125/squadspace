import * as THREE from 'three';
import { VoiceParticipant } from '../../../types';

export interface SeatDefinition {
  id: number;
  name: string;
  zone: 'Couch Cinema' | 'Window Beanbag' | 'Squad Table';
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  type: 'couch' | 'beanbag' | 'armchair';
  color: string;
}

export const SEAT_DEFINITIONS: SeatDefinition[] = [
  // Zone A: Main Cinema Couches (Facing TV on the left wall at X ~ -6.8)
  {
    id: 1,
    name: 'Main Couch — Left',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-1.2, 0.45, -0.4),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 2,
    name: 'Main Couch — Right',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-0.4, 0.45, -0.4),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 3,
    name: 'Side Couch — Left',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-1.6, 0.45, 1.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'couch',
    color: '#a855f7',
  },
  {
    id: 4,
    name: 'Side Couch — Right',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-0.8, 0.45, 1.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'couch',
    color: '#a855f7',
  },

  // Zone B: Window Beanbag Lounge (Elevated deck on the right wall X ~ 4.2 to 5.4)
  {
    id: 5,
    name: 'Skyline Beanbag — Teal',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.48, -2.4),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'beanbag',
    color: '#06b6d4',
  },
  {
    id: 6,
    name: 'Skyline Beanbag — Gold',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.48, -1.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'beanbag',
    color: '#eab308',
  },
  {
    id: 7,
    name: 'Skyline Beanbag — Coral',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.48, 0.0),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'beanbag',
    color: '#f43f5e',
  },
  {
    id: 8,
    name: 'Skyline Beanbag — Purple',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.48, 1.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'beanbag',
    color: '#9333ea',
  },

  // Zone C: Back Squad Pod (Table 1 armchairs X ~ -1.5 to 1.5, Z ~ -3.2)
  {
    id: 9,
    name: 'Squad Pod — North',
    zone: 'Squad Table',
    position: new THREE.Vector3(-0.2, 0.42, -4.2),
    lookAt: new THREE.Vector3(-0.2, 0.5, -3.2),
    type: 'armchair',
    color: '#0ea5e9',
  },
  {
    id: 10,
    name: 'Squad Pod — South',
    zone: 'Squad Table',
    position: new THREE.Vector3(-0.2, 0.42, -2.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'armchair',
    color: '#0ea5e9',
  },
  {
    id: 11,
    name: 'Squad Pod — West',
    zone: 'Squad Table',
    position: new THREE.Vector3(-1.2, 0.42, -3.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'armchair',
    color: '#10b981',
  },
  {
    id: 12,
    name: 'Squad Pod — East',
    zone: 'Squad Table',
    position: new THREE.Vector3(0.8, 0.42, -3.2),
    lookAt: new THREE.Vector3(-6.8, 1.8, 0),
    type: 'armchair',
    color: '#10b981',
  },
];

export class LoungeSeatManager {
  private scene: THREE.Scene;
  private anchorGroup: THREE.Group = new THREE.Group();
  private avatarGroup: THREE.Group = new THREE.Group();
  private interactiveMeshes: THREE.Mesh[] = [];
  private seatMeshMap = new Map<number, THREE.Mesh>();
  private mySeatId: number | null = null;
  private occupiedMap = new Map<number, { userId: string; displayName: string; avatarUrl?: string }>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.anchorGroup);
    this.scene.add(this.avatarGroup);
    this.buildSeatAnchors();
  }

  private buildSeatAnchors() {
    SEAT_DEFINITIONS.forEach((seat) => {
      // Clickable circular floating hotspot (matching the reference image's glowing rings)
      const ringGeo = new THREE.RingGeometry(0.12, 0.18, 32);
      ringGeo.rotateX(-Math.PI / 2);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(seat.position);
      ringMesh.position.y += 0.28; // Hover slightly above seat cushion
      ringMesh.userData = { seatId: seat.id, isSeat: true };

      this.interactiveMeshes.push(ringMesh);
      this.seatMeshMap.set(seat.id, ringMesh);
      this.anchorGroup.add(ringMesh);
    });
  }

  public getInteractiveMeshes(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  public getMySeat(): SeatDefinition | null {
    if (this.mySeatId === null) return null;
    return SEAT_DEFINITIONS.find((s) => s.id === this.mySeatId) || null;
  }

  public getMySeatId(): number | null {
    return this.mySeatId;
  }

  public sitInSeat(seatId: number, user: { id: string; displayName: string; avatarUrl?: string }): boolean {
    // If seat already occupied by someone else, return false
    const existing = this.occupiedMap.get(seatId);
    if (existing && existing.userId !== user.id) {
      return false;
    }

    // Leave any previous seat
    if (this.mySeatId !== null) {
      this.occupiedMap.delete(this.mySeatId);
    }

    this.mySeatId = seatId;
    this.occupiedMap.set(seatId, {
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });

    this.updateAvatarVisuals();
    return true;
  }

  public standUp() {
    if (this.mySeatId !== null) {
      this.occupiedMap.delete(this.mySeatId);
      this.mySeatId = null;
      this.updateAvatarVisuals();
    }
  }

  public syncParticipants(participants: VoiceParticipant[], currentUserId?: string) {
    // Auto-distribute participants who don't have seats yet
    participants.forEach((p, index) => {
      const isMe = p.userId === currentUserId;
      if (isMe && this.mySeatId !== null) return; // Respect local user's selected seat

      // Check if user already has a seat assigned
      let hasSeat = false;
      for (const [sId, occ] of this.occupiedMap.entries()) {
        if (occ.userId === p.userId) {
          hasSeat = true;
          break;
        }
      }

      if (!hasSeat) {
        // Find first empty seat
        const targetSeat = SEAT_DEFINITIONS.find((s) => !this.occupiedMap.has(s.id));
        if (targetSeat) {
          this.occupiedMap.set(targetSeat.id, {
            userId: p.userId,
            displayName: p.user.displayName,
            avatarUrl: p.user.avatarUrl,
          });
          if (isMe) {
            this.mySeatId = targetSeat.id;
          }
        }
      }
    });

    // Remove users who left
    for (const [sId, occ] of Array.from(this.occupiedMap.entries())) {
      if (!participants.some((p) => p.userId === occ.userId)) {
        this.occupiedMap.delete(sId);
        if (this.mySeatId === sId) {
          this.mySeatId = null;
        }
      }
    }

    this.updateAvatarVisuals();
  }

  private updateAvatarVisuals() {
    // Clean current avatars
    while (this.avatarGroup.children.length > 0) {
      const obj = this.avatarGroup.children[0];
      this.avatarGroup.remove(obj);
    }

    // Render cute stylized low-poly avatar tokens for each occupied seat
    this.occupiedMap.forEach((occ, seatId) => {
      const seat = SEAT_DEFINITIONS.find((s) => s.id === seatId);
      if (!seat) return;

      const avatarPivot = new THREE.Group();
      avatarPivot.position.copy(seat.position);
      avatarPivot.lookAt(seat.lookAt.x, seat.position.y, seat.lookAt.z);

      // Stylized character body (capsule/cylinder)
      const bodyColor = occ.userId === this.occupiedMap.get(this.mySeatId || -1)?.userId ? 0x10b981 : 0x6366f1;
      const bodyGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.4,
        metalness: 0.1,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.25;
      avatarPivot.add(bodyMesh);

      // Head sphere
      const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.3,
      });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.y = 0.58;
      avatarPivot.add(headMesh);

      // Floating Name Badge above head
      const nameSprite = this.createNameSprite(occ.displayName);
      nameSprite.position.set(0, 0.88, 0);
      avatarPivot.add(nameSprite);

      this.avatarGroup.add(avatarPivot);
    });

    // Update seat ring visibility
    SEAT_DEFINITIONS.forEach((seat) => {
      const ring = this.seatMeshMap.get(seat.id);
      if (ring) {
        const isOccupied = this.occupiedMap.has(seat.id);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = isOccupied ? 0.15 : 0.65;
        mat.color.setHex(isOccupied ? 0x4b5563 : 0xffffff);
      }
    });
  }

  private createNameSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cleanText = text.length > 14 ? text.slice(0, 12) + '...' : text;
      ctx.fillText(cleanText, 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.9, 0.22, 1);
    return sprite;
  }

  public getOccupancyCount(): number {
    return this.occupiedMap.size;
  }

  public dispose() {
    this.anchorGroup.clear();
    this.avatarGroup.clear();
    this.interactiveMeshes = [];
    this.seatMeshMap.clear();
    this.occupiedMap.clear();
  }
}
