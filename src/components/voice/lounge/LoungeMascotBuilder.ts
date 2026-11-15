import * as THREE from 'three';

export type MascotType = 'corgi' | 'bear' | 'shiba' | 'bunny' | 'cat';

export interface MascotConfig {
  type: MascotType;
  name: string;
  primaryColor: number;
  secondaryColor: number;
  outfitColor: number;
  headsetColor: number;
  description: string;
}

export const MASCOT_PRESETS: Record<MascotType, MascotConfig> = {
  corgi: {
    type: 'corgi',
    name: 'Corgi Gamer',
    primaryColor: 0xe59846, // Warm golden corgi
    secondaryColor: 0xffffff, // White muzzle & chest
    outfitColor: 0x3b82f6, // Bright cyan-blue
    headsetColor: 0x06b6d4, // Cyan neon headset
    description: 'Chubby golden puppy with gamer headset & wagging tail',
  },
  bear: {
    type: 'bear',
    name: 'Teddy Bear',
    primaryColor: 0x935b33, // Warm teddy brown
    secondaryColor: 0xd4a373, // Cream muzzle & belly
    outfitColor: 0xef4444, // Red snapback cap
    headsetColor: 0xec4899, // Pink neon headset
    description: 'Fluffy brown bear wearing a backward snapback cap',
  },
  shiba: {
    type: 'shiba',
    name: 'Shiba Inu',
    primaryColor: 0xec9a42, // Shiba orange
    secondaryColor: 0xffffff, // Cream cheeks
    outfitColor: 0xc084fc, // Lavender pastel hoodie
    headsetColor: 0xa855f7, // Purple headset
    description: 'Happy chubby Shiba in a cozy pastel hoodie',
  },
  bunny: {
    type: 'bunny',
    name: 'Fluffy Bunny',
    primaryColor: 0xf8fafc, // Snow white fur
    secondaryColor: 0xfda4af, // Soft pink inner ear
    outfitColor: 0x1e3a8a, // Navy varsity jacket
    headsetColor: 0x10b981, // Mint green headset
    description: 'Round white bunny with floppy ears & varsity jacket',
  },
  cat: {
    type: 'cat',
    name: 'Neon Kitty',
    primaryColor: 0x334155, // Midnight slate
    secondaryColor: 0xf472b6, // Soft neon pink
    outfitColor: 0x8b5cf6, // Violet cyberpunk vest
    headsetColor: 0xd946ef, // Glowing cat-ear headset
    description: 'Cool cyber cat with glowing cat-ear headphones',
  },
};

