// Save and load: one JSON blob in localStorage with the player's money,
// mission progress, position and health. Loading never throws — a missing or
// broken save just means a fresh start.

import { SAVE_KEY } from './config.js';

/** What a fresh game starts with. */
export function freshSave() {
  return {
    money: 150,
    missionIndex: 0,
    playerX: 1600,
    playerY: 1300,
    health: 100,
    ammo: 24,
    best: 0,
  };
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return { ...freshSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
