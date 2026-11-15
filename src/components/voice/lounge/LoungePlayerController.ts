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
  };

  public nearestSeat: SeatDefinition | null = null;
  public isSitting: boolean = false;
  private currentSeatId: number | null = null;

  constructor(
    avatar: LoungeAvatar,
    seatManager: LoungeSeatManager,
    camera: THREE.Camera
  ) {
    this.avatar = avatar;
    this.seatManager = seatManager;
    this.camera = camera;

    // Start position in the center of the lounge
    this.avatar.group.position.set(0, 0, 1.2);
    this.bindEvents();
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore input if typing in an input field
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

    // Space to stand up or jump
    if (e.code === 'Space') {
      if (this.isSitting) {
        this.standUp();
      }
    }

    // E to interact / sit / stand up
    if (key === 'e') {
      if (this.isSitting) {
        this.standUp();
      } else if (this.nearestSeat) {
        this.sitInSeat(this.nearestSeat.id);
      }
    }

    // Emote shortcuts: 1: Wave, 2: Dance, 3: Cheers, 4: Laugh
    if (key === '1') this.playEmote('Wave');
    if (key === '2') this.playEmote('Dance');
    if (key === '3') this.playEmote('Cheers');
    if (key === '4') this.playEmote('Laugh');
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') this.keys.forward = false;
    if (key === 's' || e.key === 'ArrowDown') this.keys.backward = false;
    if (key === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
    if (key === 'd' || e.key === 'ArrowRight') this.keys.right = false;
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
  }

  public playEmote(emote: string) {
    if (this.isSitting) {
      this.standUp();
    }
    this.avatar.playEmote(emote);
  }

  public update(delta: number) {
    this.avatar.update(delta);

    // If seated, check nearest seat update and return
    if (this.isSitting) {
      this.avatar.isMoving = false;
      return;
    }

    // 1. Calculate WASD movement direction
    let moveX = 0;
    let moveZ = 0;

    if (this.keys.forward) moveZ -= 1;
    if (this.keys.backward) moveZ += 1;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;
    this.avatar.isMoving = isMoving;

    if (isMoving) {
      // Calculate movement vector relative to room axes
      const inputVector = new THREE.Vector3(moveX, 0, moveZ).normalize();

      // Move avatar
      const moveSpeed = 3.2; // units per second
      const step = inputVector.clone().multiplyScalar(moveSpeed * delta);
      this.avatar.group.position.add(step);

      // Smoothly rotate avatar towards movement direction
      const targetAngle = Math.atan2(inputVector.x, inputVector.z);
      this.avatar.group.rotation.y = THREE.MathUtils.lerp(
        this.avatar.group.rotation.y,
        targetAngle,
        15 * delta
      );

      // 2. Room Collision Boundaries (Stay inside walls!)
      const pos = this.avatar.group.position;
      pos.x = THREE.MathUtils.clamp(pos.x, -6.2, 6.2);
      pos.z = THREE.MathUtils.clamp(pos.z, -5.4, 5.0);

      // Step up onto the elevated window lounge deck
      if (pos.x > 4.4 && pos.z >= -4.2 && pos.z <= 3.2) {
        pos.y = THREE.MathUtils.lerp(pos.y, 0.32, 10 * delta); // Deck height
      } else {
        pos.y = THREE.MathUtils.lerp(pos.y, 0.0, 10 * delta); // Floor level
      }
    }

    // 3. Check proximity to nearest chair
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
