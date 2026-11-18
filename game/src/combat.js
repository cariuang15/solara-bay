// Solara Bay — combat on foot: punching, pistol fire, bullets, enemy gang
// members, and damage to the player. Pure logic; rendering and sound live
// in render.js / audio.js and react to the events returned here.
import { PLAYER, WEAPONS } from './config.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_ENEMY_DOWN = 4;
export const EVENT_PLAYER_HIT = 8;

export function makeBullet(x, y, angle, owner) {
  return { x, y, angle, speed: WEAPONS.pistol.bulletSpeed, life: 0.9, owner, dead: false };
}

export function makeEnemy(id, x, y) {
  return {
    id, x, y, angle: 0, hp: 70, maxHp: 70, speed: 150, state: 'guard',
    color: '#3d2b52', dead: false, shootTimer: 1 + Math.random(), punchTimer: 0,
    tx: x, ty: y, wait: 2,
  };
}

/** Punch: hits the nearest ped/enemy/cop in front within range. Returns events + kills. */
export function punch(state, dt) {
  const p = state.player;
  if (p.punchTimer > 0) return 0;
  p.punchTimer = PLAYER.punchRate;
  let events = EVENT_PUNCH;
  const targets = [];
  for (const e of state.enemies) if (!e.dead) targets.push(e);
  for (const ped of state.peds) if (!ped.dead && ped.cop) targets.push(ped);
  let best = null, bestD = PLAYER.punchRange + 14;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    best.hp -= PLAYER.punchDamage;
    if (best.hp <= 0) {
      best.dead = true;
      events |= EVENT_ENEMY_DOWN;
      if (state.enemies.includes(best)) state.killsThisStep = (state.killsThisStep || 0) + 1;
    }
  }
  return events;
}

/** Fire the pistol toward (tx, ty). Returns EVENT_SHOT when a bullet is made. */
export function shoot(state, tx, ty) {
  const p = state.player;
  if (p.weapon !== 'pistol' || p.ammo <= 0 || p.shootTimer > 0) return 0;
  p.shootTimer = WEAPONS.pistol.rate;
  p.ammo -= 1;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  state.bullets.push(makeBullet(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, angle, 'player'));
  return EVENT_SHOT;
}

/** Move bullets, hit buildings / cars / peds / enemies / the player. Returns events + kills. */
export function stepBullets(state, dt) {
  let events = 0;
  for (const b of state.bullets) {
    if (b.dead) continue;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > 3600 || b.y > 2600) { b.dead = true; continue; }
    if (state.city && state.city.buildings) {
      for (const bd of state.city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { b.dead = true; break; }
      }
      if (b.dead) continue;
    }
    const hitList = [];
    for (const e of state.enemies) if (!e.dead) hitList.push(e);
    for (const ped of state.peds) if (!ped.dead) hitList.push(ped);
    for (const t of hitList) {
      if (Math.hypot(t.x - b.x, t.y - b.y) < 18) {
        b.dead = true;
        t.hp -= WEAPONS.pistol.damage;
        if (t.hp <= 0) {
          t.dead = true; events |= EVENT_ENEMY_DOWN;
          if (state.enemies.includes(t)) state.killsThisStep = (state.killsThisStep || 0) + 1;
          if (t.cop) events |= EVENT_PLAYER_HIT; // killing a cop is a crime, handled by caller
        }
        break;
      }
    }
    if (b.dead) continue;
    // Enemy bullets can hit the player.
    if (b.owner === 'enemy' && Math.hypot(state.player.x - b.x, state.player.y - b.y) < 16) {
      b.dead = true;
      damagePlayer(state, 6);
      events |= EVENT_PLAYER_HIT;
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  return events;
}

/** One enemy gang member: guards its post, chases and shoots the player when close. */
export function stepEnemy(e, state, dt) {
  if (e.dead) return 0;
  const p = state.player;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.angle = Math.atan2(dy, dx);
  e.shootTimer -= dt;
  e.punchTimer = Math.max(0, e.punchTimer - dt);
  let events = 0;
  if (d < 320) {
    e.state = 'attack';
    if (d > 200) { e.x += Math.cos(e.angle) * e.speed * dt; e.y += Math.sin(e.angle) * e.speed * dt; }
    else if (e.shootTimer <= 0) {
      e.shootTimer = 1.8 + Math.random() * 0.8;
      state.bullets.push(makeBullet(e.x, e.y, e.angle + (Math.random() - 0.5) * 0.25, 'enemy'));
      events |= EVENT_SHOT;
    }
    if (d < 30 && e.punchTimer === 0) {
      e.punchTimer = 0.9;
      damagePlayer(state, 9);
      events |= EVENT_PLAYER_HIT;
    }
  } else {
    e.state = 'guard';
    e.wait -= dt;
    if (e.wait <= 0) { e.tx = e.x + (Math.random() - 0.5) * 160; e.ty = e.y + (Math.random() - 0.5) * 160; e.wait = 3 + Math.random() * 3; }
    const gx = e.tx - e.x, gy = e.ty - e.y, gd = Math.hypot(gx, gy);
    if (gd > 10) { e.x += (gx / gd) * 60 * dt; e.y += (gy / gd) * 60 * dt; }
  }
  return events;
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0) return;
  p.health -= amount;
  p.invuln = 0.4;
  state.lastHurt = state.elapsed;
  if (p.health <= 0) { p.health = 0; state.wasted = true; }
}
