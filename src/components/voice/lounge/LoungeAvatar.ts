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
  public isLocal: boolean;

  // Body parts for procedural animation
  private hipsGroup: THREE.Group = new THREE.Group();
  private torsoMesh!: THREE.Mesh;
  private headGroup: THREE.Group = new THREE.Group();
  private headMesh!: THREE.Mesh;
  private hairMesh!: THREE.Mesh;
  private leftArmPivot: THREE.Group = new THREE.Group();
  private rightArmPivot: THREE.Group = new THREE.Group();
  private leftForearmPivot: THREE.Group = new THREE.Group();
  private rightForearmPivot: THREE.Group = new THREE.Group();
  private leftLegPivot: THREE.Group = new THREE.Group();
  private rightLegPivot: THREE.Group = new THREE.Group();
  private leftKneePivot: THREE.Group = new THREE.Group();
  private rightKneePivot: THREE.Group = new THREE.Group();
  private nameSprite!: THREE.Sprite;
  private speechBubbleSprite: THREE.Sprite | null = null;
  private speechTimeout: ReturnType<typeof setTimeout> | null = null;

  // Materials for live outfit customization
  private skinMat!: THREE.MeshStandardMaterial;
  private shirtMat!: THREE.MeshStandardMaterial;
  private pantsMat!: THREE.MeshStandardMaterial;
  private hairMat!: THREE.MeshStandardMaterial;
  private shoeMat!: THREE.MeshStandardMaterial;

  // State
  public isMoving: boolean = false;
  public isSitting: boolean = false;
  public currentEmote: string | null = null;
  private emoteTimer: number = 0;
  private animTimer: number = 0;
  public isSpeaking: boolean = false;

  // Floating reactions
  private floatingEmojis: Array<{ mesh: THREE.Sprite; time: number; speed: number }> = [];

  constructor(options: AvatarOptions) {
    this.userId = options.userId;
    this.displayName = options.displayName;
    this.isLocal = !!options.isLocal;

    this.initMaterials(options);
    this.buildHumanoid();
    this.buildNameBadge();
  }

  private initMaterials(opt: AvatarOptions) {
    this.skinMat = new THREE.MeshStandardMaterial({
      color: opt.skinColor ?? 0xf5c096, // Warm natural stylized skin tone
      roughness: 0.55,
      metalness: 0.05,
    });

    // Default stylized casual clothes (matching reference: teal/green, coral pink, royal blue, or purple)
    const defaultShirt = opt.isLocal ? 0x0d9488 : 0xec4899; // Teal for local, Coral pink for peers
    this.shirtMat = new THREE.MeshStandardMaterial({
      color: opt.shirtColor ?? defaultShirt,
      roughness: 0.65,
    });

    this.pantsMat = new THREE.MeshStandardMaterial({
      color: opt.pantsColor ?? 0x1e293b, // Dark denim / joggers
      roughness: 0.7,
    });

    this.hairMat = new THREE.MeshStandardMaterial({
      color: opt.hairColor ?? 0x3b2318, // Chestnut / dark hair
      roughness: 0.8,
    });

    this.shoeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Clean white sneakers
      roughness: 0.35,
    });
  }

  public setOutfit(shirt?: string | number, pants?: string | number, hair?: string | number, skin?: string | number) {
    if (shirt !== undefined) this.shirtMat.color.set(shirt);
    if (pants !== undefined) this.pantsMat.color.set(pants);
    if (hair !== undefined) this.hairMat.color.set(hair);
    if (skin !== undefined) this.skinMat.color.set(skin);
  }

  private buildHumanoid() {
    // 1. Hips (Center pivot for movement and posture)
    this.hipsGroup.position.set(0, 0.72, 0);
    this.group.add(this.hipsGroup);

    // Pelvis / Hips (Smooth rounded capsule-like geometry)
    const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.18, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, this.pantsMat);
    this.hipsGroup.add(pelvis);

    // 2. Torso (Casual T-shirt with smooth curves and rounded shoulders)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.09, 0);

    // Main chest / waist
    const torsoGeo = new THREE.CylinderGeometry(0.20, 0.18, 0.44, 20);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.shirtMat);
    this.torsoMesh.position.set(0, 0.22, 0);
    torsoGroup.add(this.torsoMesh);

    // Rounded shoulder caps
    const shoulderGeo = new THREE.SphereGeometry(0.10, 16, 12);
    const shoulderL = new THREE.Mesh(shoulderGeo, this.shirtMat);
    shoulderL.position.set(-0.22, 0.38, 0);
    torsoGroup.add(shoulderL);

    const shoulderR = new THREE.Mesh(shoulderGeo, this.shirtMat);
    shoulderR.position.set(0.22, 0.38, 0);
    torsoGroup.add(shoulderR);

    this.hipsGroup.add(torsoGroup);

    // 3. Head & Stylized Face (Matching Image 1)
    this.headGroup.position.set(0, 0.58, 0);
    this.hipsGroup.add(this.headGroup);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 16), this.skinMat);
    neck.position.set(0, -0.04, 0);
    this.headGroup.add(neck);

    // Smooth rounded head (stylized cute sphere)
    const headGeo = new THREE.SphereGeometry(0.22, 24, 20);
    headGeo.scale(0.92, 1.05, 0.96);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMat);
    this.headMesh.position.set(0, 0.12, 0);
    this.headGroup.add(this.headMesh);

    // Stylized 3D Nose Bump
    const noseGeo = new THREE.CapsuleGeometry(0.026, 0.04, 8, 12);
    const nose = new THREE.Mesh(noseGeo, this.skinMat);
    nose.rotation.x = Math.PI / 4;
    nose.position.set(0, 0.11, 0.215);
    this.headGroup.add(nose);

    // Stylized Ears
    const earGeo = new THREE.SphereGeometry(0.05, 12, 12);
    earGeo.scale(0.5, 1.0, 0.8);
    const earL = new THREE.Mesh(earGeo, this.skinMat);
    earL.position.set(-0.21, 0.12, 0.0);
    this.headGroup.add(earL);

    const earR = new THREE.Mesh(earGeo, this.skinMat);
    earR.position.set(0.21, 0.12, 0.0);
    this.headGroup.add(earR);

    // Stylized Sculpted Hair (Smooth helmet cap with bangs and sideburns)
    const hairGeo = new THREE.SphereGeometry(0.23, 24, 20);
    hairGeo.scale(0.96, 1.08, 0.98);
    this.hairMesh = new THREE.Mesh(hairGeo, this.hairMat);
    this.hairMesh.position.set(0, 0.15, -0.02);
    this.headGroup.add(this.hairMesh);

    // Hair front bangs / swoop
    const bangsGeo = new THREE.BoxGeometry(0.24, 0.09, 0.1);
    const bangs = new THREE.Mesh(bangsGeo, this.hairMat);
    bangs.position.set(0, 0.26, 0.14);
    bangs.rotation.x = -0.2;
    this.headGroup.add(bangs);

    // Stylized Eyes (Friendly dark oval pupils)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const eyeGeo = new THREE.SphereGeometry(0.026, 12, 12);
    eyeGeo.scale(1.0, 1.3, 0.5);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.065, 0.13, 0.198);
    this.headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.065, 0.13, 0.198);
    this.headGroup.add(eyeR);

    // Subtle Eyebrows
    const browMat = new THREE.MeshBasicMaterial({ color: 0x271911 });
    const browGeo = new THREE.BoxGeometry(0.06, 0.015, 0.02);
    const browL = new THREE.Mesh(browGeo, browMat);
    browL.position.set(-0.065, 0.18, 0.20);
    browL.rotation.z = 0.08;
    this.headGroup.add(browL);

    const browR = new THREE.Mesh(browGeo, browMat);
    browR.position.set(0.065, 0.18, 0.20);
    browR.rotation.z = -0.08;
    this.headGroup.add(browR);

    // 4. Arms (Upper Arm with T-shirt Sleeve + Forearm with Skin + Rounded Hands)
    const createArm = (isLeft: boolean) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(isLeft ? -0.24 : 0.24, 0.44, 0);

      // Upper arm sleeve (shirt fabric)
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.18, 14), this.shirtMat);
      sleeve.position.set(0, -0.09, 0);
      armPivot.add(sleeve);

      // Forearm pivot (elbow joint)
      const forearmPivot = new THREE.Group();
      forearmPivot.position.set(0, -0.18, 0);

      // Bare forearm (skin tone)
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.18, 14), this.skinMat);
      forearm.position.set(0, -0.09, 0);
      forearmPivot.add(forearm);

      // Stylized rounded hand
      const handGeo = new THREE.SphereGeometry(0.05, 12, 12);
      handGeo.scale(1.0, 1.2, 0.7);
      const hand = new THREE.Mesh(handGeo, this.skinMat);
      hand.position.set(0, -0.21, 0.01);
      forearmPivot.add(hand);

      armPivot.add(forearmPivot);

      if (isLeft) this.leftForearmPivot = forearmPivot;
      else this.rightForearmPivot = forearmPivot;

      return armPivot;
    };

    this.leftArmPivot = createArm(true);
    this.rightArmPivot = createArm(false);
    this.hipsGroup.add(this.leftArmPivot);
    this.hipsGroup.add(this.rightArmPivot);

    // 5. Legs (Thighs + Knee Pivot + Shins + Modern Sneakers)
    const createLeg = (isLeft: boolean) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(isLeft ? -0.11 : 0.11, -0.09, 0);

      // Upper leg / thigh
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 14), this.pantsMat);
      thigh.position.set(0, -0.14, 0);
      legPivot.add(thigh);

      // Knee joint pivot
      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.28, 0);

      // Lower leg / shin (joggers cuff)
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.07, 0.24, 14), this.pantsMat);
      shin.position.set(0, -0.12, 0);
      kneePivot.add(shin);

      // Sneaker Upper (White athletic shoe)
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.25, 0.04);

      const shoeUpperGeo = new THREE.BoxGeometry(0.11, 0.08, 0.18);
      const shoeUpper = new THREE.Mesh(shoeUpperGeo, this.shoeMat);
      shoeGroup.add(shoeUpper);

      // Sneaker Rubber Sole (White/Grey trim)
      const soleGeo = new THREE.BoxGeometry(0.12, 0.03, 0.20);
      const soleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
      const sole = new THREE.Mesh(soleGeo, soleMat);
      sole.position.y = -0.045;
      shoeGroup.add(sole);

      kneePivot.add(shoeGroup);
      legPivot.add(kneePivot);

      if (isLeft) this.leftKneePivot = kneePivot;
      else this.rightKneePivot = kneePivot;

      return legPivot;
    };

    this.leftLegPivot = createLeg(true);
    this.rightLegPivot = createLeg(false);
    this.hipsGroup.add(this.leftLegPivot);
    this.hipsGroup.add(this.rightLegPivot);
  }

  // Floating Name Badge Sprite matching Image 1
  private buildNameBadge() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      this.drawNameBadgeCanvas(ctx, canvas.width, canvas.height);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });

    this.nameSprite = new THREE.Sprite(spriteMat);
    this.nameSprite.position.set(0, 1.85, 0); // Floats right above avatar's head
    this.nameSprite.scale.set(1.5, 0.38, 1);
    this.group.add(this.nameSprite);
  }

  private drawNameBadgeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);

    const pad = 12;
    const pillH = h - pad * 2;
    const pillW = w - pad * 2;
    const radius = pillH / 2;

    // Dark sleek glass pill background (matching micup badge in Image 1)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 12, 24, 0.88)';
    ctx.strokeStyle = this.isSpeaking ? '#22c55e' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = this.isSpeaking ? 5 : 2;

    ctx.beginPath();
    ctx.roundRect(pad, pad, pillW, pillH, radius);
    ctx.fill();
    ctx.stroke();

    // User Avatar Circle Icon on left
    const avatarX = pad + radius;
    const avatarY = pad + radius;
    const avatarR = radius - 10;

    // Circular gradient avatar badge
    const badgeColors = ['#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#6366f1'];
    const colIdx = Math.abs(this.displayName.charCodeAt(0)) % badgeColors.length;
    ctx.fillStyle = badgeColors[colIdx];
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fill();

    // User Initial
    const initial = (this.displayName || 'U').charAt(0).toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarX, avatarY);

    // User Display Name Text (Crisp bold typography)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textX = avatarX + avatarR + 18;
    const maxTextW = pillW - (textX - pad) - 20;

    let text = this.displayName;
    if (this.isLocal) text += ' (You)';
    ctx.fillText(text, textX, avatarY, maxTextW);

    ctx.restore();
  }

  public updateSpeaking(speaking: boolean) {
    if (this.isSpeaking === speaking) return;
    this.isSpeaking = speaking;
    if (this.nameSprite && this.nameSprite.material.map) {
      const canvas = (this.nameSprite.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this.drawNameBadgeCanvas(ctx, canvas.width, canvas.height);
        this.nameSprite.material.map.needsUpdate = true;
      }
    }
  }

  // 3D Floating Speech Bubble (When user chats in room)
  public showSpeechBubble(message: string) {
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    if (this.speechBubbleSprite) {
      this.group.remove(this.speechBubbleSprite);
      this.speechBubbleSprite = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw speech bubble
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 140, 24);
    ctx.fill();
    ctx.stroke();

    // Bubble pointer down
    ctx.beginPath();
    ctx.moveTo(236, 156);
    ctx.lineTo(256, 185);
    ctx.lineTo(276, 156);
    ctx.closePath();
    ctx.fill();

    // Message text
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 32px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message.slice(0, 32), 256, 86, 440);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    this.speechBubbleSprite = new THREE.Sprite(spriteMat);
    this.speechBubbleSprite.position.set(0, 2.35, 0);
    this.speechBubbleSprite.scale.set(1.8, 0.7, 1);
    this.group.add(this.speechBubbleSprite);

    this.speechTimeout = setTimeout(() => {
      if (this.speechBubbleSprite) {
        this.group.remove(this.speechBubbleSprite);
        this.speechBubbleSprite = null;
      }
    }, 4000);
  }

  // 3D Floating Animated Emoji Reaction (spawns when emoji clicked)
  public spawnFloatingEmoji(emoji: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = '84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set((Math.random() - 0.5) * 0.4, 1.9, (Math.random() - 0.5) * 0.4);
    sprite.scale.set(0.45, 0.45, 1);
    this.group.add(sprite);

    this.floatingEmojis.push({
      mesh: sprite,
      time: 0,
      speed: 1.2 + Math.random() * 0.4,
    });
  }

  public setSitting(isSitting: boolean, lookAtTarget?: THREE.Vector3) {
    this.isSitting = isSitting;
    this.isMoving = false;
    this.currentEmote = null;

    if (isSitting) {
      // Natural sitting pose: Lower hips onto seat cushion
      this.hipsGroup.position.set(0, 0.40, 0);

      // Thighs project horizontally forward (90 deg flexion)
      this.leftLegPivot.rotation.x = -Math.PI / 2 + 0.1;
      this.rightLegPivot.rotation.x = -Math.PI / 2 + 0.1;

      // Knees bend 90 deg down towards floor
      this.leftKneePivot.rotation.x = Math.PI / 2;
      this.rightKneePivot.rotation.x = Math.PI / 2;

      // Arms rest naturally on thighs / lap
      this.leftArmPivot.rotation.x = -0.4;
      this.rightArmPivot.rotation.x = -0.4;
      this.leftForearmPivot.rotation.x = -0.4;
      this.rightForearmPivot.rotation.x = -0.4;

      // Orient avatar toward TV screen or conversation table
      if (lookAtTarget) {
        const flatTarget = new THREE.Vector3(lookAtTarget.x, this.group.position.y, lookAtTarget.z);
        this.group.lookAt(flatTarget);
      }
    } else {
      // Reset standing pose
      this.hipsGroup.position.set(0, 0.72, 0);
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      this.leftKneePivot.rotation.set(0, 0, 0);
      this.rightKneePivot.rotation.set(0, 0, 0);
      this.leftArmPivot.rotation.set(0, 0, 0);
      this.rightArmPivot.rotation.set(0, 0, 0);
      this.leftForearmPivot.rotation.set(0, 0, 0);
      this.rightForearmPivot.rotation.set(0, 0, 0);
    }
  }

  public playEmote(emote: string) {
    this.currentEmote = emote;
    this.emoteTimer = 0;
  }

  public update(delta: number) {
    this.animTimer += delta;

    // Update floating emojis
    for (let i = this.floatingEmojis.length - 1; i >= 0; i--) {
      const item = this.floatingEmojis[i];
      item.time += delta;
      item.mesh.position.y += item.speed * delta;
      item.mesh.position.x += Math.sin(item.time * 6) * 0.01;
      item.mesh.material.opacity = Math.max(0, 1.0 - item.time / 2.2);

      if (item.time >= 2.2) {
        this.group.remove(item.mesh);
        this.floatingEmojis.splice(i, 1);
      }
    }

    // 1. Sitting animation: Subtle idle breathing while seated
    if (this.isSitting) {
      const breath = Math.sin(this.animTimer * 2.5) * 0.02;
      this.torsoMesh.scale.set(1.0 + breath, 1.0, 1.0 + breath);
      this.headGroup.rotation.y = Math.sin(this.animTimer * 0.8) * 0.08; // Gentle glances
      return;
    }

    // 2. Emote Animations (Wave, Dance, Slap, Point, Wrestle, Cheers, Laugh)
    if (this.currentEmote) {
      this.emoteTimer += delta;
      const t = this.emoteTimer;

      if (this.currentEmote === 'Wave') {
        // Raise right arm up high and wave hand back and forth!
        this.rightArmPivot.rotation.z = -2.4;
        this.rightArmPivot.rotation.x = -0.3;
        this.rightForearmPivot.rotation.z = Math.sin(t * 12) * 0.5 - 0.2;
        this.leftArmPivot.rotation.set(0, 0, 0);
        this.headGroup.rotation.z = -0.1;
      } else if (this.currentEmote === 'Dance') {
        // Bouncy rhythmic dance moves!
        this.hipsGroup.position.y = 0.72 + Math.abs(Math.sin(t * 8)) * 0.08;
        this.hipsGroup.rotation.y = Math.sin(t * 8) * 0.35;
        this.hipsGroup.rotation.z = Math.sin(t * 4) * 0.15;
        this.leftArmPivot.rotation.x = Math.sin(t * 8) * 0.8 - 0.4;
        this.rightArmPivot.rotation.x = -Math.sin(t * 8) * 0.8 - 0.4;
        this.leftArmPivot.rotation.z = 0.6;
        this.rightArmPivot.rotation.z = -0.6;
        this.headGroup.rotation.z = Math.sin(t * 8) * 0.2;
      } else if (this.currentEmote === 'Slap') {
        // Energetic horizontal slap swing!
        if (t < 0.2) {
          this.rightArmPivot.rotation.y = 1.2;
          this.rightArmPivot.rotation.z = -0.6;
        } else if (t < 0.6) {
          this.rightArmPivot.rotation.y = -1.6;
          this.rightArmPivot.rotation.z = -0.4;
        } else {
          this.rightArmPivot.rotation.set(0, 0, 0);
        }
      } else if (this.currentEmote === 'Point') {
        // Direct arm forward pointing
        this.rightArmPivot.rotation.x = -Math.PI / 2;
        this.rightArmPivot.rotation.y = 0.1;
        this.rightForearmPivot.rotation.x = 0;
      } else if (this.currentEmote === 'Wrestle' || this.currentEmote === 'Cheers') {
        // Triumphantly pump both arms in the air!
        this.leftArmPivot.rotation.z = 2.4;
        this.rightArmPivot.rotation.z = -2.4;
        this.leftArmPivot.rotation.x = -0.2;
        this.rightArmPivot.rotation.x = -0.2;
        this.hipsGroup.position.y = 0.72 + Math.abs(Math.sin(t * 10)) * 0.09;
      } else if (this.currentEmote === 'Laugh') {
        // Chuckling with head tilted back
        this.headGroup.rotation.x = -0.3 + Math.sin(t * 14) * 0.1;
        this.torsoMesh.scale.y = 1.0 + Math.sin(t * 14) * 0.04;
        this.rightArmPivot.rotation.x = -0.5;
        this.leftArmPivot.rotation.x = -0.5;
      }

      if (this.emoteTimer > 3.2) {
        this.currentEmote = null;
        this.setSitting(false);
      }
      return;
    }

    // 3. Walk Cycle Animation (Smooth natural walking motion)
    if (this.isMoving) {
      const walkSpeed = 9.0;
      const walkCycle = this.animTimer * walkSpeed;

      // Natural arm swing
      const armSwing = Math.sin(walkCycle) * 0.7;
      this.leftArmPivot.rotation.x = armSwing;
      this.rightArmPivot.rotation.x = -armSwing;
      this.leftArmPivot.rotation.z = 0.05;
      this.rightArmPivot.rotation.z = -0.05;

      // Leg stride & knee flexion
      const legStride = Math.sin(walkCycle) * 0.65;
      this.leftLegPivot.rotation.x = -legStride;
      this.rightLegPivot.rotation.x = legStride;

      // Dynamic knee bends on backstroke
      this.leftKneePivot.rotation.x = Math.max(0, -legStride * 0.8);
      this.rightKneePivot.rotation.x = Math.max(0, legStride * 0.8);

      // Vertical body bounce (natural bobbing)
      this.hipsGroup.position.y = 0.72 + Math.abs(Math.sin(walkCycle * 2)) * 0.04;
      this.headGroup.rotation.y = Math.sin(walkCycle) * 0.04;
    } else {
      // 4. Idle Breathing
      const breath = Math.sin(this.animTimer * 2.2) * 0.015;
      this.hipsGroup.position.y = 0.72 + breath;
      this.torsoMesh.scale.set(1.0 + breath * 0.5, 1.0, 1.0 + breath * 0.5);

      // Relax limbs
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, 0, 10 * delta);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, 0, 10 * delta);
      this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, 0, 10 * delta);
      this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0, 10 * delta);
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, 10 * delta);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, 10 * delta);
      this.leftKneePivot.rotation.x = THREE.MathUtils.lerp(this.leftKneePivot.rotation.x, 0, 10 * delta);
      this.rightKneePivot.rotation.x = THREE.MathUtils.lerp(this.rightKneePivot.rotation.x, 0, 10 * delta);
    }
  }

  public dispose() {
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    this.group.clear();
  }
}
