import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LoungeAssetLoader } from './LoungeAssetLoader';

export class LoungeScene {
  public scene: THREE.Scene;
  public tvMesh!: THREE.Mesh;
  public roomGroup: THREE.Group = new THREE.Group();
  public furnitureGroup: THREE.Group = new THREE.Group();
  public tvScreenLight!: THREE.PointLight;
  private moonLight!: THREE.PointLight;
  private platformLight!: THREE.PointLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0917);
    this.scene.fog = new THREE.FogExp2(0x0e0917, 0.015);

    this.scene.add(this.roomGroup);
    this.scene.add(this.furnitureGroup);

    this.buildLighting();
    this.buildRoomShell();
    this.buildSkylineWindow();
    this.buildNeonMoon();
    this.buildTVUnit();
    this.buildBeanbagPlatform();
    this.buildGamingTableBooth();
    this.buildFurniture();
    this.load3DAssets();
  }

  private buildLighting() {
    // 1. Moody Violet Ambient Light
    const ambientLight = new THREE.AmbientLight(0x382250, 1.85);
    this.scene.add(ambientLight);

    // 2. Ceiling Warm Fill Light
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.35);
    dirLight.position.set(-2, 9, 3);
    this.scene.add(dirLight);

    // 3. Neon Crescent Moon Light (Back Wall)
    this.moonLight = new THREE.PointLight(0xff2a85, 2.6, 9, 1.2);
    this.moonLight.position.set(-1.2, 3.65, -5.8);
    this.scene.add(this.moonLight);

    // 4. TV Screen Glow Light (TV on the LEFT wall X = -7.28)
    this.tvScreenLight = new THREE.PointLight(0x818cf8, 2.2, 11, 1.3);
    this.tvScreenLight.position.set(-5.6, 2.4, -0.6);
    this.scene.add(this.tvScreenLight);

    // 5. Tripod Floor Lamp Light (Warm golden glow next to TV)
    const lampLight = new THREE.PointLight(0xfef08a, 2.0, 7, 1.3);
    lampLight.position.set(-6.2, 2.0, 2.2);
    this.scene.add(lampLight);

    // 6. Red Rug Candle / Lantern Light
    const candleLight = new THREE.PointLight(0xf59e0b, 1.8, 5, 1.5);
    candleLight.position.set(0.6, 0.55, 4.2);
    this.scene.add(candleLight);

    // 7. Beanbag Platform Warm Golden Underglow Light Strip
    this.platformLight = new THREE.PointLight(0xf59e0b, 1.9, 6, 1.4);
    this.platformLight.position.set(5.2, 0.4, 0);
    this.scene.add(this.platformLight);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm honey-walnut horizontal wood planks (matching user reference)
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(0, 0, 1024, 1024);

      const plankH = 40;
      const plankW = 256;
      ctx.strokeStyle = '#2b170c';
      ctx.lineWidth = 3;

      for (let y = 0; y < 1024; y += plankH) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();

        const offset = (Math.floor(y / plankH) % 2) * (plankW / 2);
        for (let x = offset; x < 1024; x += plankW) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + plankH);
          ctx.stroke();

          const rand = Math.sin(x * 12.9898 + y * 78.233);
          const val = Math.floor((rand + 1) * 14);
          ctx.fillStyle = `rgba(${110 + val * 2}, ${72 + val}, ${46 + val / 2}, 0.28)`;
          ctx.fillRect(x, y, plankW, plankH);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildRoomShell() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(16, 15);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.45,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    // Deep Plum / Velvet Violet Walls (matching reference screenshot)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x24152e,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Left Wall (Cinema TV Wall)
    const leftWallGeo = new THREE.PlaneGeometry(15, 5.6);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-7.5, 2.8, 0);
    this.roomGroup.add(leftWall);

    // Back Wall (Neon Moon & Table 1 Booth Wall)
    const backWallGeo = new THREE.PlaneGeometry(16, 5.6);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.8, -6.5);
    this.roomGroup.add(backWall);

    // Right Wall (Panoramic City Window Wall)
    const rightWallGeo = new THREE.PlaneGeometry(15, 5.6);
    rightWallGeo.rotateY(-Math.PI / 2);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(7.5, 2.8, 0);
    this.roomGroup.add(rightWall);

    // Dark Walnut Baseboard Trim & Horizontal Divider Molding
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f0b18, roughness: 0.4 });
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.08), trimMat);
    trimBack.position.set(0, 0.08, -6.46);
    this.roomGroup.add(trimBack);

    const railBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.06), trimMat);
    railBack.position.set(0, 2.0, -6.47);
    this.roomGroup.add(railBack);

    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 15), trimMat);
    trimLeft.position.set(-7.46, 0.08, 0);
    this.roomGroup.add(trimLeft);

    const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 15), trimMat);
    railLeft.position.set(-7.47, 2.0, 0);
    this.roomGroup.add(railLeft);
  }

  // Giant Night City Skyline Panoramic Window on the RIGHT wall (Image 2)
  private buildSkylineWindow() {
    const windowGroup = new THREE.Group();
    windowGroup.position.set(7.35, 2.7, 0);

    // High-Resolution Procedural Night City Skyline Canvas
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 2048;
    skyCanvas.height = 1024;
    const ctx = skyCanvas.getContext('2d');
    if (ctx) {
      // 1. Midnight Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 1024);
      grad.addColorStop(0, '#030510');
      grad.addColorStop(0.35, '#070c20');
      grad.addColorStop(0.7, '#0d1636');
      grad.addColorStop(1, '#151d45');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2048, 1024);

      // 2. Distant Twinkling Stars
      for (let i = 0; i < 180; i++) {
        const sx = (i * 137.5) % 2048;
        const sy = (i * 73.1) % 450;
        const sr = ((i % 3) + 1) * 0.7;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(199, 210, 254, 0.65)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Layer 1: Distant City Silhouette
      ctx.fillStyle = '#060a1a';
      for (let bx = 0; bx < 2048; bx += 70) {
        const bh = 220 + ((bx * 31) % 200);
        ctx.fillRect(bx, 1024 - bh, 65, bh);
      }

      // 4. Layer 2: Middle-Ground High-Rise Skyscraper Towers with Lit Windows
      const buildings = [
        { x: 30, w: 90, h: 620 },
        { x: 130, w: 110, h: 720 },
        { x: 250, w: 85, h: 540 },
        { x: 345, w: 125, h: 810 },
        { x: 480, w: 95, h: 600 },
        { x: 585, w: 140, h: 750 },
        { x: 735, w: 100, h: 880 }, // Spire tower
        { x: 845, w: 120, h: 670 },
        { x: 975, w: 135, h: 780 },
        { x: 1120, w: 90, h: 590 },
        { x: 1220, w: 130, h: 840 },
        { x: 1360, w: 105, h: 650 },
        { x: 1475, w: 140, h: 770 },
        { x: 1625, w: 95, h: 580 },
        { x: 1730, w: 130, h: 730 },
        { x: 1870, w: 110, h: 630 },
      ];

      buildings.forEach((b, idx) => {
        // Skyscraper body
        ctx.fillStyle = idx % 2 === 0 ? '#0b1228' : '#080e22';
        ctx.fillRect(b.x, 1024 - b.h, b.w, b.h);

        // Tower Roof Details & Antenna Spire
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(b.x + b.w / 2 - 12, 1024 - b.h - 22, 24, 22);

        if (idx % 3 === 0) {
          // Red glowing aircraft beacon antenna
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.x + b.w / 2, 1024 - b.h - 22);
          ctx.lineTo(b.x + b.w / 2, 1024 - b.h - 55);
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(b.x + b.w / 2, 1024 - b.h - 55, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Office & Apartment Windows Grid
        const winCols = Math.floor(b.w / 14);
        const winRows = Math.floor((b.h - 40) / 20);

        for (let r = 0; r < winRows; r++) {
          for (let c = 0; c < winCols; c++) {
            const seed = (b.x * 17 + r * 31 + c * 47) % 100;
            if (seed > 40) {
              // Lit window colors: warm yellow, cyan, warm white
              if (seed > 85) ctx.fillStyle = '#fef08a'; // bright yellow
              else if (seed > 70) ctx.fillStyle = '#67e8f9'; // cyan
              else if (seed > 55) ctx.fillStyle = '#fef9c3'; // warm white
              else ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';

              ctx.fillRect(b.x + 8 + c * 13, 1024 - b.h + 20 + r * 19, 7, 10);
            }
          }
        }
      });
    }

    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    skyTexture.colorSpace = THREE.SRGBColorSpace;

    // Window Backdrop Plane (facing -X into the room)
    const skyGeo = new THREE.PlaneGeometry(9.6, 4.0);
    skyGeo.rotateY(-Math.PI / 2);
    const skyMesh = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ map: skyTexture })
    );
    skyMesh.position.set(0.04, 0, 0);
    windowGroup.add(skyMesh);

    // Architectural Window Frame & Mullions (Dark Matte Charcoal)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: 0.35, metalness: 0.6 });

    // Outer Border
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 9.7), frameMat);
    topBar.position.set(-0.02, 2.0, 0);
    windowGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 9.7), frameMat);
    bottomBar.position.set(-0.02, -2.0, 0);
    windowGroup.add(bottomBar);

    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.1, 0.14), frameMat);
    leftBar.position.set(-0.02, 0, -4.85);
    windowGroup.add(leftBar);

    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.1, 0.14), frameMat);
    rightBar.position.set(-0.02, 0, 4.85);
    windowGroup.add(rightBar);

    // Vertical Divider Mullions (3 vertical dividers matching Image 2)
    for (let mz = -2.4; mz <= 2.5; mz += 2.4) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.0, 0.08), frameMat);
      mullion.position.set(-0.01, 0, mz);
      windowGroup.add(mullion);
    }

    // Horizontal Transom Bar
    const transom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 9.6), frameMat);
    transom.position.set(-0.01, 0.85, 0);
    windowGroup.add(transom);

    this.roomGroup.add(windowGroup);
  }

  // Glowing Neon Pink Crescent Moon on Back Wall (Image 2)
  private buildNeonMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-1.2, 3.65, -6.4);

    const moonShape = new THREE.Shape();
    moonShape.absarc(0, 0, 0.48, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0.18, 0.09, 0.40, 0, Math.PI * 2, true);
    moonShape.holes.push(holePath);

    const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
    const moonGeo = new THREE.ExtrudeGeometry(moonShape, extrudeSettings);

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xff3b77,
      emissive: 0xff2a85,
      emissiveIntensity: 3.2,
      roughness: 0.1,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = 0.25;
    moonGroup.add(moonMesh);

    // Two Framed Modern Art Posters (Image 2)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc89d6c, roughness: 0.4 });
    const createPoster = (x: number, y: number, color1: string, color2: string) => {
      const posterGroup = new THREE.Group();
      posterGroup.position.set(x, y, -6.42);

      // Frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.04), frameMat);
      posterGroup.add(frame);

      // Canvas Art
      const artCanvas = document.createElement('canvas');
      artCanvas.width = 256;
      artCanvas.height = 340;
      const actx = artCanvas.getContext('2d');
      if (actx) {
        actx.fillStyle = '#f8fafc';
        actx.fillRect(0, 0, 256, 340);

        actx.fillStyle = color1;
        actx.beginPath();
        actx.arc(128, 130, 70, 0, Math.PI * 2);
        actx.fill();

        actx.fillStyle = color2;
        actx.beginPath();
        actx.arc(128, 220, 50, 0, Math.PI * 2);
        actx.fill();
      }

      const artMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.64, 0.87),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(artCanvas) })
      );
      artMesh.position.set(0, 0, 0.022);
      posterGroup.add(artMesh);

      return posterGroup;
    };

    this.roomGroup.add(moonGroup);
    this.roomGroup.add(createPoster(0.8, 3.2, '#f97316', '#3b82f6'));
    this.roomGroup.add(createPoster(2.1, 3.2, '#10b981', '#a855f7'));
  }

  // Cinema TV on the LEFT Wall (Image 2)
  private buildTVUnit() {
    const tvGroup = new THREE.Group();

    const tvWidth = 5.6;
    const tvHeight = 3.2;

    // 1. TV Screen Mesh (Left wall at X = -7.32, facing +X into room)
    const tvScreenGeo = new THREE.PlaneGeometry(tvWidth, tvHeight);
    const uvAttr = tvScreenGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;
    tvScreenGeo.rotateY(Math.PI / 2);
    tvScreenGeo.computeVertexNormals();

    const tvMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05,
      side: THREE.FrontSide,
    });

    this.tvMesh = new THREE.Mesh(tvScreenGeo, tvMat);
    this.tvMesh.position.set(-7.32, 2.5, -0.6);
    tvGroup.add(this.tvMesh);

    // 2. Sleek TV Bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x09090e, metalness: 0.85, roughness: 0.25 });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, tvHeight + 0.16, tvWidth + 0.16),
      bezelMat
    );
    bezel.position.set(-7.40, 2.5, -0.6);
    tvGroup.add(bezel);

    // 3. LED Purple/Blue Underglow Strip
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, tvWidth), ledMat);
    ledStrip.position.set(-7.28, 0.82, -0.6);
    tvGroup.add(ledStrip);

    // 4. Low Modern Media Console Underneath TV
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 0.4 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 5.8), shelfMat);
    shelf.position.set(-6.95, 0.22, -0.6);
    tvGroup.add(shelf);

    for (let cz = -2.7; cz <= 1.8; cz += 1.1) {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(0.70, 0.40, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.4 })
      );
      divider.position.set(-6.95, 0.22, cz);
      tvGroup.add(divider);
    }

    // Modern White Gamepad Controller
    const padBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 })
    );
    padBody.position.set(-6.78, 0.46, -1.8);
    tvGroup.add(padBody);

    // Soundbar
    const soundbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.08, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 })
    );
    soundbar.position.set(-6.75, 0.48, -0.6);
    tvGroup.add(soundbar);

    // Potted Flower on Console
    const flowerPotGroup = new THREE.Group();
    flowerPotGroup.position.set(-6.75, 0.44, 1.2);

    const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.6 });
    const fPot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 16), terracottaMat);
    fPot.position.y = 0.06;
    flowerPotGroup.add(fPot);

    const fStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a })
    );
    fStem.position.y = 0.16;
    flowerPotGroup.add(fStem);

    const fBlossom = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
    );
    fBlossom.position.y = 0.22;
    flowerPotGroup.add(fBlossom);
    tvGroup.add(flowerPotGroup);

    this.roomGroup.add(tvGroup);
  }

  // Raised Wooden Platform with 5 Colorful Beanbags along the Right Window (Image 2)
  private buildBeanbagPlatform() {
    const platformGroup = new THREE.Group();

    // 1. Elevated Wooden Stage / Riser
    const platformGeo = new THREE.BoxGeometry(2.3, 0.28, 8.8);
    const platformMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.4,
      metalness: 0.08,
    });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.position.set(6.25, 0.14, 0);
    platformMesh.receiveShadow = true;
    platformGroup.add(platformMesh);

    // 2. Warm Golden LED Under-Step Light Strip (Image 2)
    const stepLedMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const stepLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 8.8), stepLedMat);
    stepLed.position.set(5.08, 0.02, 0);
    platformGroup.add(stepLed);

    // 3. 5 Plush Colorful Beanbags (Image 2: Purple, Yellow/Gold, Cyan, Red, Violet)
    const beanbagColors = [
      { color: 0x7c3aed, z: -3.2 }, // Purple
      { color: 0xf59e0b, z: -1.6 }, // Warm Gold
      { color: 0x06b6d4, z: 0.0 },  // Turquoise/Cyan
      { color: 0xef4444, z: 1.6 },  // Coral Red
      { color: 0x8b5cf6, z: 3.2 },  // Violet
    ];

    beanbagColors.forEach((b) => {
      const beanbag = new THREE.Group();
      beanbag.position.set(6.25, 0.28, b.z);

      // Squashed soft beanbag body
      const bodyGeo = new THREE.SphereGeometry(0.52, 28, 20);
      bodyGeo.scale(1.15, 0.72, 1.15);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.85,
        metalness: 0.02,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.28;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      beanbag.add(bodyMesh);

      // Top fabric handle tab
      const tabGeo = new THREE.BoxGeometry(0.04, 0.08, 0.14);
      const tabMesh = new THREE.Mesh(tabGeo, bodyMat);
      tabMesh.position.y = 0.58;
      beanbag.add(tabMesh);

      platformGroup.add(beanbag);
    });

    this.roomGroup.add(platformGroup);
  }

  // Gaming Table Corner Booth: "Table 1 Free" + Green Table (Image 2)
  private buildGamingTableBooth() {
    const boothGroup = new THREE.Group();
    boothGroup.position.set(-4.0, 0, -4.2);

    // 1. Square Emerald Green / Walnut Game Table
    const tableTopGeo = new THREE.BoxGeometry(1.6, 0.08, 1.6);
    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.5, metalness: 0.1 });
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
    tableTop.position.y = 0.68;
    tableTop.castShadow = true;
    boothGroup.add(tableTop);

    // Wood Trim
    const trimGeo = new THREE.BoxGeometry(1.66, 0.06, 0.06);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f1d0b, roughness: 0.4 });
    const tNorth = new THREE.Mesh(trimGeo, woodMat);
    tNorth.position.set(0, 0.67, -0.81);
    boothGroup.add(tNorth);

    const tSouth = new THREE.Mesh(trimGeo, woodMat);
    tSouth.position.set(0, 0.67, 0.81);
    boothGroup.add(tSouth);

    // Table Pedestal / Center Leg
    const legGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.64, 16);
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.y = 0.32;
    boothGroup.add(leg);

    const baseGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.04, 24);
    const base = new THREE.Mesh(baseGeo, woodMat);
    base.position.y = 0.02;
    boothGroup.add(base);

    // 2. Floating 3D "Table 1 Free" Pill Badge Sprite (Image 2)
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 384;
    badgeCanvas.height = 96;
    const bctx = badgeCanvas.getContext('2d');
    if (bctx) {
      // Rounded dark green pill
      bctx.fillStyle = 'rgba(6, 78, 59, 0.90)';
      bctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
      bctx.lineWidth = 4;
      bctx.beginPath();
      bctx.roundRect(8, 8, 368, 80, 40);
      bctx.fill();
      bctx.stroke();

      // Green active dot
      bctx.fillStyle = '#34d399';
      bctx.beginPath();
      bctx.arc(52, 48, 12, 0, Math.PI * 2);
      bctx.fill();

      // Text: Table 1 Free
      bctx.fillStyle = '#ffffff';
      bctx.font = 'bold 36px "Inter", sans-serif';
      bctx.textAlign = 'left';
      bctx.textBaseline = 'middle';
      bctx.fillText('Table 1 Free', 82, 48);
    }

    const badgeTexture = new THREE.CanvasTexture(badgeCanvas);
    badgeTexture.colorSpace = THREE.SRGBColorSpace;
    const badgeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture, depthTest: false }));
    badgeSprite.position.set(0, 1.25, 0);
    badgeSprite.scale.set(1.4, 0.35, 1);
    boothGroup.add(badgeSprite);

    // Wooden Stool next to table (Image 2)
    const stoolGeo = new THREE.CylinderGeometry(0.20, 0.22, 0.36, 16);
    const stoolMesh = new THREE.Mesh(stoolGeo, woodMat);
    stoolMesh.position.set(-1.2, 0.18, 0.8);
    boothGroup.add(stoolMesh);

    this.furnitureGroup.add(boothGroup);
  }

  private buildFurniture() {
    // -------------------------------------------------------------
    // 1. Center Circular Dark Purple Rug (Image 2)
    // -------------------------------------------------------------
    const purpleRugGeo = new THREE.CircleGeometry(3.4, 48);
    purpleRugGeo.rotateX(-Math.PI / 2);
    const purpleRugMat = new THREE.MeshStandardMaterial({
      color: 0x381d58,
      roughness: 0.85,
    });
    const purpleRug = new THREE.Mesh(purpleRugGeo, purpleRugMat);
    purpleRug.position.set(-0.5, 0.005, 0.4);
    purpleRug.receiveShadow = true;
    this.furnitureGroup.add(purpleRug);

    // Center Round Coffee Table + Drinks (Image 2)
    const woodLegMat = new THREE.MeshStandardMaterial({ color: 0x3f1d0b, roughness: 0.4 });
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(-0.5, 0, 0.4);

    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.25 });
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 32), tableTopMat);
    tableTop.position.y = 0.34;
    coffeeTableGroup.add(tableTop);

    const createTableLeg = (angle: number) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.34, 12), woodLegMat);
      const rad = 0.42;
      leg.position.set(Math.cos(angle) * rad, 0.17, Math.sin(angle) * rad);
      leg.rotation.z = Math.cos(angle) * 0.15;
      leg.rotation.x = -Math.sin(angle) * 0.15;
      coffeeTableGroup.add(leg);
    };
    createTableLeg(0);
    createTableLeg((Math.PI * 2) / 3);
    createTableLeg((Math.PI * 4) / 3);

    const bookColors = [0xf97316, 0xec4899, 0x14b8a6];
    for (let i = 0; i < 3; i++) {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.03, 0.28),
        new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.4 })
      );
      book.position.set(-0.16, 0.38 + i * 0.032, 0.04);
      book.rotation.y = 0.1 * i;
      coffeeTableGroup.add(book);
    }

    const flowerPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.05, 0.11, 16),
      new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.6 })
    );
    flowerPot.position.set(0.18, 0.42, -0.05);
    coffeeTableGroup.add(flowerPot);

    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 })
    );
    flower.position.set(0.18, 0.58, -0.05);
    coffeeTableGroup.add(flower);

    this.furnitureGroup.add(coffeeTableGroup);

    // -------------------------------------------------------------
    // 2. Tripod Floor Lamp (Image 2: Next to Cinema TV console)
    // -------------------------------------------------------------
    const tripodLamp = new THREE.Group();
    tripodLamp.position.set(-6.2, 0, 2.2);

    const createTripodLeg = (angle: number) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.85, 12), woodLegMat);
      const rad = 0.32;
      leg.position.set(Math.cos(angle) * rad, 0.92, Math.sin(angle) * rad);
      leg.rotation.z = Math.cos(angle) * 0.16;
      leg.rotation.x = -Math.sin(angle) * 0.16;
      tripodLamp.add(leg);
    };
    createTripodLeg(0);
    createTripodLeg((Math.PI * 2) / 3);
    createTripodLeg((Math.PI * 4) / 3);

    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.36, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfef08a,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      })
    );
    lampShade.position.y = 1.95;
    tripodLamp.add(lampShade);
    this.furnitureGroup.add(tripodLamp);

    // -------------------------------------------------------------
    // 3. Tall Potted Monstera Tree in Back Corner (Image 2)
    // -------------------------------------------------------------
    const treeGroup = new THREE.Group();
    treeGroup.position.set(-6.0, 0, -5.6);

    const planterPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 0.52, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    planterPot.position.y = 0.26;
    treeGroup.add(planterPot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    for (let i = 0; i < 7; i++) {
      const leafAngle = (i * Math.PI * 2) / 7;
      const leafGeo = new THREE.SphereGeometry(0.28, 12, 12);
      leafGeo.scale(1.25, 0.15, 0.85);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(leafAngle) * 0.32, 0.70 + i * 0.09, Math.sin(leafAngle) * 0.32);
      leaf.rotation.y = leafAngle;
      leaf.rotation.z = 0.32;
      treeGroup.add(leaf);
    }
    this.furnitureGroup.add(treeGroup);

    // -------------------------------------------------------------
    // 4. Circular Crimson Red Rug in Foreground Lounge (Image 2)
    // -------------------------------------------------------------
    const redRug = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 48),
      new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.85 })
    );
    redRug.rotateX(-Math.PI / 2);
    redRug.position.set(0.6, 0.005, 4.2);
    redRug.receiveShadow = true;
    this.furnitureGroup.add(redRug);

    // Coffee Table with Warm Glowing Lantern
    const lanternTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.4 })
    );
    lanternTable.position.set(0.6, 0.14, 4.2);
    this.furnitureGroup.add(lanternTable);

    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      })
    );
    lantern.position.set(0.6, 0.37, 4.2);
    this.furnitureGroup.add(lantern);
  }

  // Load Real High-Quality PBR 3D Models (.GLB)
  private async load3DAssets() {
    const loader = LoungeAssetLoader.getInstance();

    try {
      // 1. Load Real Glam Velvet Sofa (Khronos Group PBR model)
      const sofaGLTF = await loader.loadModel('/models/sofa.glb');

      const spawnSofa = (x: number, z: number, rotY: number, tintColor?: number) => {
        const sofa = SkeletonUtils.clone(sofaGLTF.scene);
        sofa.scale.set(1.2, 1.2, 1.2);
        sofa.position.set(x, 0, z);
        sofa.rotation.y = rotY;

        sofa.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (tintColor && mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
              mat.color.set(tintColor);
              mesh.material = mat;
            }
          }
        });

        this.furnitureGroup.add(sofa);
      };

      // 3 Curved Purple Velvet Sofas forming an arc on Purple Rug FACING CINEMA TV ON LEFT (Image 2)
      // Sofa 1: Angled towards TV (-Z side)
      spawnSofa(-0.6, -1.6, -Math.PI * 0.35, 0x7c3aed);

      // Sofa 2: Centered facing TV (+X side)
      spawnSofa(1.4, 0.4, -Math.PI * 0.5, 0x8b5cf6);

      // Sofa 3: Angled towards TV (+Z side)
      spawnSofa(-0.6, 2.4, -Math.PI * 0.65, 0x7c3aed);

    } catch (err) {
      console.warn('[LoungeScene] Error loading sofa.glb:', err);
    }

    try {
      // 2. Load Real Sheen Armchairs (Khronos Group PBR model)
      const chairGLTF = await loader.loadModel('/models/chair.glb');

      const spawnChair = (x: number, z: number, rotY: number, tintColor?: number) => {
        const chair = SkeletonUtils.clone(chairGLTF.scene);
        chair.scale.set(1.15, 1.15, 1.15);
        chair.position.set(x, 0, z);
        chair.rotation.y = rotY;

        chair.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (tintColor && mesh.material && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
              mat.color.set(tintColor);
              mesh.material = mat;
            }
          }
        });

        this.furnitureGroup.add(chair);
      };

      // 4 Mustard-Yellow Armchairs around Red Rug in Foreground (Image 2)
      spawnChair(0.6, 2.9, 0, 0xd97706);          // North
      spawnChair(0.6, 5.5, Math.PI, 0xd97706);     // South
      spawnChair(-0.7, 4.2, Math.PI / 2, 0xd97706); // West
      spawnChair(1.9, 4.2, -Math.PI / 2, 0xd97706); // East

      // 1 Mustard-Yellow Armchair on the right edge of Purple Rug (Image 2)
      spawnChair(0.7, 1.8, -Math.PI * 0.6, 0xd97706);

      // 4 Cyan / Turquoise Armchairs around "Table 1 Free" Gaming Booth (Image 2)
      spawnChair(-4.0, -5.2, 0, 0x0891b2);          // North
      spawnChair(-4.0, -3.2, Math.PI, 0x0891b2);     // South
      spawnChair(-5.0, -4.2, Math.PI / 2, 0x0891b2); // West
      spawnChair(-3.0, -4.2, -Math.PI / 2, 0x0891b2); // East

    } catch (err) {
      console.warn('[LoungeScene] Error loading chair.glb:', err);
    }
  }

  public update() {
    const time = Date.now() * 0.002;
    this.tvScreenLight.intensity = 2.2 + Math.sin(time) * 0.15;
  }

  public dispose() {
    this.roomGroup.clear();
    this.furnitureGroup.clear();
  }
}
