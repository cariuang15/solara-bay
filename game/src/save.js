// Solara Bay — save and load. One localStorage slot holds money, missions
// completed, the player's position and health, wanted level and weapon, so
// Continue on the title screen resumes exactly where the player left off.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1, money: p.money, health: p.health, wanted: Math.round(p.wanted),
      x: Math.round(p.x), y: Math.round(p.y), weapon: p.weapon, ammo: p.ammo,
      missionsDone: state.missions.completed.slice(),
      missionIndex: state.missions.index, timeOfDay: state.timeOfDay,
      carsStolen: state.carsStolen, savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch { return null; }
}

export function hasSave() { return loadSave() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}

/** Apply a loaded save to a fresh world state. */
export function applySave(state, data) {
  const p = state.player;
  p.money = data.money; p.health = data.health; p.wanted = data.wanted;
  p.x = data.x; p.y = data.y; p.weapon = data.weapon; p.ammo = data.ammo || 0;
  p.inCar = false; p.carId = -1;
  state.timeOfDay = data.timeOfDay || 9.5;
  state.carsStolen = data.carsStolen || 0;
  const m = state.missions;
  m.completed = (data.missionsDone || []).slice();
  m.index = data.missionIndex || 0;
  m.stage = 0; m.active = false; m.started = false; m.failed = false;
  if (m.index >= m.defs.length) m.allDone = true;
}
