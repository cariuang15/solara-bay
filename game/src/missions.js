// Solara Bay — the story: six missions for fixer Mama Rosa, run in order.
// Each mission is a list of stages (go to a place, pick something up, deliver it,
// defeat a set of rivals, escape with a wanted level, beat a timer). The world
// step calls updateMissions every frame; it returns events the main loop turns
// into sounds, money and mission-complete screens.
import { LANDMARKS } from './city.js';
import { MISSION_REWARDS } from './config.js';

export const MISSION_NAMES = [
  '1. Mobil untuk Rosa',
  '2. Paket Senyap',
  '3. Kabur dari Bank',
  '4. Bersihkan Blok Geng',
  '5. Antar Tepat Waktu',
  '6. Yacht Terakhir',
];

const L = LANDMARKS;

export function missionDefs() {
  return [
    {
      name: MISSION_NAMES[0], intro: 'Mama Rosa: "Leo, aku butuh mobil. Curi satu dan bawa ke garasiku."',
      stages: [
        { kind: 'stealCar', text: 'Curi mobil apa saja (dekati lalu tekan E)', done: false },
        { kind: 'goto', x: L.garage.x, y: L.garage.y, r: 90, text: 'Bawa mobilnya ke Garasi Rosa', inCar: true, done: false },
      ],
    },
    {
      name: MISSION_NAMES[1], intro: 'Rosa: "Ambil paket di Pasar Ikan. Antar ke Plaza — pelan-pelan, jangan sampai polisi melihatmu."',
      stages: [
        { kind: 'goto', x: L.market.x, y: L.market.y, r: 80, text: 'Ambil paket di Pasar Ikan', done: false },
        { kind: 'deliver', x: L.plaza.x, y: L.plaza.y, r: 80, text: 'Antar paket ke Plaza Solara (hati-hati polisi)', done: false },
      ],
    },
    {
      name: MISSION_NAMES[2], intro: 'Rosa: "Bank Solara baru saja... dikunjungi teman kita. Ambil tasnya dan kabur ke safehouse!"',
      stages: [
        { kind: 'goto', x: L.bank.x, y: L.bank.y, r: 80, text: 'Ambil tas uang di Bank Solara', done: false },
        { kind: 'escape', x: L.safehouse.x, y: L.safehouse.y, r: 90, text: 'Kabur ke Safehouse dengan polisi mengejarmu!', wanted: 3, done: false },
      ],
    },
    {
      name: MISSION_NAMES[3], intro: 'Rosa: "Geng Bayangan menguasai satu blok. Bersihkan mereka — semua."',
      stages: [
        { kind: 'goto', x: L.block.x, y: L.block.y, r: 120, text: 'Datangi Blok Geng di timur kota', done: false },
        { kind: 'kill', count: 5, x: L.block.x, y: L.block.y, r: 260, text: 'Kalahkan 5 anggota geng rival (0/5)', done: false },
      ],
    },
    {
      name: MISSION_NAMES[4], intro: 'Rosa: "Barang dari Depot harus sampai ke Dermaga sebelum 90 detik. Gas, Leo!"',
      stages: [
        { kind: 'goto', x: L.depot.x, y: L.depot.y, r: 80, text: 'Ambil barang di Depot Pelabuhan', done: false },
        { kind: 'timed', x: L.pier.x, y: L.pier.y, r: 90, time: 90, text: 'Antar ke Dermaga sebelum waktu habis!', done: false },
      ],
    },
    {
      name: MISSION_NAMES[5], intro: 'Rosa: "Terakhir, Leo. Curi mobil sport merah, hilangkan polisi, dan bawa ke yacht. Setelah ini kita bebas."',
      stages: [
        { kind: 'stealSport', text: 'Curi mobil sport (yang merah)', done: false },
        { kind: 'loseCops', text: 'Hilangkan polisi sampai wanted hilang', done: false },
        { kind: 'goto', x: L.yacht.x, y: L.yacht.y, r: 110, text: 'Bawa mobil sport ke Yacht Marina', inCar: true, done: false },
      ],
    },
  ];
}

