// Pickups scattered around the city: cash stashes worth money, health kits
// outside the hospital, and ammo boxes outside the gun shop. Taken ones come
// back after a while, so the city never runs dry.

import { randomPick } from './random.js';
import { randomSidewalkPoint } from './pedestrians.js';

const RESPAWN = 45;

export function createPickups(random) {
  const pickups = [];
  for (let i = 0; i < 8; i += 1) {
    const p = randomSidewalkPoint(random);
    pickups.push({ x: p.x, y: p.y, kind: 'cash', amount: 50 + randomPick(random, [0, 50, 100]), taken: false, timer: 0 });
  }
  pickups.push({ x: 730, y: 1960, kind: 'health', amount: 40, taken: false, timer: 0 });
  pickups.push({ x: 780, y: 2040, kind: 'health', amount: 40, taken: false, timer: 0 });
  pickups.push({ x: 1240, y: 1560, kind: 'ammo', amount: 24, taken: false, timer: 0 });
  pickups.push({ x: 2360, y: 840, kind: 'ammo', amount: 24, taken: false, timer: 0 });
  return pickups;
}

/** Collect what the player (or the player's car) touches. Returns what was taken. */
export function collectPickups(pickups, x, y) {
  const taken = [];
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - x, pickup.y - y) < 34) {
      pickup.taken = true;
      pickup.timer = RESPAWN;
      taken.push(pickup);
    }
  }
  return taken;
}

export function stepPickups(pickups, dt) {
  for (const pickup of pickups) {
    if (!pickup.taken) continue;
    pickup.timer -= dt;
    if (pickup.timer <= 0) pickup.taken = false;
  }
}
