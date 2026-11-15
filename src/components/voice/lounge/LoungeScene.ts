import * as THREE from 'three';
import { SEAT_DEFINITIONS } from './LoungeSeats';

export class LoungeScene {
  public scene: THREE.Scene;
  public tvMesh!: THREE.Mesh;
  public roomGroup: THREE.Group = new THREE.Group();
  private furnitureGroup: THREE.Group = new THREE.Group();
  private tvScreenLight!: THREE.PointLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0a17);
    this.scene.fog = new THREE.FogExp2(0x0e0a17, 0.022);

    this.scene.add(this.roomGroup);
    this.scene.add(this.furnitureGroup);

    this.buildLighting();
    this.buildRoomShell();
    this.buildSkylineWindow();
    this.buildNeonMoon();
    this.buildTVUnit();
    this.buildFurniture();
  }

  private buildLighting() {
    // 1. Soft moody violet/dark ambient light
    const ambientLight = new THREE.AmbientLight(0x2a1d40, 1.4);
    this.scene.add(ambientLight);

    // 2. Main ceiling directional light
    const dirLight = new THREE.DirectionalLight(0xfff1e6, 1.2);
    dirLight.position.set(5, 8, 4);
    this.scene.add(dirLight);

    // 3. Neon Moon Magenta Point Light
    const moonLight = new THREE.PointLight(0xf43f5e, 2.2, 8, 1.2);
    moonLight.position.set(0, 3.8, -5.6);
    this.scene.add(moonLight);

    // 4. TV Screen Glow Light (reflects dynamic video onto nearby couches)
    this.tvScreenLight = new THREE.PointLight(0x818cf8, 1.5, 9, 1.4);
    this.tvScreenLight.position.set(-5.5, 2.2, 0);
    this.scene.add(this.tvScreenLight);

    // 5. Window Platform Warm Amber LED Strip Light
    const platformLight = new THREE.PointLight(0xf59e0b, 1.8, 6, 1.5);
    platformLight.position.set(4.5, 0.6, -0.6);
    this.scene.add(platformLight);

    // 6. Warm Corner Floor Lamp
    const lampLight = new THREE.PointLight(0xfef08a, 1.6, 7, 1.3);
    lampLight.position.set(-5.8, 1.8, 4.8);
    this.scene.add(lampLight);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm dark walnut wood base
      ctx.fillStyle = '#261912';
      ctx.fillRect(0, 0, 1024, 1024);

      // Wood plank seams
      const plankHeight = 32;
      const plankWidth = 256;
      ctx.strokeStyle = '#150c07';
      ctx.lineWidth = 2;

      for (let y = 0; y < 1024; y += plankHeight) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();

        const offset = (Math.floor(y / plankHeight) % 2) * (plankWidth / 2);
        for (let x = offset; x < 1024; x += plankWidth) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + plankHeight);
          ctx.stroke();

          // Subtle plank color variation
          const rand = (Math.sin(x * y) + 1) / 2;
          ctx.fillStyle = `rgba(${rand > 0.5 ? 40 : 25}, 20, 15, 0.25)`;
          ctx.fillRect(x, y, plankWidth, plankHeight);
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
    const floorGeo = new THREE.PlaneGeometry(15, 13);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.55,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, 0, 0);
    this.roomGroup.add(floor);

    // Left Wall (TV Wall)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x181424,
      roughness: 0.85,
      metalness: 0.05,
    });

    const leftWallGeo = new THREE.PlaneGeometry(13, 5);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-7.5, 2.5, 0);
    this.roomGroup.add(leftWall);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(15, 5);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.5, -6.5);
    this.roomGroup.add(backWall);

    // Baseboard trim along bottom of walls
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f0b17, roughness: 0.6 });
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 0.08), trimMat);
    trimBack.position.set(0, 0.075, -6.46);
    this.roomGroup.add(trimBack);

    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 13), trimMat);
    trimLeft.position.set(-7.46, 0.075, 0);
    this.roomGroup.add(trimLeft);
  }

  private createCitySkylineTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Night sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#090a16');
      grad.addColorStop(0.5, '#12162a');
      grad.addColorStop(1, '#1b1b36');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 70; i++) {
        const sx = (Math.sin(i * 99) * 1000) % 1024;
        const sy = Math.abs((Math.cos(i * 33) * 500) % 220);
        ctx.fillRect(Math.abs(sx), sy, 1.5, 1.5);
      }

      // Skyline Skyscrapers
      const buildingColors = ['#080a14', '#0d1020', '#11152a', '#0a0d1c'];
      let curX = 0;
      let seed = 42;
      const pseudoRand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      while (curX < 1024) {
        const bWidth = 35 + pseudoRand() * 55;
        const bHeight = 120 + pseudoRand() * 260;
        const col = buildingColors[Math.floor(pseudoRand() * buildingColors.length)];

        ctx.fillStyle = col;
        ctx.fillRect(curX, 512 - bHeight, bWidth, bHeight);

        // Lit windows
        const winCols = ['#fef08a', '#38bdf8', '#f472b6', '#ffffff'];
        for (let wy = 512 - bHeight + 15; wy < 500; wy += 14) {
          for (let wx = curX + 6; wx < curX + bWidth - 6; wx += 10) {
            if (pseudoRand() > 0.45) {
              ctx.fillStyle = winCols[Math.floor(pseudoRand() * winCols.length)];
              ctx.globalAlpha = 0.6 + pseudoRand() * 0.4;
              ctx.fillRect(wx, wy, 4, 6);
            }
          }
        }
        ctx.globalAlpha = 1.0;
        curX += bWidth + 3;
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildSkylineWindow() {
    // Window Frame & Cutout on Right Wall (X = 7.4)
    const windowGroup = new THREE.Group();

    // Backdrop canvas with glowing city skyline
    const skyGeo = new THREE.PlaneGeometry(12, 4.5);
    skyGeo.rotateY(-Math.PI / 2);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.createCitySkylineTexture(),
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(7.6, 2.6, -0.5);
    windowGroup.add(skyMesh);

    // Window Mullions / Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0914, roughness: 0.4 });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 11), frameMat);
    topBar.position.set(7.35, 4.4, -0.5);
    windowGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 11), frameMat);
    bottomBar.position.set(7.35, 0.8, -0.5);
    windowGroup.add(bottomBar);

    for (let z = -5.0; z <= 4.0; z += 2.5) {
      const vertMullion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 0.08), frameMat);
      vertMullion.position.set(7.35, 2.6, z);
      windowGroup.add(vertMullion);
    }

    // Elevated Wooden Window Lounge Deck (Platform)
    const deckGeo = new THREE.BoxGeometry(2.4, 0.28, 7.5);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x3d271a,
      roughness: 0.5,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(5.9, 0.14, -0.6);
    windowGroup.add(deck);

    // LED Amber Underglow Strip along the edge of the deck
    const stripGeo = new THREE.BoxGeometry(0.06, 0.04, 7.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(4.68, 0.03, -0.6);
    windowGroup.add(strip);

    this.roomGroup.add(windowGroup);
  }

  private buildNeonMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(0, 3.8, -6.4);

    // Crescent Moon Shape
    const moonShape = new THREE.Shape();
    moonShape.absarc(0, 0, 0.45, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0.16, 0.08, 0.38, 0, Math.PI * 2, true);
    moonShape.holes.push(holePath);

    const extrudeSettings = { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
    const moonGeo = new THREE.ExtrudeGeometry(moonShape, extrudeSettings);

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xff3b77,
      emissive: 0xff2a85,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = 0.3;
    moonGroup.add(moonMesh);

    // Framed mini posters on the back wall
    const createMiniPoster = (x: number, y: number, col: number) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 })
      );
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.62),
        new THREE.MeshBasicMaterial({ color: col })
      );
      art.position.z = 0.025;
      frame.add(art);
      frame.position.set(x, y, -6.44);
      this.roomGroup.add(frame);
    };

    createMiniPoster(-1.2, 3.8, 0x06b6d4);
    createMiniPoster(1.4, 3.6, 0x10b981);

    this.roomGroup.add(moonGroup);
  }

  private buildTVUnit() {
    const tvGroup = new THREE.Group();

    // 1. Massive 16:9 Screen Plane
    const tvWidth = 5.6;
    const tvHeight = 3.15;
    const tvScreenGeo = new THREE.PlaneGeometry(tvWidth, tvHeight);
    tvScreenGeo.rotateY(Math.PI / 2);

    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.tvMesh = new THREE.Mesh(tvScreenGeo, tvMat);
    this.tvMesh.position.set(-7.38, 2.35, 0);
    tvGroup.add(this.tvMesh);

    // 2. TV Outer Frame & Bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x08080c, metalness: 0.8, roughness: 0.3 });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, tvHeight + 0.16, tvWidth + 0.16),
      bezelMat
    );
    bezel.position.set(-7.42, 2.35, 0);
    tvGroup.add(bezel);

    // 3. Electric Indigo LED Underglow Strip underneath TV
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, tvWidth), ledMat);
    ledStrip.position.set(-7.34, 0.73, 0);
    tvGroup.add(ledStrip);

    // 4. Low Modern Media Console Shelf
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 5.8), shelfMat);
    shelf.position.set(-7.0, 0.225, 0);
    tvGroup.add(shelf);

    // 5. Soundbar on shelf
    const soundbarMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.2 });
    const soundbar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 3.2), soundbarMat);
    soundbar.position.set(-6.8, 0.51, 0);
    tvGroup.add(soundbar);

    this.roomGroup.add(tvGroup);
  }

  private buildFurniture() {
    // 1. Central Circular Dark Indigo Rug
    const rugGeo = new THREE.CircleGeometry(2.6, 48);
    rugGeo.rotateX(-Math.PI / 2);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x241442,
      roughness: 0.9,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.position.set(-1.0, 0.005, 0.3);
    this.furnitureGroup.add(rug);

    // 2. Central TV Cinema Couches (Purple Plush)
    const couchMat = new THREE.MeshStandardMaterial({
      color: 0x581c87, // Royal Purple
      roughness: 0.6,
      metalness: 0.05,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x6b21a8,
      roughness: 0.7,
    });

    const createCouch = (x: number, z: number, rotY: number) => {
      const couch = new THREE.Group();
      // Base
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.75), couchMat);
      base.position.y = 0.12;
      couch.add(base);

      // Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.2), couchMat);
      back.position.set(0, 0.42, 0.3);
      couch.add(back);

      // Cushions
      const cushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.52), cushionMat);
      cushion1.position.set(-0.38, 0.27, -0.05);
      couch.add(cushion1);

      const cushion2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.52), cushionMat);
      cushion2.position.set(0.38, 0.27, -0.05);
      couch.add(cushion2);

      // Armrests
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.75), couchMat);
      armL.position.set(-0.84, 0.28, 0);
      couch.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.75), couchMat);
      armR.position.set(0.84, 0.28, 0);
      couch.add(armR);

      couch.position.set(x, 0, z);
      couch.rotation.y = rotY;
      return couch;
    };

    // Main Couch 1 (Seats 1 & 2)
    const couch1 = createCouch(-0.8, -0.4, -Math.PI / 2);
    this.furnitureGroup.add(couch1);

    // Main Couch 2 (Seats 3 & 4)
    const couch2 = createCouch(-1.2, 1.2, -Math.PI / 2 + 0.3);
    this.furnitureGroup.add(couch2);

    // 3. Central Low Coffee Table
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3 });
    const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 24), tableMat);
    coffeeTable.position.set(-2.6, 0.14, 0.4);
    this.furnitureGroup.add(coffeeTable);

    // 4. Beanbags on the Elevated Window Deck (Seats 5, 6, 7, 8)
    const createBeanbag = (x: number, z: number, colorHex: number) => {
      const beanGeo = new THREE.SphereGeometry(0.42, 24, 20);
      beanGeo.scale(1.1, 0.7, 1.1); // Squished round pouf
      const beanMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.65,
      });
      const bean = new THREE.Mesh(beanGeo, beanMat);
      bean.position.set(x, 0.42, z);
      return bean;
    };

    this.furnitureGroup.add(createBeanbag(4.6, -2.4, 0x06b6d4)); // Teal
    this.furnitureGroup.add(createBeanbag(4.6, -1.2, 0xeab308)); // Yellow
    this.furnitureGroup.add(createBeanbag(4.6, 0.0, 0xf43f5e));  // Coral Red
    this.furnitureGroup.add(createBeanbag(4.6, 1.2, 0x9333ea));  // Purple

    // 5. Back Squad Table ("Table 1" - Seats 9, 10, 11, 12)
    const squadTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.55, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4 })
    );
    squadTable.position.set(-0.2, 0.275, -3.2);
    this.furnitureGroup.add(squadTable);

    // 4 Bucket Armchairs around Squad Table
    const createArmchair = (x: number, z: number, rotY: number, colorHex: number) => {
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.12, 20),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 })
      );
      seat.position.y = 0.28;
      chair.add(seat);

      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.1),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 })
      );
      back.position.set(0, 0.48, 0.26);
      chair.add(back);

      chair.position.set(x, 0, z);
      chair.rotation.y = rotY;
      return chair;
    };

    this.furnitureGroup.add(createArmchair(-0.2, -4.2, 0, 0x0ea5e9));             // North Seat 9
    this.furnitureGroup.add(createArmchair(-0.2, -2.2, Math.PI, 0x0ea5e9));       // South Seat 10
    this.furnitureGroup.add(createArmchair(-1.2, -3.2, Math.PI / 2, 0x10b981));   // West Seat 11
    this.furnitureGroup.add(createArmchair(0.8, -3.2, -Math.PI / 2, 0x10b981));   // East Seat 12

    // 6. Corner Floor Lamp (Left Back)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-5.8, 0, 4.8);
    const tripodMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), tripodMat);
    stem.position.y = 0.9;
    lampGroup.add(stem);

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.38, 20), shadeMat);
    shade.position.y = 1.8;
    lampGroup.add(shade);
    this.furnitureGroup.add(lampGroup);

    // 7. Potted Monstera Plant
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.2, 0.48, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 })
    );
    pot.position.set(-6.2, 0.24, -5.2);
    this.furnitureGroup.add(pot);

    const plantLeaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    );
    plantLeaves.position.set(-6.2, 0.75, -5.2);
    this.furnitureGroup.add(plantLeaves);
  }

  public update() {
    // Dynamic lighting animation (subtle pulsing of neon moon)
    const time = Date.now() * 0.002;
    this.tvScreenLight.intensity = 1.4 + Math.sin(time) * 0.15;
  }

  public dispose() {
    this.roomGroup.clear();
    this.furnitureGroup.clear();
  }
}
