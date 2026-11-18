// Vela Bay — Sunset Heist: every number that shapes the city, the cars, the
// boats, the police and the story lives here, so tuning never means hunting
// through gameplay code. All distances are in metres, all speeds in km/h
// unless a name says otherwise.

export const CITY = {
  seed: 1337,
  // Avenues run north-south, streets east-west. Blocks between them are 48 m
  // wide with 12 m roads, so the drivable grid spans 360 m by 360 m.
  avenues: [-180, -120, -60, 0, 60, 120, 180],
  streets: [-180, -120, -60, 0, 60, 120, 180],
  roadHalf: 6,
  // The bay lies south of the beach. The canal cuts the east side and joins
  // the bay; the marina inlet cuts the west shore and joins the bay too, so
  // a boat can sail from the marina out to Isla Luna. Boats live in waterRects.
  beachZ: 186,
  waterZ: 204,
  canal: { x0: 140, x1: 172, z0: -180, z1: 204 },
  marina: { x0: -208, x1: -146, z0: 92, z1: 204 },
  // The causeway carries avenue x = -60 across the bay to Isla Luna.
  causewayX: -60,
  causewayDeckY: 7,
  island: { x: -60, z: 312, radius: 56 },
  // The old-town hill is a visual backdrop north-west of the grid.
  hill: { x: -260, z: -250, radius: 150, height: 42 },
};

export const WATER_RECTS = [
  { x0: -400, x1: 400, z0: CITY.waterZ, z1: 420 }, // the bay
  { x0: CITY.canal.x0, x1: CITY.canal.x1, z0: CITY.canal.z0, z1: CITY.canal.z1 },
  { x0: CITY.marina.x0, x1: CITY.marina.x1, z0: CITY.marina.z0, z1: CITY.marina.z1 },
];

export const PALETTE = {
  skyTop: 0x2b1b4d, // dusk purple overhead
  skyHorizon: 0xff8c42, // burning orange at the horizon
  skyLow: 0xff5e7a, // pink band just above the sun
  fog: 0xe08a6b, // warm haze that swallows the far city
  sun: 0xffd27a,
  ground: 0x3d3a4a,
  sidewalk: 0x8d8296,
  road: 0x23202e,
  roadLine: 0xf5c542,
  sand: 0xe8c98f,
  water: 0x1e6f8e,
  waterDeep: 0x166b8f,
  heroTeal: 0x14e0c8,
  policeWhite: 0xf2f2ee,
  policeBlack: 0x14161f,
};

