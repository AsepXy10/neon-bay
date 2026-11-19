// Neon Bay: boot, the one loop, and the screens around it.
// Input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints what is there. The game moves between five screens:
// title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=chase|street|mission|night|start (with
// &seed=N) stages that scene instead of running the loop, plays it forward
// for a few seconds, paints it twice and sets window.__shotReady.

import { CAR, DAY_LENGTH, ECONOMY, PISTOL, PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { SPOTS, generateCity } from './city.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_INTERACT, ACTION_PAUSE,
  ACTION_RELOAD, ACTION_SHOOT, createInput,
} from './input.js';
import { freshSave, readSave, writeSave } from './save.js';
import {
  createPlayer, damagePlayer, enterCar, exitCar, healPlayer,
  nearestCar, stepOnFoot,
} from './player.js';
import {
  collideCarWithBuildings, collideCars, damageCar,
  spawnTraffic, stepPlayerCar, stepTrafficCar, stepWreck, wrapAngle,
} from './vehicles.js';
import { knockDown, scarePeds, spawnPeds, stepPeds } from './pedestrians.js';
import { addWanted, createPolice, policeNear, setWanted, stepPolice } from './police.js';
import { createBullets, fireBullet, stepBullets } from './combat.js';
import { collectPickups, createPickups, stepPickups } from './pickups.js';
import {
  beginStep, createMissionState, currentMission, updateMission,
} from './missions.js';
import {
  createParticles, createRenderer, spawnExplosion, spawnSkid,
  spawnSparks, stepParticles,
} from './render.js';
import { drawHUD, pushMessage, stepMessages } from './hud.js';
import { driveAutopilot, stageShot, walkAutopilot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 30;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

/** One fresh game: city, people, cars, jobs, and an empty message feed. */
function createGame(gameSeed) {
  const random = createRandom(gameSeed);
  const city = generateCity(random);
  const player = createPlayer(1600, 1300);
  const game = {
    seed: gameSeed,
    random,
    city,
    player,
    cars: spawnTraffic(random),
    peds: spawnPeds(random),
    police: createPolice(),
    bullets: createBullets(),
    pickups: createPickups(random),
    missionState: createMissionState(),
    particles: createParticles(),
    messages: [],
    clock: 0.12,
    time: 0,
    banner: null,
    bannerTimer: 0,
    input,
    audio,
  };
  beginStep(game.missionState, game);
  return game;
}

const game = createGame(seed);
const save = readSave();

function announce(message) {
  status.textContent = message;
}

function saveGame() {
  const p = game.player;
  writeSave({
    money: p.money,
    missionIndex: game.missionState.missionIndex,
    playerX: p.inCar ? p.inCar.x : p.x,
    playerY: p.inCar ? p.inCar.y : p.y,
    health: Math.ceil(p.health),
    ammo: p.ammoReserve + p.mag,
    best: Math.max(save?.best ?? 0, p.money),
  });
}

function showBanner(text, seconds = 3) {
  game.banner = text;
  game.bannerTimer = seconds;
}

function crime(amount, message) {
  addWanted(game.police, amount);
  if (message) pushMessage(game.messages, message);
}

window.addEventListener('error', (event) => {
  window.__gameError = String(event.message ?? event.error ?? 'unknown error');
});

/** Rival cars hunt the player: steer at them and ram. */
function stepRival(car, dt) {
  const player = game.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const targetAngle = Math.atan2(py - car.y, px - car.x);
  const diff = wrapAngle(targetAngle - car.angle);
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  const dist = Math.hypot(px - car.x, py - car.y);
  const desired = dist > 90 ? 430 : 300;
  car.speed += (desired - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCarWithBuildings(car, game.city.buildings);
}

function playerShoot() {
  const player = game.player;
  if (player.inCar || player.reloadTimer > 0 || player.mag <= 0) return;
  player.mag -= 1;
  fireBullet(game.bullets, player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18, player.angle, 'player');
  audio.shot();
  scarePeds(game.peds, player.x, player.y, 500);
  if (game.police.stars < 1) crime(1, 'Shots fired — the NBPD is on to you.');
}

function playerPunch() {
  const player = game.player;
  if (player.inCar || player.punchTimer > 0) return;
  player.punchTimer = PLAYER.punchCooldown;
  audio.punch();
  const reach = PLAYER.punchRange;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < reach + 12) {
      knockDown(ped);
      crime(1, 'You knocked someone out. Someone saw that.');
      spawnSparks(game.particles, ped.x, ped.y);
      return;
    }
  }
  for (let i = game.police.cops.length - 1; i >= 0; i -= 1) {
    const cop = game.police.cops[i];
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d < reach + 12) {
      game.police.cops.splice(i, 1);
      crime(2, 'You laid out a cop. The whole city is coming.');
      spawnSparks(game.particles, cop.x, cop.y);
      return;
    }
  }
}

