import * as THREE from 'three';

export class LoungeScene {
  public scene: THREE.Scene;
  public tvMesh!: THREE.Mesh;
  public roomGroup: THREE.Group = new THREE.Group();
  public furnitureGroup: THREE.Group = new THREE.Group();
  private tvScreenLight!: THREE.PointLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0a17);
    this.scene.fog = new THREE.FogExp2(0x0e0a17, 0.02);

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
    // 1. Warm moody violet ambient light
    const ambientLight = new THREE.AmbientLight(0x352352, 1.6);
    this.scene.add(ambientLight);

    // 2. Main warm ceiling spotlight
    const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
    dirLight.position.set(4, 9, 4);
    this.scene.add(dirLight);

    // 3. Neon Moon Magenta Point Light
    const moonLight = new THREE.PointLight(0xff2a85, 2.8, 9, 1.2);
    moonLight.position.set(0, 3.8, -5.8);
    this.scene.add(moonLight);

    // 4. TV Screen Glow Light (reflects video glow onto room)
    this.tvScreenLight = new THREE.PointLight(0x818cf8, 1.6, 9, 1.3);
    this.tvScreenLight.position.set(-5.5, 2.35, 0);
    this.scene.add(this.tvScreenLight);

    // 5. Window Platform Warm Amber LED Strip Light
    const platformLight = new THREE.PointLight(0xf59e0b, 2.0, 7, 1.5);
    platformLight.position.set(4.5, 0.6, -0.6);
    this.scene.add(platformLight);

    // 6. Corner Floor Lamp (warm golden glow)
    const lampLight = new THREE.PointLight(0xfef08a, 1.8, 8, 1.2);
    lampLight.position.set(-5.8, 1.9, 4.8);
    this.scene.add(lampLight);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm dark walnut parquet
      ctx.fillStyle = '#24160f';
      ctx.fillRect(0, 0, 1024, 1024);

      const plankH = 32;
      const plankW = 256;
      ctx.strokeStyle = '#120a06';
      ctx.lineWidth = 2.5;

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

          // Organic wood grain tones
          const rand = Math.sin(x * 12.9898 + y * 78.233);
          const val = Math.floor((rand + 1) * 15);
          ctx.fillStyle = `rgba(${35 + val}, ${22 + val / 2}, ${15 + val / 3}, 0.35)`;
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
    const floorGeo = new THREE.PlaneGeometry(16, 14);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.5,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    this.roomGroup.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x161224, // Deep eggplant purple
      roughness: 0.85,
      metalness: 0.05,
    });

    // Left Wall (TV Wall)
    const leftWallGeo = new THREE.PlaneGeometry(14, 5.2);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-7.5, 2.6, 0);
    this.roomGroup.add(leftWall);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(16, 5.2);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.6, -6.5);
    this.roomGroup.add(backWall);

    // Baseboard trim along bottom
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0c0814, roughness: 0.5 });
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.08), trimMat);
    trimBack.position.set(0, 0.08, -6.46);
    this.roomGroup.add(trimBack);

    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 14), trimMat);
    trimLeft.position.set(-7.46, 0.08, 0);
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
      grad.addColorStop(0, '#060712');
      grad.addColorStop(0.5, '#101428');
      grad.addColorStop(1, '#1e1c38');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Distant stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const sx = Math.abs((Math.sin(i * 123) * 1000) % 1024);
        const sy = Math.abs((Math.cos(i * 45) * 400) % 200);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // City Skyscraper Silhouettes
      const buildingColors = ['#080a14', '#0d1020', '#12162c', '#0a0d1e'];
      let curX = 0;
      let seed = 77;
      const pseudoRand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      while (curX < 1024) {
        const bWidth = 40 + pseudoRand() * 60;
        const bHeight = 140 + pseudoRand() * 280;
        const col = buildingColors[Math.floor(pseudoRand() * buildingColors.length)];

        ctx.fillStyle = col;
        ctx.fillRect(curX, 512 - bHeight, bWidth, bHeight);

        // Lit building windows (Yellow, Cyan, White)
        const winCols = ['#fef08a', '#38bdf8', '#fb7185', '#ffffff'];
        for (let wy = 512 - bHeight + 14; wy < 500; wy += 14) {
          for (let wx = curX + 7; wx < curX + bWidth - 7; wx += 11) {
            if (pseudoRand() > 0.42) {
              ctx.fillStyle = winCols[Math.floor(pseudoRand() * winCols.length)];
              ctx.globalAlpha = 0.6 + pseudoRand() * 0.4;
              ctx.fillRect(wx, wy, 5, 7);
            }
          }
        }
        ctx.globalAlpha = 1.0;
        curX += bWidth + 4;
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildSkylineWindow() {
    const windowGroup = new THREE.Group();

    // Backdrop canvas with glowing city skyline
    const skyGeo = new THREE.PlaneGeometry(12, 4.8);
    skyGeo.rotateY(-Math.PI / 2);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.createCitySkylineTexture(),
      side: THREE.DoubleSide,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(7.6, 2.6, -0.5);
    windowGroup.add(skyMesh);

    // Window Mullions / Dark Steel Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x090710, roughness: 0.3 });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 11), frameMat);
    topBar.position.set(7.35, 4.4, -0.5);
    windowGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 11), frameMat);
    bottomBar.position.set(7.35, 0.75, -0.5);
    windowGroup.add(bottomBar);

    for (let z = -5.0; z <= 4.0; z += 2.5) {
      const vertMullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.65, 0.1), frameMat);
      vertMullion.position.set(7.35, 2.58, z);
      windowGroup.add(vertMullion);
    }

    // Elevated Wooden Window Lounge Deck (Platform)
    const deckGeo = new THREE.BoxGeometry(2.5, 0.32, 7.8);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x3d271a,
      roughness: 0.45,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(5.95, 0.16, -0.6);
    windowGroup.add(deck);

    // Warm Golden Amber LED Underglow Strip
    const stripGeo = new THREE.BoxGeometry(0.08, 0.05, 7.8);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(4.68, 0.04, -0.6);
    windowGroup.add(strip);

    this.roomGroup.add(windowGroup);
  }

  private buildNeonMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(0, 3.85, -6.4);

    // Crescent Moon Shape
    const moonShape = new THREE.Shape();
    moonShape.absarc(0, 0, 0.48, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0.17, 0.08, 0.4, 0, Math.PI * 2, true);
    moonShape.holes.push(holePath);

    const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
    const moonGeo = new THREE.ExtrudeGeometry(moonShape, extrudeSettings);

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xff3b77,
      emissive: 0xff2a85,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = 0.3;
    moonGroup.add(moonMesh);

    // Framed mini posters on the back wall
    const createMiniPoster = (x: number, y: number, col: number) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.75, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
      );
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.66),
        new THREE.MeshBasicMaterial({ color: col })
      );
      art.position.z = 0.025;
      frame.add(art);
      frame.position.set(x, y, -6.44);
      this.roomGroup.add(frame);
    };

    createMiniPoster(-1.3, 3.8, 0x06b6d4);
    createMiniPoster(1.5, 3.6, 0x10b981);

    this.roomGroup.add(moonGroup);
  }

  private buildTVUnit() {
    const tvGroup = new THREE.Group();

    const tvWidth = 5.8;
    const tvHeight = 3.25;

    // 1. TV Screen Mesh (Positioned at X = -7.28, securely IN FRONT of the bezel!)
    const tvScreenGeo = new THREE.PlaneGeometry(tvWidth, tvHeight);
    tvScreenGeo.rotateY(Math.PI / 2);

    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.tvMesh = new THREE.Mesh(tvScreenGeo, tvMat);
    this.tvMesh.position.set(-7.28, 2.35, 0); // Front face at -7.28
    tvGroup.add(this.tvMesh);

    // 2. TV Outer Frame & Bezel (Center at -7.40, depth 0.14 -> front at -7.33)
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x08080c, metalness: 0.8, roughness: 0.3 });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, tvHeight + 0.18, tvWidth + 0.18),
      bezelMat
    );
    bezel.position.set(-7.40, 2.35, 0);
    tvGroup.add(bezel);

    // 3. Electric Indigo LED Underglow Strip underneath TV
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, tvWidth), ledMat);
    ledStrip.position.set(-7.26, 0.68, 0);
    tvGroup.add(ledStrip);

    // 4. Low Modern Media Console Shelf
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 6.0), shelfMat);
    shelf.position.set(-6.95, 0.225, 0);
    tvGroup.add(shelf);

    // 5. Soundbar on shelf
    const soundbarMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
    const soundbar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 3.4), soundbarMat);
    soundbar.position.set(-6.75, 0.51, 0);
    tvGroup.add(soundbar);

    this.roomGroup.add(tvGroup);
  }

  private buildFurniture() {
    // 1. Central Circular Dark Indigo Rug
    const rugGeo = new THREE.CircleGeometry(2.7, 48);
    rugGeo.rotateX(-Math.PI / 2);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x2a174a,
      roughness: 0.9,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.position.set(-1.0, 0.005, 0.3);
    this.furnitureGroup.add(rug);

    // 2. Plush Lounge Couches with Sculpted Cushions & Wooden Legs
    const couchBaseMat = new THREE.MeshStandardMaterial({
      color: 0x581c87, // Deep royal purple
      roughness: 0.65,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x7e22ce, // Vibrant purple velvet cushion
      roughness: 0.55,
    });
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1c130d, // Dark walnut legs
      roughness: 0.4,
    });

    const createDeluxeCouch = (x: number, z: number, rotY: number) => {
      const couch = new THREE.Group();

      // Main seat base
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.26, 0.85), couchBaseMat);
      base.position.y = 0.22;
      couch.add(base);

      // Angled backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.22), couchBaseMat);
      back.position.set(0, 0.56, 0.34);
      back.rotation.x = -0.08;
      couch.add(back);

      // Thick plush seat cushions (2 seater)
      const seatCushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.15, 0.65), cushionMat);
      seatCushion1.position.set(-0.43, 0.38, -0.05);
      couch.add(seatCushion1);

      const seatCushion2 = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.15, 0.65), cushionMat);
      seatCushion2.position.set(0.43, 0.38, -0.05);
      couch.add(seatCushion2);

      // Back cushions
      const backCushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.38, 0.14), cushionMat);
      backCushion1.position.set(-0.43, 0.62, 0.24);
      backCushion1.rotation.x = -0.1;
      couch.add(backCushion1);

      const backCushion2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.38, 0.14), cushionMat);
      backCushion2.position.set(0.43, 0.62, 0.24);
      backCushion2.rotation.x = -0.1;
      couch.add(backCushion2);

      // Curved sculpted armrests
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.85), couchBaseMat);
      armL.position.set(-0.95, 0.4, 0);
      couch.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.85), couchBaseMat);
      armR.position.set(0.95, 0.4, 0);
      couch.add(armR);

      // 4 Wooden legs
      const createLeg = (lx: number, lz: number) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.16, 12), legMat);
        leg.position.set(lx, 0.08, lz);
        couch.add(leg);
      };
      createLeg(-0.8, -0.32);
      createLeg(0.8, -0.32);
      createLeg(-0.8, 0.32);
      createLeg(0.8, 0.32);

      couch.position.set(x, 0, z);
      couch.rotation.y = rotY;
      return couch;
    };

    // Main Couch 1 (Seats 1 & 2 - Front Row)
    const couch1 = createDeluxeCouch(-0.8, -0.4, -Math.PI / 2);
    this.furnitureGroup.add(couch1);

    // Main Couch 2 (Seats 3 & 4 - Angled Corner)
    const couch2 = createDeluxeCouch(-1.2, 1.25, -Math.PI / 2 + 0.3);
    this.furnitureGroup.add(couch2);

    // 3. Central Coffee Table (Round Wood + Drinks)
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.2 });
    const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.28, 32), tableMat);
    coffeeTable.position.set(-2.6, 0.14, 0.4);
    this.furnitureGroup.add(coffeeTable);

    // Coffee table cups / drinks
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
    const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 12), cupMat);
    cup1.position.set(-2.55, 0.33, 0.35);
    this.furnitureGroup.add(cup1);

    const cup2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
    );
    cup2.position.set(-2.7, 0.34, 0.48);
    this.furnitureGroup.add(cup2);

    // 4. Beanbags on the Elevated Window Deck (Seats 5, 6, 7, 8)
    const createBeanbag = (x: number, z: number, colorHex: number) => {
      const beanGroup = new THREE.Group();
      // Main plush body
      const beanGeo = new THREE.SphereGeometry(0.44, 24, 20);
      beanGeo.scale(1.15, 0.72, 1.15); // Squished round pouf
      const beanMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.6,
        metalness: 0.05,
      });
      const bean = new THREE.Mesh(beanGeo, beanMat);
      bean.position.y = 0.26;
      beanGroup.add(bean);

      // Top indentation / crease
      const topCrease = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 })
      );
      topCrease.position.y = 0.52;
      beanGroup.add(topCrease);

      beanGroup.position.set(x, 0.16, z); // Sits on platform (height 0.16)
      return beanGroup;
    };

    this.furnitureGroup.add(createBeanbag(4.6, -2.4, 0x06b6d4)); // Teal (Seat 5)
    this.furnitureGroup.add(createBeanbag(4.6, -1.2, 0xeab308)); // Yellow (Seat 6)
    this.furnitureGroup.add(createBeanbag(4.6, 0.0, 0xf43f5e));  // Coral Red (Seat 7)
    this.furnitureGroup.add(createBeanbag(4.6, 1.2, 0x9333ea));  // Purple (Seat 8)

    // 5. Back Squad Table ("Table 1" - Seats 9, 10, 11, 12)
    const squadTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.58, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.35, metalness: 0.1 })
    );
    squadTable.position.set(-0.2, 0.29, -3.2);
    this.furnitureGroup.add(squadTable);

    // 4 Modern Bucket Armchairs around Squad Table
    const createArmchair = (x: number, z: number, rotY: number, colorHex: number) => {
      const chair = new THREE.Group();
      const chairMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });

      // Seat cushion
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 24), chairMat);
      seat.position.y = 0.28;
      chair.add(seat);

      // Curved bucket back
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.12), chairMat);
      back.position.set(0, 0.48, 0.26);
      back.rotation.x = -0.08;
      chair.add(back);

      // Central steel swivel base
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
      );
      pole.position.y = 0.12;
      chair.add(pole);

      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
      );
      baseRing.position.y = 0.02;
      chair.add(baseRing);

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
      new THREE.CylinderGeometry(0.28, 0.22, 0.5, 18),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6 })
    );
    pot.position.set(-6.2, 0.25, -5.2);
    this.furnitureGroup.add(pot);

    const plantLeaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    );
    plantLeaves.position.set(-6.2, 0.78, -5.2);
    this.furnitureGroup.add(plantLeaves);
  }

  public update() {
    const time = Date.now() * 0.002;
    this.tvScreenLight.intensity = 1.5 + Math.sin(time) * 0.15;
  }

  public dispose() {
    this.roomGroup.clear();
    this.furnitureGroup.clear();
  }
}
