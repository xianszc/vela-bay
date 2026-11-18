// Vela Bay itself: the sunset city. Builds the sky dome, the sun, the bay
// and the canal, the road grid, the buildings, the palms, the boardwalk, the
// causeway to Isla Luna, the ferris wheel and the marina — all from one
// seeded random stream so every load looks identical. Returns the collision
// boxes, the water regions, the traffic loops and the animated bits the main
// loop has to tick (water, ferris wheel, clouds).

import * as THREE from 'three';
import { CITY, PALETTE, WATER_RECTS } from './config.js';
import { mulberry32, pick, range, rangeInt, clamp, makeWindowsTexture, makeSignTexture, makeGlowTexture } from './util.js';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts }));
  }
  return matCache.get(key);
}

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, color, opts = {}, segments = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat(color, opts));
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = true;
  return m;
}

function isWater(x, z) {
  for (const r of WATER_RECTS) {
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
function groundHeightAt(x, z) {
  let h = 0;
  const d = Math.hypot(x - CITY.island.x, z - CITY.island.z);
  if (d < 66) {
    if (d <= 50) h = ISLAND_TOP;
    else {
      const t = (66 - d) / 16; // 0 at the shore, 1 at the island edge
      h = ISLAND_TOP * t * t * (3 - 2 * t);
    }
  }
  if (Math.abs(x - CITY.causewayX) < 6.4 && z >= 175 && z <= 325) {
    let ch;
    if (z < 197) ch = 3.8 + 0.331 * (z - 186); // north ramp up to the deck
    else if (z <= 303) ch = 7.6; // the deck
    else ch = 3.8 - 0.331 * (z - 314); // south ramp down to the island
    h = Math.max(h, Math.max(0, ch));
  }
  return h;
}

function makePalm(rng, height) {
  const palm = new THREE.Group();
  const trunk = cyl(0.22, 0.34, height, 0x8a6a4a, {}, 7);
  trunk.position.y = height / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  palm.add(trunk);
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 3.4, 4),
      mat(0x2f9e5f, { roughness: 0.9 }),
    );
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.4;
    frond.position.set(Math.cos(a) * 1.3, height + 0.4, Math.sin(a) * 1.3);
    frond.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9);
    frond.scale.set(1, 1, 0.28);
    frond.castShadow = true;
    palm.add(frond);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat(0x6b4a2a));
  nuts.position.y = height - 0.2;
  palm.add(nuts);
  return palm;
}

