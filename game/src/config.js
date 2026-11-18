// Vela Bay — Sunset Heist. Every tuning number for the town, the cars,
// the boats, the law and the story sits in this one file, so balancing
// never means digging through gameplay code. Metres for distance, km/h
// for speed, unless a name says otherwise.

export const TOWN = {
  seed: 90210,
  // Boulevards run north-south, streets east-west. Blocks are 48 m wide
  // with 12 m roads between them, so the drivable grid is 360 m by 360 m.
  boulevards: [-180, -120, -60, 0, 60, 120, 180],
  streets: [-180, -120, -60, 0, 60, 120, 180],
  roadHalf: 6,
  // The bay is south of the beach. A canal cuts the east side down to the
  // bay, and a marina inlet cuts the west shore, so a boat can sail from
  // the marina out to Isla Luna. Boats live in WATERS.
  beachZ: 186,
  waterZ: 204,
  canal: { x0: 140, x1: 172, z0: -180, z1: 204 },
  marina: { x0: -208, x1: -146, z0: 92, z1: 204 },
  // The causeway carries boulevard x = -60 across the bay to Isla Luna.
  causewayX: -60,
  deckY: 7,
  island: { x: -60, z: 312, radius: 56 },
  // The old-town hill is a visual backdrop north-west of the grid.
  hill: { x: -260, z: -250, radius: 150, height: 42 },
};

export const WATERS = [
  { x0: -400, x1: 400, z0: TOWN.waterZ, z1: 420 }, // the bay itself
  { x0: TOWN.canal.x0, x1: TOWN.canal.x1, z0: TOWN.canal.z0, z1: TOWN.canal.z1 },
  { x0: TOWN.marina.x0, x1: TOWN.marina.x1, z0: TOWN.marina.z0, z1: TOWN.marina.z1 },
];

export const HUES = {
  skyTop: 0x8a76c0, // deep violet-purple overhead, like the Marisol sky
  skyHorizon: 0xff9eb8, // soft pink at the horizon — pink, never yellow
  skyBand: 0xffb3d6, // pink-lavender band just above the sun
  haze: 0xe8a8c0, // soft rose haze that softens the far city
  sun: 0xffe9cf, // soft warm sun disc, a pale glow not a yellow ball
  ground: 0x615a52,
  walk: 0x9a8ab0,
  asphalt: 0x23202e,
  lane: 0xf5c542,
  sand: 0xe8b89a, // pinkish sand, not yellow
  sea: 0x0e7a9e, // rich vivid turquoise, like the Halcyon bay
  seaDeep: 0x0e5a9e,
  heroTeal: 0x14e0c8,
  copWhite: 0xf2f2ee,
  copBlack: 0x14161f,
};

export const AREAS = [
  { name: 'Downtown Vela', x0: -70, x1: 70, z0: -70, z1: 70 },
  { name: 'Palm Row', x0: -190, x1: 130, z0: 150, z1: 186 },
  { name: 'Vela Marina', x0: -208, x1: -140, z0: 80, z1: 186 },
  { name: 'The Canals', x0: 130, x1: 180, z0: -180, z1: 200 },
  { name: 'Old Town Hill', x0: -210, x1: -110, z0: -190, z1: -80 },
  { name: 'Causeway', x0: -80, x1: -40, z0: 186, z1: 260 },
  { name: 'Isla Luna', x0: -120, x1: 0, z0: 260, z1: 370 },
  { name: 'Sunset Boardwalk', x0: -140, x1: 140, z0: 170, z1: 205 },
];

export function areaAt(x, z) {
  for (const a of AREAS) {
    if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) return a.name;
  }
  return 'Vela Bay';
}

export const CAR_TYPES = [
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

export const BOAT_TYPES = [
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

export const ARSENAL = [
  { id: 'fists', name: 'FISTS', slot: 1, ammo: Infinity, damage: 18, rate: 0.45, range: 2.2, auto: false },
  { id: 'pistol', name: 'P9 PISTOL', slot: 2, ammo: 48, damage: 26, rate: 0.28, range: 55, auto: false },
  { id: 'smg', name: 'WASP SMG', slot: 3, ammo: 120, damage: 16, rate: 0.09, range: 48, auto: true },
  { id: 'shotgun', name: 'TIDE-12', slot: 4, ammo: 24, damage: 14, rate: 0.85, range: 26, auto: false, pellets: 7 },
];

export const STATIONS = [
  { name: 'WAVE 88.1', song: 'Neon Drive — Palm Static', bpm: 112, root: 55, mood: 'synth' },
  { name: 'SOL 101.9', song: 'Sunset Run — The Breakers', bpm: 96, root: 65.4, mood: 'funk' },
  { name: 'BAY FM 94', song: 'Night Tide — Coral Ghosts', bpm: 128, root: 49, mood: 'drive' },
];

export const CREW = {
  rex: { name: 'REX VELA', role: 'DRIVER', color: '#14e0c8', initials: 'RV', skin: '#c98a5e', mood: 'grin' },
  mara: { name: 'MARA SOLIS', role: 'BOAT PILOT', color: '#ff7ab8', initials: 'MS', skin: '#e8b88a', mood: 'smile' },
  theo: { name: 'THEO KADE', role: 'FIXER', color: '#ffb020', initials: 'TK', skin: '#8a5a3a', mood: 'calm' },
  dario: { name: 'DARIO FONTE', role: 'THE MARK', color: '#ff5e5e', initials: 'DF', skin: '#d9a077', mood: 'calm' },
};

// Heat 0..1000 maps to 0..5 wanted stars.
export const HEAT = {
  maxStars: 5,
  perStar: 200,
  coolPerSec: 26, // while no police unit has eyes on the player
  coolFarPerSec: 55, // while every police unit is far away
  stealSeen: 210, // stealing a car is always a 1-star crime
  hitWalker: 110,
  hitCop: 180,
  shotSeen: 140,
  carsPerStar: [0, 2, 3, 4, 5, 6],
  heliAtStar: 3,
  boatsAtStar: 4,
};

export const PAYOUTS = {
  startCash: 850,
  nearMiss: 50,
  driftPerSec: 25,
  jobCash: [1200, 1800, 2400, 3200, 4200, 5200, 6800, 15000],
  jobRep: [120, 160, 200, 260, 320, 400, 520, 900],
};
