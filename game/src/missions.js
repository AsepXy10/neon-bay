// The story: six jobs from Vex, the fixer who never left Neon Bay. Rex
// Marlowe came home after five years away with nothing but a name the city
// still remembers. Each mission is a list of steps; a step is done when the
// player reaches a place, collects the packages, or wrecks the right cars.

import { SPOTS } from './city.js';
import { createCar } from './vehicles.js';
import { randomRoadPoint } from './city.js';
import { PALETTE } from './config.js';
import { addWanted, setWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'back-in-the-bay',
    title: 'Back in the Bay',
    briefing: "Vex: Rex. Five years, and you walk back in like the tide. You need wheels and you need work. Get a car — any car — and bring it to my garage.",
    reward: 300,
    steps: [
      { type: 'enterCar', text: 'Get in a car (press E near one)' },
      { type: 'driveTo', spot: 'garage', text: "Drive to Vex's Garage" },
    ],
  },
  {
    id: 'the-package',
    title: 'The Package',
    briefing: "Vex: First real job. Three crates at the Docks, still warm from the boat. Pick them up and bring them to Club Mirage on Neon Row. No cops, no questions.",
    reward: 500,
    steps: [
      { type: 'goto', spot: 'docks', text: 'Go to the Docks' },
      { type: 'pickup', spot: 'docks', count: 3, text: 'Collect the 3 crates' },
      { type: 'deliver', spot: 'club', text: 'Deliver to Club Mirage' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: "Vex: A gold Comet GT is parked at the Marina, keys in it, owner in the casino. It belongs to the Vultures. Take it to the Chop Shop — and expect the law to notice.",
    reward: 800,
    steps: [
      { type: 'steal', spot: 'marina', text: 'Steal the gold Comet GT at the Marina' },
      { type: 'deliver', spot: 'chopShop', text: 'Deliver it to the Chop Shop' },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    briefing: "Vex: The Vultures sent two of their boys to lean on my garage. They drive purple, they drive mean. Wreck both of their cars — ram them, shoot them, I don't care how.",
    reward: 1000,
    steps: [
      { type: 'takedown', count: 2, text: 'Wreck the 2 Vulture cars' },
    ],
  },
  {
    id: 'smoke-and-mirrors',
    title: 'Smoke and Mirrors',
    briefing: "Vex: One more pickup at the Marina, and this one's hot — the cops are already on it. Grab it, run the blockade, and get it to the Safehouse. Don't get caught.",
    reward: 1500,
    steps: [
      { type: 'pickup', spot: 'marina', count: 1, text: 'Grab the package at the Marina' },
      { type: 'escape', spot: 'safehouse', wanted: 3, text: 'Escape to the Safehouse' },
    ],
  },
  {
    id: 'the-meridian-job',
    title: 'The Meridian Job',
    briefing: "Vex: Last one, Rex. Meridian Bank, downtown, twelve seconds of nerve. Get inside, grab the cash, and lose the whole city on the way to the Safehouse. After this, Neon Bay is yours.",
    reward: 5000,
    steps: [
      { type: 'goto', spot: 'bank', text: 'Get to Meridian Bank' },
      { type: 'wait', spot: 'bank', seconds: 12, text: 'Grab the cash — hold position' },
      { type: 'escape', spot: 'safehouse', wanted: 4, text: 'Lose the cops — reach the Safehouse' },
    ],
  },
];

/** Fresh mission progress. */
export function createMissionState() {
  return {
    missionIndex: 0,
    stepIndex: 0,
    packages: [],
    rivals: [],
    goldCar: null,
    waitTimer: 0,
    waitTotal: 0,
    done: false,
    finishedAll: false,
    banner: null,
  };
}

export function currentMission(state) {
  return MISSIONS[state.missionIndex] ?? null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.stepIndex] ?? null;
}

/** The one-line objective the HUD shows. */
export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return '';
  const step = currentStep(state);
  if (!step) return '';
  if (step.type === 'pickup') {
    const left = state.packages.filter((p) => !p.taken).length;
    return `${mission.title}: ${step.text} (${left} left)`;
  }
  if (step.type === 'takedown') {
    const left = state.rivals.filter((r) => !r.wrecked).length;
    return `${mission.title}: ${step.text} (${left} left)`;
  }
  if (step.type === 'wait') {
    return `${mission.title}: ${step.text} (${Math.ceil(state.waitTotal - state.waitTimer)}s)`;
  }
  return `${mission.title}: ${step.text}`;
}

