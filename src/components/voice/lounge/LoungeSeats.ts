import * as THREE from 'three';
import { VoiceParticipant } from '../../../types';
import { LoungeAvatar } from './LoungeAvatar';

export interface SeatDefinition {
  id: number;
  name: string;
  zone: 'Cinema Lounge' | 'Wall Sofa' | 'Conversation Pod' | 'Table 1 Booth' | 'Skyline Platform';
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  type: 'couch' | 'armchair' | 'stool' | 'beanbag';
  color: string;
}

// Cinema TV is on LEFT Wall at X = -7.32, Y = 2.5, Z = -0.6
const TV_TARGET = new THREE.Vector3(-7.32, 2.5, -0.6);

export const SEAT_DEFINITIONS: SeatDefinition[] = [
  // 1. Curved Purple Cinema Couches (Center Purple Rug facing TV on LEFT wall)
  {
    id: 1,
    name: 'Cinema Couch 1 — Outer',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.9, 0.22, -1.9),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 2,
    name: 'Cinema Couch 1 — Inner',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.3, 0.22, -1.3),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 3,
    name: 'Cinema Couch 2 — Top',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(1.3, 0.22, 0.1),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 4,
    name: 'Cinema Couch 2 — Bottom',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(1.3, 0.22, 0.7),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 5,
    name: 'Cinema Couch 3 — Inner',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.3, 0.22, 2.1),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 6,
    name: 'Cinema Couch 3 — Outer',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.9, 0.22, 2.7),
    lookAt: TV_TARGET,
    type: 'couch',
    color: '#8b5cf6',
  },

  // 2. Yellow Modern Armchair on Purple Rug
  {
    id: 7,
    name: 'Center Yellow Armchair',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(0.7, 0.22, 1.8),
    lookAt: TV_TARGET,
    type: 'armchair',
    color: '#eab308',
  },

  // 3. Mustard-Yellow Club Armchairs (Foreground Red Rug Conversation Area)
  {
    id: 8,
    name: 'Foreground Armchair — North',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(0.6, 0.22, 2.9),
    lookAt: new THREE.Vector3(0.6, 0.5, 4.2),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 9,
    name: 'Foreground Armchair — South',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(0.6, 0.22, 5.5),
    lookAt: new THREE.Vector3(0.6, 0.5, 4.2),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 10,
    name: 'Foreground Armchair — West',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-0.7, 0.22, 4.2),
    lookAt: new THREE.Vector3(0.6, 0.5, 4.2),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 11,
    name: 'Foreground Armchair — East',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(1.9, 0.22, 4.2),
    lookAt: new THREE.Vector3(0.6, 0.5, 4.2),
    type: 'armchair',
    color: '#ca8a04',
  },

  // 4. Cyan / Turquoise Gaming Armchairs ("Table 1 Free" Booth)
  {
    id: 12,
    name: 'Table 1 — North',
    zone: 'Table 1 Booth',
    position: new THREE.Vector3(-4.0, 0.22, -5.2),
    lookAt: new THREE.Vector3(-4.0, 0.6, -4.2),
    type: 'armchair',
    color: '#06b6d4',
  },
  {
    id: 13,
    name: 'Table 1 — South',
    zone: 'Table 1 Booth',
    position: new THREE.Vector3(-4.0, 0.22, -3.2),
    lookAt: new THREE.Vector3(-4.0, 0.6, -4.2),
    type: 'armchair',
    color: '#06b6d4',
  },
  {
    id: 14,
    name: 'Table 1 — West',
    zone: 'Table 1 Booth',
    position: new THREE.Vector3(-5.0, 0.22, -4.2),
    lookAt: new THREE.Vector3(-4.0, 0.6, -4.2),
    type: 'armchair',
    color: '#06b6d4',
  },
  {
    id: 15,
    name: 'Table 1 — East',
    zone: 'Table 1 Booth',
    position: new THREE.Vector3(-3.0, 0.22, -4.2),
    lookAt: new THREE.Vector3(-4.0, 0.6, -4.2),
    type: 'armchair',
    color: '#06b6d4',
  },

  // 5. Skyline Platform Colorful Beanbags along Right Window (Image 2)
  {
    id: 16,
    name: 'Skyline Beanbag — Purple',
    zone: 'Skyline Platform',
    position: new THREE.Vector3(6.25, 0.42, -3.2),
    lookAt: new THREE.Vector3(0, 1.0, -1.0),
    type: 'beanbag',
    color: '#7c3aed',
  },
  {
    id: 17,
    name: 'Skyline Beanbag — Gold',
    zone: 'Skyline Platform',
    position: new THREE.Vector3(6.25, 0.42, -1.6),
    lookAt: new THREE.Vector3(0, 1.0, -0.5),
    type: 'beanbag',
    color: '#f59e0b',
  },
  {
    id: 18,
    name: 'Skyline Beanbag — Cyan',
    zone: 'Skyline Platform',
    position: new THREE.Vector3(6.25, 0.42, 0.0),
    lookAt: new THREE.Vector3(-2.0, 1.0, 0.0),
    type: 'beanbag',
    color: '#06b6d4',
  },
  {
    id: 19,
    name: 'Skyline Beanbag — Coral Red',
    zone: 'Skyline Platform',
    position: new THREE.Vector3(6.25, 0.42, 1.6),
    lookAt: new THREE.Vector3(-1.0, 1.0, 1.0),
    type: 'beanbag',
    color: '#ef4444',
  },
  {
    id: 20,
    name: 'Skyline Beanbag — Violet',
    zone: 'Skyline Platform',
    position: new THREE.Vector3(6.25, 0.42, 3.2),
    lookAt: new THREE.Vector3(0, 1.0, 2.0),
    type: 'beanbag',
    color: '#8b5cf6',
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
      // Sleek subtle white circular ring lying flat on the seat cushion surface (Image 2)
      const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
      ringGeo.rotateX(-Math.PI / 2);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(seat.position);
      ringMesh.position.y += 0.08;
      ringMesh.userData = { seatId: seat.id };

      this.anchorGroup.add(ringMesh);
      this.interactiveMeshes.push(ringMesh);
      this.seatMeshMap.set(seat.id, ringMesh);
    });
  }

  public getInteractiveMeshes(): THREE.Mesh[] {
    return this.interactiveMeshes;
  }

  public sitInSeat(seatId: number, user: { id: string; displayName: string; avatarUrl?: string }, isLocal: boolean = false) {
    const seatDef = SEAT_DEFINITIONS.find((s) => s.id === seatId);
    if (!seatDef) return;

    if (isLocal) {
      this.mySeatId = seatId;
    }

    this.occupiedMap.set(seatId, {
      userId: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });

    // Hide target ring when occupied
    const ringMesh = this.seatMeshMap.get(seatId);
    if (ringMesh) {
      ringMesh.visible = false;
    }

    // For remote users, spawn or update seated avatar
    if (!isLocal) {
      let avatar = this.avatarMap.get(user.id);
      if (!avatar) {
        avatar = new LoungeAvatar({
          userId: user.id,
          displayName: user.displayName,
          isLocal: false,
        });
        this.avatarGroup.add(avatar.group);
        this.avatarMap.set(user.id, avatar);
      }
      avatar.group.position.copy(seatDef.position);
      avatar.setSitting(true, seatDef.lookAt);
    }
  }

  public standUp() {
    if (this.mySeatId !== null) {
      const ringMesh = this.seatMeshMap.get(this.mySeatId);
      if (ringMesh) {
        ringMesh.visible = true;
      }
      this.occupiedMap.delete(this.mySeatId);
      this.mySeatId = null;
    }
  }

  public freeSeatForUser(userId: string) {
    for (const [seatId, occupant] of this.occupiedMap.entries()) {
      if (occupant.userId === userId) {
        this.occupiedMap.delete(seatId);
        const ringMesh = this.seatMeshMap.get(seatId);
        if (ringMesh) ringMesh.visible = true;
      }
    }
    const avatar = this.avatarMap.get(userId);
    if (avatar) {
      this.avatarGroup.remove(avatar.group);
      avatar.dispose();
      this.avatarMap.delete(userId);
    }
  }

  public getOccupancyCount(): number {
    return this.occupiedMap.size;
  }

  public syncParticipants(participants: VoiceParticipant[], currentUserId: string) {
    const currentParticipantIds = new Set(participants.map((p) => p.user?.id).filter(Boolean));

    for (const [userId, avatar] of this.avatarMap.entries()) {
      if (!currentParticipantIds.has(userId)) {
        this.freeSeatForUser(userId);
      }
    }

    let nextSeatIndex = 0;
    participants.forEach((p) => {
      const u = p.user;
      if (!u || u.id === currentUserId) return;

      const isAlreadyOccupied = Array.from(this.occupiedMap.values()).some((o) => o.userId === u.id);
      if (!isAlreadyOccupied) {
        while (nextSeatIndex < SEAT_DEFINITIONS.length && this.occupiedMap.has(SEAT_DEFINITIONS[nextSeatIndex].id)) {
          nextSeatIndex++;
        }
        if (nextSeatIndex < SEAT_DEFINITIONS.length) {
          const seat = SEAT_DEFINITIONS[nextSeatIndex];
          this.sitInSeat(seat.id, {
            id: u.id,
            displayName: u.displayName || u.username || 'User',
            avatarUrl: u.avatarUrl,
          }, false);
          nextSeatIndex++;
        }
      }

      const avatar = this.avatarMap.get(u.id);
      if (avatar) {
        avatar.updateSpeaking(!!p.isSpeaking);
      }
    });
  }

  public update(delta: number) {
    const time = Date.now() * 0.003;

    this.seatMeshMap.forEach((mesh) => {
      if (mesh.visible) {
        mesh.rotation.y = time * 0.5;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.45 + Math.sin(time * 2) * 0.20;
      }
    });

    this.avatarMap.forEach((avatar) => {
      avatar.update(delta);
    });
  }

  public dispose() {
    this.avatarMap.forEach((avatar) => avatar.dispose());
    this.avatarMap.clear();
    this.anchorGroup.clear();
    this.avatarGroup.clear();
  }
}
