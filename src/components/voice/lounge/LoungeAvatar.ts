import * as THREE from 'three';

export interface AvatarOptions {
  userId: string;
  displayName: string;
  shirtColor?: string | number;
  pantsColor?: string | number;
  skinColor?: string | number;
  hairColor?: string | number;
  isLocal?: boolean;
}

export class LoungeAvatar {
  public group: THREE.Group = new THREE.Group();
  public userId: string;
  public displayName: string;

  // Body parts for procedural skeletal animation
  private hipsGroup: THREE.Group = new THREE.Group();
  private torsoMesh!: THREE.Mesh;
  private headGroup: THREE.Group = new THREE.Group();
  private leftArmPivot: THREE.Group = new THREE.Group();
  private rightArmPivot: THREE.Group = new THREE.Group();
  private leftLegPivot: THREE.Group = new THREE.Group();
  private rightLegPivot: THREE.Group = new THREE.Group();
  private leftShinMesh!: THREE.Mesh;
  private rightShinMesh!: THREE.Mesh;
  private nameSprite!: THREE.Sprite;

  // State
  public isMoving: boolean = false;
  public isSitting: boolean = false;
  public currentEmote: string | null = null;
  private emoteTimer: number = 0;
  private animTimer: number = 0;

  constructor(options: AvatarOptions) {
    this.userId = options.userId;
    this.displayName = options.displayName;

    this.buildHumanoid(options);
  }

