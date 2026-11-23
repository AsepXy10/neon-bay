// The law: the wanted level, the police who answer it, and the two ways a
// run ends — busted, or wasted. Stars rise with every crime the city sees
// and fall when the player stays out of sight; police cars chase and ram,
// foot cops chase and shoot, and at five stars the whole city is after you.

import { PALETTE, ROADS, ROADBLOCK, WANTED } from './config.js';
import { createCar, wrapAngle } from './vehicles.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

/** A police car or a foot cop. */
export function createCop(x, y, onFoot) {
  return {
    x, y,
    radius: 12,
    angle: 0,
    speed: 0,
    onFoot,
    color: PALETTE.police,
    shootTimer: 1 + Math.random(),
    stuckTimer: 0,
    lastX: x,
    lastY: y,
  };
}

export function createPolice() {
  return {
    stars: 0,
    decayTimer: 0,
    cars: [],
    cops: [],
    roadblock: [],
    roadblockTimer: 0,
    nearestCopDist: Infinity,
  };
}

export function addWanted(police, amount) {
  police.stars = Math.max(0, Math.min(WANTED.max, police.stars + amount));
  police.decayTimer = WANTED.decayDelay;
}

export function setWanted(police, amount) {
  police.stars = Math.max(0, Math.min(WANTED.max, amount));
  police.decayTimer = WANTED.decayDelay;
}

/**
 * Throw up a roadblock: two parked police cars across the road at (x, y),
 * facing across it (perpendicular to `angle`, the road's direction). They
 * sit still until they are cleared or wrecked, and the player can ram
 * through them like any other police car.
 */
export function placeRoadblock(police, x, y, angle) {
  const across = angle + Math.PI / 2;
  const cars = [];
  for (const offset of [-24, 24]) {
    const car = createCar(
      x + Math.cos(across) * offset,
      y + Math.sin(across) * offset,
      across, PALETTE.police, 'police',
    );
    car.roadblock = true;
    cars.push(car);
  }
  police.roadblock = cars;
  police.roadblockTimer = ROADBLOCK.cooldown;
  return cars;
}

