// Vela Bay itself: the sunset city. Builds the sky dome, the sun, the
// bay and the canal, the road grid, the buildings, the palms, the
// boardwalk, the causeway to Isla Luna, the ferris wheel and the marina
// — all from one seeded random stream so every load looks identical.
// Returns the collision boxes, the water regions, the traffic loops and
// the animated bits the main loop has to tick (water, ferris wheel,
// clouds).

import * as THREE from 'three';
import { TOWN, HUES, WATERS } from './config.js';
import { rng32, choose, between, intBetween, windowsCanvas, stripWindowsCanvas, signCanvas, glowCanvas, sunDiscCanvas, stripedAwningCanvas, verticalSignCanvas } from './util.js';

const shadeCache = new Map();
function shade(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!shadeCache.has(key)) {
    shadeCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts }));
  }
  return shadeCache.get(key);
}

function block(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shade(color, opts));
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = true;
  return m;
}

function tube(rt, rb, h, color, opts = {}, segments = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), shade(color, opts));
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = true;
  return m;
}

function inWater(x, z) {
  for (const r of WATERS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}

// Ground height: flat everywhere except Isla Luna, where the ground rises
// smoothly from the shore to the island top (2.7 m) so a car can drive up
// from the causeway without clipping through the island mound — and except
// the causeway itself, whose deck sits 7.6 m up, reached by ramps at both
// ends, so a car (or a pedestrian) can cross the bay to Isla Luna.
const ISLAND_TOP = 2.7;
function floorAt(x, z) {
  let h = 0;
  const d = Math.hypot(x - TOWN.island.x, z - TOWN.island.z);
  if (d < 66) {
    if (d <= 50) h = ISLAND_TOP;
    else {
      const t = (66 - d) / 16; // 0 at the shore, 1 at the island edge
      h = ISLAND_TOP * t * t * (3 - 2 * t);
    }
  }
  if (Math.abs(x - TOWN.causewayX) < 6.4 && z >= 175 && z <= 325) {
    let ch;
    if (z < 197) ch = 3.8 + 0.331 * (z - 186); // north ramp up to the deck
    else if (z <= 303) ch = 7.6; // the deck
    else ch = 3.8 - 0.331 * (z - 314); // south ramp down to the island
    h = Math.max(h, Math.max(0, ch));
  }
  return h;
}

function palmTree(rng, height) {
  const palm = new THREE.Group();
  const trunk = tube(0.22, 0.34, height, 0x8a6a4a, {}, 7);
  trunk.position.y = height / 2;
  trunk.rotation.z = between(rng, -0.08, 0.08);
  palm.add(trunk);
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 3.4, 4),
      shade(0x2fb85e, { roughness: 0.9 }),
    );
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.4;
    frond.position.set(Math.cos(a) * 1.3, height + 0.4, Math.sin(a) * 1.3);
    frond.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9);
    frond.scale.set(1, 1, 0.28);
    frond.castShadow = true;
    palm.add(frond);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), shade(0x6b4a2a));
  nuts.position.y = height - 0.2;
  palm.add(nuts);
  return palm;
}

// A leafy shade tree: a straight trunk and a big round canopy, so the
// sidewalks read green from a distance — palms alone are too thin.
function leafyTree(rng, height) {
  const tree = new THREE.Group();
  const trunk = tube(0.22, 0.32, height * 0.6, 0x6a4a32, {}, 7);
  trunk.position.y = height * 0.3;
  tree.add(trunk);
  const canopyColors = [0x3fae4f, 0x5ac83f, 0x2f9a5a, 0x7ac83f];
  const puffs = intBetween(rng, 2, 3);
  for (let i = 0; i < puffs; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(between(rng, 1.6, 2.4), 8, 6),
      shade(choose(rng, canopyColors), { roughness: 1 }),
    );
    s.position.set(between(rng, -1, 1), height * 0.6 + between(rng, 0.4, 1.4), between(rng, -1, 1));
    s.scale.y = 0.75;
    s.castShadow = true;
    tree.add(s);
  }
  return tree;
}

function lampPost() {
  const g = new THREE.Group();
  const pole = tube(0.09, 0.12, 6.4, 0x2a2d3a, {}, 6);
  pole.position.y = 3.2;
  g.add(pole);
  const arm = block(1.6, 0.12, 0.12, 0x2a2d3a);
  arm.position.set(0.7, 6.3, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc93c, emissiveIntensity: 1.6 }),
  );
  lamp.position.set(1.4, 6.2, 0);
  g.add(lamp);
  return g;
}

// A seafront balcony: a thin floor slab and a low railing, like the
// balconies on the Marisol coastal buildings. Sticks out from the face
// it is placed on, so a flat facade gains real depth.
function balcony(width, color) {
  const g = new THREE.Group();
  const slab = block(width, 0.3, 1.6, color);
  slab.position.set(0, 0, 0.8);
  g.add(slab);
  const rail = block(width, 0.9, 0.12, 0x2a2d3a);
  rail.position.set(0, 0.6, 1.55);
  g.add(rail);
  return g;
}

