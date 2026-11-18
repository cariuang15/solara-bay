// Solara Bay — the minimap: the whole city shrunk into the bottom-right
// corner, with roads, the sea, the player, police, the mission waypoint and
// the gang block. Drawn every frame by render.js.
import { WORLD } from './config.js';
import { BEACH_Y, LANDMARKS, V_ROADS, H_ROADS, WATER_Y } from './city.js';
import { missionWaypoint } from './missions.js';

const SIZE = 190;
const MARGIN = 14;

export function drawMinimap(ctx, state, view) {
  const x0 = view.width - SIZE - MARGIN, y0 = view.height - SIZE - MARGIN;
  const sx = SIZE / WORLD.width, sy = SIZE / WORLD.height;
  ctx.fillStyle = 'rgba(10,14,20,0.7)';
  ctx.fillRect(x0 - 4, y0 - 4, SIZE + 8, SIZE + 8);
  // Land.
  ctx.fillStyle = '#4d8a4f';
  ctx.fillRect(x0, y0, SIZE, SIZE);
  // Sea + beach.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0, y0 + WATER_Y * sy, SIZE, SIZE - WATER_Y * sy);
  ctx.fillStyle = '#e6d29a';
  ctx.fillRect(x0, y0 + BEACH_Y * sy, SIZE, (WATER_Y - BEACH_Y) * sy);
  // Roads.
  ctx.fillStyle = '#3c3f46';
  for (const rx of V_ROADS) ctx.fillRect(x0 + rx * sx - 2, y0, 4, SIZE);
  for (const ry of H_ROADS) ctx.fillRect(x0, y0 + ry * sy - 2, SIZE, 4);
  // Gang block + landmarks.
  ctx.fillStyle = '#e5534b';
  ctx.fillRect(x0 + LANDMARKS.block.x * sx - 3, y0 + LANDMARKS.block.y * sy - 3, 6, 6);
  // Mission waypoint, blinking.
  const wp = missionWaypoint(state.missions);
  if (wp && Math.floor(state.elapsed * 2) % 2 === 0) {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x0 + wp.x * sx, y0 + wp.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x0 + wp.x * sx, y0 + wp.y * sy, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police cars.
  ctx.fillStyle = '#4fc3f7';
  for (const c of state.cars) {
    if (c.police && !c.dead) {
      ctx.beginPath();
      ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(x0 - 4, y0 - 4, SIZE + 8, SIZE + 8);
}
