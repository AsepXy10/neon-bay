// The screenshot scenes behind ?shot=chase|street|mission|night|start. Each
// one sets the world to a moment a real game reaches — a chase, a busy
// street, a job in progress, Neon Row at night — then the loop plays it
// forward for a few seconds with an autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { PALETTE } from './config.js';
import { createCar } from './vehicles.js';
import { placeRoadblock, setWanted } from './police.js';
import { createPed } from './pedestrians.js';
import { beginStep } from './missions.js';

/** Put the player in a car on a road, heading east, at speed. */
function putPlayerInCar(game, x, y, angle, color, speed) {
  const car = createCar(x, y, angle, color, 'traffic');
  car.hasDriver = false;
  car.speed = speed;
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  car.drivenByPlayer = true;
  game.cars.push(car);
  return car;
}

/** A police car behind the player, already in pursuit. */
function addPoliceCar(game, x, y, angle) {
  const car = createCar(x, y, angle, PALETTE.police, 'police');
  car.speed = 420;
  game.police.cars.push(car);
  return car;
}

function stageChase(game) {
  // Morning in Downtown, three stars, two police cars on the player's tail
  // and an NBPD roadblock thrown across the road ahead — the job is two
  // thousand metres away, so the chase never finishes mid-shot.
  game.clock = 0.18;
  game.missionState.missionIndex = 1;
  game.missionState.stepIndex = 0;
  beginStep(game.missionState, game);
  const car = putPlayerInCar(game, 2400, 800, Math.PI, '#e63946', 430);
  // Same lane, close behind: the chase reads at a glance.
  addPoliceCar(game, 2620, 800, Math.PI);
  addPoliceCar(game, 2740, 800, Math.PI);
  // The blockade ahead, on the same road the player is racing down.
  placeRoadblock(game.police, 1200, 800, Math.PI);
  game.player.money = 1250;
  setWanted(game.police, 3);
  // Traffic with somewhere to be: one faster car well ahead on another road,
  // two crossing the grid on the roads around him.
  for (const [x, y, angle, speed] of [[2000, 1200, Math.PI, 250], [1600, 1300, Math.PI / 2, 150], [1500, 1200, Math.PI, 160]]) {
    const t = createCar(x, y, angle, '#2980b9', 'traffic');
    t.speed = speed;
    game.cars.push(t);
  }
  return { screen: 'play', autopilot: 'drive', seconds: 1.5 };
}

function stageStreet(game) {
  // Afternoon on a busy Downtown crossing, on foot, traffic and people everywhere.
  // Rex stands in the crowd: the staged pedestrians mill around him while
  // traffic crosses the intersection behind them.
  game.clock = 0.32;
  game.player.x = 1560;
  game.player.y = 1560;
  game.player.angle = -Math.PI / 2;
  game.player.money = 450;
  // A crowd right around Rex, not scattered across the block.
  for (let i = 0; i < 10; i += 1) {
    const ped = createPed(1500 + game.random() * 160, 1500 + game.random() * 160, game.random);
    ped.target = { x: 1500 + game.random() * 160, y: 1500 + game.random() * 160 };
    game.peds.push(ped);
  }
  for (const [x, y, angle, speed] of [[1000, 1600, 0, 150], [1600, 1000, Math.PI / 2, 150], [2000, 1600, Math.PI, 150]]) {
    const t = createCar(x, y, angle, '#2980b9', 'traffic');
    t.speed = speed;
    game.cars.push(t);
  }
  return { screen: 'play', autopilot: null, seconds: 2 };
}

function stageMission(game) {
  // The Package, mid-job: the crates are on the ground at the Docks, and
  // Rex is right there in the teal Comet to grab them.
  game.clock = 0.25;
  game.missionState.missionIndex = 1;
  game.missionState.stepIndex = 1;
  beginStep(game.missionState, game);
  putPlayerInCar(game, 460, 420, -Math.PI / 2, '#16a085', 0);
  // A car crossing the Docks junction behind him.
  const t = createCar(400, 700, -Math.PI / 2, '#2980b9', 'traffic');
  t.speed = 150;
  game.cars.push(t);
  game.player.money = 800;
  return { screen: 'play', autopilot: null, seconds: 2 };
}

function stageNight(game) {
  // Neon Row after dark, for real this time: the signs are on, one star,
  // one police car closing in. Rex runs east along Neon Row, buildings lit
  // on both sides.
  game.clock = 0.78;
  game.missionState.missionIndex = 2;
  game.missionState.stepIndex = 0;
  beginStep(game.missionState, game);
  putPlayerInCar(game, 2000, 800, 0, '#8e44ad', 380);
  addPoliceCar(game, 1800, 824, 0);
  game.player.money = 2100;
  setWanted(game.police, 1);
  return { screen: 'play', autopilot: 'drive', seconds: 2 };
}

/**
 * Set `game` to the named scene (chase, street, mission, night; anything else
 * is the title screen) and return how to play it forward.
 */
export function stageShot(name, game) {
  if (name === 'chase') return stageChase(game);
  if (name === 'street') return stageStreet(game);
  if (name === 'mission') return stageMission(game);
  if (name === 'night') return stageNight(game);
  return { screen: 'title', autopilot: null, seconds: 0 };
}

/**
 * The autopilot that drives the player's car during a staged scene: aim at
 * the next intersection ahead and keep the throttle down.
 */
export function driveAutopilot(game) {
  const car = game.player.inCar;
  if (!car) return { throttle: 0, steer: 0 };
  const aheadX = car.x + Math.cos(car.angle) * 320;
  const aheadY = car.y + Math.sin(car.angle) * 320;
  const targetAngle = Math.atan2(aheadY - car.y, aheadX - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  return { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2)) };
}

/** The autopilot that strolls the player down the street for a scene. */
export function walkAutopilot(game) {
  return { x: 0, y: -1 };
}
