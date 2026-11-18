// Solara Bay — the screenshot scenes behind ?shot=start|play|chase|mission.
// Each one plays the real rules forward from a fresh world with a scripted
// autopilot that drives along the road grid (never through buildings), so the
// frame is what real play looks like and the same seed always gives the same
// frame. Sets window.__shotReady when painted.
import { STEP } from './config.js';
import { LANDMARKS, V_ROADS, H_ROADS } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_BUSTED, EVENT_WASTED } from './world.js';

function cmdToward(state, tx, ty, run) {
  const p = state.player;
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
  return { mx: dx / d, my: dy / d, run: !!run, enter: false, punch: false, shoot: false, aimX: tx, aimY: ty, weapon: null, click: false };
}

// Road-graph routing (BFS over intersections) so the autopilot stays on roads.
function makeRouter(state) {
  let route = [], routeTarget = null;
  function routeTo(tx, ty) {
    const key = `${Math.round(tx / 50)},${Math.round(ty / 50)}`;
    if (routeTarget === key && route.length) return route[0];
    routeTarget = key;
    const p = state.player;
    const ni = (x, y) => {
      let bi = 0, bd = 1e9; V_ROADS.forEach((rx, i) => { const d = Math.abs(x - rx); if (d < bd) { bd = d; bi = i; } });
      let bj = 0; bd = 1e9; H_ROADS.forEach((ry, j) => { const d = Math.abs(y - ry); if (d < bd) { bd = d; bj = j; } });
      return [bi, bj];
    };
    const [si, sj] = ni(p.x, p.y), [ti, tj] = ni(tx, ty);
    const prev = new Map(), q = [[si, sj]], seen = new Set([`${si},${sj}`]);
    while (q.length) {
      const [i, j] = q.shift();
      if (i === ti && j === tj) break;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || a >= V_ROADS.length || b < 0 || b >= H_ROADS.length) continue;
        const k = `${a},${b}`;
        if (seen.has(k)) continue;
        seen.add(k); prev.set(k, `${i},${j}`); q.push([a, b]);
      }
    }
    const pts = [];
    let cur = `${ti},${tj}`;
    const chain = [cur];
    while (cur !== `${si},${sj}` && prev.has(cur)) { cur = prev.get(cur); chain.unshift(cur); }
    for (const k of chain) { const [i, j] = k.split(',').map(Number); pts.push({ x: V_ROADS[i], y: H_ROADS[j] }); }
    pts.push({ x: tx, y: ty });
    route = pts;
    return route[0];
  }
  return {
    driveTo(tx, ty) {
      const wp = routeTo(tx, ty);
      const p = state.player;
      if (Math.hypot(wp.x - p.x, wp.y - p.y) < 70) route.shift();
      const cur = route[0] || { x: tx, y: ty };
      const d = Math.hypot(cur.x - p.x, cur.y - p.y);
      const want = Math.atan2(cur.y - p.y, cur.x - p.x);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const throttle = d < 60 ? 0.8 : d < 150 ? 0.3 : -Math.max(0.3, 1 - Math.abs(diff) * 0.7);
      return { mx: Math.max(-1, Math.min(1, diff * 2.5)), my: throttle, run: false, enter: false, punch: false, shoot: false, aimX: cur.x, aimY: cur.y, weapon: null, click: false };
    },
  };
}

const IDLE = { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, aimX: 0, aimY: 0, weapon: null, click: false };

export function stageShot(name, world) {
  const s = world.state;
  world.reset();
  if (name === 'start') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, IDLE);
    return { screen: SCREEN_TITLE };
  }
  const router = makeRouter(s);
  if (name === 'play') {
    // Already in a stolen sedan, cruising east through busy streets.
    const car = s.cars.find((c) => c.type === 'sedan' && c.parked) || s.cars[0];
    car.x = 1100; car.y = 1000; car.angle = 0; car.parked = false; car.ai = false;
    s.player.x = 1100; s.player.y = 1000; s.player.angle = 0;
    s.player.inCar = true; s.player.carId = car.id;
    s.player.wanted = 1; // stole the car: one star, mission 1 in progress
    for (let i = 0; i < 5 / STEP; i += 1) {
      const cmd = router.driveTo(3100, 1000);
      world.step(STEP, cmd);
      if (s.busted || s.wasted) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Wanted 4, police in pursuit: a straight high-speed run east on the main
    // road, police cars closing in behind the player's sport car.
    const car = s.cars.find((c) => c.type === 'sport' && c.parked) || s.cars[0];
    car.x = 700; car.y = 650; car.angle = 0; car.parked = false; car.ai = false;
    s.player.x = 700; s.player.y = 650; s.player.angle = 0;
    s.player.inCar = true; s.player.carId = car.id; s.player.wanted = 4;
    for (let i = 0; i < 10 / STEP; i += 1) {
      if (i % 60 === 0) s.player.wanted = 4;
      const cmd = router.driveTo(3100, 650);
      world.step(STEP, cmd);
      if (s.busted || s.wasted) break;
    }
    s.player.wanted = 4;
    return { screen: SCREEN_PLAY };
  }
  // mission: mission 3 escape — wanted 3, racing from the bank to the safehouse.
  s.missions.index = 2; s.missions.started = true;
  s.player.x = LANDMARKS.bank.x; s.player.y = LANDMARKS.bank.y;
  const car = s.cars.find((c) => c.type === 'sedan' && c.parked) || s.cars[0];
  car.x = s.player.x; car.y = s.player.y + 60; // on the road by the bank
  let arrivedAt = -1;
  for (let i = 0; i < 26 / STEP; i += 1) {
    let cmd;
    if (!s.player.inCar) {
      cmd = cmdToward(s, car.x, car.y, true);
      if (Math.hypot(car.x - s.player.x, car.y - s.player.y) < 60) cmd.enter = true;
    } else cmd = router.driveTo(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
    const ev = world.step(STEP, cmd);
    if (s.missions.index === 2 && s.missions.stage === 1) s.player.wanted = 3;
    // Stop shortly after reaching the safehouse: police closing in, 3 stars.
    if (s.missions.index > 2 && arrivedAt < 0) arrivedAt = i * STEP;
    if (arrivedAt >= 0 && i * STEP - arrivedAt > 2.5) break;
    if (s.busted || s.wasted) break;
    if (ev & (EVENT_BUSTED | EVENT_WASTED)) break;
  }
  return { screen: SCREEN_PLAY };
}
