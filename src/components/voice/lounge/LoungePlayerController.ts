import * as THREE from 'three';
import { LoungeAvatar } from './LoungeAvatar';
import { LoungeSeatManager, SEAT_DEFINITIONS, SeatDefinition } from './LoungeSeats';

export class LoungePlayerController {
  public avatar: LoungeAvatar;
  private seatManager: LoungeSeatManager;
  private camera: THREE.Camera;

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

  // Event callbacks for network / broadcast sync
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

    // Start in the center of the lounge, facing the TV (left wall)
    this.avatar.group.position.set(0.5, 0, 0.3);
    this.avatar.group.rotation.y = -Math.PI / 2;
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore input if user is typing in a text field
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

    // Space to stand up
    if (e.code === 'Space') {
      if (this.isSitting) this.standUp();
    }

    // E to interact / sit / stand up
    if (key === 'e') {
      if (this.isSitting) {
        this.standUp();
      } else if (this.nearestSeat) {
        this.sitInSeat(this.nearestSeat.id);
      }
    }

    // G to toggle run speed
    if (key === 'g') {
      this.isRunning = !this.isRunning;
    }

    // Emote hotkeys matching Image 1:
    // 1: Wave, 2: Dance, t: Slap, b: Point, k: Wrestle/Cheers, 4: Laugh
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

    // Step slightly forward from chair
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
    this.avatar.isMoving = isMoving;

    if (isMoving) {
      // Get camera horizontal forward & right vectors
      const camForward = new THREE.Vector3();
      this.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      const camRight = new THREE.Vector3();
      camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      // Combine with input
      const moveDir = new THREE.Vector3()
        .addScaledVector(camForward, -rawMoveZ)
        .addScaledVector(camRight, rawMoveX)
        .normalize();

      // Speed
      const speed = (this.keys.run || this.isRunning) ? 4.8 : 3.0;
      const step = moveDir.clone().multiplyScalar(speed * delta);
      this.avatar.group.position.add(step);

      // Smoothly rotate avatar towards movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      // Shortest angle interpolation
      let diff = targetAngle - this.avatar.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.avatar.group.rotation.y += diff * Math.min(1.0, 16 * delta);

      // Room boundary collision
      const pos = this.avatar.group.position;
      pos.x = THREE.MathUtils.clamp(pos.x, -6.4, 6.2);
      pos.z = THREE.MathUtils.clamp(pos.z, -5.6, 5.0);

      // Smoothly step up onto elevated window lounge platform
      if (pos.x > 4.4 && pos.z >= -4.2 && pos.z <= 3.2) {
        pos.y = THREE.MathUtils.lerp(pos.y, 0.32, 10 * delta); // Deck height
      } else {
        pos.y = THREE.MathUtils.lerp(pos.y, 0.0, 10 * delta); // Floor level
      }

      this.emitState();
    }

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
