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
    this.scene.fog = new THREE.FogExp2(0x0e0917, 0.016);

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
    const ambientLight = new THREE.AmbientLight(0x382250, 1.85);
    this.scene.add(ambientLight);

    // 2. Ceiling Warm Fill Light
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight.position.set(-2, 9, 3);
    this.scene.add(dirLight);

    // 3. Neon Crescent Moon Light
    const moonLight = new THREE.PointLight(0xff2a85, 2.8, 10, 1.2);
    moonLight.position.set(0, 3.8, -5.9);
    this.scene.add(moonLight);

    // 4. TV Screen Glow Light (TV on the right wall X = 7.28, shines onto center)
    this.tvScreenLight = new THREE.PointLight(0x818cf8, 2.0, 11, 1.3);
    this.tvScreenLight.position.set(5.5, 2.35, 0.3);
    this.scene.add(this.tvScreenLight);

    // 5. Tripod Floor Lamp Light (Warm golden glow)
    const lampLight = new THREE.PointLight(0xfef08a, 2.2, 7, 1.3);
    lampLight.position.set(4.4, 2.0, -3.8);
    this.scene.add(lampLight);

    // 6. Red Rug Candle / Lantern Light (Left corner)
    const candleLight = new THREE.PointLight(0xf59e0b, 1.8, 5, 1.5);
    candleLight.position.set(-4.6, 0.55, -2.6);
    this.scene.add(candleLight);
  }

  private createWoodFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm honey-walnut horizontal wood planks (matching user screenshot)
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

          // Warm wood grain variations
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
    const floorGeo = new THREE.PlaneGeometry(16, 14);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createWoodFloorTexture(),
      roughness: 0.45,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    this.roomGroup.add(floor);

    // Deep Plum / Eggplant Purple Walls (matching user screenshot)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x24152e,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Right Wall (Cinema TV Wall)
    const rightWallGeo = new THREE.PlaneGeometry(14, 5.4);
    rightWallGeo.rotateY(-Math.PI / 2);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(7.5, 2.7, 0);
    this.roomGroup.add(rightWall);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(16, 5.4);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.7, -6.5);
    this.roomGroup.add(backWall);

    // Left Wall
    const leftWallGeo = new THREE.PlaneGeometry(14, 5.4);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-7.5, 2.7, 0);
    this.roomGroup.add(leftWall);

    // Dark Walnut Baseboard Trim & Horizontal Divider Molding
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0f0b18, roughness: 0.4 });
    const trimBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.08), trimMat);
    trimBack.position.set(0, 0.08, -6.46);
    this.roomGroup.add(trimBack);

    const railBack = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.06), trimMat);
    railBack.position.set(0, 1.9, -6.47);
    this.roomGroup.add(railBack);

    const trimRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 14), trimMat);
    trimRight.position.set(7.46, 0.08, 0);
    this.roomGroup.add(trimRight);

    const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 14), trimMat);
    railRight.position.set(7.47, 1.9, 0);
    this.roomGroup.add(railRight);
  }

  private buildSkylineWindow() {
    // Left-side panoramic skyline view
    const windowGroup = new THREE.Group();

    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#04050e');
      grad.addColorStop(0.5, '#0a0e22');
      grad.addColorStop(1, '#181630');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Lit windows
      ctx.fillStyle = '#fef08a';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 37) % 500, 120 + ((i * 23) % 120), 4, 6);
      }
    }

    const skyGeo = new THREE.PlaneGeometry(8, 3.6);
    skyGeo.rotateY(Math.PI / 2);
    const skyMesh = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCanvas) })
    );
    skyMesh.position.set(-7.45, 2.5, 1.5);
    windowGroup.add(skyMesh);

    this.roomGroup.add(windowGroup);
  }

  private buildNeonMoon() {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-2.0, 3.85, -6.4);

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
      emissiveIntensity: 2.4,
      roughness: 0.1,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = 0.3;
    moonGroup.add(moonMesh);

    this.roomGroup.add(moonGroup);
  }

  private buildTVUnit() {
    // -------------------------------------------------------------
    // Cinema TV Unit on the RIGHT wall (Matching user screenshot!)
    // -------------------------------------------------------------
    const tvGroup = new THREE.Group();

    const tvWidth = 5.8;
    const tvHeight = 3.25;

    // 1. TV Screen Mesh (Positioned on the RIGHT wall at X = 7.28, facing left towards -X)
    const tvScreenGeo = new THREE.PlaneGeometry(tvWidth, tvHeight);
    tvScreenGeo.rotateY(-Math.PI / 2);

    const tvMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    this.tvMesh = new THREE.Mesh(tvScreenGeo, tvMat);
    this.tvMesh.position.set(7.28, 2.35, 0.3);
    tvGroup.add(this.tvMesh);

    // 2. TV Bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x08080c, metalness: 0.8, roughness: 0.3 });
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, tvHeight + 0.18, tvWidth + 0.18),
      bezelMat
    );
    bezel.position.set(7.40, 2.35, 0.3);
    tvGroup.add(bezel);

    // 3. Electric Indigo/Purple LED Underglow Strip beneath TV (Matching user screenshot)
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, tvWidth), ledMat);
    ledStrip.position.set(7.26, 0.68, 0.3);
    tvGroup.add(ledStrip);

    // 4. Low Modern Media Console with Open Cubbies (Matching user screenshot)
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 0.4 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 5.8), shelfMat);
    shelf.position.set(6.95, 0.225, 0.3);
    tvGroup.add(shelf);

    // Cubby dividers
    const cubbyDivMat = new THREE.MeshStandardMaterial({ color: 0x14121a, roughness: 0.4 });
    for (let cz = -1.8; cz <= 2.4; cz += 1.1) {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.04), cubbyDivMat);
      divider.position.set(6.95, 0.225, cz);
      tvGroup.add(divider);
    }

    // Modern White Game Controller on left of console (Matching user screenshot!)
    const controllerGroup = new THREE.Group();
    controllerGroup.position.set(6.78, 0.48, 1.8);
    const padBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 })
    );
    controllerGroup.add(padBody);
    tvGroup.add(controllerGroup);

    // Soundbar in center
    const soundbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 })
    );
    soundbar.position.set(6.75, 0.495, 0.3);
    tvGroup.add(soundbar);

    // Potted Flower on right of console (Matching user screenshot!)
    const flowerPotGroup = new THREE.Group();
    flowerPotGroup.position.set(6.75, 0.45, -1.8);

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

  private buildFurniture() {
    // ------------------------------------------------------------------------
    // 1. CENTER AREA: Circular Dark Purple Rug + Arc of 3 Plush Purple Couches
    // ------------------------------------------------------------------------
    const purpleRugGeo = new THREE.CircleGeometry(3.2, 48);
    purpleRugGeo.rotateX(-Math.PI / 2);
    const purpleRugMat = new THREE.MeshStandardMaterial({
      color: 0x261445, // Deep violet purple (matching user screenshot)
      roughness: 0.85,
    });
    const purpleRug = new THREE.Mesh(purpleRugGeo, purpleRugMat);
    purpleRug.position.set(-0.6, 0.005, 0.4);
    this.furnitureGroup.add(purpleRug);

    // Plush Curved Purple Couches Factory
    const couchBodyMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed, // Rich vibrant purple velvet
      roughness: 0.58,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6, // Plush cushion purple
      roughness: 0.52,
    });
    const woodLegMat = new THREE.MeshStandardMaterial({
      color: 0x451a03, // Walnut wooden peg legs
      roughness: 0.4,
    });

    const createCurvedPlushCouch = (x: number, z: number, rotY: number) => {
      const couch = new THREE.Group();

      // Curved sculpted plinth base (using curved compound geometry)
      const baseGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.24, 24, 1, false, 0, Math.PI);
      baseGeo.scale(0.85, 1.0, 1.1);
      const base = new THREE.Mesh(baseGeo, couchBodyMat);
      base.position.set(0, 0.18, 0);
      couch.add(base);

      // Curved continuous ergonomic backrest
      const backGeo = new THREE.CylinderGeometry(1.02, 1.02, 0.44, 24, 1, true, 0, Math.PI);
      backGeo.scale(0.85, 1.0, 1.1);
      const backMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6, side: THREE.DoubleSide });
      const back = new THREE.Mesh(backGeo, backMat);
      back.position.set(0, 0.48, 0);
      couch.add(back);

      // Back cushion pillowy roll on top
      const rollGeo = new THREE.TorusGeometry(0.92, 0.08, 12, 24, Math.PI);
      rollGeo.rotateX(Math.PI / 2);
      rollGeo.scale(0.85, 1.1, 1.0);
      const roll = new THREE.Mesh(rollGeo, cushionMat);
      roll.position.set(0, 0.68, 0);
      couch.add(roll);

      // 2 Individual Plush Rounded Seat Cushions
      const createCushion = (cx: number, cz: number, crot: number) => {
        const cGeo = new THREE.CylinderGeometry(0.38, 0.36, 0.14, 20);
        cGeo.scale(1.0, 1.0, 1.15);
        const cushion = new THREE.Mesh(cGeo, cushionMat);
        cushion.position.set(cx, 0.32, cz);
        cushion.rotation.y = crot;
        couch.add(cushion);
      };

      createCushion(-0.38, 0.28, 0.2);
      createCushion(0.38, 0.28, -0.2);

      // Sculpted Rounded Armrests
      const armGeo = new THREE.CapsuleGeometry(0.09, 0.48, 8, 12);
      const armL = new THREE.Mesh(armGeo, couchBodyMat);
      armL.rotation.x = Math.PI / 2;
      armL.position.set(-0.85, 0.38, 0.32);
      couch.add(armL);

      const armR = new THREE.Mesh(armGeo, couchBodyMat);
      armR.rotation.x = Math.PI / 2;
      armR.position.set(0.85, 0.38, 0.32);
      couch.add(armR);

      // 4 Tapered Wooden Peg Legs (Angled outward like modern designer sofas)
      const createPegLeg = (lx: number, lz: number, tiltX: number, tiltZ: number) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.18, 12), woodLegMat);
        leg.position.set(lx, 0.09, lz);
        leg.rotation.x = tiltX;
        leg.rotation.z = tiltZ;
        couch.add(leg);
      };

      createPegLeg(-0.7, -0.3, -0.15, -0.15);
      createPegLeg(0.7, -0.3, -0.15, 0.15);
      createPegLeg(-0.75, 0.45, 0.15, -0.15);
      createPegLeg(0.75, 0.45, 0.15, 0.15);

      couch.position.set(x, 0, z);
      couch.rotation.y = rotY;
      return couch;
    };

    // 3 Purple Couches in an Arc facing the TV on the right (matching user screenshot)
    // Couch 1 (Front Left, angled toward TV)
    const couch1 = createCurvedPlushCouch(-1.5, 1.8, Math.PI / 4 + 0.3);
    this.furnitureGroup.add(couch1);

    // Couch 2 (Center Left, facing directly toward TV on right)
    const couch2 = createCurvedPlushCouch(-2.3, 0.3, Math.PI / 2);
    this.furnitureGroup.add(couch2);

    // Couch 3 (Back Left, angled toward TV)
    const couch3 = createCurvedPlushCouch(-1.5, -1.2, Math.PI / 2 + 0.5);
    this.furnitureGroup.add(couch3);

    // -------------------------------------------------------------
    // Center Round Coffee Table + Books + Potted Flower (user screenshot!)
    // -------------------------------------------------------------
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(-0.6, 0, 0.4);

    // Circular white/cream tabletop with smooth beveled edge
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Light cream marble/wood
      roughness: 0.25,
      metalness: 0.05,
    });
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 32), tableTopMat);
    tableTop.position.y = 0.34;
    coffeeTableGroup.add(tableTop);

    // 3 Angled Tapered Wooden Legs
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

    // Stack of Colorful Books on coffee table (Matching user screenshot!)
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

    // Potted Flower on coffee table (Matching user screenshot!)
    const potMat = new THREE.MeshStandardMaterial({ color: 0xe06d53, roughness: 0.6 });
    const flowerPot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.11, 16), potMat);
    flowerPot.position.set(0.18, 0.42, -0.05);
    coffeeTableGroup.add(flowerPot);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x16a34a })
    );
    stem.position.set(0.18, 0.52, -0.05);
    coffeeTableGroup.add(stem);

    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 })
    );
    flower.position.set(0.18, 0.58, -0.05);
    coffeeTableGroup.add(flower);

    this.furnitureGroup.add(coffeeTableGroup);

    // -------------------------------------------------------------
    // 2. BACK WALL: 4-Seater Magenta Couch + Side Table + Lamp + Tree (user screenshot)
    // -------------------------------------------------------------
    const magentaMat = new THREE.MeshStandardMaterial({
      color: 0x9d174d, // Deep vibrant magenta (matching user screenshot)
      roughness: 0.6,
    });
    const magentaCushionMat = new THREE.MeshStandardMaterial({
      color: 0xbe185d,
      roughness: 0.52,
    });

    const createMagentaSofa = (x: number, z: number) => {
      const sofa = new THREE.Group();

      // Long 4-seater base
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.82), magentaMat);
      base.position.y = 0.20;
      sofa.add(base);

      // Angled backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.50, 0.20), magentaMat);
      back.position.set(0, 0.52, -0.31);
      back.rotation.x = 0.08;
      sofa.add(back);

      // 4 Individual plush seat cushions (Matching user screenshot!)
      for (let i = 0; i < 4; i++) {
        const cx = -1.15 + i * 0.77;
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 0.62), magentaCushionMat);
        cushion.position.set(cx, 0.35, 0.04);
        sofa.add(cushion);

        const backCushion = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.36, 0.12), magentaCushionMat);
        backCushion.position.set(cx, 0.58, -0.22);
        backCushion.rotation.x = 0.1;
        sofa.add(backCushion);
      }

      // Rounded Armrests
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.40, 0.82), magentaMat);
      armL.position.set(-1.65, 0.38, 0);
      sofa.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.40, 0.82), magentaMat);
      armR.position.set(1.65, 0.38, 0);
      sofa.add(armR);

      // Wooden Legs
      const createLeg = (lx: number, lz: number) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.16, 12), woodLegMat);
        leg.position.set(lx, 0.08, lz);
        sofa.add(leg);
      };
      createLeg(-1.5, -0.32);
      createLeg(1.5, -0.32);
      createLeg(-1.5, 0.32);
      createLeg(1.5, 0.32);

      sofa.position.set(x, 0, z);
      return sofa;
    };

    const magentaSofa = createMagentaSofa(2.1, -4.6);
    this.furnitureGroup.add(magentaSofa);

    // Small Round Wooden Side Table with Flower next to magenta sofa (Matching user screenshot)
    const sideTable = new THREE.Group();
    sideTable.position.set(0.1, 0, -4.6);
    const stTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), woodLegMat);
    stTop.position.y = 0.42;
    sideTable.add(stTop);

    const stLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12), woodLegMat);
    stLeg.position.y = 0.21;
    sideTable.add(stLeg);

    const stPot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.10, 14), potMat);
    stPot.position.y = 0.49;
    sideTable.add(stPot);

    const stFlower = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf472b6 })
    );
    stFlower.position.y = 0.58;
    sideTable.add(stFlower);

    this.furnitureGroup.add(sideTable);

    // Tripod Floor Lamp (Matching user screenshot between sofa & TV!)
    const tripodLamp = new THREE.Group();
    tripodLamp.position.set(4.4, 0, -3.8);

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

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 24), shadeMat);
    lampShade.position.y = 1.95;
    tripodLamp.add(lampShade);

    this.furnitureGroup.add(tripodLamp);

    // Tall Potted Monstera Tree (Matching user screenshot next to TV!)
    const treeGroup = new THREE.Group();
    treeGroup.position.set(4.6, 0, -2.4);

    const planterPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.20, 0.48, 20),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    );
    planterPot.position.y = 0.24;
    treeGroup.add(planterPot);

    // Sculpted broad green leaves
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const leafAngle = (i * Math.PI * 2) / 6;
      const leafGeo = new THREE.SphereGeometry(0.26, 12, 12);
      leafGeo.scale(1.2, 0.15, 0.8);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(leafAngle) * 0.28, 0.65 + i * 0.08, Math.sin(leafAngle) * 0.28);
      leaf.rotation.y = leafAngle;
      leaf.rotation.z = 0.3;
      treeGroup.add(leaf);
    }
    this.furnitureGroup.add(treeGroup);

    // -------------------------------------------------------------
    // 3. BACK-LEFT AREA: Circular Red Rug + 4 Mustard Yellow Club Chairs (user screenshot)
    // -------------------------------------------------------------
    const redRugGeo = new THREE.CircleGeometry(2.1, 48);
    redRugGeo.rotateX(-Math.PI / 2);
    const redRugMat = new THREE.MeshStandardMaterial({
      color: 0x481424,
      roughness: 0.85,
    });
    const redRug = new THREE.Mesh(redRugGeo, redRugMat);
    redRug.position.set(-4.6, 0.005, -2.6);
    this.furnitureGroup.add(redRug);

    // Mustard Yellow Club Armchairs (Plush curved tub chairs from user screenshot)
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.55,
    });

    const createClubArmchair = (x: number, z: number, rotY: number) => {
      const chair = new THREE.Group();

      // Circular seat cushion
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24), yellowMat);
      seat.position.y = 0.24;
      chair.add(seat);

      // Curved tub/barrel backrest
      const tubGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.38, 24, 1, true, 0, Math.PI * 1.2);
      const tubMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6, side: THREE.DoubleSide });
      const tub = new THREE.Mesh(tubGeo, tubMat);
      tub.position.set(0, 0.42, -0.05);
      tub.rotation.y = Math.PI * 0.9;
      chair.add(tub);

      // 4 Wooden legs
      const createLeg = (lx: number, lz: number) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.18, 12), woodLegMat);
        leg.position.set(lx, 0.09, lz);
        chair.add(leg);
      };
      createLeg(-0.24, -0.24);
      createLeg(0.24, -0.24);
      createLeg(-0.24, 0.24);
      createLeg(0.24, 0.24);

      chair.position.set(x, 0, z);
      chair.rotation.y = rotY;
      return chair;
    };

    this.furnitureGroup.add(createClubArmchair(-4.6, -3.6, 0));             // North
    this.furnitureGroup.add(createClubArmchair(-4.6, -1.6, Math.PI));       // South
    this.furnitureGroup.add(createClubArmchair(-5.6, -2.6, Math.PI / 2));  // West
    this.furnitureGroup.add(createClubArmchair(-3.6, -2.6, -Math.PI / 2)); // East

    // Center round table with lantern
    const lanternTable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.40, 0.40, 0.26, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.4 })
    );
    lanternTable.position.set(-4.6, 0.13, -2.6);
    this.furnitureGroup.add(lanternTable);

    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );
    lantern.position.set(-4.6, 0.35, -2.6);
    this.furnitureGroup.add(lantern);

    // -------------------------------------------------------------
    // 4. FRONT-RIGHT AREA: Teal Pouf / Stools (user screenshot)
    // -------------------------------------------------------------
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.5 });
    const stoolGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 20);
    const stool = new THREE.Mesh(stoolGeo, stoolMat);
    stool.position.set(0.6, 0.14, 2.6);
    this.furnitureGroup.add(stool);
  }

  public update() {
    const time = Date.now() * 0.002;
    this.tvScreenLight.intensity = 2.0 + Math.sin(time) * 0.15;
  }

  public dispose() {
    this.roomGroup.clear();
    this.furnitureGroup.clear();
  }
}
