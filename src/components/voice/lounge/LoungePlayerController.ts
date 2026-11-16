import * as THREE from 'three';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeSeatManager, SEAT_DEFINITIONS, SeatDefinition } from './LoungeSeats';

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const FURNITURE_OBSTACLES: ObstacleBox[] = [
  // 1. Cinema TV Screen & Media Console (Left Wall)
  { minX: -7.5, maxX: -5.6, minZ: -2.8, maxZ: 1.8 },
  // 2. Central Coffee Table (Oak table with snacks & controllers)
  { minX: -1.3, maxX: 0.3, minZ: -0.4, maxZ: 1.2 },
  // 3. Retro Arcade Cabinet (Gamer Corner)
  { minX: -6.5, maxX: -4.6, minZ: -5.8, maxZ: -4.0 },
  // 4. Gaming Table & Booth
  { minX: -4.8, maxX: -3.2, minZ: -5.0, maxZ: -3.4 },
];

export class LoungePlayerController {
  public avatar: LoungeAvatar;
  private seatManager: LoungeSeatManager;
  private camera: THREE.Camera;
  private velocity: THREE.Vector3 = new THREE.Vector3();

  // Key state
  private keys: Record<string, boolean> = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
  };

  public nearestSeat: SeatDefinition | null = null;
  public isSitting: boolean = false;
  public currentSeatId: number | null = null;
  public isRunning: boolean = false;
  private lastEmittedPos: THREE.Vector3 = new THREE.Vector3();
  private lastEmittedRot: number = 0;
  private lastEmitTime: number = 0;
  private wasMovingBefore: boolean = false;

  public onStateChange?: (state: {
    position: [number, number, number];
    rotationY: number;
    isSitting: boolean;
    seatId: number | null;
    emote: string | null;
  }) => void;

  constructor(
    avatar: LoungeAvatar,
    seatManager: LoungeSeatManager,
    camera: THREE.Camera
  ) {
    this.avatar = avatar;
    this.seatManager = seatManager;
    this.camera = camera;

    // Start in the center of the lounge, facing the Cinema TV on the left
    this.avatar.group.position.set(0.2, 0, 0.4);
    this.avatar.group.rotation.y = -Math.PI / 2;
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const key = e.key.toLowerCase();

    if (key === 'w' || e.key === 'ArrowUp') {
      this.keys.forward = true;
      if (this.isSitting) this.standUp();
    }
    if (key === 's' || e.key === 'ArrowDown') {
      this.keys.backward = true;
      if (this.isSitting) this.standUp();
    }
    if (key === 'a' || e.key === 'ArrowLeft') {
      this.keys.left = true;
      if (this.isSitting) this.standUp();
    }
    if (key === 'd' || e.key === 'ArrowRight') {
      this.keys.right = true;
      if (this.isSitting) this.standUp();
    }
    if (e.shiftKey) {
      this.keys.run = true;
    }

    if (e.code === 'Space') {
      if (this.isSitting) {
        this.standUp();
      } else {
        this.avatar.playEmote('Jump');
      }
    }

    if (key === 'e') {
      if (this.isSitting) {
        this.standUp();
      } else if (this.nearestSeat) {
        this.sitInSeat(this.nearestSeat.id);
      }
    }

    if (key === 'g') {
      this.isRunning = !this.isRunning;
    }

    if (key === '1') this.playEmote('Wave');
    if (key === '2') this.playEmote('Dance');
    if (key === 't') this.playEmote('Slap');
    if (key === 'b') this.playEmote('Point');
    if (key === 'k') this.playEmote('Wrestle');
    if (key === '4') this.playEmote('Laugh');
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') this.keys.forward = false;
    if (key === 's' || e.key === 'ArrowDown') this.keys.backward = false;
    if (key === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
    if (key === 'd' || e.key === 'ArrowRight') this.keys.right = false;
    if (!e.shiftKey) this.keys.run = false;
  };

  public sitInSeat(seatId: number) {
    const seat = SEAT_DEFINITIONS.find((s) => s.id === seatId);
    if (!seat) return;

    this.isSitting = true;
    this.currentSeatId = seatId;
    this.avatar.group.position.copy(seat.position);
    this.avatar.setSitting(true, seat.lookAt);
    this.seatManager.sitInSeat(seatId, {
      id: this.avatar.userId,
      displayName: this.avatar.displayName,
    }, true);

    this.emitState();
  }

  public standUp() {
    if (!this.isSitting) return;
    this.isSitting = false;
    this.currentSeatId = null;
    this.avatar.setSitting(false);
    this.seatManager.standUp();

    const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.avatar.group.quaternion);
    this.avatar.group.position.addScaledVector(forwardDir, 0.45);

    this.emitState();
  }

  public playEmote(emote: string) {
    if (this.isSitting) {
      this.standUp();
    }
    this.avatar.playEmote(emote);
    this.emitState();
  }

  private emitState() {
    if (this.onStateChange) {
      const p = this.avatar.group.position;
      this.onStateChange({
        position: [p.x, p.y, p.z],
        rotationY: this.avatar.group.rotation.y,
        isSitting: this.isSitting,
        seatId: this.currentSeatId,
        emote: this.avatar.currentEmote,
      });
    }
  }

  public update(delta: number) {
    this.avatar.update(delta);

    if (this.isSitting) {
      this.avatar.isMoving = false;
      this.velocity.set(0, 0, 0);
      return;
    }

    // 1. Calculate camera-relative movement direction
    let rawMoveX = 0;
    let rawMoveZ = 0;

    if (this.keys.forward) rawMoveZ -= 1;
    if (this.keys.backward) rawMoveZ += 1;
    if (this.keys.left) rawMoveX -= 1;
    if (this.keys.right) rawMoveX += 1;

    const isMoving = rawMoveX !== 0 || rawMoveZ !== 0;
    const maxSpeed = (this.keys.run || this.isRunning) ? 4.8 : 3.0;
    const targetVelocity = new THREE.Vector3();

    if (isMoving) {
      const camForward = new THREE.Vector3();
      this.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      const camRight = new THREE.Vector3();
      camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      const moveDir = new THREE.Vector3()
        .addScaledVector(camForward, -rawMoveZ)
        .addScaledVector(camRight, rawMoveX)
        .normalize();

      targetVelocity.copy(moveDir).multiplyScalar(maxSpeed);

      // Smoothly rotate avatar towards movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.avatar.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.avatar.group.rotation.y += diff * Math.min(1.0, 12.0 * delta);

      if (!this.avatar.isMoving && !this.avatar.currentEmote) {
        this.avatar.playAnimation((this.keys.run || this.isRunning) ? 'Run' : 'Walk', 0.2);
      }
      this.avatar.isMoving = true;
    } else {
      if (this.avatar.isMoving && !this.avatar.currentEmote) {
        this.avatar.playAnimation('Idle', 0.25);
      }
      this.avatar.isMoving = false;
    }

    // Smooth velocity acceleration & inertia damping (weighty physical movement)
    this.velocity.lerp(targetVelocity, Math.min(1.0, (isMoving ? 10.0 : 12.0) * delta));

    // Collision detection with room boundaries & furniture obstacles
    const avatarRadius = 0.35;
    const currentPos = this.avatar.group.position;
    const nextX = currentPos.x + this.velocity.x * delta;
    const nextZ = currentPos.z + this.velocity.z * delta;

    // Room boundaries
    const clampedX = THREE.MathUtils.clamp(nextX, -6.6, 6.4);
    const clampedZ = THREE.MathUtils.clamp(nextZ, -5.6, 5.0);

    // Test X movement against furniture obstacles
    let allowX = true;
    for (const obs of FURNITURE_OBSTACLES) {
      if (
        clampedX + avatarRadius > obs.minX &&
        clampedX - avatarRadius < obs.maxX &&
        currentPos.z + avatarRadius > obs.minZ &&
        currentPos.z - avatarRadius < obs.maxZ
      ) {
        allowX = false;
        this.velocity.x = 0;
        break;
      }
    }

    // Test Z movement against furniture obstacles
    let allowZ = true;
    for (const obs of FURNITURE_OBSTACLES) {
      if (
        currentPos.x + avatarRadius > obs.minX &&
        currentPos.x - avatarRadius < obs.maxX &&
        clampedZ + avatarRadius > obs.minZ &&
        clampedZ - avatarRadius < obs.maxZ
      ) {
        allowZ = false;
        this.velocity.z = 0;
        break;
      }
    }

    if (allowX) currentPos.x = clampedX;
    if (allowZ) currentPos.z = clampedZ;

    const isCurrentlyActive = isMoving || this.velocity.lengthSq() > 0.001;
    const hasMoved =
      currentPos.distanceToSquared(this.lastEmittedPos) > 0.0016 ||
      Math.abs(this.avatar.group.rotation.y - this.lastEmittedRot) > 0.04;
    const now = performance.now();

    if (isCurrentlyActive && hasMoved && (now - this.lastEmitTime > 55)) {
      this.lastEmitTime = now;
      this.lastEmittedPos.copy(currentPos);
      this.lastEmittedRot = this.avatar.group.rotation.y;
      this.emitState();
    } else if (!isCurrentlyActive && this.wasMovingBefore) {
      // Stopped moving: emit one final settle packet
      this.lastEmittedPos.copy(currentPos);
      this.lastEmittedRot = this.avatar.group.rotation.y;
      this.emitState();
    }
    this.wasMovingBefore = isCurrentlyActive;

    // 2. Check proximity to nearest seat for 'E' prompt
    let closestSeat: SeatDefinition | null = null;
    let closestDist = Infinity;

    for (const seat of SEAT_DEFINITIONS) {
      const dist = this.avatar.group.position.distanceTo(seat.position);
      if (dist < 1.35 && dist < closestDist) {
        closestDist = dist;
        closestSeat = seat;
      }
    }

    this.nearestSeat = closestSeat;
  }

  public dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