export const DISTRICTS = [
  { name: 'Downtown Vela', x0: -70, x1: 70, z0: -70, z1: 70 },
  { name: 'Palm Row', x0: -190, x1: 130, z0: 150, z1: 186 },
  { name: 'Vela Marina', x0: -208, x1: -140, z0: 80, z1: 186 },
  { name: 'The Canals', x0: 130, x1: 180, z0: -180, z1: 200 },
  { name: 'Old Town Hill', x0: -210, x1: -110, z0: -190, z1: -80 },
  { name: 'Causeway', x0: -80, x1: -40, z0: 186, z1: 260 },
  { name: 'Isla Luna', x0: -120, x1: 0, z0: 260, z1: 370 },
  { name: 'Sunset Boardwalk', x0: -140, x1: 140, z0: 170, z1: 205 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  if (z > 204) return 'Vela Bay';
  return 'Vela Bay';
}

export const VEHICLES = [
  {
    id: 'teal-sport', name: 'VELA GT', kind: 'sport', color: 0x14e0c8,
    topSpeed: 212, accel: 34, brake: 52, grip: 1.0, nitro: true, seats: 2,
  },
  {
    id: 'sunset-coupe', name: 'SOLSTICE S', kind: 'sport', color: 0xffb020,
    topSpeed: 198, accel: 31, brake: 50, grip: 0.95, nitro: true, seats: 2,
  },
  {
    id: 'city-sedan', name: 'MARLIN SEDAN', kind: 'sedan', color: 0x7a86c8,
    topSpeed: 158, accel: 24, brake: 46, grip: 0.9, nitro: false, seats: 4,
  },
  {
    id: 'bay-taxi', name: 'BAY CAB', kind: 'taxi', color: 0xffc93c,
    topSpeed: 152, accel: 23, brake: 46, grip: 0.9, nitro: false, seats: 4,
  },
  {
    id: 'harbor-truck', name: 'HARBOR HAULER', kind: 'truck', color: 0xc96a3b,
    topSpeed: 128, accel: 17, brake: 40, grip: 0.8, nitro: false, seats: 2,
  },
  {
    id: 'police-interceptor', name: 'VBPD INTERCEPTOR', kind: 'police', color: 0xf2f2ee,
    topSpeed: 205, accel: 36, brake: 54, grip: 1.05, nitro: false, seats: 2,
  },
];

export const BOATS = [
  {
    id: 'speedboat', name: 'TIDE RUNNER', kind: 'boat', color: 0x14e0c8,
    topSpeed: 148, accel: 26, turn: 1.15,
  },
  {
    id: 'harbor-skiff', name: 'HARBOR SKIFF', kind: 'boat', color: 0xe8e4d8,
    topSpeed: 104, accel: 18, turn: 1.0,
  },
  {
    id: 'police-boat', name: 'VBPD MARINE 7', kind: 'police-boat', color: 0xf2f2ee,
    topSpeed: 156, accel: 30, turn: 1.2,
  },
];

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', slot: 1, ammo: Infinity, damage: 18, rate: 0.45, range: 2.2, auto: false },
  { id: 'pistol', name: 'P9 PISTOL', slot: 2, ammo: 48, damage: 26, rate: 0.28, range: 55, auto: false },
  { id: 'smg', name: 'WASP SMG', slot: 3, ammo: 120, damage: 16, rate: 0.09, range: 48, auto: true },
  { id: 'shotgun', name: 'TIDE-12', slot: 4, ammo: 24, damage: 14, rate: 0.85, range: 26, auto: false, pellets: 7 },
];

export const RADIO = [
  { name: 'WAVE 88.1', song: 'Neon Drive — Palm Static', bpm: 112, root: 55, mood: 'synth' },
  { name: 'SOL 101.9', song: 'Sunset Run — The Breakers', bpm: 96, root: 65.4, mood: 'funk' },
  { name: 'BAY FM 94', song: 'Night Tide — Coral Ghosts', bpm: 128, root: 49, mood: 'drive' },
];

export const CREW = {
  rex: { name: 'REX VELA', role: 'DRIVER', color: '#14e0c8', initials: 'RV' },
  mara: { name: 'MARA SOLIS', role: 'BOAT PILOT', color: '#ff7ab8', initials: 'MS' },
  theo: { name: 'THEO KADE', role: 'FIXER', color: '#ffb020', initials: 'TK' },
  dario: { name: 'DARIO FONTE', role: 'THE MARK', color: '#ff5e5e', initials: 'DF' },
};

// Wanted heat thresholds: heat 0..1000 maps to stars 0..5.
export const WANTED = {
  maxStars: 5,
  heatPerStar: 200,
  decayPerSecond: 26, // while no police unit has eyes on the player
  decayFarPerSecond: 55, // while every police unit is far away
  stealInSight: 210, // stealing a car is always a 1-star crime
  hitPedestrian: 110,
  hitPolice: 180,
  shootInSight: 140,
  policeCarsPerStar: [0, 2, 3, 4, 5, 6],
  heliFromStar: 3,
  boatsFromStar: 4,
};

export const ECONOMY = {
  startMoney: 850,
  nearMissBonus: 50,
  driftBonusPerSecond: 25,
  missionReward: [1200, 1800, 2400, 3200, 4200, 5200, 6800, 15000],
  repPerMission: [120, 160, 200, 260, 320, 400, 520, 900],
};
