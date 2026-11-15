import * as THREE from 'three';
import { VoiceParticipant } from '../../../types';
import { LoungeAvatar } from './LoungeAvatar';

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
  // Zone A: Main Cinema Couches (Facing TV on the left wall at X ~ -7.3)
  {
    id: 1,
    name: 'Main Couch — Left',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-1.2, 0.22, -0.4),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 2,
    name: 'Main Couch — Right',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-0.4, 0.22, -0.4),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 3,
    name: 'Side Couch — Left',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-1.6, 0.22, 1.25),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'couch',
    color: '#a855f7',
  },
  {
    id: 4,
    name: 'Side Couch — Right',
    zone: 'Couch Cinema',
    position: new THREE.Vector3(-0.8, 0.22, 1.25),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'couch',
    color: '#a855f7',
  },

  // Zone B: Window Beanbag Lounge (Elevated deck on the right wall X ~ 4.6)
  {
    id: 5,
    name: 'Skyline Beanbag — Teal',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.28, -2.4),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'beanbag',
    color: '#06b6d4',
  },
  {
    id: 6,
    name: 'Skyline Beanbag — Gold',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.28, -1.2),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'beanbag',
    color: '#eab308',
  },
  {
    id: 7,
    name: 'Skyline Beanbag — Coral',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.28, 0.0),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'beanbag',
    color: '#f43f5e',
  },
  {
    id: 8,
    name: 'Skyline Beanbag — Purple',
    zone: 'Window Beanbag',
    position: new THREE.Vector3(4.6, 0.28, 1.2),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'beanbag',
    color: '#9333ea',
  },

  // Zone C: Back Squad Pod (Table 1 armchairs X ~ -1.2 to 0.8, Z ~ -3.2)
  {
    id: 9,
    name: 'Squad Pod — North',
    zone: 'Squad Table',
    position: new THREE.Vector3(-0.2, 0.22, -4.2),
    lookAt: new THREE.Vector3(-0.2, 0.5, -3.2),
    type: 'armchair',
    color: '#0ea5e9',
  },
  {
    id: 10,
    name: 'Squad Pod — South',
    zone: 'Squad Table',
    position: new THREE.Vector3(-0.2, 0.22, -2.2),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'armchair',
    color: '#0ea5e9',
  },
  {
    id: 11,
    name: 'Squad Pod — West',
    zone: 'Squad Table',
    position: new THREE.Vector3(-1.2, 0.22, -3.2),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
    type: 'armchair',
    color: '#10b981',
  },
  {
    id: 12,
    name: 'Squad Pod — East',
    zone: 'Squad Table',
    position: new THREE.Vector3(0.8, 0.22, -3.2),
    lookAt: new THREE.Vector3(-7.3, 2.35, 0),
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
  public avatarMap = new Map<string, LoungeAvatar>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.anchorGroup);
    this.scene.add(this.avatarGroup);
    this.buildSeatAnchors();
  }

  private buildSeatAnchors() {
    SEAT_DEFINITIONS.forEach((seat) => {
      // Floating glowing circle ring above seat cushion
      const ringGeo = new THREE.RingGeometry(0.12, 0.2, 32);
      ringGeo.rotateX(-Math.PI / 2);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(seat.position);
      ringMesh.position.y += 0.38; // Hover above seat cushion
      ringMesh.userData = { seatId: seat.id, isSeat: true };

      this.interactiveMeshes.push(ringMesh);
      this.seatMeshMap.set(seat.id, ringMesh);
      this.anchorGroup.add(ringMesh);
    });
  }

  public getInteractiveMeshes(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  public getSeatById(seatId: number): SeatDefinition | null {
    return SEAT_DEFINITIONS.find((s) => s.id === seatId) || null;
  }

  public getMySeat(): SeatDefinition | null {
    if (this.mySeatId === null) return null;
    return SEAT_DEFINITIONS.find((s) => s.id === this.mySeatId) || null;
  }

  public getMySeatId(): number | null {
    return this.mySeatId;
  }

  public sitInSeat(seatId: number, user: { id: string; displayName: string; avatarUrl?: string }, isLocal = false): boolean {
    const existing = this.occupiedMap.get(seatId);
    if (existing && existing.userId !== user.id) {
      return false;
    }

    if (this.mySeatId !== null && isLocal) {
      this.occupiedMap.delete(this.mySeatId);
    }

    if (isLocal) {
      this.mySeatId = seatId;
    }

    this.occupiedMap.set(seatId, {
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });

    this.updateAvatarVisuals(user.id);
    return true;
  }

  public standUp() {
    if (this.mySeatId !== null) {
      const occ = this.occupiedMap.get(this.mySeatId);
      this.occupiedMap.delete(this.mySeatId);
      this.mySeatId = null;
      if (occ) {
        this.updateAvatarVisuals(occ.userId);
      }
    }
  }

  public syncParticipants(participants: VoiceParticipant[], currentUserId?: string) {
    // Synchronize seated users with connected voice participants
    for (const [sId, occ] of Array.from(this.occupiedMap.entries())) {
      if (!participants.some((p) => p.userId === occ.userId)) {
        this.occupiedMap.delete(sId);
        if (this.mySeatId === sId) {
          this.mySeatId = null;
        }
      }
    }

    this.updateAvatarVisuals(currentUserId);
  }

  private updateAvatarVisuals(currentUserId?: string) {
    // Remove avatars for users no longer in occupied map
    const activeUserIds = new Set(Array.from(this.occupiedMap.values()).map((o) => o.userId));
    for (const [uId, avatar] of Array.from(this.avatarMap.entries())) {
      if (!activeUserIds.has(uId)) {
        this.avatarGroup.remove(avatar.group);
        avatar.dispose();
        this.avatarMap.delete(uId);
      }
    }

    // Spawn or position avatars for seated users
    this.occupiedMap.forEach((occ, seatId) => {
      const seat = SEAT_DEFINITIONS.find((s) => s.id === seatId);
      if (!seat) return;

      let avatar = this.avatarMap.get(occ.userId);
      if (!avatar) {
        const isLocal = occ.userId === currentUserId;
        avatar = new LoungeAvatar({
          userId: occ.userId,
          displayName: occ.displayName,
          isLocal,
        });
        this.avatarMap.set(occ.userId, avatar);
        this.avatarGroup.add(avatar.group);
      }

      avatar.group.position.copy(seat.position);
      avatar.setSitting(true, seat.lookAt);
    });

    // Update seat ring visibility
    SEAT_DEFINITIONS.forEach((seat) => {
      const ring = this.seatMeshMap.get(seat.id);
      if (ring) {
        const isOccupied = this.occupiedMap.has(seat.id);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = isOccupied ? 0.1 : 0.7;
        mat.color.setHex(isOccupied ? 0x64748b : 0xffffff);
      }
    });
  }

  public update(delta: number) {
    this.avatarMap.forEach((avatar) => {
      avatar.update(delta);
    });
  }

  public getOccupancyCount(): number {
    return this.occupiedMap.size;
  }

  public dispose() {
    this.avatarMap.forEach((av) => av.dispose());
    this.avatarMap.clear();
    this.anchorGroup.clear();
    this.avatarGroup.clear();
    this.interactiveMeshes = [];
    this.seatMeshMap.clear();
    this.occupiedMap.clear();
  }
}