  private buildHumanoid(opt: AvatarOptions) {
    const skinMat = new THREE.MeshStandardMaterial({
      color: opt.skinColor || 0xf5c096, // Realistic warm skin tone
      roughness: 0.5,
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: opt.shirtColor || (opt.isLocal ? 0x10b981 : 0x6366f1), // Green for local, Indigo for peers
      roughness: 0.6,
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: opt.pantsColor || 0x1e293b, // Dark denim / navy pants
      roughness: 0.7,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: opt.hairColor || 0x2b1d14, // Dark brown / stylish hair
      roughness: 0.8,
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White sneakers
      roughness: 0.3,
    });

    // 1. Hips (Base Pivot for lower & upper body)
    this.hipsGroup.position.set(0, 0.65, 0);
    this.group.add(this.hipsGroup);

    // Pelvis
    const pelvisGeo = new THREE.BoxGeometry(0.32, 0.16, 0.22);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    this.hipsGroup.add(pelvis);

    // 2. Torso (Chest + Shirt)
    const torsoGeo = new THREE.BoxGeometry(0.36, 0.44, 0.24);
    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.position.set(0, 0.28, 0);
    this.hipsGroup.add(this.torsoMesh);

    // 3. Head & Hair
    this.headGroup.position.set(0, 0.62, 0);
    this.hipsGroup.add(this.headGroup);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), skinMat);
    neck.position.set(0, -0.06, 0);
    this.headGroup.add(neck);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.24), skinMat);
    this.headGroup.add(head);

    // Hair (stylized top + sides)
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.26), hairMat);
    hair.position.set(0, 0.12, 0);
    this.headGroup.add(hair);

    const hairBangs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), hairMat);
    hairBangs.position.set(0, 0.08, 0.12);
    this.headGroup.add(hairBangs);

    // Stylized Eyes (Glasses / dark eyes)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat);
    eyeL.position.set(-0.065, 0.02, 0.125);
    this.headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat);
    eyeR.position.set(0.065, 0.02, 0.125);
    this.headGroup.add(eyeR);

    // 4. Arms (Shoulders + Upper arm + Forearm + Hands)
    const createArm = (isLeft: boolean) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(isLeft ? -0.25 : 0.25, 0.42, 0);

      // Sleeve / Upper Arm
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), shirtMat);
      sleeve.position.set(0, -0.11, 0);
      armPivot.add(sleeve);

      // Lower Arm + Hand
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), skinMat);
      hand.position.set(0, -0.3, 0);
      armPivot.add(hand);

      return armPivot;
    };

    this.leftArmPivot = createArm(true);
    this.rightArmPivot = createArm(false);
    this.hipsGroup.add(this.leftArmPivot);
    this.hipsGroup.add(this.rightArmPivot);

    // 5. Legs (Hips + Thighs + Shins + Shoes)
    const createLeg = (isLeft: boolean) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(isLeft ? -0.1 : 0.1, -0.08, 0);

      // Thigh
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.14), pantsMat);
      thigh.position.set(0, -0.15, 0);
      legPivot.add(thigh);

      // Shin + Shoe
      const shinGroup = new THREE.Group();
      shinGroup.position.set(0, -0.3, 0);

      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), pantsMat);
      shin.position.set(0, -0.12, 0);
      shinGroup.add(shin);

      // Sneaker / Shoe
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.2), shoeMat);
      shoe.position.set(0, -0.22, 0.035);
      shinGroup.add(shoe);

      legPivot.add(shinGroup);
      return { legPivot, shinGroup };
    };

    const leftLegData = createLeg(true);
    this.leftLegPivot = leftLegData.legPivot;
    this.leftShinMesh = leftLegData.shinGroup as any;
    this.hipsGroup.add(this.leftLegPivot);

    const rightLegData = createLeg(false);
    this.rightLegPivot = rightLegData.legPivot;
    this.rightShinMesh = rightLegData.shinGroup as any;
    this.hipsGroup.add(this.rightLegPivot);

    // 6. Name Sprite above head
    this.nameSprite = this.createNameSprite(this.displayName, opt.isLocal);
    this.nameSprite.position.set(0, 1.6, 0);
    this.group.add(this.nameSprite);
  }

  private createNameSprite(name: string, isLocal?: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = isLocal ? 'rgba(16, 185, 129, 0.85)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isLocal ? '#34d399' : '#818cf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(6, 6, 244, 52, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cleanText = name.length > 14 ? name.slice(0, 12) + '...' : name;
      ctx.fillText(cleanText + (isLocal ? ' (You)' : ''), 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.0, 0.25, 1);
    return sprite;
  }

  public setSitting(sitting: boolean, seatLookAt?: THREE.Vector3) {
    this.isSitting = sitting;
    if (sitting) {
      this.isMoving = false;
      this.currentEmote = null;
      // Sitting posture: Hips lower, legs bend 90 degrees at hips and knees
      this.hipsGroup.position.set(0, 0.44, 0);
      this.leftLegPivot.rotation.set(-Math.PI / 2, 0, 0);
      this.rightLegPivot.rotation.set(-Math.PI / 2, 0, 0);
      (this.leftShinMesh as any).rotation.set(Math.PI / 2, 0, 0);
      (this.rightShinMesh as any).rotation.set(Math.PI / 2, 0, 0);

      // Relaxed arms on lap
      this.leftArmPivot.rotation.set(-0.6, 0, 0.15);
      this.rightArmPivot.rotation.set(-0.6, 0, -0.15);
      this.torsoMesh.rotation.set(0.08, 0, 0);
      this.headGroup.rotation.set(-0.05, 0, 0);

      if (seatLookAt) {
        this.group.lookAt(seatLookAt.x, this.group.position.y, seatLookAt.z);
      }
    } else {
      // Reset to standing
      this.hipsGroup.position.set(0, 0.65, 0);
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      (this.leftShinMesh as any).rotation.set(0, 0, 0);
      (this.rightShinMesh as any).rotation.set(0, 0, 0);
      this.leftArmPivot.rotation.set(0, 0, 0);
      this.rightArmPivot.rotation.set(0, 0, 0);
      this.torsoMesh.rotation.set(0, 0, 0);
      this.headGroup.rotation.set(0, 0, 0);
    }
  }

  public playEmote(emote: string) {
    if (this.isSitting) {
      this.setSitting(false);
    }
    this.currentEmote = emote;
    this.emoteTimer = 0;
  }

  public update(delta: number) {
    this.animTimer += delta;

    // 1. Sitting animation
    if (this.isSitting) {
      // Gentle breathing idle while sitting
      const breath = Math.sin(this.animTimer * 2) * 0.02;
      this.headGroup.position.y = 0.62 + breath;
      return;
    }

    // 2. Active Emote Animations
    if (this.currentEmote) {
      this.emoteTimer += delta;

      if (this.currentEmote === 'Wave') {
        // Raise right arm and wave hand left and right
        this.rightArmPivot.rotation.set(-0.4, 0, 2.5);
        this.rightArmPivot.rotation.z = 2.4 + Math.sin(this.emoteTimer * 12) * 0.35;
        this.leftArmPivot.rotation.set(0, 0, 0.1);
        this.headGroup.rotation.set(0, Math.sin(this.emoteTimer * 6) * 0.1, 0);
      } else if (this.currentEmote === 'Dance') {
        // Bouncy energetic dance with arm pumping and hip swaying
        const beat = this.emoteTimer * 9;
        this.hipsGroup.position.y = 0.65 + Math.abs(Math.sin(beat)) * 0.1;
        this.hipsGroup.rotation.y = Math.sin(beat * 0.5) * 0.35;
        this.leftArmPivot.rotation.set(-1.2 + Math.sin(beat) * 0.6, 0, -0.4);
        this.rightArmPivot.rotation.set(-1.2 - Math.sin(beat) * 0.6, 0, 0.4);
        this.headGroup.rotation.set(Math.sin(beat) * 0.15, 0, 0);
      } else if (this.currentEmote === 'Cheers' || this.currentEmote === 'Celebrate') {
        // Both arms raised high celebrating and jumping
        const jump = this.emoteTimer * 8;
        this.hipsGroup.position.y = 0.65 + Math.max(0, Math.sin(jump)) * 0.16;
        this.leftArmPivot.rotation.set(0, 0, 2.7);
        this.rightArmPivot.rotation.set(0, 0, -2.7);
        this.headGroup.rotation.set(-0.2, 0, 0);
      } else if (this.currentEmote === 'Laugh') {
        // Laughing head tilted back, chest shaking
        const laugh = Math.sin(this.emoteTimer * 16) * 0.08;
        this.torsoMesh.rotation.set(-0.15 + laugh, 0, 0);
        this.headGroup.rotation.set(-0.25 + laugh * 1.5, 0, 0);
        this.leftArmPivot.rotation.set(-0.5, 0, 0.3);
        this.rightArmPivot.rotation.set(-0.5, 0, -0.3);
      }

      // Auto finish emote after 3.5s
      if (this.emoteTimer > 3.5) {
        this.currentEmote = null;
      }
      return;
    }

    // 3. Walking Animation Loop
    if (this.isMoving) {
      const walkFreq = 9.5;
      const legSwing = Math.sin(this.animTimer * walkFreq) * 0.65;
      const armSwing = Math.sin(this.animTimer * walkFreq) * 0.6;
      const bounce = Math.abs(Math.sin(this.animTimer * walkFreq)) * 0.05;

      // Vertical bounce
      this.hipsGroup.position.y = 0.65 + bounce;

      // Alternating leg swings
      this.leftLegPivot.rotation.set(legSwing, 0, 0);
      this.rightLegPivot.rotation.set(-legSwing, 0, 0);

      // Alternating arm swings (opposite to legs)
      this.leftArmPivot.rotation.set(-armSwing, 0, 0.1);
      this.rightArmPivot.rotation.set(armSwing, 0, -0.1);

      // Subtle torso sway
      this.torsoMesh.rotation.y = Math.sin(this.animTimer * walkFreq) * 0.06;
      this.headGroup.rotation.set(0, -Math.sin(this.animTimer * walkFreq) * 0.05, 0);
    } else {
      // 4. Idle Breathing Animation
      const breath = Math.sin(this.animTimer * 2.2) * 0.02;
      this.hipsGroup.position.y = 0.65 + breath;
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      this.leftArmPivot.rotation.set(0, 0, 0.08);
      this.rightArmPivot.rotation.set(0, 0, -0.08);
      this.torsoMesh.rotation.set(0, 0, 0);
      this.headGroup.rotation.set(breath * 1.2, 0, 0);
    }
  }

  public dispose() {
    this.group.clear();
  }
}
