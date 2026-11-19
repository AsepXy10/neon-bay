// Pedestrians: the people who make the sidewalks feel alive. They stroll
// between random sidewalk points, cross at intersections, and run when they
// hear a gunshot or see a car coming at them. Hit one and the city notices.

import { ROADS, TRAFFIC, WORLD } from './config.js';
import { randomPick } from './random.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** A pedestrian on a sidewalk. */
export function createPed(x, y, random) {
  return {
    x, y,
    radius: 11,
    angle: random() * Math.PI * 2,
    speed: TRAFFIC.pedSpeed * (0.7 + random() * 0.6),
    shirt: randomPick(random, SHIRTS),
    skin: randomPick(random, SKINS),
    target: null,
    state: 'walk',
    downTimer: 0,
    fleeTimer: 0,
    bob: random() * Math.PI * 2,
  };
}

/** A random sidewalk point: just off a road, never in the middle of it. */
export function randomSidewalkPoint(random) {
  const line = randomPick(random, ROADS.lines);
  const along = 160 + random() * (WORLD.width - 320);
  const off = ROADS.width / 2 + 14 + random() * 20;
  const side = random() < 0.5 ? -1 : 1;
  if (random() < 0.5) return { x: along, y: line + side * off };
  return { x: line + side * off, y: along };
}

export function spawnPeds(random, count = TRAFFIC.peds) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(random);
    const ped = createPed(p.x, p.y, random);
    ped.target = randomSidewalkPoint(random);
    peds.push(ped);
  }
  return peds;
}

/** Scare every pedestrian near (x, y): they run from the threat. */
export function scarePeds(peds, x, y, radius = 420) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5 + Math.random() * 2;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

/** Knock a pedestrian down. Returns true when it was standing. */
export function knockDown(ped) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.downTimer = 6;
  return true;
}

export function stepPeds(peds, dt, random, buildings) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // Gets up, dusts off, and walks away from the road.
        ped.state = 'walk';
        const p = randomSidewalkPoint(random);
        ped.x = p.x;
        ped.y = p.y;
        ped.target = randomSidewalkPoint(random);
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const speed = ped.speed * 2.4;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      ped.bob += dt * 14;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.target = randomSidewalkPoint(random);
      }
    } else {
      if (!ped.target) ped.target = randomSidewalkPoint(random);
      const dx = ped.target.x - ped.x;
      const dy = ped.target.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        ped.target = randomSidewalkPoint(random);
        continue;
      }
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.bob += dt * 8;
    }
    resolveBuildingCollision(ped, buildings);
    const clamped = clampToWorld(ped.x, ped.y);
    ped.x = clamped.x;
    ped.y = clamped.y;
  }
}