export function buildTown(scene) {
  const rng = rng32(TOWN.seed);
  // A separate stream for the v5 decorative details (balcony colours,
  // striped awnings, blade signs), so they never consume from the main
  // stream and the seeded town layout — building spots, parked cars,
  // trees — stays exactly as it was.
  const decorRng = rng32(TOWN.seed + 777);
  const colliders = [];
  const parkedCars = [];
  const animated = { waterMats: [], ferris: null, clouds: [], heliPad: null };
  const loops = [];
  const sidewalkSpots = [];

  // ---- sky, sun, fog, light -------------------------------------------
  // A rich sunset sky like the references: deep violet overhead (Marisol),
  // purple-pink in the middle, soft pink at the horizon, and a warm
  // peach-orange glow that pools around the sun (Halcyon) — so the sky
  // reads as a real sunset from any angle, never a flat pink wash.
  // The sun sits north-west, upper-left in the north-looking title,
  // chase and end shots like the Halcyon sun — inside the frame, clear
  // of the skyline towers, and high enough that its light clears the
  // downtown rooftops instead of hiding behind them.
  const SUN_POS = new THREE.Vector3(-160, 181, -411);
  const SUN_DIR = SUN_POS.clone().normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(HUES.skyTop) },
      mid: { value: new THREE.Color(HUES.skyBand) },
      horizon: { value: new THREE.Color(HUES.skyHorizon) },
      warm: { value: new THREE.Color(HUES.skyWarm) },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 warm; uniform vec3 sunDir;
      void main() {
        vec3 dir = normalize(vPos);
        float h = dir.y;
        // Four-stop vertical gradient: violet top, purple-pink middle,
        // soft pink horizon, warm peach at the very bottom of the sky.
        vec3 c = h > 0.35 ? mix(mid, top, smoothstep(0.35, 0.85, h))
                : h > 0.08 ? mix(horizon, mid, smoothstep(0.08, 0.35, h))
                : mix(warm, horizon, smoothstep(-0.05, 0.08, h));
        // Warm glow around the sun: the sky near the sun burns peach and
        // gold, fading to the pink-violet gradient away from it.
        float glow = pow(max(dot(dir, sunDir), 0.0), 4.0);
        c = mix(c, warm, glow * 0.75);
        // A faint bright core right at the sun, so the glow feels lit —
        // kept dimmer than the sun disc itself, so the disc still reads
        // as a distinct circle against the glow.
        float core = pow(max(dot(dir, sunDir), 0.0), 24.0);
        c = mix(c, vec3(1.0, 0.85, 0.55), core * 0.55);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);

  scene.fog = new THREE.Fog(HUES.haze, 180, 900);

  // Low late-afternoon sun in the north-west, over the city skyline —
  // so the big sun sits in the frame of the north-looking title, chase
  // and end cameras, upper-left like the Halcyon title. Warm peach
  // light, so buildings, trees, cars and characters throw long, soft,
  // clearly readable shadows across the streets, like a real afternoon
  // photograph.
  const sun = new THREE.DirectionalLight(0xffc8a0, 3.0);
  sun.position.set(-200, 120, -600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240; sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -240;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xc8a8d8, 0x8a6a54, 1.3));
  // Warm bounce light from the south, off the sunlit bay — so Rex, the
  // hero car and every south-facing facade stay warmly lit even though
  // the sun itself sits behind them in the north-west.
  const fill = new THREE.DirectionalLight(0xffc0a0, 0.7);
  fill.position.set(100, 90, 300);
  scene.add(fill);

  // The sun itself: a big golden disc, rendered as a sprite so it is
  // always round from any camera (a flat circle shears into a thin
  // triangle at a glancing angle), plus a broad warm halo. The disc sits
  // north-west over the skyline, upper-left in the title and chase
  // shots, like the Halcyon sun.
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunDiscCanvas()), fog: false, transparent: true, depthWrite: false }));
  sunDisc.scale.set(150, 150, 1);
  sunDisc.position.copy(SUN_POS);
  sunDisc.renderOrder = 2; // the crisp disc draws on top of the halo
  scene.add(sunDisc);
  const glowTex = new THREE.CanvasTexture(glowCanvas('rgba(255,180,90,0.75)', 'rgba(255,140,80,0)'));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, transparent: true, depthWrite: false }));
  halo.scale.set(450, 450, 1);
  halo.position.copy(SUN_POS);
  halo.renderOrder = 1;
  scene.add(halo);

  // Drifting clouds, soft white-pink in the afternoon light, a few of
  // them catching the warm glow near the sun. (Kept at nine clouds with
  // the v4 random calls, so the seeded town layout after them is
  // unchanged — only their size and spacing grew.)
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = intBetween(rng, 3, 5);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(between(rng, 9, 18), 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xfff0f5, roughness: 1, transparent: true, opacity: 0.9, emissive: 0xd08090, emissiveIntensity: 0.35 }),
      );
      s.position.set(p * 14 - puffs * 7, between(rng, -2, 3), between(rng, -4, 4));
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set(between(rng, -420, 420), between(rng, 90, 170), between(rng, -380, 380));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // ---- ground, beach, water --------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    shade(HUES.ground, { roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(760, 26), shade(HUES.sand, { roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, 196);
  sand.receiveShadow = true;
  scene.add(sand);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    opacity: 0.94,
    fog: false, // no fog chunks in this shader; three.js would fault on missing fog uniforms
    uniforms: { time: { value: 0 }, shallow: { value: new THREE.Color(0x2fc8e8) }, deep: { value: new THREE.Color(HUES.seaDeep) } },
    vertexShader: `
      uniform float time; varying vec2 vUv; varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        vWave = sin(p.x * 0.08 + time * 1.4) * 0.35 + cos(p.y * 0.06 + time * 0.9) * 0.35;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float time; uniform vec3 shallow; uniform vec3 deep;
      varying vec2 vUv; varying float vWave;
      void main() {
        float sparkle = smoothstep(0.55, 0.95, sin(vUv.x * 320.0 + time * 2.0) * sin(vUv.y * 260.0 - time * 1.6));
        vec3 c = mix(deep, shallow, 0.52 + 0.22 * vWave + 0.3 * sparkle);
        gl_FragColor = vec4(c, 0.94);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(860, 240), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.35, 320);
  scene.add(water);
  animated.waterMats.push(waterMat);

  const canalMat = waterMat.clone();
  canalMat.uniforms = { time: waterMat.uniforms.time, shallow: { value: new THREE.Color(0x2fc8e8) }, deep: { value: new THREE.Color(HUES.seaDeep) } };
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(32, 390), canalMat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(156, 0.35, 10);
  scene.add(canal);
  animated.waterMats.push(canalMat);

  const marinaMat = waterMat.clone();
  marinaMat.uniforms = { time: waterMat.uniforms.time, shallow: { value: new THREE.Color(0x2fc8e8) }, deep: { value: new THREE.Color(HUES.seaDeep) } };
  const marina = new THREE.Mesh(new THREE.PlaneGeometry(62, 112), marinaMat);
  marina.rotation.x = -Math.PI / 2;
  marina.position.set(-177, 0.35, 148);
  scene.add(marina);
  animated.waterMats.push(marinaMat);

  // ---- roads and sidewalks ----------------------------------------------
  const roadTexCanvas = document.createElement('canvas');
  roadTexCanvas.width = 64; roadTexCanvas.height = 64;
  {
    const g = roadTexCanvas.getContext('2d');
    g.fillStyle = '#38343f'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f5c542'; g.fillRect(30, 4, 4, 24); g.fillRect(30, 36, 4, 24);
  }
  const roadTex = new THREE.CanvasTexture(roadTexCanvas);
  roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;

  function roadStrip(x, z, w, d, repeatX, repeatZ) {
    const t = roadTex.clone();
    t.needsUpdate = true;
    t.repeat.set(repeatX, repeatZ);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.12 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.12, z);
    m.receiveShadow = true;
    scene.add(m);
  }

  for (const x of TOWN.boulevards) {
    roadStrip(x, 0, 12, 372, 1, 12);
    const walkL = new THREE.Mesh(new THREE.PlaneGeometry(4, 372), shade(HUES.walk, { roughness: 1 }));
    walkL.rotation.x = -Math.PI / 2; walkL.position.set(x - 8, 0.1, 0); walkL.receiveShadow = true;
    scene.add(walkL);
    const walkR = walkL.clone(); walkR.position.x = x + 8; scene.add(walkR);
  }
  for (const z of TOWN.streets) {
    roadStrip(0, z, 372, 12, 12, 1);
    const walkT = new THREE.Mesh(new THREE.PlaneGeometry(372, 4), shade(HUES.walk, { roughness: 1 }));
    walkT.rotation.x = -Math.PI / 2; walkT.position.set(0, 0.1, z - 8); walkT.receiveShadow = true;
    scene.add(walkT);
    const walkB = walkT.clone(); walkB.position.z = z + 8; scene.add(walkB);
  }

  // ---- buildings ----------------------------------------------------------
  // Fourteen facades, four window styles and three height bands, so no
  // two blocks look alike: low shops with awnings, mid flats, tall
  // office slabs, each with its own window pattern and rooftop clutter.
  // Coastal seafront facades like the Marisol references: warm cream,
  // soft pink, teal, white, coral, pale yellow and sky blue — so the
  // city reads as a colourful beach town, not a grey office district.
  // No two blocks look alike.
  const facadeColors = [
    0xf2e8d8, 0xffb8c8, 0x4ad8c8, 0xf8f8f0, 0xff8a7a, 0xffd88a,
    0x8fc8e8, 0xd8c8e8, 0xa8d8b8, 0xffc8a8, 0xff7a9e, 0x6ac8d8,
    0xe8d0b8, 0xc8e8d8, 0xffa8b8, 0x9fd8e8, 0xf0c8a8, 0x7ab8d8,
  ];
  const windowStyles = [
    { base: '#3a3348', lit: 0.55, palette: 'warm' },
    { base: '#2e2a3e', lit: 0.7, palette: 'warm' },
    { base: '#4a4038', lit: 0.35, palette: 'warm' },
    { base: '#1e2a3a', lit: 0.5, palette: 'cool' },
  ];
  const signTexts = [
    ['VELA', 'GRAND CASINO'], ['HOTEL', 'LUNA'], ['TIDE', 'MARKET'],
    ['PALM', 'COURT'], ['SUNSET', 'MOTEL'], ['MARINA', 'YACHT CLUB'],
  ];
  let signIndex = 0;

  for (let ai = 0; ai < TOWN.boulevards.length - 1; ai++) {
    for (let si = 0; si < TOWN.streets.length - 1; si++) {
      const x0 = TOWN.boulevards[ai] + 11, x1 = TOWN.boulevards[ai + 1] - 11;
      const z0 = TOWN.streets[si] + 11, z1 = TOWN.streets[si + 1] - 11;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // Skip blocks drowned by the canal, the marina or the beach.
      if (x0 < TOWN.canal.x1 && x1 > TOWN.canal.x0) continue;
      if (x0 < TOWN.marina.x1 && x1 > TOWN.marina.x0 && z0 < TOWN.marina.z1 && z1 > TOWN.marina.z0) continue;
      if (z1 > 178) continue;
      const downtown = Math.abs(cx) < 80 && Math.abs(cz) < 80;
      const roll = rng();
      if (roll < 0.14) {
        // A pocket park: palms, benches, a fountain square.
        for (let p = 0; p < 5; p++) {
          const palm = palmTree(rng, between(rng, 5, 8));
          palm.position.set(between(rng, x0 + 4, x1 - 4), 0, between(rng, z0 + 4, z1 - 4));
          scene.add(palm);
        }
        const fountain = tube(2.2, 2.6, 0.8, 0x9fc8d8, {}, 12);
        fountain.position.set(cx, 0.4, cz);
        scene.add(fountain);
        sidewalkSpots.push({ x: cx, z: cz });
        continue;
      }
      const count = downtown ? intBetween(rng, 2, 3) : intBetween(rng, 1, 2);
      for (let b = 0; b < count; b++) {
        const w = between(rng, 14, Math.min(30, x1 - x0 - 6));
        const d = between(rng, 12, Math.min(26, z1 - z0 - 6));
        // Height bands: low shops, mid flats, tall slabs.
        const hr = rng();
        const h = downtown
          ? hr < 0.3 ? between(rng, 6, 12) : hr < 0.7 ? between(rng, 14, 28) : between(rng, 30, 48)
          : hr < 0.25 ? between(rng, 6, 9) : between(rng, 8, 22);
        const bx = between(rng, x0 + w / 2 + 2, x1 - w / 2 - 2);
        const bz = between(rng, z0 + d / 2 + 2, z1 - d / 2 - 2);
        const color = choose(rng, facadeColors);
        const ws = choose(rng, windowStyles);
        const winTex = new THREE.CanvasTexture(windowsCanvas(rng, ws.base, ws.lit, ws.palette));
        winTex.wrapS = THREE.RepeatWrapping; winTex.wrapT = THREE.RepeatWrapping;
        winTex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        const walls = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        // Windows on all four sides, so a building reads as detailed from
        // any angle — a plain side wall is what made the chase shot look
        // like a blank beige box.
        const faces = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 }),
            new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 }),
            new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 1 }),
            walls,
            new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 }),
            new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 })],
        );
        faces.position.set(bx, h / 2, bz);
        faces.castShadow = true; faces.receiveShadow = true;
        scene.add(faces);
        // Seafront balconies on mid-rise buildings, like the Marisol
        // coastal flats: two per floor above the ground floor, on the
        // street-facing side, so the facade has real depth instead of a
        // flat printed wall.
        if (h >= 12 && h <= 30) {
          const floors = Math.floor(h / 5);
          const balColor = choose(decorRng, [0xf8f8f0, 0x2a2d3a, 0x8a6a4a, 0x4ad8c8]);
          for (let f = 1; f < floors; f++) {
            for (const off of [-w / 4, w / 4]) {
              const bal = balcony(Math.min(5, w * 0.3), balColor);
              bal.position.set(bx + off, f * 5, bz + d / 2);
              scene.add(bal);
            }
          }
        }
        // A setback crown on the tallest slabs, so the skyline steps.
        if (h > 30) {
          const crown = block(w * 0.55, 3.5, d * 0.55, color);
          crown.position.set(bx, h + 1.75, bz);
          scene.add(crown);
          const antenna = tube(0.12, 0.2, 7, 0x2a2d3a, {}, 6);
          antenna.position.set(bx + w * 0.2, h + 7, bz);
          scene.add(antenna);
          const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 2 }),
          );
          tip.position.set(bx + w * 0.2, h + 10.6, bz);
          scene.add(tip);
        }
        // Rooftop clutter.
        const ac = block(between(rng, 2, 4), 1.2, between(rng, 2, 3), 0x6a6a72);
        ac.position.set(bx + between(rng, -w / 4, w / 4), h + 0.6, bz + between(rng, -d / 4, d / 4));
        scene.add(ac);
        if (rng() < 0.3) {
          const tank = tube(1.1, 1.1, 2.4, 0x8a7a6a, {}, 8);
          tank.position.set(bx - w / 4, h + 1.2, bz - d / 4);
          scene.add(tank);
        }
        // Low shops get a striped awning and a small shop sign over the
        // door, so the street level reads as storefronts, not blank walls.
        if (h <= 12) {
          // A striped awning, purple-and-white or teal-and-white like the
          // Marisol seafront shops — a tilted plane with a striped canvas.
          const stripePair = choose(rng, [['#b06ad8', '#ffffff'], ['#14d8c8', '#ffffff'], ['#ff7ab8', '#ffffff'], ['#ffb020', '#ffffff']]);
          const awnTex = new THREE.CanvasTexture(stripedAwningCanvas(stripePair[0], stripePair[1]));
          const awn = new THREE.Mesh(
            new THREE.PlaneGeometry(w * 0.7, 2.2),
            new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.9, side: THREE.DoubleSide }),
          );
          awn.position.set(bx, 3.4, bz + d / 2 + 1.0);
          awn.rotation.x = -Math.PI / 2 + 0.25;
          awn.castShadow = true;
          scene.add(awn);
          const shopWord = choose(rng, ['CAFE', 'TACOS', 'SURF SHOP', 'BAR', 'PIZZA', 'FLOWERS']);
          const shopTex = new THREE.CanvasTexture(signCanvas([shopWord], '#fff', '#241a33'));
          const shopSign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(10, w * 0.6), 1.6),
            new THREE.MeshStandardMaterial({
              map: shopTex, emissive: 0xffffff, emissiveMap: shopTex,
              emissiveIntensity: 0.5,
            }),
          );
          shopSign.position.set(bx, 4.8, bz + d / 2 + 0.15);
          scene.add(shopSign);
        }
        // A tall vertical blade sign on some mid-rise buildings, like the
        // neon "MIRAGE" blade on the Marisol seafront — it reads from
        // down the street and gives the facade a landmark.
        if (h > 12 && h <= 30 && decorRng() < 0.35) {
          const bladeWord = choose(decorRng, ['VELA', 'LUNA', 'TIDE', 'PALM', 'SOL', 'MARINA']);
          const bladeTex = new THREE.CanvasTexture(verticalSignCanvas(bladeWord, '#ffd27a', '#241a33'));
          const blade = new THREE.Mesh(
            new THREE.PlaneGeometry(2.2, 9),
            new THREE.MeshStandardMaterial({
              map: bladeTex, emissive: 0xffffff, emissiveMap: bladeTex,
              emissiveIntensity: 0.7, side: THREE.DoubleSide,
            }),
          );
          blade.position.set(bx + w / 2 + 0.3, h * 0.6, bz + d / 2 + 0.3);
          scene.add(blade);
        }
        // A neon sign on some taller buildings.
        if (h > 22 && signIndex < signTexts.length && rng() < 0.6) {
          const [l1, l2] = signTexts[signIndex++];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 6),
            new THREE.MeshStandardMaterial({
              map: new THREE.CanvasTexture(signCanvas([l1], '#ffd27a', '#241a33', l2)),
              emissive: 0xffffff, emissiveMap: new THREE.CanvasTexture(signCanvas([l1], '#ffd27a', '#241a33', l2)),
              emissiveIntensity: 0.9,
            }),
          );
          sign.position.set(bx, h - 4, bz + d / 2 + 0.15);
          scene.add(sign);
        }
        colliders.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 });
      }
      // A parked car in some blocks — free to steal. It parks at the kerb,
      // on the road's edge, so it can always drive away (never boxed in by
      // a building inside the block).
      if (rng() < 0.5) {
        parkedCars.push({ x: TOWN.boulevards[ai] + 7, z: cz + between(rng, -16, 16), heading: choose(rng, [0, Math.PI]) });
      }
      sidewalkSpots.push({ x: cx, z: cz });
    }
  }

  // ---- the distant coastal skyline ---------------------------------------
  // A seafront skyline far north of the grid, like the Halcyon Keys
  // background: tall slim towers in hazy pastel colours, spread out
  // along the horizon with varied heights, so they read as a beach
  // city's skyline instead of a dense downtown. Their windows glow, so
  // they cut through the afternoon haze instead of washing out. The
  // western stretch is left open, so the big sun sits clear of the
  // towers in the title and chase shots.
  function coastalTower(x, z, spec) {
    // A slim slab, optionally with a narrower top slab, then a small
    // crown: a thin antenna with a red beacon, a slim spire, or a flat
    // roof.
    let y = 0;
    for (const t of spec.tiers) {
      const winTex = new THREE.CanvasTexture(stripWindowsCanvas(rng, spec.base, 0.62, spec.palette || 'warm'));
      winTex.wrapS = THREE.RepeatWrapping; winTex.wrapT = THREE.RepeatWrapping;
      winTex.repeat.set(Math.max(1, Math.round(t.w / 10)), Math.max(1, Math.round(t.h / 14)));
      const faceMat = new THREE.MeshStandardMaterial({
        map: winTex, emissive: 0xffffff, emissiveMap: winTex,
        emissiveIntensity: 0.6, roughness: 0.55, metalness: 0.15,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 1 });
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(t.w, t.h, t.d),
        [faceMat, faceMat, roofMat, faceMat, faceMat, faceMat],
      );
      tier.position.set(x, y + t.h / 2, z);
      tier.castShadow = true; tier.receiveShadow = true;
      scene.add(tier);
      y += t.h;
    }
    if (spec.crown === 'antenna') {
      const ant = tube(0.18, 0.3, 12, 0x2a2d3a, {}, 6);
      ant.position.set(x, y + 6, z);
      scene.add(ant);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 2.5 }),
      );
      beacon.position.set(x, y + 12.5, z);
      scene.add(beacon);
    } else if (spec.crown === 'spire') {
      // A slim spire, like the rooftop masts on the Halcyon towers.
      const mast = tube(0.4, 1.0, 16, 0x8a7a62, {}, 8);
      mast.position.set(x, y + 8, z);
      scene.add(mast);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 2.5 }),
      );
      beacon.position.set(x, y + 16.5, z);
      scene.add(beacon);
    }
    // 'flat' needs no crown — the slab's roof is the top.
    const baseW = spec.tiers[0].w, baseD = spec.tiers[0].d;
    colliders.push({ x0: x - baseW / 2, x1: x + baseW / 2, z0: z - baseD / 2, z1: z + baseD / 2 });
  }
  {
    // Hand-placed coastal towers, tallest of the skyline. Slim pastel
    // slabs with lit windows — the Halcyon Keys background skyline, not
    // a downtown cluster. The western stretch stays open so the big sun
    // sits clear of the towers, upper-left like the Halcyon title.
    const skyline = [
      { x: -60, z: -335, w: 18, h: 120, base: '#f2e8d8', palette: 'warm', crown: 'flat' },
      { x: -20, z: -360, w: 16, h: 150, base: '#ffc8d8', palette: 'warm', crown: 'antenna' },
      { x: 20, z: -330, w: 20, h: 190, base: '#a8c8e8', palette: 'cool', crown: 'spire' },
      { x: 60, z: -355, w: 18, h: 130, base: '#f8f8f0', palette: 'warm', crown: 'flat' },
      { x: 100, z: -335, w: 16, h: 165, base: '#8fc8e8', palette: 'cool', crown: 'antenna' },
      { x: 140, z: -365, w: 20, h: 200, base: '#ffd88a', palette: 'warm', crown: 'spire' },
      { x: 180, z: -330, w: 16, h: 120, base: '#d8c8e8', palette: 'warm', crown: 'flat' },
      { x: 220, z: -355, w: 18, h: 155, base: '#a8d8c8', palette: 'cool', crown: 'antenna' },
      { x: 255, z: -335, w: 16, h: 100, base: '#f2e8d8', palette: 'warm', crown: 'flat' },
      { x: -40, z: -390, w: 16, h: 95, base: '#ffb8a8', palette: 'warm', crown: 'flat' },
      { x: 80, z: -390, w: 18, h: 140, base: '#9fd8e8', palette: 'cool', crown: 'antenna' },
      { x: 170, z: -385, w: 16, h: 105, base: '#ffd8a8', palette: 'warm', crown: 'flat' },
    ];
    for (const f of skyline) {
      const tiers = f.h > 140
        ? [{ w: f.w, d: f.w * 0.85, h: f.h * 0.65 }, { w: f.w * 0.7, d: f.w * 0.6, h: f.h * 0.35 }]
        : [{ w: f.w, d: f.w * 0.85, h: f.h }];
      coastalTower(f.x, f.z, { base: f.base, palette: f.palette, crown: f.crown, tiers });
    }
  }

  // ---- billboards ---------------------------------------------------------
  // Big colourful roadside and rooftop ads — the GTA signature. A helper
  // builds one from a canvas ad; the rest place them where the cameras
  // look: along the main avenue, on downtown rooftops, by the marina.
  function billboard(lines, fg, bg, w, h, sub) {
    const tex = new THREE.CanvasTexture(signCanvas(lines, fg, bg, sub));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6,
      }),
    );
    m.castShadow = false;
    return m;
  }
  const ads = [
    [['VELA GT'], '#14e0c8', '#14161f'],
    [['SUNSET'], '#ffd27a', '#ff5e5e', 'COLA'],
    [['TIDE'], '#fff', '#1468c8', 'ENERGY DRINK'],
    [['PALM HOTEL'], '#ffb020', '#241a33'],
    [['GRAND'], '#ffd27a', '#7a1a5a', 'CASINO'],
    [['SURF’S UP'], '#fff', '#0e8a6a'],
    [['BAY BURGER'], '#ff8a3c', '#3a1a0e'],
    [['NEON NIGHTS'], '#ff7ab8', '#1a1030'],
  ];
  // Freestanding roadside billboards on tall poles, facing the avenue.
  const roadBoards = [
    { x: 10, z: 40, ry: Math.PI / 2 }, { x: -10, z: -40, ry: -Math.PI / 2 },
    { x: 10, z: -100, ry: Math.PI / 2 }, { x: -10, z: 100, ry: -Math.PI / 2 },
    { x: 130, z: 40, ry: Math.PI / 2 }, { x: -130, z: -100, ry: -Math.PI / 2 },
    { x: 70, z: 130, ry: Math.PI }, { x: -70, z: -130, ry: 0 },
  ];
  for (let i = 0; i < roadBoards.length; i++) {
    const b = roadBoards[i];
    const [lines, fg, bg, sub] = ads[i % ads.length];
    const pole = tube(0.35, 0.45, 9, 0x2a2d3a, {}, 6);
    pole.position.set(b.x, 4.5, b.z);
    scene.add(pole);
    const board = billboard(lines, fg, bg, 13, 6.5, sub);
    board.position.set(b.x, 12.5, b.z);
    board.rotation.y = b.ry;
    scene.add(board);
  }
  // Two big rooftop billboards over downtown, angled at the avenue.
  for (const [bx, bz, ry, ai] of [[-30, -30, Math.PI / 4, 0], [30, 30, -Math.PI * 0.75, 4]]) {
    const [lines, fg, bg, sub] = ads[ai];
    const tex = new THREE.CanvasTexture(signCanvas(lines, fg, bg, sub));
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.6,
      }),
    );
    board.position.set(bx, 52, bz);
    board.rotation.y = ry;
    scene.add(board);
    const legs = block(0.6, 6, 0.6, 0x2a2d3a);
    legs.position.set(bx, 46, bz);
    scene.add(legs);
  }

  // ---- palms, leafy trees, streetlights along the boulevards ------------
  // Dense and mixed: a palm or a leafy shade tree every ~22 m on both
  // sidewalks, so the streets read green and alive from the chase camera.
  for (const x of TOWN.boulevards) {
    for (let z = -170; z <= 170; z += 22) {
      if (inWater(x + 10, z) || inWater(x - 10, z)) continue;
      if (rng() < 0.85) {
        const side = rng() < 0.5 ? -10.5 : 10.5;
        const tree = rng() < 0.55
          ? palmTree(rng, between(rng, 6, 9))
          : leafyTree(rng, between(rng, 4.5, 6.5));
        tree.position.set(x + side, 0, z + between(rng, -5, 5));
        scene.add(tree);
      }
    }
  }
  // A green row along the boardwalk, where the title and end shots look.
  for (let x = -170; x <= 170; x += 18) {
    if (inWater(x, 182)) continue;
    if (rng() < 0.75) {
      const tree = rng() < 0.5 ? palmTree(rng, between(rng, 6, 8.5)) : leafyTree(rng, between(rng, 4.5, 6));
      tree.position.set(x + between(rng, -3, 3), 0, 182 + between(rng, 0, 4));
      scene.add(tree);
    }
  }
  for (const x of [-180, -60, 60, 180]) {
    for (const z of [-120, 0, 120]) {
      const lamp = lampPost();
      lamp.position.set(x + 7.5, 0, z + 7.5);
      scene.add(lamp);
    }
  }
  // Beach umbrellas and boardwalk benches (none in the marina channel).
  for (let x = -170; x <= 170; x += 26) {
    if (inWater(x, 192)) continue;
    if (rng() < 0.7) {
      const pole = tube(0.08, 0.08, 2.6, 0xd8d8d8, {}, 6);
      pole.position.set(x, 1.3, 192);
      scene.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.1, 8),
        shade(choose(rng, [0xff7ab8, 0xffb020, 0x14e0c8, 0xff5e5e]), { roughness: 0.9 }),
      );
      top.position.set(x, 2.9, 192);
      top.castShadow = true;
      scene.add(top);
    }
  }

  // ---- the causeway bridge to Isla Luna ----------------------------------
  const bridge = new THREE.Group();
  const deck = block(14, 1.2, 130, 0x4a4556);
  deck.position.set(TOWN.causewayX, TOWN.deckY, 250);
  bridge.add(deck);
  for (let z = 196; z <= 304; z += 18) {
    const pillar = block(3, TOWN.deckY + 2, 3, 0x6a6478);
    pillar.position.set(TOWN.causewayX, (TOWN.deckY - 1) / 2, z);
    bridge.add(pillar);
  }
  for (const side of [-1, 1]) {
    const rail = block(0.5, 1.1, 130, 0x8a8496);
    rail.position.set(TOWN.causewayX + side * 6.8, TOWN.deckY + 1.1, 250);
    bridge.add(rail);
  }
  // Ramps where the avenue meets the deck.
  const rampN = block(14, 0.8, 22, 0x4a4556);
  rampN.position.set(TOWN.causewayX, 3.4, 186);
  rampN.rotation.x = 0.32;
  bridge.add(rampN);
  const rampS = block(14, 0.8, 22, 0x4a4556);
  rampS.position.set(TOWN.causewayX, 3.4, 314);
  rampS.rotation.x = -0.32;
  bridge.add(rampS);
  scene.add(bridge);
  colliders.push({ x0: TOWN.causewayX - 7.4, x1: TOWN.causewayX - 6.4, z0: 186, z1: 314 });
  colliders.push({ x0: TOWN.causewayX + 6.4, x1: TOWN.causewayX + 7.4, z0: 186, z1: 314 });

  // ---- Isla Luna: ferris wheel, lighthouse, pier --------------------------
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWN.island.radius, TOWN.island.radius + 6, 3, 28),
    shade(0x6a8a6a, { roughness: 1 }),
  );
  island.position.set(TOWN.island.x, 1.2, TOWN.island.z);
  island.receiveShadow = true;
  scene.add(island);
  const sandRing = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWN.island.radius + 4, TOWN.island.radius + 8, 1.2, 28),
    shade(HUES.sand, { roughness: 1 }),
  );
  sandRing.position.set(TOWN.island.x, 0.4, TOWN.island.z);
  scene.add(sandRing);

  const ferris = new THREE.Group();
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.7, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff8c42, emissiveIntensity: 0.7, roughness: 0.5 }),
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = tube(0.28, 0.28, 31, 0xd8d8e8, {}, 6);
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = block(2.4, 2.4, 2.4, choose(rng, [0xff7ab8, 0x14e0c8, 0xffb020, 0x9fd8ff]));
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cabin);
  }
  wheel.position.y = 22;
  ferris.add(wheel);
  const legA = tube(0.6, 0.9, 24, 0x8a8496, {}, 6);
  legA.position.set(-7, 11, 0); legA.rotation.z = 0.3;
  ferris.add(legA);
  const legB = legA.clone(); legB.position.x = 7; legB.rotation.z = -0.3;
  ferris.add(legB);
  ferris.position.set(TOWN.island.x + 18, 2.4, TOWN.island.z - 6);
  scene.add(ferris);
  animated.ferris = wheel;

  const lighthouse = new THREE.Group();
  const tower = tube(2.2, 3, 22, 0xf2ede0, {}, 12);
  tower.position.y = 11;
  lighthouse.add(tower);
  const band = tube(2.35, 2.35, 2, 0xff5e5e, {}, 12);
  band.position.y = 15;
  lighthouse.add(band);
  const lampRoom = tube(1.8, 1.8, 2.4, 0x2a2d3a, {}, 8);
  lampRoom.position.y = 23;
  lighthouse.add(lampRoom);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffd27a, emissiveIntensity: 2.4 }),
  );
  beacon.position.y = 23;
  lighthouse.add(beacon);
  lighthouse.position.set(TOWN.island.x - 22, 2.4, TOWN.island.z + 18);
  scene.add(lighthouse);

  // ---- marina docks and moored boats --------------------------------------
  const dockMat = shade(0x8a6a4a, { roughness: 1 });
  // Four docks across the marina; the last one sits at the east shore,
  // where the moored boats wait within reach of the boardwalk.
  const dockXs = [-200, -188, -176, -152];
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 34), dockMat);
    dock.position.set(dockXs[i], 0.8, 150);
    dock.castShadow = true; dock.receiveShadow = true;
    scene.add(dock);
    for (let p = 0; p < 4; p++) {
      const post = tube(0.14, 0.14, 1.6, 0x5a4a3a, {}, 6);
      post.position.set(dockXs[i] + (p % 2 === 0 ? -1.4 : 1.4), 1.2, 136 + p * 10);
      scene.add(post);
    }
  }
  // Canal bridges so the east side stays drivable.
  for (const z of [0, 120]) {
    const cBridge = block(40, 1, 14, 0x4a4556);
    cBridge.position.set(156, 0.6, z);
    scene.add(cBridge);
  }

  // ---- old-town hill backdrop ---------------------------------------------
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(TOWN.hill.radius, TOWN.hill.height, 24, 6),
    shade(0x4a8a5a, { roughness: 1 }),
  );
  hill.position.set(TOWN.hill.x, TOWN.hill.height / 2 - 2, TOWN.hill.z);
  scene.add(hill);
  for (let i = 0; i < 10; i++) {
    const h = block(between(rng, 6, 10), between(rng, 5, 9), between(rng, 6, 10), choose(rng, facadeColors));
    const a = rng() * Math.PI * 2;
    const r = between(rng, 30, 110);
    h.position.set(TOWN.hill.x + Math.cos(a) * r, 18 + rng() * 8, TOWN.hill.z + Math.sin(a) * r);
    scene.add(h);
  }
  const church = block(8, 26, 8, 0xe8dcc8);
  church.position.set(TOWN.hill.x + 20, 30, TOWN.hill.z - 10);
  scene.add(church);

  // ---- traffic loops (rectangular circuits around blocks) -----------------
  const loopDefs = [
    { x0: -60, x1: 60, z0: -30, z1: 30 },
    { x0: 0, x1: 120, z0: -90, z1: 30 },
    { x0: -180, x1: -60, z0: 30, z1: 150 },
    { x0: -60, x1: 60, z0: 90, z1: 150 },
  ];
  for (const l of loopDefs) {
    const pts = [
      { x: l.x0 + 3, z: l.z0 + 3 }, { x: l.x1 - 3, z: l.z0 + 3 },
      { x: l.x1 - 3, z: l.z1 - 3 }, { x: l.x0 + 3, z: l.z1 - 3 },
    ];
    loops.push(pts);
  }

  return { colliders, parkedCars, loops, sidewalkSpots, animated, inWater, floorAt };
}
