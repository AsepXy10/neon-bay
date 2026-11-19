// Cars: the player's ride, the traffic that fills the roads, and the wrecks.
// Traffic follows the road grid from intersection to intersection, keeping to
// the right-hand lane; the player's car is arcade physics — throttle, brake,
// steering that bites harder the faster the car goes.

import { CAR, PALETTE, ROADS, TRAFFIC, WORLD } from './config.js';
import { randomInt, randomPick } from './random.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

const HALF_ROAD = ROADS.width / 2;

/** A car at a place and heading. `kind` is traffic, police, rival or gold. */
export function createCar(x, y, angle, color, kind = 'traffic') {
  return {
    x, y, angle,
    radius: 15,
    speed: 0,
    color,
    kind,
    health: 100,
    wrecked: false,
    smokeTimer: 0,
    hitCooldown: 0,
    drivenByPlayer: false,
    hasDriver: kind === 'traffic',
    target: null,
    prevTarget: null,
    cruise: TRAFFIC.carSpeed * (0.85 + Math.random() * 0.3),
    skid: 0,
  };
}

/** The intersections of the road grid, as {x, y} points. */
export function intersections() {
  const points = [];
  for (const x of ROADS.lines) {
    for (const y of ROADS.lines) points.push({ x, y });
  }
  return points;
}

function nearestIntersection(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const ix of ROADS.lines) {
    for (const iy of ROADS.lines) {
      const d = (ix - x) * (ix - x) + (iy - y) * (iy - y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: ix, y: iy };
      }
    }
  }
  return best;
}

/** Pick the next intersection for a traffic car: any neighbour but the last. */
function nextTarget(car, random) {
  const here = nearestIntersection(car.x, car.y);
  const options = [];
  for (const ix of ROADS.lines) {
    for (const iy of ROADS.lines) {
      const onSameRoad = (ix === here.x && Math.abs(iy - here.y) === 400)
        || (iy === here.y && Math.abs(ix - here.x) === 400);
      if (!onSameRoad) continue;
      if (car.prevTarget && ix === car.prevTarget.x && iy === car.prevTarget.y) continue;
      options.push({ x: ix, y: iy });
    }
  }
  if (options.length === 0) return here;
  return randomPick(random, options);
}

/** Spawn the traffic fleet on the roads, already moving. */
export function spawnTraffic(random, count = TRAFFIC.cars) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const line = randomPick(random, ROADS.lines);
    const along = 200 + random() * (WORLD.width - 400);
    const horizontal = random() < 0.5;
    const dir = random() < 0.5 ? 1 : -1;
    const x = horizontal ? along : line + (dir > 0 ? ROADS.lane : -ROADS.lane);
    const y = horizontal ? line + (dir > 0 ? ROADS.lane : -ROADS.lane) : along;
    const angle = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(x, y, angle, randomPick(random, PALETTE.trafficCar));
    car.speed = car.cruise;
    car.target = nextTarget(car, random);
    cars.push(car);
  }
  return cars;
}

/** Keep an angle in (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** One traffic car's step: steer to its target intersection, slow for the car ahead. */
export function stepTrafficCar(car, dt, random, allCars) {
  if (car.wrecked || car.drivenByPlayer) return;
  if (!car.target) car.target = nextTarget(car, random);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 34) {
    car.prevTarget = car.target;
    car.target = nextTarget(car, random);
    return;
  }
  // Slow down for a car ahead in the same direction.
  let desired = car.cruise;
  for (const other of allCars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) desired = Math.min(desired, other.speed * 0.8);
  }
  car.speed += (desired - car.speed) * Math.min(1, dt * 1.5);
  const wantedAngle = Math.atan2(dy, dx);
  const diff = wrapAngle(wantedAngle - car.angle);
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Drive the player's car: throttle, brake, reverse, steering. */
export function stepPlayerCar(car, throttle, steer, dt) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return;
  }
  const forward = throttle > 0;
  const braking = throttle < 0 && car.speed > 20;
  if (forward) car.speed += CAR.accel * dt;
  else if (braking) car.speed -= CAR.brake * dt;
  else if (throttle < 0) car.speed -= CAR.reverseAccel * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 160 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 1) {
    const grip = Math.min(1, Math.abs(car.speed) / 220);
    car.angle += steer * CAR.turnRate * grip * dt * Math.sign(car.speed);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const clamped = clampToWorld(car.x, car.y);
  car.x = clamped.x;
  car.y = clamped.y;
  car.skid = Math.abs(steer) > 0.6 && Math.abs(car.speed) > 260 ? 1 : 0;
}

/** A car is two circles (nose and tail) against buildings; push it out. */
export function collideCarWithBuildings(car, buildings) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const nose = { x: car.x + fx * 16, y: car.y + fy * 16, radius: 15 };
  const tail = { x: car.x - fx * 16, y: car.y - fy * 16, radius: 15 };
  const n0x = nose.x;
  const n0y = nose.y;
  const t0x = tail.x;
  const t0y = tail.y;
  resolveBuildingCollision(nose, buildings);
  resolveBuildingCollision(tail, buildings);
  const dx = ((nose.x - n0x) + (tail.x - t0x)) / 2;
  const dy = ((nose.y - n0y) + (tail.y - t0y)) / 2;
  car.x += dx;
  car.y += dy;
  if (dx !== 0 || dy !== 0) car.speed *= 0.55;
}

/** Circle-circle shove between two cars; returns the impact speed.
 *  The shove separates them; the impact only takes a little speed off each,
 *  so a pile-up does not grind every car to a halt. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = 44;
  if (dist >= min || dist === 0) return 0;
  const impact = Math.abs(a.speed - b.speed);
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  a.speed *= 0.88;
  b.speed *= 0.88;
  return impact;
}

/** Damage a car; at zero health it becomes a smoking wreck. Returns true if it just died. */
export function damageCar(car, amount) {
  if (car.wrecked) return false;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    return true;
  }
  return false;
}

/** A wreck smokes for a while, then the smoke thins. */
export function stepWreck(car, dt) {
  if (!car.wrecked) return;
  car.smokeTimer += dt;
}
