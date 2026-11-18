// Solara Bay — the wanted system and the police. Crimes raise stars (1–5);
// police cars chase and ram, foot cops chase and punch; stars decay while the
// player stays out of sight, and getting caught means Busted, dying means Wasted.
import { CAR_TYPES, WANTED } from './config.js';
import { makeCar } from './traffic.js';
import { buildingAt, nearestRoadPoint } from './city.js';

export function addWanted(state, amount, reason) {
  const before = state.player.wanted;
  state.player.wanted = Math.min(WANTED.max, state.player.wanted + amount);
  if (state.player.wanted > before) state.lastCrime = state.elapsed;
  state.lastCrimeReason = reason;
  return state.player.wanted;
}

/** How many police units the wanted level calls for. */
export function policeQuota(wanted) {
  return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 5 : 7;
}

/** Spawn one police car on a road near the player. */
export function spawnPoliceCar(state, random) {
  const rp = nearestRoadPoint(state.player.x + (random() - 0.5) * 900, state.player.y + (random() - 0.5) * 900);
  const car = makeCar(state.nextCarId++, 'police', rp.x, rp.y, 0, { ai: false });
  car.speed = 200;
  car.siren = 1;
  car.chaseTime = 0;
  state.cars.push(car);
  return car;
}

/** Spawn one foot cop near the player. */
export function spawnFootCop(state, random) {
  const cop = {
    id: state.nextPedId++, x: state.player.x + (random() - 0.5) * 500,
    y: state.player.y + (random() - 0.5) * 500, angle: 0, speed: 210,
    color: '#1d2f4d', state: 'chase', panic: 0, tx: 0, ty: 0, wait: 0,
    dead: false, hp: 60, cop: true, punchTimer: 0,
  };
  state.peds.push(cop);
  return cop;
}

/** Steer a police car toward the player and ram; returns true on a hard hit. */
export function stepPoliceCar(car, player, dt, city) {
  // Spread out: each unit aims at its own point around the player, so the
  // pack surrounds instead of stacking on one spot and pinning the player.
  const d0 = Math.hypot(player.x - car.x, player.y - car.y) || 1;
  const spread = d0 < 300 ? 130 : 0;
  const sa = (car.id % 7) * 0.9;
  const tx = player.x + Math.cos(sa) * spread;
  const ty = player.y + Math.sin(sa) * spread;
  const dx = tx - car.x, dy = ty - car.y, d = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const t = CAR_TYPES.police;
  car.angle += Math.max(-t.turn * 1.4 * dt, Math.min(t.turn * 1.4 * dt, diff));
  // Slightly slower than a sport car, so a fast getaway can work.
  const target = d > 60 ? t.top * 0.92 : t.top * 0.4;
  car.speed += Math.max(-600 * dt, Math.min(520 * dt, target - car.speed));
  // Police cars respect buildings too: slide along a wall instead of driving
  // through it (no rooftop police cars).
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!buildingAt(city, nx, ny, 24)) { car.x = nx; car.y = ny; }
  else if (!buildingAt(city, nx, car.y, 24)) car.x = nx;
  else if (!buildingAt(city, car.x, ny, 24)) car.y = ny;
  else car.speed *= 0.5;
  car.siren = 1;
  return d < 60 && car.speed > 200;
}

/** Steer a foot cop toward the player; punches in range. Returns damage dealt. */
export function stepFootCop(cop, player, dt) {
  const dx = player.x - cop.x, dy = player.y - cop.y, d = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  cop.punchTimer = Math.max(0, (cop.punchTimer || 0) - dt);
  if (d > 30) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  } else if (cop.punchTimer === 0) {
    cop.punchTimer = 1.1;
    return 8;
  }
  return 0;
}

/** Decay wanted when no police unit is close and no crime happened recently. */
export function decayWanted(state, dt) {
  if (state.player.wanted <= 0) return;
  const nearPolice = state.cars.some((c) => c.police && !c.dead && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 350)
    || state.peds.some((p) => p.cop && !p.dead && Math.hypot(p.x - state.player.x, p.y - state.player.y) < 350);
  const quiet = state.elapsed - state.lastCrime > 4;
  if (!nearPolice && quiet) {
    state.player.wanted = Math.max(0, state.player.wanted - WANTED.decayPerSec * dt * 4);
    if (state.player.wanted < 0.5) state.player.wanted = 0;
  }
}
