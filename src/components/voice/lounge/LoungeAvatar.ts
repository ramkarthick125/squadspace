import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LoungeAssetLoader } from './LoungeAssetLoader';
import { LoungeMascotBuilder, MascotType, MASCOT_PRESETS } from './LoungeMascotBuilder';

export interface AvatarOptions {
  userId: string;
  displayName: string;
  mascotType?: MascotType;
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
  public mascotType: MascotType = 'corgi';

  // Real 3D Skeletal Mesh & Animation Mixer
  private modelRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private currentActionName: string = 'Idle';
  private mascotUpdater: ((time: number, isMoving: boolean) => void) | null = null;
  private accessoriesGroup: THREE.Group | null = null;

  // Floating Name Badge & Overlays
  private nameSprite!: THREE.Sprite;
  private speechBubbleSprite: THREE.Sprite | null = null;
  private speechTimeout: ReturnType<typeof setTimeout> | null = null;

  // State
  public isMoving: boolean = false;
  public isSitting: boolean = false;
  public isRunning: boolean = false;
  public currentEmote: string | null = null;
  private emoteTimer: number = 0;
  public isSpeaking: boolean = false;

  // Floating animated reactions
  private floatingEmojis: Array<{ mesh: THREE.Sprite; time: number; speed: number }> = [];

  constructor(options: AvatarOptions) {
    this.userId = options.userId;
    this.displayName = options.displayName;
    this.isLocal = !!options.isLocal;
    this.mascotType = options.mascotType || 'corgi';

    this.buildNameBadge();
    this.load3DModel(options);
  }

