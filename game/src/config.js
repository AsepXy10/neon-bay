// Neon Bay tuning: every number and colour in one place, so the rest of the
// game reads like a description of the city instead of a pile of literals.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The city is this big, in world pixels; roads run on a grid inside it. */
export const WORLD = { width: 3200, height: 3200 };

/** Roads: centre lines of the grid, and how wide the asphalt is. */
export const ROADS = {
  lines: [400, 800, 1200, 1600, 2000, 2400, 2800],
  width: 96,
  lane: 24,
};

/** Seconds of one full day/night cycle. */
export const DAY_LENGTH = 360;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'neon-bay.save.v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 20,
  punchCooldown: 0.45,
};

export const PISTOL = {
  damage: 26,
  magSize: 12,
  reloadTime: 1.1,
  bulletSpeed: 900,
  range: 520,
  fireCooldown: 0.22,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  length: 52,
  width: 26,
  damagePerHit: 9,
};

export const TRAFFIC = { cars: 26, peds: 42, carSpeed: 150, pedSpeed: 55 };

export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayInterval: 7,
  // How many police cars chase at each wanted level (index = stars).
  chaseCars: [0, 1, 2, 3, 4, 5],
  // How many foot cops chase at each wanted level.
  footCops: [0, 1, 1, 2, 2, 3],
  copCarSpeed: 470,
  copFootSpeed: 200,
  bustDistance: 26,
};

/** NBPD roadblocks: thrown across the road once the heat is high enough. */
export const ROADBLOCK = {
  // The wanted level at which the NBPD starts throwing roadblocks.
  minStars: 3,
  // How far ahead of the player the blockade is thrown, in world pixels.
  ahead: 520,
  // The blockade stands down once the player is this far from it.
  clearDistance: 1400,
  // Seconds after a blockade stands down before the NBPD throws another.
  cooldown: 20,
};

export const ECONOMY = {
  startMoney: 150,
  payAndSprayCost: 200,
  ammoPrice: 60,
  healPrice: 80,
};

/** Districts, by rectangle: name, and the hour the neon comes on. */
export const DISTRICTS = [
  { name: 'Downtown', x: 1000, y: 1000, w: 1200, h: 1200, neon: false },
  { name: 'Neon Row', x: 2000, y: 300, w: 1100, h: 1000, neon: true },
  { name: 'The Marina', x: 300, y: 2200, w: 1300, h: 900, neon: false },
  { name: 'Paleto Heights', x: 1900, y: 1900, w: 1200, h: 1200, neon: false },
  { name: 'The Docks', x: 300, y: 300, w: 900, h: 900, neon: false },
];

export const PALETTE = {
  grass: '#3d7a4a',
  sand: '#d9c48a',
  water: '#1d6f8f',
  sidewalk: '#8d8f96',
  asphalt: '#33363e',
  asphaltLine: '#d8d8c8',
  building: ['#5a5f73', '#6b5a6e', '#4a5d6e', '#715a4a', '#54505f'],
  buildingRoof: ['#3c4054', '#4a3f52', '#35424f', '#52423a', '#3e3a4a'],
  neon: ['#ff2e88', '#00e5ff', '#ffe600', '#7c4dff', '#00ff9d'],
  player: '#ffd23e',
  police: '#2f6df6',
  trafficCar: ['#c0392b', '#2980b9', '#7f8c8d', '#e67e22', '#16a085', '#8e44ad', '#bdc3c7', '#2c3e50'],
  rival: '#8e44ad',
  gold: '#f1c40f',
  hudText: '#f2f4f8',
  hudMuted: '#9aa3b2',
  hudPanel: 'rgba(10, 12, 22, 0.72)',
  hudAccent: '#ff2e88',
  health: '#3ddc84',
  damage: '#ff5252',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
