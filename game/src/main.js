// Solara Bay — boot and the one loop: input every frame, the world advances in
// fixed 1/60 s steps, the renderer paints it. Screens: title, play, paused,
// help, busted, wasted and the all-missions-done screen.
//
// ?shot=start|play|chase|mission (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_CRIME, EVENT_ENEMY_DOWN, EVENT_MISSION_COMPLETE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_WEAPON1, ACTION_WEAPON2, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { applySave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {});
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let lastScreen = SCREEN_PLAY;
  let accumulator = 0;
  let last = performance.now();
  let weaponKey = null;
  let saveMsg = '';

  function announce(message) { status.textContent = message; }

  function startNew() {
    world.reset();
    screen = SCREEN_PLAY;
    audio.unlock(); audio.startMusic();
    announce('Main. Ikuti misi Mama Rosa — curi mobil dan bawa ke garasi.');
  }
  function continueGame() {
    const data = loadSave();
    world.reset();
    if (data) applySave(world.state, data);
    screen = SCREEN_PLAY;
    audio.unlock(); audio.startMusic();
    announce('Lanjutkan permainan.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_CRIME) audio.crime();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION_COMPLETE) { audio.missionDone(); saveGame(world.state); }
    if (events & EVENT_MISSION_FAIL) audio.missionFail();
    if (events & EVENT_BUSTED) { audio.busted(); screen = SCREEN_BUSTED; }
    if (events & EVENT_WASTED) { audio.busted(); screen = SCREEN_WASTED; }
    if (world.state.missions.allDone) screen = SCREEN_DONE;
  }

  function mouseToWorld() {
    const m = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    const ox = (rect.width - VIEW.width * scale) / 2;
    const oy = (rect.height - VIEW.height * scale) / 2;
    const cam = renderer.camera(world.state);
    return { x: cam.x + (m.x - ox) / scale, y: cam.y + (m.y - oy) / scale };
  }

  function buildCmd() {
    const move = input.move();
    const aim = mouseToWorld();
    const p = world.state.player;
    if (p.inCar) p.angle = world.state.cars.find((c) => c.id === p.carId)?.angle ?? p.angle;
    else if (p.weapon === 'pistol') p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    return {
      mx: move.x, my: move.y, run: input.running(),
      enter: false, punch: false, shoot: false,
      aimX: aim.x, aimY: aim.y, weapon: weaponKey, click: false,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (actions & ACTION_MUTE) { const muted = audio.toggleMute(); saveMsg = muted ? 'Suara mati (M)' : 'Suara hidup (M)'; }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || clicked) startNew();
      else if (actions & ACTION_HELP) { lastScreen = SCREEN_TITLE; screen = SCREEN_HELP; }
      return;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_HELP | ACTION_PAUSE | ACTION_CONFIRM)) screen = lastScreen;
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM || clicked) { world.respawn(); saveGame(world.state); screen = SCREEN_PLAY; }
      return;
    }
    if (screen === SCREEN_DONE) {
      if (actions & ACTION_CONFIRM || clicked) startNew();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
      else if (actions & ACTION_HELP) { lastScreen = SCREEN_PAUSED; screen = SCREEN_HELP; }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Jeda.'); return; }
    if (actions & ACTION_HELP) { lastScreen = SCREEN_PLAY; screen = SCREEN_HELP; return; }
    if (actions & ACTION_WEAPON1) weaponKey = 'fists';
    if (actions & ACTION_WEAPON2) weaponKey = 'pistol';
    pending.enter = !!(actions & ACTION_ENTER_CAR);
    pending.punch = !!(actions & ACTION_PUNCH) || !!(actions & ACTION_CONFIRM);
    pending.shoot = input.mouse().down || clicked;
    if (pending.punch && world.state.player.weapon === 'pistol') pending.shoot = true;
  }

  const pending = { enter: false, punch: false, shoot: false };
  let titleKeyHandler = null;

  // Title-screen keys that are not part of the play loop (C = continue).
  titleKeyHandler = (event) => {
    if (screen !== SCREEN_TITLE) return;
    if (event.code === 'KeyC' && hasSave()) continueGame();
    if (event.code === 'KeyH') { lastScreen = SCREEN_TITLE; screen = SCREEN_HELP; }
  };
  window.addEventListener('keydown', titleKeyHandler);
  // Pause-screen save key.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_PAUSED && event.code === 'KeyS') { saveGame(world.state); saveMsg = 'Game disimpan!'; }
    if (screen === SCREEN_PLAY && event.code === 'KeyS') { saveGame(world.state); saveMsg = 'Game disimpan!'; }
    if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED) && event.code === 'KeyR') { world.respawn(); screen = SCREEN_PLAY; }
    if (screen === SCREEN_PLAY && event.code === 'KeyR' && world.state.missions.failed) world.restartMission();
  });

  function step() {
    const cmd = buildCmd();
    cmd.enter = pending.enter; cmd.punch = pending.punch; cmd.shoot = pending.shoot;
    pending.enter = false; pending.punch = false; pending.shoot = false;
    const events = world.step(STEP, cmd);
    handleEvents(events);
    const p = world.state.player;
    audio.setEngine(p.inCar ? Math.min(1, Math.abs(p.speed) / 500) : 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) { step(); accumulator -= STEP; }
    } else if (screen === SCREEN_TITLE) {
      // Ambient city life behind the title.
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, aimX: 0, aimY: 0, weapon: null, click: false });
        accumulator -= STEP;
        if (accumulator < STEP) break;
      }
      if (world.state.missions.active) world.state.missions.active = false;
    } else accumulator = 0;
    const nearCar = !world.state.player.inCar && world.state.cars.some((c) => !c.dead && Math.hypot(c.x - world.state.player.x, c.y - world.state.player.y) < 78);
    renderer.draw(world.state, screen, { nearCar });
    if (saveMsg) { saveMsg = ''; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  // Debug handle for playtesting (read-only state inspection from the console).
  window.__solara = world;

  announce('Solara Bay. Tekan Spasi untuk New Game, C untuk Continue, H untuk bantuan.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
