// Rex Marlowe on foot: walking, running, aiming with the mouse, punching,
// and getting in and out of cars. Driving itself lives in vehicles.js; this
// module only moves the body and hands the car over.

import { CAR, PISTOL, PLAYER } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

/** A fresh player, standing on the street where the story starts. */
export function createPlayer(x, y) {
  return {
    x, y,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: 150,
    ammoReserve: 24,
    mag: PISTOL.magSize,
    reloadTimer: 0,
    punchTimer: 0,
    invulnTimer: 0,
    speed: 0,
    moving: false,
    inCar: null,
    dead: false,
  };
}

/** Move on foot. `move` is a unit x/y pair, `aimAngle` comes from the mouse. */
export function stepOnFoot(player, move, aimAngle, dt, buildings) {
  const speed = PLAYER.walkSpeed;
  player.moving = move.x !== 0 || move.y !== 0;
  player.speed = player.moving ? speed : 0;
  player.x += move.x * speed * dt;
  player.y += move.y * speed * dt;
  if (aimAngle !== null) player.angle = aimAngle;
  else if (player.moving) player.angle = Math.atan2(move.y, move.x);
  resolveBuildingCollision(player, buildings);
  const clamped = clampToWorld(player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const need = PISTOL.magSize - player.mag;
      const taken = Math.min(need, player.ammoReserve);
      player.mag += taken;
      player.ammoReserve -= taken;
    }
  }
  if (player.invulnTimer > 0) player.invulnTimer -= dt;
}

/** Hurt the player; returns true when this kills him. */
export function damagePlayer(player, amount) {
  if (player.invulnTimer > 0 || player.dead) return false;
  player.health -= amount;
  player.invulnTimer = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
}

/** The nearest car the player could get into, or null. */
export function nearestCar(player, cars) {
  let best = null;
  let bestDist = 78;
  for (const car of cars) {
    if (car.wrecked) continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

/**
 * Get into `car`: the player becomes its driver. A traffic car loses its
 * driver, who runs off on foot. Returns the event that happened.
 */
export function enterCar(player, car, onDriverFlees) {
  if (car.kind === 'traffic' && car.hasDriver) {
    car.hasDriver = false;
    if (onDriverFlees) onDriverFlees(car);
  }
  player.inCar = car;
  car.drivenByPlayer = true;
  car.speed = 0;
  return car.kind === 'traffic' ? 'stole' : 'entered';
}

/** Get out beside the car, on the side with room. */
export function exitCar(player, buildings) {
  const car = player.inCar;
  if (!car) return;
  car.drivenByPlayer = false;
  player.inCar = null;
  const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
  player.x = car.x + side.x * (CAR.width / 2 + PLAYER.radius + 4);
  player.y = car.y + side.y * (CAR.width / 2 + PLAYER.radius + 4);
  player.angle = car.angle;
  resolveBuildingCollision(player, buildings);
  const clamped = clampToWorld(player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
}
