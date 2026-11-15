import * as THREE from 'three';

export class LoungeScene {
  public scene: THREE.Scene;
  public tvMesh!: THREE.Mesh;
  public roomGroup: THREE.Group = new THREE.Group();
  public furnitureGroup: THREE.Group = new THREE.Group();
  private tvScreenLight!: THREE.PointLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0917);
    this.scene.fog = new THREE.FogExp2(0x0e0917, 0.018);

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
    // 1. Moody Violet Ambient Light
    const ambientLight = new THREE.AmbientLight(0x382250, 1.8);
    this.scene.add(ambientLight);

    // 2. Main Ceiling Light (Warm soft fill)
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
    dirLight.position.set(4, 9, 4);
    this.scene.add(dirLight);

    // 3. Neon Crescent Moon Magenta/Pink Glow Light
    const moonLight = new THREE.PointLight(0xff2a85, 3.2, 10, 1.2);
    moonLight.position.set(0, 3.8, -5.9);
    this.scene.add(moonLight);

    // 4. TV Screen Glow Light (Reflects live video glow into the cinema room)
    this.tvScreenLight = new THREE.PointLight(0x818cf8, 1.8, 10, 1.3);
    this.tvScreenLight.position.set(-5.5, 2.35, 0);
    this.scene.add(this.tvScreenLight);

    // 5. Window Platform Warm Amber LED Strip Light
    const platformLight = new THREE.PointLight(0xf59e0b, 2.4, 8, 1.4);
    platformLight.position.set(4.6, 0.5, -0.6);
    this.scene.add(platformLight);

    // 6. Red Rug Candle / Lantern Light
    const candleLight = new THREE.PointLight(0xf59e0b, 1.8, 4.5, 1.5);
    candleLight.position.set(0.6, 0.55, 3.6);
    this.scene.add(candleLight);

    // 7. Corner Floor Lamp (Warm golden light)
    const lampLight = new THREE.PointLight(0xfef08a, 2.0, 7, 1.3);
    lampLight.position.set(-5.8, 1.9, 4.8);
    this.scene.add(lampLight);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm rich dark walnut parquet
      ctx.fillStyle = '#261710';
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

          // Organic natural wood plank grain variations
          const rand = Math.sin(x * 12.9898 + y * 78.233);
          const val = Math.floor((rand + 1) * 16);
          ctx.fillStyle = `rgba(${38 + val}, ${24 + val / 2}, ${16 + val / 3}, 0.38)`;
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
      roughness: 0.45,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    this.roomGroup.add(floor);

    // Moody Eggplant Purple Walls (matching reference Image 2)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x22152b,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Left Wall (TV Wall)
    const leftWallGeo = new THREE.PlaneGeometry(14, 5.4);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-7.5, 2.7, 0);
    this.roomGroup.add(leftWall);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(16, 5.4);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.7, -6.5);
    this.roomGroup.add(backWall);

    // Dark Walnut Baseboard Trim & Wainscot Chair Rail
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0c0814, roughness: 0.4 });
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.08), trimMat);
    trimBack.position.set(0, 0.08, -6.46);
    this.roomGroup.add(trimBack);

    const railBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.06), trimMat);
    railBack.position.set(0, 2.1, -6.47);
    this.roomGroup.add(railBack);

    const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 14), trimMat);
    trimLeft.position.set(-7.46, 0.08, 0);
    this.roomGroup.add(trimLeft);

    const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 14), trimMat);
    railLeft.position.set(-7.47, 2.1, 0);
    this.roomGroup.add(railLeft);
  }

  private createCitySkylineTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Midnight skyline gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#04050e');
      grad.addColorStop(0.5, '#0a0e22');
      grad.addColorStop(1, '#181630');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const sx = Math.abs((Math.sin(i * 123) * 1000) % 1024);
        const sy = Math.abs((Math.cos(i * 45) * 400) % 200);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // City Skyscraper Silhouettes
      const buildingColors = ['#080a14', '#0d1020', '#12162c', '#0a0d1e'];
      let curX = 0;
      let seed = 89;
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

        // Lit building windows (Yellow, Cyan, Warm White)
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

    // Elevated Wooden Window Lounge Deck (Matching Image 2)
    const deckGeo = new THREE.BoxGeometry(2.5, 0.32, 8.2);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x3d271a,
      roughness: 0.45,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(5.95, 0.16, -0.6);
    windowGroup.add(deck);

    // Warm Golden Amber LED Underglow Strip along the step edge (Image 2)
    const stripGeo = new THREE.BoxGeometry(0.08, 0.05, 8.2);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(4.68, 0.04, -0.6);
    windowGroup.add(strip);

    this.roomGroup.add(windowGroup);
  }

  private buildNeonMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(0, 3.85, -6.4);

    // Glowing Pink Crescent Moon Shape (Matching Image 2)
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
      emissiveIntensity: 2.6,
      roughness: 0.1,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = 0.3;
    moonGroup.add(moonMesh);

    // Framed art pieces on the back wall (Matching Image 2)
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

    createMiniPoster(-1.4, 3.8, 0x06b6d4);
    createMiniPoster(1.4, 3.6, 0x10b981);

    this.roomGroup.add(moonGroup);
  }

  private buildTVUnit() {
    const tvGroup = new THREE.Group();

    const tvWidth = 5.8;
    const tvHeight = 3.25;

    // 1. TV Screen Mesh (Positioned at X = -7.28, securely in front of bezel)
    const tvScreenGeo = new THREE.PlaneGeometry(tvWidth, tvHeight);
    tvScreenGeo.rotateY(Math.PI / 2);

    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.tvMesh = new THREE.Mesh(tvScreenGeo, tvMat);
    this.tvMesh.position.set(-7.28, 2.35, 0);
    tvGroup.add(this.tvMesh);

    // 2. TV Outer Frame & Bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x08080c, metalness: 0.8, roughness: 0.3 });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, tvHeight + 0.18, tvWidth + 0.18),
      bezelMat
    );
    bezel.position.set(-7.40, 2.35, 0);
    tvGroup.add(bezel);

    // 3. Electric Indigo LED Underglow Strip
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, tvWidth), ledMat);
    ledStrip.position.set(-7.26, 0.68, 0);
    tvGroup.add(ledStrip);

    // 4. Low Modern Media Console Shelf (Cubby units matching Image 1 & Image 2)
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 6.0), shelfMat);
    shelf.position.set(-6.95, 0.225, 0);
    tvGroup.add(shelf);

    // Console open cubby dividers
    const cubbyDivMat = new THREE.MeshStandardMaterial({ color: 0x120e0c, roughness: 0.5 });
    for (let cz = -2.2; cz <= 2.2; cz += 1.1) {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.04), cubbyDivMat);
      divider.position.set(-6.95, 0.225, cz);
      tvGroup.add(divider);
    }

    // Soundbar / speaker on shelf
    const soundbarMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
    const soundbar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 2.8), soundbarMat);
    soundbar.position.set(-6.75, 0.50, 0);
    tvGroup.add(soundbar);

    // Mini potted succulent on media console (Image 1 reference)
    const miniPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.05, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316 })
    );
    miniPot.position.set(-6.75, 0.51, 1.8);
    tvGroup.add(miniPot);

    const miniPlant = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a })
    );
    miniPlant.position.set(-6.75, 0.60, 1.8);
    tvGroup.add(miniPlant);

    this.roomGroup.add(tvGroup);
  }

  private buildFurniture() {
    // ------------------------------------------------------------------------
    // 1. CENTER AREA: Circular Navy Blue Rug + Two Curved Plush Purple Couches
    // ------------------------------------------------------------------------
    const blueRugGeo = new THREE.CircleGeometry(2.6, 48);
    blueRugGeo.rotateX(-Math.PI / 2);
    const blueRugMat = new THREE.MeshStandardMaterial({
      color: 0x1a214d, // Deep navy blue (Image 2)
      roughness: 0.85,
    });
    const blueRug = new THREE.Mesh(blueRugGeo, blueRugMat);
    blueRug.position.set(-0.6, 0.005, 0.3);
    this.furnitureGroup.add(blueRug);

    // Plush Couch Factory
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

    const createPlushCouch = (x: number, z: number, rotY: number) => {
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

    // Center Couch 1 (Seats 1 & 2 - North side of blue rug facing inward/TV)
    const couch1 = createPlushCouch(-0.6, -0.65, 0.15);
    this.furnitureGroup.add(couch1);

    // Center Couch 2 (Seats 3 & 4 - South side of blue rug facing inward/TV)
    const couch2 = createPlushCouch(-0.6, 1.25, Math.PI - 0.15);
    this.furnitureGroup.add(couch2);

    // Center Round Wood Coffee Table
    const centerTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.28, 32),
      new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.35, metalness: 0.1 })
    );
    centerTable.position.set(-0.6, 0.14, 0.3);
    this.furnitureGroup.add(centerTable);

    // Coffee table drinks / snack bowl
    const cupMat1 = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
    const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 12), cupMat1);
    cup1.position.set(-0.55, 0.33, 0.25);
    this.furnitureGroup.add(cup1);

    const cupMat2 = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    const cup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), cupMat2);
    cup2.position.set(-0.7, 0.34, 0.38);
    this.furnitureGroup.add(cup2);

    // ------------------------------------------------------------------------
    // 2. FOREGROUND AREA: Circular Burgundy Red Rug + 4 Mustard Yellow Club Chairs
    // ------------------------------------------------------------------------
    const redRugGeo = new THREE.CircleGeometry(2.3, 48);
    redRugGeo.rotateX(-Math.PI / 2);
    const redRugMat = new THREE.MeshStandardMaterial({
      color: 0x481424, // Rich burgundy red (Image 2)
      roughness: 0.85,
    });
    const redRug = new THREE.Mesh(redRugGeo, redRugMat);
    redRug.position.set(0.6, 0.005, 3.6);
    this.furnitureGroup.add(redRug);

    // 4 Mustard Yellow Club Armchairs (Seats 10, 11, 12, 13)
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04, // Mustard / warm golden yellow (Image 2)
      roughness: 0.55,
    });

    const createClubArmchair = (x: number, z: number, rotY: number) => {
      const chair = new THREE.Group();

      // Main seat box
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.72), yellowMat);
      seat.position.y = 0.22;
      chair.add(seat);

      // Rounded backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.18), yellowMat);
      back.position.set(0, 0.48, 0.28);
      chair.add(back);

      // Armrests
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.72), yellowMat);
      armL.position.set(-0.36, 0.36, 0);
      chair.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.72), yellowMat);
      armR.position.set(0.36, 0.36, 0);
      chair.add(armR);

      chair.position.set(x, 0, z);
      chair.rotation.y = rotY;
      return chair;
    };

    this.furnitureGroup.add(createClubArmchair(0.6, 2.5, 0));             // North (Seat 10)
    this.furnitureGroup.add(createClubArmchair(0.6, 4.7, Math.PI));       // South (Seat 11)
    this.furnitureGroup.add(createClubArmchair(-0.5, 3.6, Math.PI / 2));  // West (Seat 12)
    this.furnitureGroup.add(createClubArmchair(1.7, 3.6, -Math.PI / 2));  // East (Seat 13)

    // Center Round Table with Glowing Candle Lantern
    const redRugTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.4 })
    );
    redRugTable.position.set(0.6, 0.14, 3.6);
    this.furnitureGroup.add(redRugTable);

    // Glowing candle lantern
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );
    lantern.position.set(0.6, 0.36, 3.6);
    this.furnitureGroup.add(lantern);

    // ------------------------------------------------------------------------
    // 3. WINDOW DECK: 5 Colorful Beanbags (Seats 5, 6, 7, 8, 9 - Image 2)
    // ------------------------------------------------------------------------
    const createBeanbag = (x: number, z: number, colorHex: number) => {
      const beanGroup = new THREE.Group();
      const beanGeo = new THREE.SphereGeometry(0.44, 24, 20);
      beanGeo.scale(1.15, 0.72, 1.15);
      const beanMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.6,
        metalness: 0.05,
      });
      const bean = new THREE.Mesh(beanGeo, beanMat);
      bean.position.y = 0.26;
      beanGroup.add(bean);

      const topCrease = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.8 })
      );
      topCrease.position.y = 0.52;
      beanGroup.add(topCrease);

      beanGroup.position.set(x, 0.16, z); // Sits on elevated platform
      return beanGroup;
    };

    // 5 Beanbags matching Image 2 in sequence:
    this.furnitureGroup.add(createBeanbag(4.8, -3.0, 0x8b5cf6)); // 1: Purple (Seat 5)
    this.furnitureGroup.add(createBeanbag(4.8, -1.8, 0xeab308)); // 2: Yellow (Seat 6)
    this.furnitureGroup.add(createBeanbag(4.8, -0.6, 0x06b6d4)); // 3: Teal/Cyan (Seat 7)
    this.furnitureGroup.add(createBeanbag(4.8, 0.6, 0xf43f5e));  // 4: Coral Red (Seat 8)
    this.furnitureGroup.add(createBeanbag(4.8, 1.8, 0x6366f1));  // 5: Indigo/Violet (Seat 9)

    // ------------------------------------------------------------------------
    // 4. BACK-CORNER SQUAD AREA: Square Table + 3 Teal Chairs + Stools ("Table 1 Free")
    // ------------------------------------------------------------------------
    const squareTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.58, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x1f293d, roughness: 0.35, metalness: 0.1 })
    );
    squareTable.position.set(-1.8, 0.29, -3.8);
    this.furnitureGroup.add(squareTable);

    // Teal Armchairs (Seats 14, 15, 16)
    const tealMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.5 });
    const createTealChair = (x: number, z: number, rotY: number) => {
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 24), tealMat);
      seat.position.y = 0.28;
      chair.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.12), tealMat);
      back.position.set(0, 0.48, 0.26);
      chair.add(back);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 })
      );
      pole.position.y = 0.12;
      chair.add(pole);

      chair.position.set(x, 0, z);
      chair.rotation.y = rotY;
      return chair;
    };

    this.furnitureGroup.add(createTealChair(-1.8, -4.8, 0));            // North (Seat 14)
    this.furnitureGroup.add(createTealChair(-2.8, -3.8, Math.PI / 2));  // West (Seat 15)
    this.furnitureGroup.add(createTealChair(-0.8, -3.8, -Math.PI / 2)); // East (Seat 16)

    // Small Wooden Stool (Seat 17)
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4 });
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.26, 18), stoolMat);
    stool.position.set(-1.8, 0.13, -2.8);
    this.furnitureGroup.add(stool);

    // 3D Floating Pill Badge: "Table 1 Free" (Image 2)
    const tableBadgeCanvas = document.createElement('canvas');
    tableBadgeCanvas.width = 256;
    tableBadgeCanvas.height = 64;
    const tbCtx = tableBadgeCanvas.getContext('2d');
    if (tbCtx) {
      tbCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      tbCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      tbCtx.lineWidth = 2;
      tbCtx.beginPath();
      tbCtx.roundRect(8, 8, 240, 48, 24);
      tbCtx.fill();
      tbCtx.stroke();

      // Green dot
      tbCtx.fillStyle = '#22c55e';
      tbCtx.beginPath();
      tbCtx.arc(32, 32, 6, 0, Math.PI * 2);
      tbCtx.fill();

      // Text
      tbCtx.fillStyle = '#ffffff';
      tbCtx.font = 'bold 22px "Inter", sans-serif';
      tbCtx.textAlign = 'left';
      tbCtx.textBaseline = 'middle';
      tbCtx.fillText('Table 1 Free', 48, 32);
    }
    const tbTexture = new THREE.CanvasTexture(tableBadgeCanvas);
    const tbSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tbTexture, depthTest: false, transparent: true }));
    tbSprite.position.set(-1.8, 1.25, -3.8);
    tbSprite.scale.set(1.4, 0.35, 1);
    this.furnitureGroup.add(tbSprite);

    // ------------------------------------------------------------------------
    // 5. LEFT SIDE LOUNGE: Magenta/Wine Sofa + Side Table + Floor Lamp
    // ------------------------------------------------------------------------
    const magentaMat = new THREE.MeshStandardMaterial({ color: 0x831843, roughness: 0.65 });
    const magentaCouch = new THREE.Group();
    const mBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.26, 0.85), magentaMat);
    mBase.position.y = 0.22;
    magentaCouch.add(mBase);

    const mBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.22), magentaMat);
    mBack.position.set(0, 0.56, 0.34);
    magentaCouch.add(mBack);

    magentaCouch.position.set(-5.6, 0, 2.6);
    magentaCouch.rotation.y = Math.PI / 2;
    this.furnitureGroup.add(magentaCouch);

    // Corner Floor Lamp (Golden Glow)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-5.8, 0, 4.8);
    const tripodMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), tripodMat);
    stem.position.y = 0.9;
    lampGroup.add(stem);

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.38, 20), shadeMat);
    shade.position.y = 1.8;
    lampGroup.add(shade);
    this.furnitureGroup.add(lampGroup);

    // Potted Monstera Tree (Back Left Corner)
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
    this.tvScreenLight.intensity = 1.8 + Math.sin(time) * 0.15;
  }

  public dispose() {
    this.roomGroup.clear();
    this.furnitureGroup.clear();
  }
}