function tryEnterCar() {
  const player = game.player;
  if (player.inCar) {
    exitCar(player, game.city.buildings);
    pushMessage(game.messages, 'Out of the car.');
    return;
  }
  const car = nearestCar(player, game.cars);
  if (!car) return;
  const result = enterCar(player, car, (stolen) => {
    const ped = {
      x: stolen.x + 30, y: stolen.y + 30, radius: 11, angle: 0,
      speed: 200, shirt: '#e67e22', skin: '#f1c27d', target: null,
      state: 'flee', downTimer: 0, fleeTimer: 4, bob: 0,
    };
    game.peds.push(ped);
  });
  audio.click();
  if (result === 'stole') crime(1, 'Car stolen! The NBPD is on to you.');
}

function respawn(kind) {
  const player = game.player;
  player.dead = false;
  player.health = PLAYER.health;
  player.inCar = null;
  player.x = SPOTS.hospital.x;
  player.y = SPOTS.hospital.y;
  player.money = Math.max(0, player.money - (kind === 'busted' ? 200 : 100));
  setWanted(game.police, 0);
  game.police.cars = [];
  game.police.cops = [];
  game.bullets = [];
  saveGame();
}

/** One fixed step of the whole world. `opts` carries the frame's actions (or
 *  a scripted drive/walk for a staged screenshot). Returns 'busted' | 'wasted' | null. */