  private async load3DModel(options: AvatarOptions) {
    try {
      const loader = LoungeAssetLoader.getInstance();
      const gltf = await loader.loadModel('/models/character.glb');

      // Clone rigged skeletal mesh using Three.js SkeletonUtils
      const model = SkeletonUtils.clone(gltf.scene);
      this.modelRoot = model;

      // Chubby stylized mascot proportions (slightly stockier, shorter, cute Party Animals look)
      model.scale.set(0.68, 0.62, 0.68);
      model.position.set(0, 0, 0);

      // Enable shadows and soft clay PBR shading
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Clone and configure materials for smooth matte clay feel
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const clonedMats = mats.map((m) => {
              const cm = (m as THREE.MeshStandardMaterial).clone();
              cm.roughness = 0.72; // Soft clay / silicone roughness
              cm.metalness = 0.04;
              return cm;
            });
            mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
          }
        }
      });

      this.group.add(model);

      // Set up real skeletal AnimationMixer
      this.mixer = new THREE.AnimationMixer(model);

      // Index available animations
      gltf.animations.forEach((clip) => {
        const action = this.mixer!.clipAction(clip);
        this.actions.set(clip.name, action);
      });

      // Start with Idle
      const idle = this.actions.get('Idle');
      if (idle) {
        idle.play();
        this.currentAction = idle;
        this.currentActionName = 'Idle';
      }

      // Attach Party Animals mascot ears, tail, headset, and accessories
      this.applyMascotAccessories(this.mascotType);

      // Apply initial outfit if customized
      if (options.shirtColor || options.pantsColor || options.hairColor || options.skinColor) {
        this.setOutfit(options.shirtColor, options.pantsColor, options.hairColor, options.skinColor);
      }
    } catch (err) {
      console.warn('[LoungeAvatar] Error loading 3D character model:', err);
    }
  }

  public applyMascotAccessories(type: MascotType) {
    if (!this.modelRoot) return;
    this.mascotType = type;
    const config = MASCOT_PRESETS[type] || MASCOT_PRESETS.corgi;

    // Remove existing accessories if any
    if (this.accessoriesGroup) {
      this.modelRoot.remove(this.accessoriesGroup);
      this.accessoriesGroup = null;
      this.mascotUpdater = null;
    }

    const { accessoriesGroup, update } = LoungeMascotBuilder.attachMascotFeatures(this.modelRoot, config);
    this.accessoriesGroup = accessoriesGroup;
    this.mascotUpdater = update;

    // Apply thematic colors to body and clothes
    this.modelRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            const name = (stdMat.name || '').toLowerCase();
            if (name.includes('skin') || name.includes('body')) {
              stdMat.color.set(config.primaryColor);
            } else if (name.includes('shirt')) {
              stdMat.color.set(config.outfitColor);
            } else if (name.includes('pants')) {
              stdMat.color.set(0x1e293b); // Dark stylish pants
            } else if (name.includes('face') || name.includes('hair')) {
              stdMat.color.set(config.secondaryColor);
            }
          }
        });
      }
    });
  }

  public setOutfit(shirt?: string | number, pants?: string | number, hair?: string | number, skin?: string | number) {
    if (!this.modelRoot) return;
    this.modelRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            const name = (stdMat.name || '').toLowerCase();
            if (shirt !== undefined && name.includes('shirt')) {
              stdMat.color.set(shirt);
            } else if (pants !== undefined && name.includes('pants')) {
              stdMat.color.set(pants);
            } else if (hair !== undefined && name.includes('hair')) {
              stdMat.color.set(hair);
            } else if (skin !== undefined && name.includes('skin')) {
              stdMat.color.set(skin);
            }
          }
        });
      }
    });
  }

  public playAnimation(name: string, transitionDuration: number = 0.25) {
    if (!this.mixer || this.currentActionName === name) return;

    let targetAction = this.actions.get(name);
    // Fallback mappings if exact name is different
    if (!targetAction && name === 'Wave') targetAction = this.actions.get('Victory');
    if (!targetAction && name === 'Dance') targetAction = this.actions.get('Victory');
    if (!targetAction && name === 'Slap') targetAction = this.actions.get('Punch');

    if (!targetAction) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(transitionDuration);
    }

    targetAction.reset();
    targetAction.fadeIn(transitionDuration);
    targetAction.play();

    this.currentAction = targetAction;
    this.currentActionName = name;
  }

  public setSitting(isSitting: boolean, lookAtTarget?: THREE.Vector3) {
    this.isSitting = isSitting;
    this.isMoving = false;
    this.currentEmote = null;

    if (isSitting) {
      // Play SitDown skeletal animation and clamp on seated pose
      const sitAction = this.actions.get('SitDown');
      if (sitAction) {
        if (this.currentAction) this.currentAction.fadeOut(0.2);
        sitAction.reset();
        sitAction.setLoop(THREE.LoopOnce, 1);
        sitAction.clampWhenFinished = true;
        sitAction.fadeIn(0.2).play();
        this.currentAction = sitAction;
        this.currentActionName = 'SitDown';
      }

      if (lookAtTarget) {
        const flatTarget = new THREE.Vector3(lookAtTarget.x, this.group.position.y, lookAtTarget.z);
        this.group.lookAt(flatTarget);
      }
    } else {
      // Stand back up
      const standAction = this.actions.get('StandUp');
      if (standAction) {
        if (this.currentAction) this.currentAction.fadeOut(0.15);
        standAction.reset();
        standAction.setLoop(THREE.LoopOnce, 1);
        standAction.fadeIn(0.15).play();
        this.currentAction = standAction;
        this.currentActionName = 'StandUp';

        // Transition back to Idle after standing up
        setTimeout(() => {
          if (!this.isSitting && !this.isMoving) {
            this.playAnimation('Idle', 0.25);
          }
        }, 500);
      } else {
        this.playAnimation('Idle', 0.2);
      }
    }
  }

  public playEmote(emote: string) {
    if (this.isSitting) {
      this.setSitting(false);
    }

    this.currentEmote = emote;
    this.emoteTimer = 0;

    if (emote === 'Wave') {
      const victoryAction = this.actions.get('Victory');
      if (victoryAction) {
        this.playAnimation('Victory', 0.2);
        victoryAction.setLoop(THREE.LoopOnce, 1);
      }
    } else if (emote === 'Dance' || emote === 'Cheers' || emote === 'Victory') {
      const victoryAction = this.actions.get('Victory');
      if (victoryAction) {
        this.playAnimation('Victory', 0.2);
        victoryAction.setLoop(THREE.LoopRepeat, 3);
      }
    } else if (emote === 'Slap' || emote === 'Punch') {
      const punchAction = this.actions.get('Punch');
      if (punchAction) {
        this.playAnimation('Punch', 0.15);
        punchAction.setLoop(THREE.LoopOnce, 1);
      }
    } else if (emote === 'Point') {
      const pointAction = this.actions.get('Shoot_OneHanded');
      if (pointAction) {
        this.playAnimation('Shoot_OneHanded', 0.15);
        pointAction.setLoop(THREE.LoopOnce, 1);
      }
    } else if (emote === 'Wrestle') {
      const rollAction = this.actions.get('Roll');
      if (rollAction) {
        this.playAnimation('Roll', 0.15);
        rollAction.setLoop(THREE.LoopOnce, 1);
      }
    } else if (emote === 'Jump') {
      const jumpAction = this.actions.get('Jump');
      if (jumpAction) {
        this.playAnimation('Jump', 0.15);
        jumpAction.setLoop(THREE.LoopOnce, 1);
      }
    }
  }

  // Floating Name Badge Sprite
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
    this.nameSprite.position.set(0, 1.95, 0);
    this.nameSprite.scale.set(1.4, 0.35, 1);
    this.group.add(this.nameSprite);
  }

  private drawNameBadgeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);

    const pad = 12;
    const pillH = h - pad * 2;
    const pillW = w - pad * 2;
    const radius = pillH / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 12, 24, 0.88)';
    ctx.strokeStyle = this.isSpeaking ? '#22c55e' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = this.isSpeaking ? 5 : 2;

    ctx.beginPath();
    ctx.roundRect(pad, pad, pillW, pillH, radius);
    ctx.fill();
    ctx.stroke();

    const avatarX = pad + radius;
    const avatarY = pad + radius;
    const avatarR = radius - 10;

    const badgeColors = ['#a855f7', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#6366f1'];
    const colIdx = Math.abs(this.displayName.charCodeAt(0)) % badgeColors.length;
    ctx.fillStyle = badgeColors[colIdx];
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fill();

    const initial = (this.displayName || 'U').charAt(0).toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarX, avatarY);

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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 140, 24);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(236, 156);
    ctx.lineTo(256, 185);
    ctx.lineTo(276, 156);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 32px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message.slice(0, 32), 256, 86, 440);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    this.speechBubbleSprite = new THREE.Sprite(spriteMat);
    this.speechBubbleSprite.position.set(0, 2.45, 0);
    this.speechBubbleSprite.scale.set(1.8, 0.7, 1);
    this.group.add(this.speechBubbleSprite);

    this.speechTimeout = setTimeout(() => {
      if (this.speechBubbleSprite) {
        this.group.remove(this.speechBubbleSprite);
        this.speechBubbleSprite = null;
      }
    }, 4000);
  }

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
    sprite.position.set((Math.random() - 0.5) * 0.4, 2.0, (Math.random() - 0.5) * 0.4);
    sprite.scale.set(0.45, 0.45, 1);
    this.group.add(sprite);

    this.floatingEmojis.push({
      mesh: sprite,
      time: 0,
      speed: 1.2 + Math.random() * 0.4,
    });
  }

  public setSpeaking(isSpeaking: boolean) {
    if (this.isSpeaking !== isSpeaking) {
      this.isSpeaking = isSpeaking;
      if (this.nameSprite && this.nameSprite.material.map) {
        const texture = this.nameSprite.material.map as THREE.CanvasTexture;
        const canvas = texture.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          this.drawNameBadgeCanvas(ctx, canvas.width, canvas.height);
          texture.needsUpdate = true;
        }
      }
    }
  }

  public update(delta: number) {
    // 1. Advance real skeletal animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 2. Animate mascot accessories (floppy ear wiggles and tail wags!)
    if (this.mascotUpdater) {
      this.mascotUpdater(Date.now() * 0.001, this.isMoving);
    }

    // 2. Handle active emotes timeout
    if (this.currentEmote) {
      this.emoteTimer += delta;
      if (this.emoteTimer > 3.0) {
        this.currentEmote = null;
        if (!this.isSitting) {
          this.playAnimation(this.isMoving ? (this.isRunning ? 'Run' : 'Walk') : 'Idle', 0.25);
        }
      }
    }

    // 3. Update floating emojis
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
  }

  public dispose() {
    if (this.speechTimeout) clearTimeout(this.speechTimeout);
    if (this.mixer) this.mixer.stopAllAction();
    this.group.clear();
  }
}
