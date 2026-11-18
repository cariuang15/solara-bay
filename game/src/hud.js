// Solara Bay — the HUD: health bar, money, wanted stars, weapon and ammo,
// active mission objective, speed, clock, and the mission list. Drawn by
// render.js onto the same canvas, top-down over the city view.
import { FONT, PALETTE, WEAPONS } from './config.js';
import { MISSION_NAMES, currentMission, objectiveText } from './missions.js';

export function drawHud(ctx, state, view) {
  const p = state.player;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  // Top-left: health + money.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(14, 12, 250, 64);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`$${p.money}`, 26, 20);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 48, 180, 12);
  ctx.fillStyle = p.health > 30 ? PALETTE.green : PALETTE.red;
  ctx.fillRect(26, 48, 180 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `14px ${FONT}`;
  ctx.fillText(`${Math.ceil(p.health)}`, 212, 46);
  // Top-right: wanted stars.
  const stars = Math.round(p.wanted);
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(view.width - 14 - 5 * 30 - 16, 12, 5 * 30 + 16, 40);
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', view.width - 14 - (5 - i) * 30, 16);
  }
  // Weapon + ammo, under the stars.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(view.width - 184, 60, 170, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `16px ${FONT}`;
  const wname = WEAPONS[p.weapon].name;
  ctx.fillText(p.weapon === 'pistol' ? `${wname}  ${p.ammo}` : wname, view.width - 172, 68);
  // Speed + clock, bottom-left.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(14, view.height - 52, 210, 40);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 18px ${FONT}`;
  const speed = p.inCar ? Math.round(p.speed * 0.9) : Math.round(p.speed * 0.9);
  const hh = Math.floor(state.timeOfDay), mm = Math.floor((state.timeOfDay - hh) * 60);
  ctx.fillText(p.inCar ? `${speed} km/j` : 'Jalan kaki', 26, view.height - 44);
  ctx.font = `16px ${FONT}`;
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 150, view.height - 42);
  // Objective panel, top-centre.
  const m = state.missions;
  const mission = currentMission(m);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  const obj = objectiveText(m);
  ctx.fillRect(view.width / 2 - 260, 12, 520, 58);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(mission ? mission.name : 'Solara Bay', view.width / 2, 18);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(obj.length > 62 ? obj.slice(0, 62) + '…' : obj, view.width / 2, 42);
  // Story message banner.
  if (m.messageTimer > 0 && m.message) {
    ctx.fillStyle = 'rgba(20,26,36,0.85)';
    ctx.fillRect(view.width / 2 - 330, view.height - 130, 660, 44);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `16px ${FONT}`;
    const msg = m.message.length > 78 ? m.message.slice(0, 78) + '…' : m.message;
    ctx.fillText(msg, view.width / 2, view.height - 116);
  }
  // Mission list, left edge under the health box (collapsible by length).
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.45)';
  ctx.fillRect(14, 86, 250, 24 + MISSION_NAMES.length * 20);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText('MISI — MAMA ROSA', 24, 92);
  ctx.font = `13px ${FONT}`;
  MISSION_NAMES.forEach((name, i) => {
    const done = m.completed.includes(i);
    const active = mission && m.index === i && !m.allDone;
    ctx.fillStyle = done ? PALETTE.green : active ? PALETTE.gold : PALETTE.muted;
    ctx.fillText(`${done ? '✓' : active ? '▶' : '·'} ${name}`, 24, 112 + i * 20);
  });
  ctx.textAlign = 'left';
}

/** Small "nearby car — press E" hint above the player, drawn in world space. */
export function drawEnterHint(ctx, x, y) {
  ctx.fillStyle = 'rgba(10,14,20,0.75)';
  ctx.fillRect(x - 78, y - 52, 156, 26);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Tekan E — Masuk Mobil', x, y - 46);
  ctx.textAlign = 'left';
}