/** Fresh mission runtime state (progress is kept here, defs stay read-only). */
export function createMissions() {
  return {
    defs: missionDefs(), index: 0, stage: 0, active: false,
    kills: 0, timer: 0, message: '', messageTimer: 0,
    completed: [], failed: false, allDone: false, started: false,
  };
}

export function currentMission(m) {
  if (m.index >= m.defs.length) return null;
  return m.defs[m.index];
}
export function currentStage(m) {
  const def = currentMission(m);
  return def ? def.stages[m.stage] : null;
}
export function objectiveText(m) {
  if (m.allDone) return 'Semua misi selesai! Solara Bay milikmu, Leo.';
  const st = currentStage(m);
  if (!st) return '';
  if (st.kind === 'kill') return `Kalahkan anggota geng rival (${m.kills}/${st.count})`;
  if (st.kind === 'timed') return `${st.text} — ${Math.max(0, Math.ceil(m.timer))} dtk`;
  return st.text;
}

export function startMission(m) {
  const def = currentMission(m);
  if (!def) return;
  m.active = true; m.stage = 0; m.kills = 0; m.timer = 0; m.failed = false; m.started = true;
  m.message = def.intro; m.messageTimer = 6;
}

function advanceStage(m, state) {
  m.stage += 1;
  const def = currentMission(m);
  if (m.stage >= def.stages.length) {
    const reward = MISSION_REWARDS[m.index] || 500;
    state.player.money += reward;
    m.completed.push(m.index);
    m.message = `Misi selesai! +$${reward} dari Mama Rosa.`;
    m.messageTimer = 5;
    m.index += 1; m.stage = 0; m.active = false; m.kills = 0;
    if (m.index >= m.defs.length) { m.allDone = true; m.message = 'SEMUA MISI SELESAI! Leo Marín bebas — Solara Bay milikmu!'; m.messageTimer = 8; }
    return 'complete';
  }
  return 'stage';
}

/**
 * Advance the active mission. `ctx` carries live facts the stages need:
 * { inCar, carType, wanted, killsThisStep, playerX, playerY }.
 * Returns 'complete' | 'stage' | 'failed' | null.
 */
export function updateMissions(m, state, ctx, dt) {
  if (m.messageTimer > 0) m.messageTimer -= dt;
  if (!m.active || m.allDone) return null;
  const st = currentStage(m);
  if (!st) return null;
  const px = ctx.playerX, py = ctx.playerY;
  const dist = (x, y) => Math.hypot(px - x, py - y);
  if (st.kind === 'stealCar') {
    if (ctx.inCar) return advanceStage(m, state);
  } else if (st.kind === 'stealSport') {
    if (ctx.inCar && ctx.carType === 'sport') return advanceStage(m, state);
  } else if (st.kind === 'loseCops') {
    if (state.player.wanted <= 0) return advanceStage(m, state);
  } else if (st.kind === 'goto' || st.kind === 'deliver' || st.kind === 'escape') {
    if (st.failOnWanted && state.player.wanted >= 2) { m.failed = true; m.active = false; m.message = 'Misi gagal — polisi melihatmu! Coba lagi.'; m.messageTimer = 5; return 'failed'; }
    if (dist(st.x, st.y) < st.r && (!st.inCar || ctx.inCar)) return advanceStage(m, state);
  } else if (st.kind === 'kill') {
    m.kills += ctx.killsThisStep || 0;
    if (m.kills >= st.count) return advanceStage(m, state);
  } else if (st.kind === 'timed') {
    if (m.timer <= 0) m.timer = st.time;
    m.timer -= dt;
    if (dist(st.x, st.y) < st.r) return advanceStage(m, state);
    if (m.timer <= 0) { m.failed = true; m.active = false; m.message = 'Misi gagal — waktu habis! Coba lagi.'; m.messageTimer = 5; return 'failed'; }
  }
  return null;
}

/** Waypoint for the HUD/minimap: the current stage target, or null. */
export function missionWaypoint(m) {
  const st = currentStage(m);
  if (!m.active || !st) return null;
  if (st.x !== undefined) return { x: st.x, y: st.y };
  return null;
}
