// Gunfire: bullets, muzzle flashes and the damage they do. A bullet is a
// fast point with an owner — the player, a cop, or a rival — and it stops at
// the first thing it meets: a building, a car, a pedestrian, or a person.

import { PISTOL } from './config.js';

export function createBullets() {
  return [];
}

/** Fire one bullet. `owner` is 'player', 'cop' or 'rival'. */
export function fireBullet(bullets, x, y, angle, owner) {
  bullets.push({
    x, y, angle,
    speed: PISTOL.bulletSpeed,
    damage: PISTOL.damage,
    owner,
    life: PISTOL.range / PISTOL.bulletSpeed,
    trail: 0,
  });
}

/**
 * Move every bullet and report what it hit:
 * [{type: 'building'|'car'|'ped'|'player'|'cop', x, y, target}]
 */
export function stepBullets(bullets, dt, world) {
  const hits = [];
  const { buildings, cars, peds, cops, player } = world;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    const step = b.speed * dt;
    const nx = b.x + Math.cos(b.angle) * step;
    const ny = b.y + Math.sin(b.angle) * step;
    let dead = b.life <= 0;
    if (!dead) {
      // Buildings stop bullets.
      for (const building of buildings) {
        if (nx >= building.x && nx <= building.x + building.w && ny >= building.y && ny <= building.y + building.h) {
          hits.push({ type: 'building', x: nx, y: ny, target: null });
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of cars) {
        if (car.wrecked) continue;
        const dx = nx - car.x;
        const dy = ny - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(along) < 28 && Math.abs(side) < 16) {
          hits.push({ type: 'car', x: nx, y: ny, target: car });
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(nx - ped.x, ny - ped.y) < 13) {
          hits.push({ type: 'ped', x: nx, y: ny, target: ped });
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.owner !== 'player' && player && !player.dead && !player.inCar) {
      if (Math.hypot(nx - player.x, ny - player.y) < 14) {
        hits.push({ type: 'player', x: nx, y: ny, target: player });
        dead = true;
      }
    }
    if (!dead && b.owner !== 'cop' && cops) {
      for (const cop of cops) {
        if (Math.hypot(nx - cop.x, ny - cop.y) < 13) {
          hits.push({ type: 'cop', x: nx, y: ny, target: cop });
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      bullets.splice(i, 1);
    } else {
      b.x = nx;
      b.y = ny;
    }
  }
  return hits;
}
