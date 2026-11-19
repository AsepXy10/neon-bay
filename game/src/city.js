// Neon Bay itself: the road grid, the blocks between the roads, the buildings
// and parks that fill them, and the named places missions send the player to.
// Everything is generated once from a seed, so the city is the same every visit.

import { DISTRICTS, PALETTE, ROADS, WORLD } from './config.js';
import { randomInt, randomPick } from './random.js';

/** The beach: sand west of this x, water west of the water line. */
export const SAND_EDGE = 352;
export const WATER_EDGE = 140;

/** Places the story uses: x and y sit on a road or a sidewalk, never inside a building. */
export const SPOTS = {
  garage: { x: 1600, y: 352, name: "Vex's Garage" },
  bank: { x: 1648, y: 1552, name: 'Meridian Bank' },
  club: { x: 2400, y: 752, name: 'Club Mirage' },
  hospital: { x: 752, y: 2000, name: 'St. Anselm Hospital' },
  sprayNorth: { x: 1152, y: 2400, name: "Pay 'n Spray" },
  spraySouth: { x: 2448, y: 2000, name: "Pay 'n Spray" },
  safehouse: { x: 2752, y: 2848, name: 'Safehouse' },
  docks: { x: 352, y: 448, name: 'The Docks' },
  marina: { x: 752, y: 2848, name: 'The Marina' },
  chopShop: { x: 2848, y: 1152, name: 'Chop Shop' },
};

/** Is the point on asphalt (a road)? */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2;
  for (const line of ROADS.lines) {
    if (Math.abs(x - line) <= half) return true;
    if (Math.abs(y - line) <= half) return true;
  }
  return false;
}

/** The district a point is in, or 'Neon Bay' outside them all. */
export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x && x < district.x + district.w && y >= district.y && y < district.y + district.h) {
      return district;
    }
  }
  return null;
}

/** The display name of the district a point is in. */
export function districtNameAt(x, y) {
  const district = districtAt(x, y);
  return district ? district.name : 'Neon Bay';
}

/** Is the point in the water (west edge)? */
export function isInWater(x, y) {
  return x < WATER_EDGE;
}

/** Clamp a point inside the drivable/walkable world. */
export function clampToWorld(x, y) {
  return {
    x: Math.min(WORLD.width - 8, Math.max(WATER_EDGE + 8, x)),
    y: Math.min(WORLD.height - 8, Math.max(8, y)),
  };
}

/** Build the city from a seed: buildings, parks, trees, lamps and neon signs. */
export function generateCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const lamps = [];
  const half = ROADS.width / 2;
  const lines = ROADS.lines;

  // The blocks between the roads: each cell is bounded by two road edges.
  // Block i runs from the far edge of road i-1 to the near edge of road i.
  const starts = [16, ...lines.map((line) => line + half + 16)];
  const edges = [...lines.map((line) => line - half - 16), WORLD.width - 16];
  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const x0 = starts[bx];
      const x1 = edges[bx];
      const y0 = starts[by];
      const y1 = edges[by];
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = random();
      if (x0 < SAND_EDGE) {
        // Beach blocks: palms on the sand, never in the water.
        for (let i = 0; i < 5; i += 1) {
          trees.push({ x: 170 + random() * (x1 - 190), y: y0 + 20 + random() * (h - 40), r: 9 });
        }
        continue;
      }
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w, h });
        for (let i = 0; i < 8; i += 1) {
          trees.push({ x: x0 + 16 + random() * (w - 32), y: y0 + 16 + random() * (h - 32), r: 7 + random() * 6 });
        }
        continue;
      }
      if (roll < 0.26) {
        // Parking lot: flat asphalt with painted bays, no building.
        lots.push({ x: x0, y: y0, w, h });
        continue;
      }
      // Buildings: one big block, or a 2x2 of smaller ones.
      const wall = randomPick(random, PALETTE.building);
      const roof = randomPick(random, PALETTE.buildingRoof);
      const neon = district && district.neon && random() < 0.7
        ? randomPick(random, PALETTE.neon)
        : null;
      if (random() < 0.55) {
        buildings.push({
          x: x0 + 14, y: y0 + 14, w: w - 28, h: h - 28,
          wall, roof, neon, seed: randomInt(random, 0, 100000),
        });
      } else {
        const mx = x0 + w / 2;
        const my = y0 + h / 2;
        for (const [qx, qy] of [[x0, y0], [mx, y0], [x0, my], [mx, my]]) {
          if (random() < 0.2) continue;
          buildings.push({
            x: qx + 10, y: qy + 10, w: w / 2 - 20, h: h / 2 - 20,
            wall: randomPick(random, PALETTE.building), roof: randomPick(random, PALETTE.buildingRoof),
            neon: district && district.neon && random() < 0.4 ? randomPick(random, PALETTE.neon) : null,
            seed: randomInt(random, 0, 100000),
          });
        }
      }
    }
  }

  // Street lamps at every intersection corner.
  for (const lx of lines) {
    for (const ly of lines) {
      lamps.push({ x: lx - half - 8, y: ly - half - 8 });
      lamps.push({ x: lx + half + 8, y: ly + half + 8 });
    }
  }

  return { buildings, parks, lots, trees, lamps };
}

/**
 * Push a circle (x, y, radius) out of every building it overlaps and out of the
 * water. Mutates and returns the body. Buildings are solid; roads are open.
 */
export function resolveBuildingCollision(body, buildings) {
  if (!Number.isFinite(body.radius)) return body;
  for (const b of buildings) {
    const closestX = Math.min(b.x + b.w, Math.max(b.x, body.x));
    const closestY = Math.min(b.y + b.h, Math.max(b.y, body.y));
    const dx = body.x - closestX;
    const dy = body.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= body.radius * body.radius) continue;
    if (distSq === 0) {
      // Centre inside the building: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - body.radius;
      else if (min === right) body.x = b.x + b.w + body.radius;
      else if (min === top) body.y = b.y - body.radius;
      else body.y = b.y + b.h + body.radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    const push = (body.radius - dist) / dist;
    body.x += dx * push;
    body.y += dy * push;
  }
  if (body.x - body.radius < WATER_EDGE) body.x = WATER_EDGE + body.radius;
  return body;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(random) {
  const line = randomPick(random, ROADS.lines);
  const along = 200 + random() * (WORLD.width - 400);
  if (random() < 0.5) return { x: along, y: line };
  return { x: line, y: along };
}