/** Where the yellow marker points, or null when the step has no place. */
export function targetPoint(state) {
  const step = currentStep(state);
  if (!step) return null;
  if (step.spot) {
    const spot = SPOTS[step.spot];
    return { x: spot.x, y: spot.y, label: spot.name };
  }
  if (step.type === 'takedown' && state.rivals.length > 0) {
    const alive = state.rivals.find((r) => !r.wrecked);
    if (alive) return { x: alive.x, y: alive.y, label: 'Vulture' };
  }
  if (step.type === 'steal' && state.goldCar) {
    return { x: state.goldCar.x, y: state.goldCar.y, label: 'Comet GT' };
  }
  return null;
}

/** Spawn what a step needs: packages, the gold car, or the rival cars. */
export function beginStep(state, game) {
  const step = currentStep(state);
  if (!step) return;
  state.packages = [];
  state.rivals = [];
  state.goldCar = null;
  state.waitTimer = 0;
  state.waitTotal = step.seconds ?? 0;
  if (step.type === 'pickup') {
    const spot = SPOTS[step.spot];
    for (let i = 0; i < step.count; i += 1) {
      const angle = (i / step.count) * Math.PI * 2 + 0.6;
      state.packages.push({
        x: spot.x + Math.cos(angle) * 150,
        y: spot.y + Math.sin(angle) * 150,
        taken: false,
      });
    }
  }
  if (step.type === 'steal') {
    const spot = SPOTS[step.spot];
    const car = createCar(spot.x + 60, spot.y + 30, 0, PALETTE.gold, 'gold');
    car.hasDriver = false;
    state.goldCar = car;
    game.cars.push(car);
  }
  if (step.type === 'takedown') {
    for (let i = 0; i < step.count; i += 1) {
      const p = randomRoadPoint(game.random);
      const car = createCar(p.x, p.y, 0, PALETTE.rival, 'rival');
      car.health = 60;
      car.hasDriver = false;
      state.rivals.push(car);
      game.cars.push(car);
    }
  }
  if (step.type === 'escape') {
    setWanted(game.police, step.wanted ?? 3);
  }
}

/**
 * Check the current step. Returns { stepDone, missionDone, message }.
 * `game` carries player, cars, police, and the event helpers.
 */
export function updateMission(state, game, dt) {
  const mission = currentMission(state);
  const step = currentStep(state);
  if (!mission || !step) return { stepDone: false, missionDone: false, message: null };
  const player = game.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;

  function reach(spotKey, radius) {
    const spot = SPOTS[spotKey];
    return Math.hypot(px - spot.x, py - spot.y) < radius;
  }

  let done = false;
  if (step.type === 'enterCar') {
    done = player.inCar !== null;
  } else if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'deliver') {
    done = reach(step.spot, 70);
  } else if (step.type === 'pickup') {
    for (const pack of state.packages) {
      if (!pack.taken && Math.hypot(px - pack.x, py - pack.y) < 40) pack.taken = true;
    }
    done = state.packages.length > 0 && state.packages.every((p) => p.taken);
  } else if (step.type === 'steal') {
    done = player.inCar === state.goldCar;
    if (done) setWanted(game.police, 2);
  } else if (step.type === 'takedown') {
    done = state.rivals.length > 0 && state.rivals.every((r) => r.wrecked);
  } else if (step.type === 'wait') {
    if (reach(step.spot, 90)) {
      state.waitTimer += dt;
      if (state.waitTimer >= state.waitTotal) done = true;
    } else {
      state.waitTimer = Math.max(0, state.waitTimer - dt * 2);
    }
  } else if (step.type === 'escape') {
    done = reach(step.spot, 70);
    if (done) setWanted(game.police, 0);
  }

  if (!done) return { stepDone: false, missionDone: false, message: null };
  state.stepIndex += 1;
  if (state.stepIndex < mission.steps.length) {
    beginStep(state, game);
    return { stepDone: true, missionDone: false, message: 'Objective complete.' };
  }
  // Mission complete: pay up, move to the next job.
  player.money += mission.reward;
  const wasLast = state.missionIndex >= MISSIONS.length - 1;
  if (wasLast) {
    state.finishedAll = true;
    state.banner = 'KING OF NEON BAY';
    return { stepDone: true, missionDone: true, message: `Job done: ${mission.title} — $${mission.reward}. Neon Bay is yours.` };
  }
  state.missionIndex += 1;
  state.stepIndex = 0;
  beginStep(state, game);
  const next = currentMission(state);
  return {
    stepDone: true,
    missionDone: true,
    message: `Job done: ${mission.title} — $${mission.reward}. New job: ${next.title}.`,
  };
}