function stepWorld(dt, opts) {
  const player = game.player;
  const scripted = opts?.scripted ?? false;
  game.time += dt;
  game.clock = (game.clock + dt / DAY_LENGTH) % 1;

  // --- The player.
  const aim = aimAngle();
  if (player.inCar) {
    const drive = opts?.drive ?? { throttle: input.throttle(), steer: input.steer() };
    stepPlayerCar(player.inCar, drive.throttle, drive.steer, dt);
    collideCarWithBuildings(player.inCar, game.city.buildings);
    if (player.inCar.skid) spawnSkid(game.particles, player.inCar.x, player.inCar.y, player.inCar.angle);
    audio.setEngine(Math.abs(player.inCar.speed) / CAR.maxSpeed, true);
  } else {
    const move = opts?.move ?? input.move();
    stepOnFoot(player, move, aim, dt, game.city.buildings);
    audio.setEngine(0, false);
  }

  // --- Actions (the frame's presses, once; scripted scenes press nothing).
  const actions = opts?.actions ?? input.takeActions();
  if (actions & ACTION_ENTER_CAR) tryEnterCar();
  if (actions & ACTION_SHOOT) playerShoot();
  if (actions & ACTION_INTERACT) playerPunch();
  if (actions & ACTION_RELOAD && player.reloadTimer <= 0 && player.mag < PISTOL.magSize && player.ammoReserve > 0) {
    player.reloadTimer = PISTOL.reloadTime;
  }
  if (!scripted) {
    if (input.takeMute()) {
      const muted = audio.toggleMute();
      pushMessage(game.messages, muted ? 'Sound off.' : 'Sound on.');
    }
    if (input.takeTimeToggle()) {
      game.clock = (game.clock + 0.5) % 1;
      pushMessage(game.messages, 'Time passes in Neon Bay…');
    }
  }

  // --- Traffic, rivals, wrecks.
  for (const car of game.cars) {
    car.hitCooldown = Math.max(0, car.hitCooldown - dt);
    if (car.kind === 'traffic') stepTrafficCar(car, dt, game.random, game.cars);
    else if (car.kind === 'rival' && !car.wrecked) stepRival(car, dt);
    else if (car.wrecked) stepWreck(car, dt);
  }
  // Car-on-car collisions. A crash hurts once per half second, not once per
  // frame of contact — otherwise a brief scrape wrecks the car.
  for (let i = 0; i < game.cars.length; i += 1) {
    for (let j = i + 1; j < game.cars.length; j += 1) {
      const a = game.cars[i];
      const b = game.cars[j];
      const impact = collideCars(a, b);
      if (impact > 120) {
        let hit = false;
        if (a.hitCooldown <= 0) { damageCar(a, CAR.damagePerHit); a.hitCooldown = 0.6; hit = true; }
        if (b.hitCooldown <= 0) { damageCar(b, CAR.damagePerHit); b.hitCooldown = 0.6; hit = true; }
        if (hit) {
          spawnSparks(game.particles, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.drivenByPlayer || b.drivenByPlayer) audio.crash();
        }
      }
    }
  }
  // The player's car against pedestrians.
  if (player.inCar) {
    const car = player.inCar;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        knockDown(ped);
        crime(1, 'You hit a pedestrian!');
        audio.crash();
        spawnSparks(game.particles, ped.x, ped.y);
      }
    }
    // And against police cars.
    for (const copCar of game.police.cars) {
      copCar.hitCooldown = Math.max(0, (copCar.hitCooldown || 0) - dt);
      const impact = collideCars(car, copCar);
      if (impact > 140) {
        let hit = false;
        if (car.hitCooldown <= 0) { damageCar(car, CAR.damagePerHit); car.hitCooldown = 0.6; hit = true; }
        if (copCar.hitCooldown <= 0) { damageCar(copCar, CAR.damagePerHit); copCar.hitCooldown = 0.6; hit = true; }
        if (hit) {
          spawnSparks(game.particles, (car.x + copCar.x) / 2, (car.y + copCar.y) / 2);
          audio.crash();
        }
      }
    }
    if (car.wrecked) {
      spawnExplosion(game.particles, car.x, car.y);
      audio.crash();
      pushMessage(game.messages, 'Your car is wrecked. Get out!');
      exitCar(player, game.city.buildings);
    }
  }

  // --- Pedestrians and the police.
  stepPeds(game.peds, dt, game.random, game.city.buildings);
  const policeEvents = stepPolice(game.police, player, player.inCar, dt, game.random, game.city.buildings, (x, y, angle) => {
    fireBullet(game.bullets, x, y, angle, 'cop');
    audio.shot();
  });
  if (policeEvents.busted) return 'busted';
  audio.setSiren(policeNear(game.police));

  // --- Bullets.
  const hits = stepBullets(game.bullets, dt, {
    buildings: game.city.buildings,
    cars: [...game.cars, ...game.police.cars],
    peds: game.peds,
    cops: game.police.cops,
    player,
  });
  for (const hit of hits) {
    if (hit.type === 'building') {
      spawnSparks(game.particles, hit.x, hit.y);
    } else if (hit.type === 'car') {
      const died = damageCar(hit.target, PISTOL.damage);
      spawnSparks(game.particles, hit.x, hit.y);
      if (died) {
        spawnExplosion(game.particles, hit.target.x, hit.target.y);
        audio.crash();
        if (hit.target.kind === 'police') crime(2, 'You wrecked a police car!');
        if (hit.target.kind === 'rival') pushMessage(game.messages, 'Vulture car destroyed.');
      }
    } else if (hit.type === 'ped') {
      knockDown(hit.target);
      scarePeds(game.peds, hit.x, hit.y, 300);
      crime(1, 'You shot a pedestrian!');
    } else if (hit.type === 'player') {
      if (damagePlayer(player, PISTOL.damage)) return 'wasted';
    } else if (hit.type === 'cop') {
      const index = game.police.cops.indexOf(hit.target);
      if (index !== -1) game.police.cops.splice(index, 1);
      crime(2, 'You shot a cop. The whole city is coming.');
      spawnSparks(game.particles, hit.x, hit.y);
    }
  }

  // --- Pickups, missions, garages.
  const collectAt = player.inCar ? { x: player.inCar.x, y: player.inCar.y } : { x: player.x, y: player.y };
  for (const pickup of collectPickups(game.pickups, collectAt.x, collectAt.y)) {
    if (pickup.kind === 'cash') {
      player.money += pickup.amount;
      pushMessage(game.messages, `Found a stash: +$${pickup.amount}.`);
      audio.coin();
    } else if (pickup.kind === 'health') {
      healPlayer(player, pickup.amount);
      pushMessage(game.messages, `Health +${pickup.amount}.`);
      audio.pickup();
    } else {
      player.ammoReserve += pickup.amount;
      pushMessage(game.messages, `Ammo +${pickup.amount}.`);
      audio.pickup();
    }
  }
  stepPickups(game.pickups, dt);

  const missionResult = updateMission(game.missionState, game, dt);
  if (missionResult.message) {
    pushMessage(game.messages, missionResult.message);
    if (missionResult.missionDone) {
      audio.missionDone();
      showBanner(missionResult.missionDone && game.missionState.finishedAll ? 'KING OF NEON BAY' : 'JOB DONE');
      saveGame();
    }
  }

  // Pay 'n Spray: drive in, pay up, lose the heat.
  if (player.inCar && game.police.stars > 0 && player.money >= ECONOMY.payAndSprayCost) {
    for (const spot of [SPOTS.sprayNorth, SPOTS.spraySouth]) {
      if (Math.hypot(player.inCar.x - spot.x, player.inCar.y - spot.y) < 70) {
        player.money -= ECONOMY.payAndSprayCost;
        setWanted(game.police, 0);
        pushMessage(game.messages, `Pay 'n Spray: -$${ECONOMY.payAndSprayCost}. Clean plates, clean slate.`);
        audio.pickup();
        break;
      }
    }
  }

  // --- Ambience.
  stepMessages(game.messages, dt);
  stepParticles(game.particles, dt);
  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    if (game.bannerTimer <= 0) game.banner = null;
  }
  return null;
}