function makeStreetlight() {
  const g = new THREE.Group();
  const pole = cyl(0.09, 0.12, 6.4, 0x2a2d3a, {}, 6);
  pole.position.y = 3.2;
  g.add(pole);
  const arm = box(1.6, 0.12, 0.12, 0x2a2d3a);
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

export function buildWorld(scene) {
  const rng = mulberry32(CITY.seed);
  const colliders = [];
  const parkedCars = [];
  const animated = { waterMats: [], ferris: null, clouds: [], heliPad: null };
  const loops = [];
  const sidewalkSpots = [];

  // ---- sky, sun, fog, light -------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyLow) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h))
                          : mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);

  scene.fog = new THREE.Fog(PALETTE.fog, 180, 720);

  const sun = new THREE.DirectionalLight(0xffb36b, 3.1);
  sun.position.set(-260, 110, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9a7bc8, 0x4a3428, 1.25));
  const fill = new THREE.DirectionalLight(0x9a8cff, 0.6);
  fill.position.set(200, 120, -160);
  scene.add(fill);

  // The sun disc itself, low over the bay, plus a halo sprite.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunDisc.position.set(-420, 62, 330);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const glowTex = new THREE.CanvasTexture(makeGlowTexture('rgba(255,210,122,0.85)', 'rgba(255,140,66,0)'));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, transparent: true, depthWrite: false }));
  halo.scale.set(260, 260, 1);
  halo.position.copy(sunDisc.position);
  scene.add(halo);

  // Drifting clouds, pink in the sunset light.
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffs = rangeInt(rng, 3, 5);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(range(rng, 7, 16), 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffc9b8, roughness: 1, transparent: true, opacity: 0.85, emissive: 0x80385a, emissiveIntensity: 0.35 }),
      );
      s.position.set(p * 12 - puffs * 6, range(rng, -2, 3), range(rng, -4, 4));
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set(range(rng, -420, 420), range(rng, 90, 170), range(rng, -380, 380));
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // ---- ground, beach, water --------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    mat(0x5a5468, { roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(760, 26), mat(PALETTE.sand, { roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.06, 196);
  sand.receiveShadow = true;
  scene.add(sand);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    opacity: 0.94,
    fog: false, // no fog chunks in this shader; three.js would fault on missing fog uniforms
    uniforms: { time: { value: 0 }, shallow: { value: new THREE.Color(0x3fb2d8) }, deep: { value: new THREE.Color(PALETTE.waterDeep) } },
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
  canalMat.uniforms = { time: waterMat.uniforms.time, shallow: { value: new THREE.Color(0x3fb2d8) }, deep: { value: new THREE.Color(PALETTE.waterDeep) } };
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(32, 390), canalMat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(156, 0.35, 10);
  scene.add(canal);
  animated.waterMats.push(canalMat);

  const marinaMat = waterMat.clone();
  marinaMat.uniforms = { time: waterMat.uniforms.time, shallow: { value: new THREE.Color(0x3fb2d8) }, deep: { value: new THREE.Color(PALETTE.waterDeep) } };
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
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });

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

  for (const x of CITY.avenues) {
    roadStrip(x, 0, 12, 372, 1, 12);
    const walkL = new THREE.Mesh(new THREE.PlaneGeometry(4, 372), mat(PALETTE.sidewalk, { roughness: 1 }));
    walkL.rotation.x = -Math.PI / 2; walkL.position.set(x - 8, 0.1, 0); walkL.receiveShadow = true;
    scene.add(walkL);
    const walkR = walkL.clone(); walkR.position.x = x + 8; scene.add(walkR);
  }
  for (const z of CITY.streets) {
    roadStrip(0, z, 372, 12, 12, 1);
    const walkT = new THREE.Mesh(new THREE.PlaneGeometry(372, 4), mat(PALETTE.sidewalk, { roughness: 1 }));
    walkT.rotation.x = -Math.PI / 2; walkT.position.set(0, 0.1, z - 8); walkT.receiveShadow = true;
    scene.add(walkT);
    const walkB = walkT.clone(); walkB.position.z = z + 8; scene.add(walkB);
  }

  // ---- buildings ----------------------------------------------------------
  const facadeColors = [0xe8dcc8, 0xd8a08a, 0x9fc8c0, 0xe8b88a, 0xc8b8d8, 0xa8c8e8, 0xe8c8a8, 0x8fb8a8];
  const signTexts = [
    ['VELA', 'GRAND CASINO'], ['HOTEL', 'LUNA'], ['TIDE', 'MARKET'],
    ['PALM', 'COURT'], ['SUNSET', 'MOTEL'], ['MARINA', 'YACHT CLUB'],
  ];
  let signIndex = 0;

  for (let ai = 0; ai < CITY.avenues.length - 1; ai++) {
    for (let si = 0; si < CITY.streets.length - 1; si++) {
      const x0 = CITY.avenues[ai] + 11, x1 = CITY.avenues[ai + 1] - 11;
      const z0 = CITY.streets[si] + 11, z1 = CITY.streets[si + 1] - 11;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // Skip blocks drowned by the canal, the marina or the beach.
      if (x0 < CITY.canal.x1 && x1 > CITY.canal.x0) continue;
      if (x0 < CITY.marina.x1 && x1 > CITY.marina.x0 && z0 < CITY.marina.z1 && z1 > CITY.marina.z0) continue;
      if (z1 > 178) continue;
      const downtown = Math.abs(cx) < 80 && Math.abs(cz) < 80;
      const roll = rng();
      if (roll < 0.14) {
        // A pocket park: palms, benches, a fountain square.
        for (let p = 0; p < 5; p++) {
          const palm = makePalm(rng, range(rng, 5, 8));
          palm.position.set(range(rng, x0 + 4, x1 - 4), 0, range(rng, z0 + 4, z1 - 4));
          scene.add(palm);
        }
        const fountain = cyl(2.2, 2.6, 0.8, 0x9fc8d8, {}, 12);
        fountain.position.set(cx, 0.4, cz);
        scene.add(fountain);
        sidewalkSpots.push({ x: cx, z: cz });
        continue;
      }
      const count = downtown ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 2);
      for (let b = 0; b < count; b++) {
        const w = range(rng, 14, Math.min(30, x1 - x0 - 6));
        const d = range(rng, 12, Math.min(26, z1 - z0 - 6));
        const h = downtown ? range(rng, 18, 46) : range(rng, 8, 22);
        const bx = range(rng, x0 + w / 2 + 2, x1 - w / 2 - 2);
        const bz = range(rng, z0 + d / 2 + 2, z1 - d / 2 - 2);
        const color = pick(rng, facadeColors);
        const winTex = new THREE.CanvasTexture(makeWindowsTexture(rng, '#3a3348', 0.55));
        winTex.wrapS = THREE.RepeatWrapping; winTex.wrapT = THREE.RepeatWrapping;
        winTex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 14)));
        const walls = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
        const faces = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [walls, walls,
            new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 1 }),
            walls,
            new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 }),
            new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 })],
        );
        faces.position.set(bx, h / 2, bz);
        faces.castShadow = true; faces.receiveShadow = true;
        scene.add(faces);
        // Rooftop clutter.
        const ac = box(range(rng, 2, 4), 1.2, range(rng, 2, 3), 0x6a6a72);
        ac.position.set(bx + range(rng, -w / 4, w / 4), h + 0.6, bz + range(rng, -d / 4, d / 4));
        scene.add(ac);
        if (rng() < 0.3) {
          const tank = cyl(1.1, 1.1, 2.4, 0x8a7a6a, {}, 8);
          tank.position.set(bx - w / 4, h + 1.2, bz - d / 4);
          scene.add(tank);
        }
        // A neon sign on some taller buildings.
        if (h > 22 && signIndex < signTexts.length && rng() < 0.6) {
          const [l1, l2] = signTexts[signIndex++];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 6),
            new THREE.MeshStandardMaterial({
              map: new THREE.CanvasTexture(makeSignTexture([l1], '#ffd27a', '#241a33', l2)),
              emissive: 0xffffff, emissiveMap: new THREE.CanvasTexture(makeSignTexture([l1], '#ffd27a', '#241a33', l2)),
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
        parkedCars.push({ x: CITY.avenues[ai] + 7, z: cz + range(rng, -16, 16), heading: pick(rng, [0, Math.PI]) });
      }
      sidewalkSpots.push({ x: cx, z: cz });
    }
  }

  // ---- palms, streetlights, props along the avenues ---------------------
  for (const x of CITY.avenues) {
    for (let z = -170; z <= 170; z += 30) {
      if (isWater(x + 10, z) || isWater(x - 10, z)) continue;
      if (rng() < 0.55) {
        const palm = makePalm(rng, range(rng, 5.5, 8.5));
        palm.position.set(x + (rng() < 0.5 ? -10.5 : 10.5), 0, z + range(rng, -6, 6));
        scene.add(palm);
      }
    }
  }
  for (const x of [-180, -60, 60, 180]) {
    for (const z of [-120, 0, 120]) {
      const lamp = makeStreetlight();
      lamp.position.set(x + 7.5, 0, z + 7.5);
      scene.add(lamp);
    }
  }
  // Beach umbrellas and boardwalk benches (none in the marina channel).
  for (let x = -170; x <= 170; x += 26) {
    if (isWater(x, 192)) continue;
    if (rng() < 0.7) {
      const pole = cyl(0.08, 0.08, 2.6, 0xd8d8d8, {}, 6);
      pole.position.set(x, 1.3, 192);
      scene.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.1, 8),
        mat(pick(rng, [0xff7ab8, 0xffb020, 0x14e0c8, 0xff5e5e]), { roughness: 0.9 }),
      );
      top.position.set(x, 2.9, 192);
      top.castShadow = true;
      scene.add(top);
    }
  }

  // ---- the causeway bridge to Isla Luna ----------------------------------
  const bridge = new THREE.Group();
  const deck = box(14, 1.2, 130, 0x4a4556);
  deck.position.set(CITY.causewayX, CITY.causewayDeckY, 250);
  bridge.add(deck);
  for (let z = 196; z <= 304; z += 18) {
    const pillar = box(3, CITY.causewayDeckY + 2, 3, 0x6a6478);
    pillar.position.set(CITY.causewayX, (CITY.causewayDeckY - 1) / 2, z);
    bridge.add(pillar);
  }
  for (const side of [-1, 1]) {
    const rail = box(0.5, 1.1, 130, 0x8a8496);
    rail.position.set(CITY.causewayX + side * 6.8, CITY.causewayDeckY + 1.1, 250);
    bridge.add(rail);
  }
  // Ramps where the avenue meets the deck.
  const rampN = box(14, 0.8, 22, 0x4a4556);
  rampN.position.set(CITY.causewayX, 3.4, 186);
  rampN.rotation.x = 0.32;
  bridge.add(rampN);
  const rampS = box(14, 0.8, 22, 0x4a4556);
  rampS.position.set(CITY.causewayX, 3.4, 314);
  rampS.rotation.x = -0.32;
  bridge.add(rampS);
  scene.add(bridge);
  colliders.push({ x0: CITY.causewayX - 7.4, x1: CITY.causewayX - 6.4, z0: 186, z1: 314 });
  colliders.push({ x0: CITY.causewayX + 6.4, x1: CITY.causewayX + 7.4, z0: 186, z1: 314 });

  // ---- Isla Luna: ferris wheel, lighthouse, pier --------------------------
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(CITY.island.radius, CITY.island.radius + 6, 3, 28),
    mat(0x6a8a6a, { roughness: 1 }),
  );
  island.position.set(CITY.island.x, 1.2, CITY.island.z);
  island.receiveShadow = true;
  scene.add(island);
  const sandRing = new THREE.Mesh(
    new THREE.CylinderGeometry(CITY.island.radius + 4, CITY.island.radius + 8, 1.2, 28),
    mat(PALETTE.sand, { roughness: 1 }),
  );
  sandRing.position.set(CITY.island.x, 0.4, CITY.island.z);
  scene.add(sandRing);

  const ferris = new THREE.Group();
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.7, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff8c42, emissiveIntensity: 0.7, roughness: 0.5 }),
  );
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = cyl(0.28, 0.28, 31, 0xd8d8e8, {}, 6);
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = box(2.4, 2.4, 2.4, pick(rng, [0xff7ab8, 0x14e0c8, 0xffb020, 0x9fd8ff]));
    cabin.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cabin);
  }
  wheel.position.y = 22;
  ferris.add(wheel);
  const legA = cyl(0.6, 0.9, 24, 0x8a8496, {}, 6);
  legA.position.set(-7, 11, 0); legA.rotation.z = 0.3;
  ferris.add(legA);
  const legB = legA.clone(); legB.position.x = 7; legB.rotation.z = -0.3;
  ferris.add(legB);
  ferris.position.set(CITY.island.x + 18, 2.4, CITY.island.z - 6);
  scene.add(ferris);
  animated.ferris = wheel;

  const lighthouse = new THREE.Group();
  const tower = cyl(2.2, 3, 22, 0xf2ede0, {}, 12);
  tower.position.y = 11;
  lighthouse.add(tower);
  const band = cyl(2.35, 2.35, 2, 0xff5e5e, {}, 12);
  band.position.y = 15;
  lighthouse.add(band);
  const lampRoom = cyl(1.8, 1.8, 2.4, 0x2a2d3a, {}, 8);
  lampRoom.position.y = 23;
  lighthouse.add(lampRoom);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffd27a, emissiveIntensity: 2.4 }),
  );
  beacon.position.y = 23;
  lighthouse.add(beacon);
  lighthouse.position.set(CITY.island.x - 22, 2.4, CITY.island.z + 18);
  scene.add(lighthouse);

  // ---- marina docks and moored boats --------------------------------------
  const dockMat = mat(0x8a6a4a, { roughness: 1 });
  // Four docks across the marina; the last one sits at the east shore,
  // where the moored boats wait within reach of the boardwalk.
  const dockXs = [-200, -188, -176, -152];
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 34), dockMat);
    dock.position.set(dockXs[i], 0.8, 150);
    dock.castShadow = true; dock.receiveShadow = true;
    scene.add(dock);
    for (let p = 0; p < 4; p++) {
      const post = cyl(0.14, 0.14, 1.6, 0x5a4a3a, {}, 6);
      post.position.set(dockXs[i] + (p % 2 === 0 ? -1.4 : 1.4), 1.2, 136 + p * 10);
      scene.add(post);
    }
  }
  // Canal bridges so the east side stays drivable.
  for (const z of [0, 120]) {
    const cBridge = box(40, 1, 14, 0x4a4556);
    cBridge.position.set(156, 0.6, z);
    scene.add(cBridge);
  }

  // ---- old-town hill backdrop ---------------------------------------------
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(CITY.hill.radius, CITY.hill.height, 24, 6),
    mat(0x5a6a52, { roughness: 1 }),
  );
  hill.position.set(CITY.hill.x, CITY.hill.height / 2 - 2, CITY.hill.z);
  scene.add(hill);
  for (let i = 0; i < 10; i++) {
    const h = box(range(rng, 6, 10), range(rng, 5, 9), range(rng, 6, 10), pick(rng, facadeColors));
    const a = rng() * Math.PI * 2;
    const r = range(rng, 30, 110);
    h.position.set(CITY.hill.x + Math.cos(a) * r, 18 + rng() * 8, CITY.hill.z + Math.sin(a) * r);
    scene.add(h);
  }
  const church = box(8, 26, 8, 0xe8dcc8);
  church.position.set(CITY.hill.x + 20, 30, CITY.hill.z - 10);
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

  return { colliders, parkedCars, loops, sidewalkSpots, animated, isWater, groundHeightAt };
}
