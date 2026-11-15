import * as THREE from 'three';
import { VoiceParticipant } from '../../../types';
import { LoungeAvatar } from './LoungeAvatar';

export interface SeatDefinition {
  id: number;
  name: string;
  zone: 'Cinema Lounge' | 'Wall Sofa' | 'Conversation Pod' | 'Front Lounge';
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  type: 'couch' | 'armchair' | 'stool';
  color: string;
}

export const SEAT_DEFINITIONS: SeatDefinition[] = [
  // 1. Curved Purple Cinema Couches (Facing TV on RIGHT wall at X = 7.28)
  {
    id: 1,
    name: 'Cinema Couch 1 — Outer',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.8, 0.22, 1.6),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 2,
    name: 'Cinema Couch 1 — Inner',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.2, 0.22, 2.0),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 3,
    name: 'Cinema Couch 2 — Top',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-2.3, 0.22, 0.6),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 4,
    name: 'Cinema Couch 2 — Bottom',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-2.3, 0.22, 0.0),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 5,
    name: 'Cinema Couch 3 — Inner',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.8, 0.22, -1.0),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },
  {
    id: 6,
    name: 'Cinema Couch 3 — Outer',
    zone: 'Cinema Lounge',
    position: new THREE.Vector3(-1.2, 0.22, -1.4),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'couch',
    color: '#8b5cf6',
  },

  // 2. 4-Seater Magenta Sofa on Back Wall
  {
    id: 7,
    name: 'Back Sofa — Seat 1',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(1.0, 0.22, -4.6),
    lookAt: new THREE.Vector3(1.0, 1.0, 0),
    type: 'couch',
    color: '#be185d',
  },
  {
    id: 8,
    name: 'Back Sofa — Seat 2',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(1.7, 0.22, -4.6),
    lookAt: new THREE.Vector3(1.7, 1.0, 0),
    type: 'couch',
    color: '#be185d',
  },
  {
    id: 9,
    name: 'Back Sofa — Seat 3',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(2.5, 0.22, -4.6),
    lookAt: new THREE.Vector3(2.5, 1.0, 0),
    type: 'couch',
    color: '#be185d',
  },
  {
    id: 10,
    name: 'Back Sofa — Seat 4',
    zone: 'Wall Sofa',
    position: new THREE.Vector3(3.2, 0.22, -4.6),
    lookAt: new THREE.Vector3(3.2, 1.0, 0),
    type: 'couch',
    color: '#be185d',
  },

  // 3. Mustard-Yellow Club Armchairs (Red Rug X = -4.6, Z = -2.6)
  {
    id: 11,
    name: 'Yellow Armchair — North',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-4.6, 0.22, -3.6),
    lookAt: new THREE.Vector3(-4.6, 0.5, -2.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 12,
    name: 'Yellow Armchair — South',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-4.6, 0.22, -1.6),
    lookAt: new THREE.Vector3(-4.6, 0.5, -2.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 13,
    name: 'Yellow Armchair — West',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-5.6, 0.22, -2.6),
    lookAt: new THREE.Vector3(-4.6, 0.5, -2.6),
    type: 'armchair',
    color: '#ca8a04',
  },
  {
    id: 14,
    name: 'Yellow Armchair — East',
    zone: 'Conversation Pod',
    position: new THREE.Vector3(-3.6, 0.22, -2.6),
    lookAt: new THREE.Vector3(-4.6, 0.5, -2.6),
    type: 'armchair',
    color: '#ca8a04',
  },

  // 4. Front Teal Stool
  {
    id: 15,
    name: 'Front Stool',
    zone: 'Front Lounge',
    position: new THREE.Vector3(0.6, 0.18, 2.6),
    lookAt: new THREE.Vector3(7.28, 2.35, 0.3),
    type: 'stool',
    color: '#0d9488',
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
      // Crisp white circular target ring hovering right above each seat cushion (matching user screenshot)
      const ringGeo = new THREE.TorusGeometry(0.18, 0.022, 12, 32);
      ringGeo.rotateX(Math.PI / 2);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(seat.position);
      ringMesh.position.y += 0.35;
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
        mesh.rotation.y = time * 0.8;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(time * 2) * 0.25;
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
