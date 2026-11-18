// Solara Bay — drawing only: the camera follows the player over the city,
// day/night light tints the scene, and the HUD, minimap and menu screens are
// painted on top. Flat procedural art, no images: every building, car and
// person is drawn from code.
import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { BEACH_Y, H_ROADS, ROAD_W, V_ROADS, WATER_Y } from './city.js';
import { drawHud, drawEnterHint } from './hud.js';
import { drawMinimap } from './minimap.js';
import { missionWaypoint } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

function daylight(timeOfDay) {
  // 1 at noon, ~0.35 at midnight; dawn/dusk in between.
  const t = timeOfDay;
  if (t >= 6 && t <= 18) return 0.75 + 0.25 * Math.sin(((t - 6) / 12) * Math.PI);
  if (t < 6) return 0.35 + 0.2 * (t / 6);
  return 0.35 + 0.2 * ((24 - t) / 6);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w; canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }

  function camera(state) {
    const p = state.player;
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2 + shakeX)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2 + shakeY)),
    };
  }

  function drawCity(state, cam) {
    const c = state.city;
    const x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + VIEW.width + 40, y1 = cam.y + VIEW.height + 40;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Parks.
    context.fillStyle = PALETTE.park;
    for (const pk of c.parks) if (pk.x < x1 && pk.x + pk.w > x0 && pk.y < y1 && pk.y + pk.h > y0) {
      context.fillRect(pk.x, pk.y, pk.w, pk.h);
      context.fillStyle = '#2f7a3e';
      for (let i = 0; i < 4; i += 1) {
        context.beginPath();
        context.arc(pk.x + 40 + i * 60, pk.y + 30 + (i % 2) * 60, 16, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = PALETTE.park;
    }
    // Beach + sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0, Math.max(y0, BEACH_Y), x1 - x0, Math.max(0, Math.min(y1, WATER_Y) - Math.max(y0, BEACH_Y)));
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, Math.max(y0, WATER_Y), x1 - x0, Math.max(0, y1 - Math.max(y0, WATER_Y)));
    // Pier.
    context.fillStyle = '#8a7d6b';
    context.fillRect(1460, 2320, 80, 180);
    context.fillStyle = '#e8e8e8';
    context.beginPath(); context.arc(1500, 2440, 26, 0, Math.PI * 2); context.fill();
    // Roads + sidewalks.
    for (const rx of V_ROADS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_W / 2 - 10, y0, ROAD_W + 20, y1 - y0);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
      context.fillStyle = PALETTE.roadLine;
      for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of H_ROADS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x0, ry - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
      context.fillStyle = PALETTE.road;
      context.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
      context.fillStyle = PALETTE.roadLine;
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) context.fillRect(x, ry - 2, 30, 4);
    }
    // Buildings: shadow, roof, windows, height shading.
    for (const b of c.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(b.x, b.y, b.w, 10);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x, b.y + b.h - 8, b.w, 8);
      if (b.windows) {
        context.fillStyle = '#2b3a4d';
        const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 30));
        for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
          context.fillRect(b.x + 10 + i * 34, b.y + 12 + j * 30, 16, 14);
        }
      }
      if (b.height >= 3) {
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.font = `bold 13px ${FONT}`;
        context.textAlign = 'left';
        context.fillText(`${'▲'.repeat(Math.min(4, b.height))}`, b.x + 8, b.y + b.h - 14);
      }
    }
  }

  function drawCar(car) {
    if (car.dead) return;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-car.l / 2 + 3, -car.w / 2 + 3, car.l, car.w);
    context.fillStyle = car.color;
    context.fillRect(-car.l / 2, -car.w / 2, car.l, car.w);
    context.fillStyle = '#20262e';
    context.fillRect(-car.l / 2 + 12, -car.w / 2 + 8, 18, car.w - 16);
    context.fillRect(car.l / 2 - 26, -car.w / 2 + 8, 16, car.w - 16);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(-6, -car.w / 2 + 6, 14, car.w - 12);
    if (car.police) {
      context.fillStyle = '#ffffff';
      context.fillRect(-car.l / 2 + 2, -car.w / 2, car.l, 10);
      context.fillStyle = '#d93a4a';
      context.fillRect(-10, -car.w / 2 - 4, 8, 6);
      context.fillStyle = '#2f6fd9';
      context.fillRect(2, -car.w / 2 - 4, 8, 6);
      if (Math.floor(performance.now() / 300) % 2 === 0) {
        context.fillStyle = 'rgba(255,60,60,0.5)';
        context.beginPath(); context.arc(0, 0, 60, 0, Math.PI * 2); context.fill();
      }
    }
    if (car.hp < car.maxHp * 0.4) {
      context.fillStyle = 'rgba(40,40,40,0.8)';
      context.beginPath(); context.arc(-car.l / 2 + 10, 0, 8, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, dead, cop) {
    context.save();
    context.translate(x, y);
    if (dead) { context.rotate(Math.PI / 2); context.globalAlpha = 0.6; }
    else context.rotate(angle);
    context.fillStyle = color;
    context.beginPath(); context.arc(0, 0, 11, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath(); context.arc(6, 0, 6, 0, Math.PI * 2); context.fill();
    if (cop) { context.fillStyle = '#0e1a2c'; context.fillRect(-8, -8, 10, 16); }
    context.restore();
    context.globalAlpha = 1;
  }

  function drawWorld(state, cam) {
    drawCity(state, cam);
    const wp = missionWaypoint(state.missions);
    if (wp) {
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 4);
      context.save();
      context.translate(wp.x, wp.y);
      context.fillStyle = 'rgba(242,201,76,0.9)';
      context.beginPath();
      context.moveTo(0, 34 * pulse); context.lineTo(-16, 6); context.lineTo(16, 6); context.closePath();
      context.fill();
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 3;
      context.beginPath(); context.arc(0, 0, 30 * pulse, 0, Math.PI * 2); context.stroke();
      context.restore();
    }
    for (const car of state.cars) drawCar(car);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.dead, ped.cop);
    for (const e of state.enemies) drawPerson(e.x, e.y, e.angle, e.color, e.dead, false);
    const p = state.player;
    if (!p.inCar) {
      const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
      if (!blink) {
        // White ring so the player is easy to spot in the crowd.
        context.save();
        context.translate(p.x, p.y);
        context.strokeStyle = 'rgba(255,255,255,0.9)';
        context.lineWidth = 3;
        context.beginPath(); context.arc(0, 0, 18, 0, Math.PI * 2); context.stroke();
        context.rotate(p.angle);
        context.fillStyle = '#2f6fd9';
        context.beginPath(); context.arc(0, 0, 13, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#e8c39a';
        context.beginPath(); context.arc(7, 0, 7, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#f2c94c';
        context.fillRect(-4, -13, 8, 5);
        context.restore();
        // Aim line when holding the pistol.
        if (p.weapon === 'pistol') {
          context.strokeStyle = 'rgba(255,255,255,0.35)';
          context.beginPath(); context.moveTo(p.x, p.y);
          context.lineTo(p.x + Math.cos(p.angle) * 90, p.y + Math.sin(p.angle) * 90); context.stroke();
        }
      }
    }
    for (const b of state.bullets) {
      context.fillStyle = '#ffe66d';
      context.beginPath(); context.arc(b.x, b.y, 3.5, 0, Math.PI * 2); context.fill();
    }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.globalAlpha = 1;
    // Night tint.
    const dl = daylight(state.timeOfDay);
    if (dl < 0.95) {
      context.fillStyle = `rgba(8,12,40,${(0.95 - dl) * 0.55})`;
      context.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 680;
    const h = 150 + lines.length * 32;
    const x = (VIEW.width - w) / 2, y = (VIEW.height - h) / 2;
    context.fillStyle = 'rgba(20,26,36,0.92)';
    context.fillRect(x, y, w, h);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 116 + i * 32, 19, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + h - 34, 20, PALETTE.gold, 'center');
  }

  function draw(state, screen, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = camera(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    drawWorld(state, cam);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8,12,20,0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('SOLARA BAY', [
        'Kota pesisir. Satu sopir. Enam misi untuk Mama Rosa.',
        'Curi mobil, kabur dari polisi, dan selesaikan semua misi.',
        'WASD gerak / mengemudi   •   E masuk mobil   •   F pukul   •   Klik tembak',
        '1 / 2 ganti senjata   •   Shift lari   •   P jeda   •   H bantuan   •   M suara',
      ], 'Tekan Spasi atau klik — New Game', PALETTE.gold);
      text('New Game: Spasi    •    Continue: C    •    Help: H', VIEW.width / 2, VIEW.height - 92, 18, PALETTE.text, 'center');
      return;
    }
    drawHud(context, state, VIEW);
    drawMinimap(context, state, VIEW);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Jeda', ['Permainan berhenti. Mobil dan polisi menunggu.', 'WASD gerak • E mobil • F pukul • Klik tembak • 1/2 senjata', 'M suara   •   S simpan game'], 'Tekan P untuk lanjut');
    } else if (screen === SCREEN_HELP) {
      drawPanel('Bantuan — Kontrol', [
        'WASD / Panah: jalan & mengemudi (W gas, S rem/mundur)',
        'Shift: lari   •   E: masuk / keluar mobil (curi mobil!)',
        'F / Spasi: pukul   •   Mouse + klik: tembak pistol',
        '1: tangan kosong   •   2: pistol   •   P / Esc: jeda',
        'M: suara   •   S: simpan   •   H: bantuan ini',
        'Bintang naik kalau mencuri, menabrak, atau menembak.',
        'Sembunyi dari polisi sampai bintang hilang.',
      ], 'Tekan H atau P untuk kembali');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED!', ['Polisi menangkapmu. Denda $100.', `Uang sekarang: $${state.player.money}`], 'Tekan Spasi untuk lanjut');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Leo tumbang di jalanan Solara Bay.', `Misi selesai: ${state.missions.completed.length} / 6`], 'Tekan Spasi untuk bangkit lagi');
    } else if (screen === SCREEN_DONE) {
      drawPanel('SOLARA BAY MILIKMU!', ['Semua 6 misi selesai. Leo Marín bebas.', `Uang akhir: $${state.player.money}   •   Mobil dicuri: ${state.carsStolen}`], 'Tekan Spasi untuk main lagi');
    }
    // "Press E" hint when a car is close and the player is on foot.
    if (screen === SCREEN_PLAY && extra && extra.nearCar && !state.player.inCar) {
      drawEnterHint(context, state.player.x - cam.x, state.player.y - cam.y);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera };
}
