// The renderer: the camera, the city, the cars and people on it, the day
// and the night, and the screens around the game (title, pause, busted,
// wasted). Particles live here too — smoke, sparks, explosions, skid marks.

import { ROADS } from './config.js';
import { SAND_EDGE, WATER_EDGE } from './city.js';
import { targetPoint } from './missions.js';

/** How bright the world is at a clock position (0 = 06:00, 1 = next 06:00). */
export function daylight(clock) {
  if (clock < 0.55) return 1;
  if (clock < 0.65) return 1 - ((clock - 0.55) / 0.1) * 0.55;
  if (clock < 0.92) return 0.45;
  if (clock < 1) return 0.45 + ((clock - 0.92) / 0.08) * 0.55;
  return 1;
}

export function isNight(clock) {
  return daylight(clock) < 0.7;
}

export function createParticles() {
  return [];
}

export function spawnExplosion(particles, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 260;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
      color: ['#ff9d00', '#ff5252', '#ffd23e', '#666'][i % 4], size: 3 + Math.random() * 6, kind: 'dot',
    });
  }
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 40,
      life: 1.6 + Math.random(), maxLife: 2.6, color: '#888', size: 8 + Math.random() * 10, kind: 'smoke',
    });
  }
}

export function spawnSparks(particles, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 180;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.2 + Math.random() * 0.25, maxLife: 0.45,
      color: '#ffe600', size: 2 + Math.random() * 2, kind: 'dot',
    });
  }
}

export function spawnSmoke(particles, x, y) {
  particles.push({
    x, y, vx: (Math.random() - 0.5) * 12, vy: -26 - Math.random() * 20,
    life: 1.2, maxLife: 1.2, color: '#999', size: 7 + Math.random() * 5, kind: 'smoke',
  });
}

export function spawnSkid(particles, x, y, angle) {
  particles.push({
    x, y, vx: 0, vy: 0, life: 7, maxLife: 7,
    color: 'rgba(10,10,14,0.5)', size: 5, kind: 'skid', angle,
  });
}