/** The nearest road line to a point, for snapping a roadblock onto asphalt. */
function nearestRoadLine(value) {
  let best = ROADS.lines[0];
  for (const line of ROADS.lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

/**
 * Keep the roadblock: throw one ahead of the player once the heat reaches
 * ROADBLOCK.minStars, stand it down when the heat falls, when every car in
 * it is wrecked, or when the player is far past it.
 */
function updateRoadblock(police, px, py, playerAngle, dt) {
  police.roadblockTimer = Math.max(0, police.roadblockTimer - dt);
  if (police.roadblock.length > 0) {
    const cx = (police.roadblock[0].x + police.roadblock[1].x) / 2;
    const cy = (police.roadblock[0].y + police.roadblock[1].y) / 2;
    const allWrecked = police.roadblock.every((c) => c.wrecked);
    const farAway = Math.hypot(px - cx, py - cy) > ROADBLOCK.clearDistance;
    if (police.stars < ROADBLOCK.minStars || allWrecked || farAway) {
      police.roadblock = [];
      police.roadblockTimer = ROADBLOCK.cooldown;
    }
    return;
  }
  if (police.stars < ROADBLOCK.minStars || police.roadblockTimer > 0) return;
  // Ahead of the player, snapped onto the road they are travelling along.
  const aheadX = px + Math.cos(playerAngle) * ROADBLOCK.ahead;
  const aheadY = py + Math.sin(playerAngle) * ROADBLOCK.ahead;
  const horizontal = Math.abs(Math.cos(playerAngle)) >= Math.abs(Math.sin(playerAngle));
  const bx = horizontal ? aheadX : nearestRoadLine(aheadX);
  const by = horizontal ? nearestRoadLine(aheadY) : aheadY;
  const clamped = clampToWorld(bx, by);
  placeRoadblock(police, clamped.x, clamped.y, playerAngle);
}

/** Where a new police car appears: on a road, a few blocks from the player. */
function spawnPointNear(player, random, distance) {
  const angle = random() * Math.PI * 2;
  const x = player.x + Math.cos(angle) * distance;
  const y = player.y + Math.sin(angle) * distance;
  return clampToWorld(x, y);
}

function wantCount(police, kind) {
  const stars = police.stars;
  if (kind === 'car') return WANTED.chaseCars[stars];
  return WANTED.footCops[stars];
}

/**
 * Keep the right number of police around, move them, and report what
 * happened: { busted, shots: [{x, y, angle}] } — shots the cops fired.
 */
export function stepPolice(police, player, playerCar, dt, random, buildings, onShoot) {
  const events = { busted: false };
  const px = playerCar ? playerCar.x : player.x;
  const py = playerCar ? playerCar.y : player.y;

  // Wanted decays only while no police can see the player.
  police.nearestCopDist = Infinity;
  for (const unit of [...police.cars, ...police.cops]) {
    const d = Math.hypot(unit.x - px, unit.y - py);
    if (d < police.nearestCopDist) police.nearestCopDist = d;
  }
  if (police.stars > 0) {
    police.decayTimer -= dt;
    if (police.decayTimer <= 0 && police.nearestCopDist > 700) {
      police.stars -= 1;
      police.decayTimer = WANTED.decayInterval;
    }
  }

  // Top up the chase.
  while (police.cars.length < wantCount(police, 'car')) {
    const p = spawnPointNear({ x: px, y: py }, random, 620);
    const car = createCop(p.x, p.y, false);
    car.angle = Math.atan2(py - p.y, px - p.x);
    police.cars.push(car);
  }
  while (police.cops.length < wantCount(police, 'cop')) {
    const p = spawnPointNear({ x: px, y: py }, random, 320);
    police.cops.push(createCop(p.x, p.y, true));
  }
  // Trim the chase when the heat falls.
  while (police.cars.length > wantCount(police, 'car')) police.cars.pop();
  while (police.cops.length > wantCount(police, 'cop')) police.cops.pop();

  // The NBPD throws a roadblock across the road ahead at three stars and up.
  const playerAngle = playerCar ? playerCar.angle : (player.angle ?? 0);
  updateRoadblock(police, px, py, playerAngle, dt);

  // Police cars: steer at the player, ram on contact, slide around buildings.
  for (const car of police.cars) {
    const targetAngle = Math.atan2(py - car.y, px - car.x);
    const dist = Math.hypot(px - car.x, py - car.y);
    // Close in, then orbit: every unit aiming at the same point piles up
    // on top of the player instead of chasing.
    const aim = dist < 150 ? targetAngle + Math.PI / 2 : targetAngle;
    const diff = wrapAngle(aim - car.angle);
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const desired = dist > 120 ? WANTED.copCarSpeed : WANTED.copCarSpeed * 0.55;
    car.speed += (desired - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    resolveBuildingCollision(car, buildings);
    const clamped = clampToWorld(car.x, car.y);
    car.x = clamped.x;
    car.y = clamped.y;
    // A stuck police car reverses out instead of pushing forever.
    if (Math.hypot(car.x - car.lastX, car.y - car.lastY) < 4) car.stuckTimer += dt;
    else car.stuckTimer = 0;
    car.lastX = car.x;
    car.lastY = car.y;
    if (car.stuckTimer > 1.2) {
      car.angle += Math.PI * 0.9;
      car.stuckTimer = 0;
    }
  }

  // Foot cops: run at the player, shoot from range, bust up close.
  for (const cop of police.cops) {
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    const speed = WANTED.copFootSpeed * (dist > 60 ? 1 : 0.6);
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    resolveBuildingCollision(cop, buildings);
    const clamped = clampToWorld(cop.x, cop.y);
    cop.x = clamped.x;
    cop.y = clamped.y;
    if (!playerCar && dist < WANTED.bustDistance && player.speed < 60) {
      events.busted = true;
    }
    if (police.stars >= 2 && dist < 340 && dist > 40) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 1.1 + random() * 0.9;
        if (onShoot) onShoot(cop.x, cop.y, cop.angle + (random() - 0.5) * 0.35);
      }
    }
  }
  return events;
}

/** Are any police close enough that the siren should wail? */
export function policeNear(police) {
  return police.nearestCopDist < 900 && police.stars > 0;
}