export class LoungeMascotBuilder {
  /**
   * Attaches Party Animals style mascot ears, hats, headsets and tails
   * to an avatar's rigged model.
   */
  public static attachMascotFeatures(
    model: THREE.Object3D,
    config: MascotConfig
  ): { accessoriesGroup: THREE.Group; update: (time: number, isMoving: boolean) => void } {
    const accessoriesGroup = new THREE.Group();
    accessoriesGroup.name = 'MascotAccessories';

    // Find Head & Hips bones if rigged, otherwise fallback to root
    let headBone: THREE.Object3D = model;
    let hipsBone: THREE.Object3D = model;

    model.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes('head')) headBone = child;
      if (name.includes('hips') || name.includes('pelvis')) hipsBone = child;
    });

    const clayMat = (color: number, roughness = 0.65) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: 0.05,
      });

    const glowMat = (color: number) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });

    // --- 1. HEADWEAR & EARS ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0); // Position at top of head

    // Gamer Over-Ear Headset (Shared base across gamer animals)
    const headsetGroup = new THREE.Group();
    const headbandGeo = new THREE.TorusGeometry(0.24, 0.025, 12, 24, Math.PI);
    headbandGeo.rotateX(Math.PI / 2);
    headbandGeo.rotateZ(Math.PI / 2);
    const headband = new THREE.Mesh(headbandGeo, clayMat(0x1e293b, 0.4));
    headsetGroup.add(headband);

    // Left Ear Cup
    const cupGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16);
    cupGeo.rotateZ(Math.PI / 2);
    const leftCup = new THREE.Mesh(cupGeo, clayMat(config.headsetColor));
    leftCup.position.set(-0.24, 0, 0);
    const leftGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.012, 8, 16),
      glowMat(config.headsetColor)
    );
    leftGlowRing.rotateY(Math.PI / 2);
    leftCup.add(leftGlowRing);
    headsetGroup.add(leftCup);

    // Right Ear Cup + Mic Boom
    const rightCup = leftCup.clone();
    rightCup.position.set(0.24, 0, 0);
    rightCup.rotation.y = Math.PI;

    // Mic boom arm curving toward mouth
    const micArmGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8);
    micArmGeo.rotateZ(Math.PI / 4);
    const micArm = new THREE.Mesh(micArmGeo, clayMat(0x0f172a));
    micArm.position.set(0.06, -0.06, 0.08);

    const micTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 10, 10),
      clayMat(config.headsetColor)
    );
    micTip.position.set(0.12, -0.12, 0.12);
    micArm.add(micTip);
    rightCup.add(micArm);
    headsetGroup.add(rightCup);

    // Attach Mascot Specific Ears & Accessories
    let tailMesh: THREE.Object3D | null = null;
    let leftEar: THREE.Object3D | null = null;
    let rightEar: THREE.Object3D | null = null;

    if (config.type === 'corgi' || config.type === 'shiba') {
      // Pointed fluffy puppy ears
      const earGeo = new THREE.ConeGeometry(0.1, 0.22, 12);
      earGeo.scale(1, 1, 0.5); // Flatten slightly
      const innerEarGeo = new THREE.ConeGeometry(0.07, 0.17, 12);
      innerEarGeo.scale(1, 1, 0.4);

      const earMat = clayMat(config.primaryColor);
      const innerMat = clayMat(0xfda4af); // Soft pink

      leftEar = new THREE.Mesh(earGeo, earMat);
      leftEar.position.set(-0.16, 0.14, 0);
      leftEar.rotation.z = 0.35;
      leftEar.rotation.x = -0.1;

      const leftInner = new THREE.Mesh(innerEarGeo, innerMat);
      leftInner.position.set(0, 0, 0.02);
      leftEar.add(leftInner);
      headGroup.add(leftEar);

      rightEar = new THREE.Mesh(earGeo, earMat);
      rightEar.position.set(0.16, 0.14, 0);
      rightEar.rotation.z = -0.35;
      rightEar.rotation.x = -0.1;

      const rightInner = new THREE.Mesh(innerEarGeo, innerMat);
      rightInner.position.set(0, 0, 0.02);
      rightEar.add(rightInner);
      headGroup.add(rightEar);

      headGroup.add(headsetGroup);

      // Cute stubby wagging corgi/shiba tail
      const tailGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.18, 12);
      tailGeo.rotateX(Math.PI / 3);
      tailMesh = new THREE.Mesh(tailGeo, earMat);
      tailMesh.position.set(0, 0.2, -0.22);
    } else if (config.type === 'bear') {
      // Round teddy bear ears
      const bearEarGeo = new THREE.SphereGeometry(0.1, 14, 14);
      bearEarGeo.scale(1, 1, 0.5);
      const bearEarMat = clayMat(config.primaryColor);

      leftEar = new THREE.Mesh(bearEarGeo, bearEarMat);
      leftEar.position.set(-0.2, 0.12, 0);
      headGroup.add(leftEar);

      rightEar = new THREE.Mesh(bearEarGeo, bearEarMat);
      rightEar.position.set(0.2, 0.12, 0);
      headGroup.add(rightEar);

      // Backward snapback cap
      const capGroup = new THREE.Group();
      const capDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        clayMat(config.outfitColor)
      );
      capDome.position.set(0, 0.02, 0);
      capGroup.add(capDome);

      // Brim facing backward
      const brimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16, 1, false, 0, Math.PI);
      brimGeo.rotateX(Math.PI / 2);
      brimGeo.scale(1, 1.4, 1);
      const brim = new THREE.Mesh(brimGeo, clayMat(0x1e293b));
      brim.position.set(0, 0.02, -0.18);
      capGroup.add(brim);

      headGroup.add(capGroup);
      headGroup.add(headsetGroup);

      // Round little bear tail
      tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), bearEarMat);
      tailMesh.position.set(0, 0.2, -0.2);
    } else if (config.type === 'bunny') {
      // Long floppy bunny ears
      const bunnyEarGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.38, 12);
      bunnyEarGeo.scale(1, 1, 0.4);
      const earMat = clayMat(config.primaryColor);
      const innerMat = clayMat(config.secondaryColor);

      leftEar = new THREE.Mesh(bunnyEarGeo, earMat);
      leftEar.position.set(-0.12, 0.24, 0);
      leftEar.rotation.z = -0.2;
      leftEar.rotation.x = -0.25;

      const innerLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.3, 10), innerMat);
      innerLeft.position.set(0, 0, 0.02);
      leftEar.add(innerLeft);
      headGroup.add(leftEar);

      rightEar = new THREE.Mesh(bunnyEarGeo, earMat);
      rightEar.position.set(0.12, 0.24, 0);
      rightEar.rotation.z = 0.2;
      rightEar.rotation.x = -0.25;

      const innerRight = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.3, 10), innerMat);
      innerRight.position.set(0, 0, 0.02);
      rightEar.add(innerRight);
      headGroup.add(rightEar);

      headGroup.add(headsetGroup);

      // Fluffy white cottontail puff
      tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), earMat);
      tailMesh.position.set(0, 0.2, -0.22);
    } else if (config.type === 'cat') {
      // Cyber Cat with Glowing Cat Ear Headset
      const catEarGeo = new THREE.ConeGeometry(0.11, 0.2, 10);
      catEarGeo.scale(1, 1, 0.5);

      leftEar = new THREE.Mesh(catEarGeo, clayMat(config.primaryColor));
      leftEar.position.set(-0.14, 0.16, 0);
      leftEar.rotation.z = 0.25;
      const leftNeon = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.14, 8),
        glowMat(config.secondaryColor)
      );
      leftNeon.position.set(0, 0, 0.02);
      leftEar.add(leftNeon);
      headGroup.add(leftEar);

      rightEar = new THREE.Mesh(catEarGeo, clayMat(config.primaryColor));
      rightEar.position.set(0.14, 0.16, 0);
      rightEar.rotation.z = -0.25;
      const rightNeon = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.14, 8),
        glowMat(config.secondaryColor)
      );
      rightNeon.position.set(0, 0, 0.02);
      rightEar.add(rightNeon);
      headGroup.add(rightEar);

      headGroup.add(headsetGroup);

      // Long curving cyber cat tail
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.2, -0.2),
        new THREE.Vector3(0, 0.32, -0.36),
        new THREE.Vector3(0.08, 0.48, -0.42),
        new THREE.Vector3(0.04, 0.6, -0.35),
      ]);
      const tailGeo = new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
      tailMesh = new THREE.Mesh(tailGeo, clayMat(config.primaryColor));
    }

    headBone.add(headGroup);

    if (tailMesh) {
      hipsBone.add(tailMesh);
    }

    accessoriesGroup.add(headGroup);

    // Animation update loop for floppy ear wiggle and tail wag
    const update = (time: number, isMoving: boolean) => {
      const wagSpeed = isMoving ? 14 : 4;
      const earSpeed = isMoving ? 8 : 2;

      // Tail wagging
      if (tailMesh) {
        tailMesh.rotation.y = Math.sin(time * wagSpeed) * 0.35;
      }

      // Ear bouncy wobble (squash & stretch sensation)
      if (leftEar && rightEar) {
        const bob = Math.sin(time * earSpeed) * 0.06;
        leftEar.rotation.x = -0.1 + bob;
        rightEar.rotation.x = -0.1 - bob;
      }
    };

    return { accessoriesGroup, update };
  }
}
