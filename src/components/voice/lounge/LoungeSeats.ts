import * as THREE from 'three';
import { VoiceParticipant } from '../../../types';
import { LoungeAvatar } from './LoungeAvatar';

export interface SeatDefinition {
  id: number;
  name: string;
  zone: 'Cinema Lounge' | 'Skyline Beanbag' | 'Conversation Pod' | 'Table 1 Squad' | 'Wall Sofa';
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  type: 'couch' | 'beanbag' | 'armchair' | 'stool';
  color: string;
}

export const SEAT_DEFINITIONS: SeatDefinition[] = [
  // 1. Center Cinema Purple Couches (Facing TV on left wall X = -7.28)
  {
    id: 1,
    name: 'Cinema Couch 1 — Left',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.0, 0.22, -0.65),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 2,
    name: 'Cinema Couch 1 — Right',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.2, 0.22, -0.65),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 3,
    name: 'Cinema Couch 2 — Left',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.0, 0.22, 1.25),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'couch',
    color: '#a855f7',
  },
  {
    id: 4,
    name: 'Cinema Couch 2 — Right',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-0.2, 0.22, 1.25),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'couch',
    color: '#a855f7',
  },

  // 2. Elevated Window Lounge Beanbags (5 beanbags matching Image 2)
  {
    id: 5,
    name: 'Skyline Beanbag — Purple',
    zone: 'Skyline Beanbag',
    position: new THREE.Vector3(4.8, 0.28, -3.0),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'beanbag',
    color: '#8b5cf6',
  },
  {
    id: 6,
    name: 'Skyline Beanbag — Gold',
    zone: 'Skyline Beanbag',
    position: new THREE.Vector3(4.8, 0.28, -1.8),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'beanbag',
    color: '#eab308',
  },
  {
    id: 7,
    name: 'Skyline Beanbag — Teal',
    zone: 'Skyline Beanbag',
    position: new THREE.Vector3(4.8, 0.28, -0.6),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'beanbag',
    color: '#06b6d4',
  },
  {
    id: 8,
    name: 'Skyline Beanbag — Coral',
    zone: 'Skyline Beanbag',
    position: new THREE.Vector3(4.8, 0.28, 0.6),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'beanbag',
    color: '#f43f5e',
  },
  {
    id: 9,
    name: 'Skyline Beanbag — Violet',
    zone: 'Skyline Beanbag',
    position: new THREE.Vector3(4.8, 0.28, 1.8),
    lookAt: new THREE.Vector3(-7.28, 2.35, 0),
    type: 'beanbag',
    color: '#6366f1',
  },

  // 3. Foreground Mustard Yellow Club Chairs (Red Rug X = 0.6, Z = 3.6)
  {
    id: 10,
    name: 'Conversation Chair — North',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(0.6, 0.22, 2.5),
    lookAt: new THREE.Vector3(0.6, 0.5, 3.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 11,
    name: 'Conversation Chair — South',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(0.6, 0.22, 4.7),
    lookAt: new THREE.Vector3(0.6, 0.5, 3.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 12,
    name: 'Conversation Chair — West',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-0.5, 0.22, 3.6),
    lookAt: new THREE.Vector3(0.6, 0.5, 3.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 13,
    name: 'Conversation Chair — East',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(1.7, 0.22, 3.6),
    lookAt: new THREE.Vector3(0.6, 0.5, 3.6),
    type: 'armchair',
    color: '#ca8a04',
  },

  // 4. Back Corner Table 1 Squad Pod
  {
    id: 14,
    name: 'Table 1 — North Chair',
    zone: 'Table 1 Squad',
    position: new THREE.Vector3(-1.8, 0.22, -4.8),
    lookAt: new THREE.Vector3(-1.8, 0.5, -3.8),
    type: 'armchair',
    color: '#0d9488',
  },
  {
    id: 15,
    name: 'Table 1 — West Chair',
    zone: 'Table 1 Squad',
    position: new THREE.Vector3(-2.8, 0.22, -3.8),
    lookAt: new THREE.Vector3(-1.8, 0.5, -3.8),
    type: 'armchair',
    color: '#0d9488',
  },
  {
    id: 16,
    name: 'Table 1 — East Chair',
    zone: 'Table 1 Squad',
    position: new THREE.Vector3(-0.8, 0.22, -3.8),
    lookAt: new THREE.Vector3(-1.8, 0.5, -3.8),
    type: 'armchair',
    color: '#0d9488',
  },
  {
    id: 17,
    name: 'Table 1 — Stool',
    zone: 'Table 1 Squad',
    position: new THREE.Vector3(-1.8, 0.18, -2.8),
    lookAt: new THREE.Vector3(-1.8, 0.5, -3.8),
    type: 'stool',
    color: '#ca8a04',
  },

  // 5. Left Wall Magenta Sofa
  {
    id: 18,
    name: 'Side Lounge — Seat 1',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(-5.6, 0.22, 2.2),
    lookAt: new THREE.Vector3(0, 0.8, 2.2),
    type: 'couch',
    color: '#db2777',
  },
  {
    id: 19,
    name: 'Side Lounge — Seat 2',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(-5.6, 0.22, 3.0),
    lookAt: new THREE.Vector3(0, 0.8, 3.0),
    type: 'couch',
    color: '#db2777',
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
      // Crisp white glowing circular target ring hovering right above each seat cushion (Image 2)
      const ringGeo = new THREE.TorusGeometry(0.18, 0.022, 12, 32);
      ringGeo.rotateX(Math.PI / 2);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(seat.position);
      ringMesh.position.y += 0.38; // Hover slightly above seat cushion
      ringMesh.userData = { seatId: seat.id, baseOpacity: 0.6 };

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

    // For remote users, spawn or update their seated avatar
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

    // Remove any avatars who left voice
    for (const [userId, avatar] of this.avatarMap.entries()) {
      if (!currentParticipantIds.has(userId)) {
        this.freeSeatForUser(userId);
      }
    }

    // Assign remote participants to seats if not already seated
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

      // Update speaking halo on remote avatar
      const avatar = this.avatarMap.get(u.id);
      if (avatar) {
        avatar.updateSpeaking(!!p.isSpeaking);
      }
    });
  }

  public update(delta: number) {
    const time = Date.now() * 0.003;

    // Gently pulse and rotate interactive seat rings
    this.seatMeshMap.forEach((mesh) => {
      if (mesh.visible) {
        mesh.rotation.y = time * 0.8;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(time * 2) * 0.25;
      }
    });

    // Update remote avatars
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
