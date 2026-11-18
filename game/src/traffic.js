// Solara Bay — traffic and pedestrians. AI cars drive the road grid in lanes,
// slow for the car ahead and turn at intersections; pedestrians walk the
// sidewalks and run away from danger (crashes, gunfire, speeding cars).
import { CAR_TYPES, CAR_TYPE_KEYS, TRAFFIC } from './config.js';
import { ROAD_W, V_ROADS, H_ROADS, buildingAt, isOnRoad, nearestRoadPoint } from './city.js';

const AI_TYPES = ['sedan', 'sedan', 'taxi', 'truck', 'van', 'sport'];

export function makeCar(id, type, x, y, angle, opts = {}) {
  const t = CAR_TYPES[type];
  return {
    id, type, x, y, angle, speed: 0, color: opts.color || t.color,
    w: t.w, l: t.l, hp: t.hp, maxHp: t.hp,
    parked: !!opts.parked, ai: !!opts.ai, driver: opts.driver !== false,
    dir: opts.dir || 0, // 0 = along +x, 1 = +y, 2 = -x, 3 = -y (AI heading)
    cruise: 150 + Math.random() * 90, stuck: 0, brake: 0,
    police: type === 'police', siren: 0, dead: false,
  };
}

export function spawnTrafficCar(random, city, id) {
  const vertical = random() < 0.5;
  const road = vertical ? V_ROADS[Math.floor(random() * V_ROADS.length)] : H_ROADS[Math.floor(random() * H_ROADS.length)];
  const along = 120 + random() * 2200;
  const lane = (random() < 0.5 ? -1 : 1) * ROAD_W / 4;
  const type = AI_TYPES[Math.floor(random() * AI_TYPES.length)];
  const x = vertical ? road + lane : along;
  const y = vertical ? along : road + lane;
  const dir = vertical ? (lane < 0 ? 1 : 3) : (lane < 0 ? 0 : 2);
  const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
  const car = makeCar(id, type, x, y, angle, { ai: true, dir });
  car.speed = car.cruise * (0.7 + random() * 0.3);
  return car;
}

export function spawnParkedCar(random, city, id) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? V_ROADS[Math.floor(random() * V_ROADS.length)] : H_ROADS[Math.floor(random() * H_ROADS.length)];
    const along = 200 + random() * 2000;
    const side = (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 8);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    if (buildingAt(city, x, y, 30)) continue;
    const type = AI_TYPES[Math.floor(random() * AI_TYPES.length)];
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    return makeCar(id, type, x, y, angle, { parked: true, driver: random() < 0.4 });
  }
  return null;
}

export function spawnPed(random, city, id) {
  for (let tries = 0; tries < 30; tries += 1) {
    const x = 150 + random() * 3300, y = 150 + random() * 2050;
    if (isOnRoad(x, y) || buildingAt(city, x, y, 20)) continue;
    return {
      id, x, y, angle: random() * Math.PI * 2, speed: TRAFFIC.pedSpeed * (0.7 + random() * 0.6),
      color: ['#e8b04b', '#7fb069', '#c96f7a', '#6a8caf', '#d9d9d9', '#9b7ec9'][Math.floor(random() * 6)],
      state: 'walk', panic: 0, tx: x, ty: y, wait: random() * 4, dead: false, hp: 50,
    };
  }
  return null;
}

function aheadClear(cars, car, dist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const o of cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy, side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < dist && side < 40) return false;
  }
  return true;
}

/** Steer one AI car along the grid for dt seconds. */
export function stepTrafficCar(car, dt, cars, city, random) {
  if (car.parked || car.dead) return;
  const t = CAR_TYPES[car.type];
  // At an intersection, sometimes turn left or right.
  const nearV = V_ROADS.some((rx) => Math.abs(car.x - rx) < 14);
  const nearH = H_ROADS.some((ry) => Math.abs(car.y - ry) < 14);
  if (nearV && nearH && random() < 0.012) {
    car.dir = (car.dir + (random() < 0.5 ? 1 : 3)) % 4;
  }
  const targetAngle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][car.dir];
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-t.turn * dt, Math.min(t.turn * dt, diff));
  // Lane keeping: drift back toward the lane centre of the current road.
  const rp = nearestRoadPoint(car.x, car.y);
  const laneOff = car.dir % 2 === 0 ? (car.y - rp.y) : (car.x - rp.x);
  const want = car.dir === 0 || car.dir === 1 ? ROAD_W / 4 : -ROAD_W / 4;
  const steer = Math.max(-1, Math.min(1, (want - laneOff) / 30));
  car.angle += steer * 0.6 * dt * Math.sign(Math.cos(diff) || 1);
  const clear = aheadClear(cars, car, 110);
  const target = clear ? car.cruise : 0;
  car.speed += Math.max(-500 * dt, Math.min(260 * dt, target - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the city edge instead of driving into the sea.
  if (car.x < 60) { car.x = 60; car.dir = 0; }
  if (car.x > 3540) { car.x = 3540; car.dir = 2; }
  if (car.y < 60) { car.y = 60; car.dir = 1; }
  if (car.y > 2260) { car.y = 2260; car.dir = 3; }
  if (buildingAt(city, car.x, car.y, 22)) { car.speed *= -0.3; car.dir = (car.dir + 2) % 4; }
}

/** Steer one pedestrian for dt; flees from (fx, fy) while panicked. */
export function stepPed(ped, dt, fx, fy, random) {
  if (ped.dead) return;
  if (ped.panic > 0) {
    ped.panic -= dt;
    ped.state = 'flee';
    const dx = ped.x - fx, dy = ped.y - fy, d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy / d, dx / d);
    ped.x += Math.cos(ped.angle) * TRAFFIC.fleeSpeed * dt;
    ped.y += Math.sin(ped.angle) * TRAFFIC.fleeSpeed * dt;
    return;
  }
  ped.state = 'walk';
  ped.wait -= dt;
  if (ped.wait <= 0) {
    // Pedestrians stay on the sidewalks: pick a target that is not on a road.
    for (let tries = 0; tries < 6; tries += 1) {
      ped.tx = Math.max(120, Math.min(3480, ped.x + (random() - 0.5) * 500));
      ped.ty = Math.max(120, Math.min(2240, ped.y + (random() - 0.5) * 500));
      if (!isOnRoad(ped.tx, ped.ty)) break;
    }
    ped.wait = 3 + random() * 5;
  }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y, d = Math.hypot(dx, dy);
  if (d > 8) {
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
}

/** All pedestrians within radius of (x, y) panic and run. */
export function scarePeds(peds, x, y, radius) {
  for (const p of peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) p.panic = 2 + Math.random() * 2;
  }
}