/** Where the player is aiming: from the player to the mouse, in world space. */
function aimAngle() {
  if (!input.mouse.inside || game.player.inCar) return null;
  const view = renderer.view;
  const wx = input.mouse.x - view.w / 2 + renderer.camera.x;
  const wy = input.mouse.y - view.h / 2 + renderer.camera.y;
  return Math.atan2(wy - game.player.y, wx - game.player.x);
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  // Paint every frame, not just twice: a resize after the first paints would
  // clear the canvas, and the screenshot must catch a painted frame.
  // The transient message feed is cleared for the shot — it is a few-second
  // feed, and the frame should show the persistent HUD, not a stray line.
  function paint() {
    renderer.resize();
    game.messages.length = 0;
    if (scene.screen === 'title') {
      renderer.drawTitle(game, save);
    } else {
      const focus = game.player.inCar ?? game.player;
      renderer.follow(focus.x, focus.y, 1);
      renderer.drawWorld(game);
      drawHUD(renderer.ctx, game, renderer.view);
    }
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  if (scene.screen === 'title') {
    requestAnimationFrame(paint);
    return;
  }
  // Play the staged scene forward with the autopilot, then paint it.
  const steps = Math.floor(scene.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    let scripted = null;
    if (scene.autopilot === 'drive') scripted = { scripted: true, drive: driveAutopilot(game), actions: 0 };
    else if (scene.autopilot === 'walk') scripted = { scripted: true, move: walkAutopilot(game), actions: 0 };
    else scripted = { scripted: true, actions: 0 };
    const outcome = stepWorld(STEP, scripted);
    if (outcome) break;
  }
  const focus = game.player.inCar ?? game.player;
  renderer.follow(focus.x, focus.y, 1);
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let last = performance.now();
  let accumulator = 0;
  let autosaveTimer = 0;
  let started = false;

  function startGame() {
    audio.ensure();
    audio.startMusic();
    if (save && !started) {
      game.player.money = save.money;
      game.player.health = save.health;
      game.player.ammoReserve = Math.max(0, save.ammo - PISTOL.magSize);
      game.player.mag = Math.min(PISTOL.magSize, save.ammo);
      game.player.x = save.playerX;
      game.player.y = save.playerY;
      game.missionState.missionIndex = Math.min(save.missionIndex, 5);
      game.missionState.stepIndex = 0;
      beginStep(game.missionState, game);
      pushMessage(game.messages, `Welcome back, Rex. ${currentMission(game.missionState)?.title ?? ''} is still open.`);
    } else {
      pushMessage(game.messages, "Vex: Rex. Get a car — any car — and bring it to my garage.");
      audio.phone();
    }
    started = true;
    screen = 'play';
    announce('Playing. Follow the yellow marker.');
  }

  function endRun(kind) {
    screen = kind;
    audio.busted();
    audio.setEngine(0, false);
    audio.setSiren(false);
    respawn(kind);
    announce(kind === 'busted' ? 'Busted. Press Enter to continue.' : 'Wasted. Press Enter to continue.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) startGame();
      game.time += STEP;
      game.clock = (game.clock + STEP / DAY_LENGTH) % 1;
      renderer.drawTitle(game, save);
      return;
    }
    if (screen === 'busted' || screen === 'wasted') {
      if (actions & ACTION_CONFIRM) {
        screen = 'play';
        announce('Playing.');
      }
      renderer.drawEnd(game, screen);
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === 'play' ? 'paused' : 'play';
      announce(screen === 'paused' ? 'Paused.' : 'Playing.');
    }
    if (screen === 'paused') {
      renderer.drawPause(game);
      return;
    }
    // The frame's presses apply to the first step only, never twice.
    let firstStep = true;
    while (accumulator >= STEP) {
      const outcome = stepWorld(STEP, firstStep ? { actions } : null);
      firstStep = false;
      accumulator -= STEP;
      if (outcome) {
        endRun(outcome);
        break;
      }
    }
    autosaveTimer += STEP;
    if (autosaveTimer >= AUTOSAVE_SECONDS) {
      autosaveTimer = 0;
      saveGame();
    }
    const focus = game.player.inCar ?? game.player;
    renderer.follow(focus.x, focus.y, STEP);
    renderer.drawWorld(game);
    drawHUD(renderer.ctx, game, renderer.view);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