export function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'smoke') p.size += dt * 6;
  }
  if (particles.length > 600) particles.splice(0, particles.length - 600);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { w: 1280, h: 800 };
  const camera = { x: 1600, y: 1600 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view = { w, h };
  }
  window.addEventListener('resize', resize);
  resize();

  function follow(tx, ty, dt) {
    const k = Math.min(1, dt * 4.5);
    camera.x += (tx - camera.x) * k;
    camera.y += (ty - camera.y) * k;
  }

  function toScreen(wx, wy) {
    return { x: wx - camera.x + view.w / 2, y: wy - camera.y + view.h / 2 };
  }

  function drawCar(c, night) {
    ctx.save();
    ctx.translate(c.x - camera.x + view.w / 2, c.y - camera.y + view.h / 2);
    ctx.rotate(c.angle);
    // Wheels.
    ctx.fillStyle = '#111';
    ctx.fillRect(-18, -15, 12, 6);
    ctx.fillRect(-18, 9, 12, 6);
    ctx.fillRect(8, -15, 12, 6);
    ctx.fillRect(8, 9, 12, 6);
    // Body.
    ctx.fillStyle = c.wrecked ? '#2b2b2e' : c.color;
    roundRectPath(ctx, -26, -13, 52, 26, 7);
    ctx.fill();
    if (c.kind === 'police') {
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(-26, -13, 52, 26);
      ctx.fillStyle = '#2f6df6';
      ctx.fillRect(-6, -13, 12, 26);
      // Light bar, flashing.
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2f6df6';
      ctx.fillRect(-8, -14, 7, 5);
      ctx.fillStyle = flash ? '#2f6df6' : '#ff2e2e';
      ctx.fillRect(1, -14, 7, 5);
    }
    if (c.kind === 'rival') {
      ctx.fillStyle = '#5b2d8e';
      ctx.fillRect(-26, -13, 8, 26);
    }
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(15,20,30,0.85)';
    ctx.fillRect(6, -10, 9, 20);
    ctx.fillRect(-16, -10, 6, 20);
    if (night && !c.wrecked) {
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(24, -10, 3, 5);
      ctx.fillRect(24, 5, 3, 5);
    }
    ctx.restore();
    if (night && !c.wrecked) {
      // Headlight beams.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tip = toScreen(c.x + Math.cos(c.angle) * 130, c.y + Math.sin(c.angle) * 130);
      const base = toScreen(c.x, c.y);
      const grad = ctx.createRadialGradient(base.x, base.y, 10, tip.x, tip.y, 120);
      grad.addColorStop(0, 'rgba(255,233,168,0.20)');
      grad.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPed(p) {
    const s = toScreen(p.x, p.y);
    if (p.state === 'down') {
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 13, 7, p.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = Math.sin(p.bob) * 2;
    ctx.save();
    ctx.translate(s.x, s.y + bob * 0.4);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p, night) {
    const s = toScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);
    // A short shadow under the player.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // The pistol, when the player is armed and aiming.
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
    ctx.restore();
  }

  function drawWorld(game) {
    const night = isNight(game.clock);
    const light = daylight(game.clock);
    const left = camera.x - view.w / 2 - 60;
    const right = camera.x + view.w / 2 + 60;
    const top = camera.y - view.h / 2 - 60;
    const bottom = camera.y + view.h / 2 + 60;

    // Ground.
    ctx.fillStyle = '#3d7a4a';
    ctx.fillRect(0, 0, view.w, view.h);
    // Beach and water, west edge.
    const sand = toScreen(SAND_EDGE, 0);
    const water = toScreen(WATER_EDGE, 0);
    ctx.fillStyle = '#d9c48a';
    ctx.fillRect(0, 0, sand.x, view.h);
    ctx.fillStyle = '#1d6f8f';
    ctx.fillRect(0, 0, water.x, view.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const wy = ((game.time * 40 + i * 137) % (view.h + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(water.x - 26, wy);
      ctx.quadraticCurveTo(water.x - 8, wy + 12, water.x - 26, wy + 24);
      ctx.stroke();
    }
    // Parks.
    for (const park of game.city.parks) {
      const s = toScreen(park.x, park.y);
      ctx.fillStyle = '#2f6b3c';
      ctx.fillRect(s.x, s.y, park.w, park.h);
    }
    // Parking lots: flat asphalt with painted bays.
    for (const lot of game.city.lots) {
      const s = toScreen(lot.x, lot.y);
      ctx.fillStyle = '#3a3d44';
      ctx.fillRect(s.x, s.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(230,230,220,0.5)';
      ctx.lineWidth = 2;
      for (let bx = s.x + 24; bx < s.x + lot.w - 20; bx += 34) {
        ctx.beginPath();
        ctx.moveTo(bx, s.y + 14);
        ctx.lineTo(bx, s.y + 44);
        ctx.stroke();
      }
    }
    // Sidewalks, then asphalt, then lane dashes.
    const half = ROADS.width / 2;
    ctx.fillStyle = '#8d8f96';
    for (const line of ROADS.lines) {
      const hy = toScreen(0, line - half - 12).y;
      const vx = toScreen(line - half - 12, 0).x;
      ctx.fillRect(-60, hy, view.w + 120, ROADS.width + 24);
      ctx.fillRect(vx, -60, ROADS.width + 24, view.h + 120);
    }
    ctx.fillStyle = '#33363e';
    for (const line of ROADS.lines) {
      const hy = toScreen(0, line - half).y;
      const vx = toScreen(line - half, 0).x;
      ctx.fillRect(-60, hy, view.w + 120, ROADS.width);
      ctx.fillRect(vx, -60, ROADS.width, view.h + 120);
    }
    ctx.strokeStyle = 'rgba(216,216,200,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (const line of ROADS.lines) {
      const hy = toScreen(0, line).y;
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(view.w, hy);
      ctx.stroke();
      const vx = toScreen(line, 0).x;
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, view.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Buildings.
    for (const b of game.city.buildings) {
      if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
      const s = toScreen(b.x, b.y);
      ctx.fillStyle = b.wall;
      ctx.fillRect(s.x, s.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(s.x + 6, s.y + 6, b.w - 12, b.h - 12);
      // Windows: a grid, some lit at night.
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = night && ((b.seed + cx * 7 + cy * 13) % 5 === 0);
          ctx.fillStyle = lit ? '#ffd76a' : 'rgba(20,24,36,0.55)';
          ctx.fillRect(s.x + 12 + cx * 26, s.y + 12 + cy * 26, 12, 14);
        }
      }
      // Neon sign on the roof edge in Neon Row.
      if (b.neon) {
        ctx.save();
        if (night) {
          ctx.shadowColor = b.neon;
          ctx.shadowBlur = 18;
        }
        ctx.fillStyle = b.neon;
        ctx.fillRect(s.x + b.w / 2 - 22, s.y - 4, 44, 8);
        ctx.restore();
      }
    }
    // Trees.
    for (const t of game.city.trees) {
      if (t.x < left || t.x > right || t.y < top || t.y > bottom) continue;
      const s = toScreen(t.x, t.y);
      ctx.fillStyle = '#2c5d33';
      ctx.beginPath();
      ctx.arc(s.x, s.y, t.r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f8f4f';
      ctx.beginPath();
      ctx.arc(s.x, s.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Street lamps.
    for (const lamp of game.city.lamps) {
      if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
      const s = toScreen(lamp.x, lamp.y);
      ctx.fillStyle = '#22242c';
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      if (night) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 46);
        grad.addColorStop(0, 'rgba(255,220,120,0.35)');
        grad.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Mission packages.
    for (const pack of game.missionState.packages) {
      if (pack.taken) continue;
      const s = toScreen(pack.x, pack.y);
      const pulse = 1 + Math.sin(game.time * 5) * 0.12;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#8a6d00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(11, 0);
      ctx.stroke();
      ctx.restore();
    }
    // Pickups.
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      const s = toScreen(pickup.x, pickup.y);
      const bob = Math.sin(game.time * 3 + pickup.x) * 3;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      if (pickup.kind === 'cash') {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      } else if (pickup.kind === 'health') {
        ctx.fillStyle = '#f2f4f8';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#e33';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillStyle = '#8a7d3c';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', 0, 1);
      }
      ctx.restore();
    }

    // Mission target marker: a beam of light where the job is.
    const target = targetPoint(game.missionState);
    if (target) {
      const s = toScreen(target.x, target.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(s.x, s.y - 160, s.x, s.y);
      grad.addColorStop(0, 'rgba(255,230,0,0)');
      grad.addColorStop(1, 'rgba(255,230,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(s.x - 12, s.y - 160, 24, 160);
      ctx.restore();
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10 + Math.sin(game.time * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', s.x, s.y);
    }

    // Cars, pedestrians, cops, player, bullets, particles.
    for (const car of game.cars) {
      if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
      drawCar(car, night);
      if (car.wrecked && Math.random() < 0.12) {
        // Wrecks keep smoking.
        game.particles.push({
          x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 20,
          vx: 0, vy: -30, life: 1, maxLife: 1, color: '#999', size: 8, kind: 'smoke',
        });
      }
    }
    for (const ped of game.peds) drawPed(ped);
    for (const cop of game.police.cops) {
      const s = toScreen(cop.x, cop.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#2f6df6';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(4, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16233d';
      ctx.fillRect(2, -6, 8, 12);
      ctx.restore();
    }
    for (const car of game.police.cars) drawCar(car, night);
    // Bullets.
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    for (const b of game.bullets) {
      const s = toScreen(b.x, b.y);
      const e = toScreen(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    // Particles.
    for (const p of game.particles) {
      const s = toScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'skid') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-8, -2, 16, 4);
        ctx.restore();
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // The player, on foot.
    if (!game.player.inCar && !game.player.dead) drawPlayer(game.player, night);

    // Night falls over everything, then the lights shine through it.
    if (light < 1) {
      ctx.fillStyle = `rgba(7,10,34,${(1 - light) * 0.52})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }

    // An off-screen objective gets an arrow at the screen's edge.
    if (target) {
      const s = toScreen(target.x, target.y);
      if (s.x < 40 || s.x > view.w - 40 || s.y < 40 || s.y > view.h - 40) {
        let cx = Math.max(50, Math.min(view.w - 50, s.x));
        const cy = Math.max(50, Math.min(view.h - 50, s.y));
        // Keep the arrow clear of the HUD panels in the corners: the label is
        // centred on the arrow, so the arrow itself must sit a label-half
        // clear of the money panel and the minimap.
        if (cy < 110 || cy > view.h - 110) cx = Math.max(340, Math.min(view.w - 340, cx));
        const angle = Math.atan2(s.y - cy, s.x - cx);
        const dist = Math.round(Math.hypot(target.x - (game.player.inCar ? game.player.inCar.x : game.player.x), target.y - (game.player.inCar ? game.player.inCar.y : game.player.y)));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffe600';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${target.label} ${dist}m`, Math.max(70, Math.min(view.w - 70, cx)), cy + 28);
      }
    }
  }

  function drawTitle(game, save) {
    // The city drifts behind the title.
    camera.x = 1600 + Math.sin(game.time * 0.05) * 500;
    camera.y = 1600 + Math.cos(game.time * 0.04) * 400;
    drawWorld(game);
    ctx.fillStyle = 'rgba(8,10,24,0.55)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 34;
    ctx.fillText('NEON BAY', view.w / 2, view.h / 2 - 90);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f2f4f8';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in a sun-soaked coastal city', view.w / 2, view.h / 2 - 48);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Rex Marlowe is back after five years away. Vex has work. The city has other ideas.', view.w / 2, view.h / 2 - 16);
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(save ? 'ENTER — Continue your story' : 'ENTER or CLICK — Start a new story', view.w / 2, view.h / 2 + 46);
    ctx.fillStyle = '#c8cfdb';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('WASD move / drive  •  E get in & out of cars  •  Mouse aim, Click shoot  •  F punch  •  R reload', view.w / 2, view.h / 2 + 84);
    ctx.fillText('M mute  •  N day / night  •  P pause  •  Steal cars, run jobs, stay ahead of the NBPD', view.w / 2, view.h / 2 + 108);
    if (save) {
      ctx.fillStyle = '#9aa3b2';
      ctx.fillText(`Saved game: $${save.money}  •  ${save.missionIndex + 1} of 6 jobs done`, view.w / 2, view.h / 2 + 142);
    }
    ctx.textAlign = 'left';
  }

  function drawPause(game) {
    drawWorld(game);
    ctx.fillStyle = 'rgba(8,10,24,0.65)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f4f8';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 20);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = '#c8cfdb';
    ctx.fillText('P or Esc to keep playing  •  Your progress saves itself after every job', view.w / 2, view.h / 2 + 22);
    ctx.textAlign = 'left';
  }

  function drawEnd(game, kind) {
    drawWorld(game);
    ctx.fillStyle = 'rgba(8,10,24,0.72)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    if (kind === 'busted') {
      ctx.fillStyle = '#4d8dff';
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.fillText('BUSTED', view.w / 2, view.h / 2 - 30);
      ctx.fillStyle = '#f2f4f8';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText('The NBPD took you in. Bail cost you $200 — and your heat is gone.', view.w / 2, view.h / 2 + 12);
    } else {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.fillText('WASTED', view.w / 2, view.h / 2 - 30);
      ctx.fillStyle = '#f2f4f8';
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText('Rex woke up at St. Anselm with a headache and a smaller wallet.', view.w / 2, view.h / 2 + 12);
    }
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('ENTER — Back on the streets', view.w / 2, view.h / 2 + 56);
    ctx.textAlign = 'left';
  }

  return {
    ctx,
    get view() { return view; },
    get camera() { return camera; },
    resize,
    follow,
    toScreen,
    drawWorld,
    drawTitle,
    drawPause,
    drawEnd,
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
