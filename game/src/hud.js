// The HUD: everything the player reads while playing — health and money,
// the wanted stars, the mission objective, the messages, the speedometer,
// the district name, and the minimap with the city, the player, the cops
// and the yellow mission marker.

import { PALETTE, ROADS, WORLD } from './config.js';
import { districtNameAt } from './city.js';
import { objectiveText, targetPoint } from './missions.js';

const MAP_SIZE = 196;

/** A message the player reads for a few seconds, then it fades. */
export function pushMessage(messages, text) {
  messages.push({ text, t: 0 });
  if (messages.length > 4) messages.shift();
}

export function stepMessages(messages, dt) {
  for (const m of messages) m.t += dt;
  while (messages.length > 0 && messages[0].t > 6) messages.shift();
}

function drawStars(ctx, x, y, stars) {
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 30, y);
  }
}

function drawMinimap(ctx, game, x, y) {
  const scale = MAP_SIZE / WORLD.width;
  ctx.save();
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(x - 6, y - 6, MAP_SIZE + 12, MAP_SIZE + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 6, MAP_SIZE + 12, MAP_SIZE + 12);
  // Water and sand on the west edge.
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(x, y, 140 * scale, MAP_SIZE);
  ctx.fillStyle = '#3d7a4a';
  ctx.fillRect(x + 140 * scale, y, MAP_SIZE - 140 * scale, MAP_SIZE);
  // Roads.
  ctx.strokeStyle = '#55585f';
  ctx.lineWidth = Math.max(2, (ROADS.width * scale) / 2);
  for (const line of ROADS.lines) {
    ctx.beginPath();
    ctx.moveTo(x, y + line * scale);
    ctx.lineTo(x + MAP_SIZE, y + line * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + line * scale, y);
    ctx.lineTo(x + line * scale, y + MAP_SIZE);
    ctx.stroke();
  }
  // Buildings as small blocks.
  ctx.fillStyle = 'rgba(20,22,32,0.8)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * scale, y + wy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Pay 'n Spray garages.
  dot(1152, 2400, '#3ddc84', 3);
  dot(2448, 2000, '#3ddc84', 3);
  // Rival and gold cars.
  for (const car of game.cars) {
    if (car.kind === 'rival' && !car.wrecked) dot(car.x, car.y, '#b45cff', 3);
    if (car.kind === 'gold' && !car.wrecked) dot(car.x, car.y, '#f1c40f', 3);
  }
  // Police.
  for (const cop of game.police.cars) dot(cop.x, cop.y, '#4d8dff', 3);
  for (const cop of game.police.cops) dot(cop.x, cop.y, '#4d8dff', 2.5);
  // Mission target: a pulsing yellow diamond.
  const target = targetPoint(game.missionState);
  if (target) {
    const pulse = 5 + Math.sin(game.time * 6) * 1.5;
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(x + target.x * scale, y + target.y * scale - pulse);
    ctx.lineTo(x + target.x * scale + pulse, y + target.y * scale);
    ctx.lineTo(x + target.x * scale, y + target.y * scale + pulse);
    ctx.lineTo(x + target.x * scale - pulse, y + target.y * scale);
    ctx.closePath();
    ctx.fill();
  }
  // The player: a white arrow that turns with them.
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const py = game.player.inCar ? game.player.inCar.y : game.player.y;
  const angle = game.player.inCar ? game.player.inCar.angle : game.player.angle;
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Draw the whole HUD over the world. `view` is {w, h} in screen pixels. */
export function drawHUD(ctx, game, view) {
  const player = game.player;
  const w = view.w;
  const h = view.h;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top left: health, money, ammo.
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, 12, 12, 250, 84, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.money}`, 26, 40);
  ctx.fillStyle = '#3ddc84';
  ctx.fillRect(26, 52, 150 * Math.max(0, player.health / 100), 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 52, 150, 10);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(player.health)}`, 184, 62);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px system-ui, sans-serif';
  const weapon = player.inCar ? 'DRIVING' : player.mag > 0 ? `PISTOL ${player.mag}/${player.ammoReserve}` : 'FISTS';
  ctx.fillText(weapon, 26, 84);

  // Top right: wanted stars and the district clock.
  drawStars(ctx, w - 170, 34, game.police.stars);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const hours = 6 + game.clock * 24;
  const hh = Math.floor(hours) % 24;
  const mm = Math.floor((hours % 1) * 60);
  ctx.fillText(`${districtNameAt(player.x, player.y)}  •  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, w - 20, 62);
  ctx.textAlign = 'left';

  // Bottom centre: the mission objective.
  const objective = objectiveText(game.missionState);
  if (objective) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    const tw = ctx.measureText(objective).width;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, (w - tw) / 2 - 14, h - 108, tw + 28, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.textAlign = 'center';
    ctx.fillText(objective, w / 2, h - 85);
    ctx.textAlign = 'left';
  }

  // Messages, top centre, newest last.
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  game.messages.forEach((m, i) => {
    const alpha = m.t > 5 ? Math.max(0, 6 - m.t) : 1;
    ctx.fillStyle = `rgba(242,244,248,${alpha})`;
    ctx.fillText(m.text, w / 2, 92 + i * 22);
  });
  ctx.textAlign = 'left';

  // Bottom left: speed when driving, controls hint otherwise.
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.36);
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 12, h - 78, 150, 66, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${kmh}`, 26, h - 38);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('km/h', 82, h - 38);
    const health = Math.max(0, player.inCar.health);
    ctx.fillStyle = health > 40 ? '#3ddc84' : '#ff5252';
    ctx.fillRect(26, h - 28, 122 * (health / 100), 6);
  } else {
    ctx.fillStyle = 'rgba(242,244,248,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move  •  E enter car  •  Click shoot  •  F punch  •  R reload  •  M mute  •  N day/night', 16, h - 16);
  }

  // Minimap, bottom right.
  drawMinimap(ctx, game, w - MAP_SIZE - 18, h - MAP_SIZE - 18);

  // Crosshair at the mouse when on foot and armed.
  if (!player.inCar && game.input.mouse.inside) {
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }

  // A banner across the middle (mission complete, busted, wasted, saved).
  if (game.banner) {
    const alpha = Math.min(1, game.bannerTimer * 2);
    ctx.fillStyle = `rgba(10,12,22,${0.72 * alpha})`;
    ctx.fillRect(0, h / 2 - 46, w, 92);
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner, w / 2, h / 2 + 12);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
