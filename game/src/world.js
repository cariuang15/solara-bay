// Solara Bay — the simulation: player on foot and in cars, driving physics,
// collisions, car stealing, wanted/police pressure, day/night, particles,
// and the mission engine. No drawing and no browser here: step() takes a plain
// command object and returns event flags the main loop turns into sound.
import { CAR_TYPES, DAY_LENGTH, PLAYER, STEP, TRAFFIC, WANTED, WEAPONS, WORLD } from './config.js';
import { BEACH_Y, LANDMARKS, WATER_Y, buildingAt, clampToWorld, createCity, isOnRoad, resolveBuildingCollision } from './city.js';
import { makeCar, scarePeds, spawnParkedCar, spawnPed, spawnTrafficCar, stepPed, stepTrafficCar } from './traffic.js';
import { addWanted, decayWanted, policeQuota, spawnFootCop, spawnPoliceCar, stepFootCop, stepPoliceCar } from './police.js';
import { createMissions, currentMission, currentStage, startMission, updateMissions } from './missions.js';
import { damagePlayer, punch, shoot, stepBullets, stepEnemy, makeEnemy } from './combat.js';

export const EVENT_CRASH = 1;
export const EVENT_SHOT = 2;
export const EVENT_PUNCH = 4;
export const EVENT_ENEMY_DOWN = 8;
export const EVENT_PLAYER_HIT = 16;
export const EVENT_CRIME = 32;
export const EVENT_MISSION_COMPLETE = 64;
export const EVENT_MISSION_FAIL = 128;
export const EVENT_BUSTED = 256;
export const EVENT_WASTED = 512;
export const EVENT_PICKUP = 1024;
export const EVENT_CAR_STOLEN = 2048;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    city, random,
    player: {
      x: LANDMARKS.garage.x, y: LANDMARKS.garage.y + 120, angle: -Math.PI / 2,
      health: PLAYER.health, money: 250, wanted: 0, weapon: 'fists', ammo: 0,
      inCar: false, carId: -1, speed: 0, punchTimer: 0, shootTimer: 0, invuln: 0,
    },
    cars: [], peds: [], enemies: [], bullets: [], particles: [],
    missions: createMissions(),
    elapsed: 0, timeOfDay: 9.5, lastCrime: -99, lastCrimeReason: '',
    nextCarId: 1, nextPedId: 1, nextEnemyId: 1,
    busted: false, wasted: false, killsThisStep: 0,
    shake: 0, spawnTimer: 0, policeTimer: 0, enemiesSpawned: false,
    score: 0, carsStolen: 0, missionsDone: 0,
  };

  function addParticle(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2, s = speed * (0.3 + random() * 0.7);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + random() * 0.4, max: 0.8, color, size: 2 + random() * 3 });
    }
    if (state.particles.length > 300) state.particles.splice(0, state.particles.length - 300);
  }

  function reset() {
    const p = state.player;
    p.x = LANDMARKS.garage.x; p.y = LANDMARKS.garage.y + 120; p.angle = -Math.PI / 2;
    p.health = PLAYER.health; p.money = 250; p.wanted = 0; p.weapon = 'fists'; p.ammo = 0;
    p.inCar = false; p.carId = -1; p.speed = 0; p.punchTimer = 0; p.shootTimer = 0; p.invuln = 0;
    state.cars = []; state.peds = []; state.enemies = []; state.bullets = []; state.particles = [];
    state.missions = createMissions();
    state.elapsed = 0; state.timeOfDay = 9.5; state.lastCrime = -99;
    state.nextCarId = 1; state.nextPedId = 1; state.nextEnemyId = 1;
    state.busted = false; state.wasted = false; state.killsThisStep = 0;
    state.shake = 0; state.enemiesSpawned = false; state.score = 0; state.carsStolen = 0; state.missionsDone = 0;
    for (let i = 0; i < TRAFFIC.cars; i += 1) state.cars.push(spawnTrafficCar(random, city, state.nextCarId++));
    for (let i = 0; i < 10; i += 1) { const c = spawnParkedCar(random, city, state.nextCarId++); if (c) state.cars.push(c); }
    for (let i = 0; i < TRAFFIC.peds; i += 1) { const pd = spawnPed(random, city, state.nextPedId++); if (pd) state.peds.push(pd); }
    // One red sport car parked on the road by the garage, for the final mission.
    state.cars.push(makeCar(state.nextCarId++, 'sport', LANDMARKS.garage.x, LANDMARKS.garage.y + 90, 0, { parked: true, driver: false }));
  }

  function nearestCar(x, y, maxD) {
    let best = null, bd = maxD;
    for (const c of state.cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function enterCar() {
    const p = state.player;
    const car = nearestCar(p.x, p.y, 78);
    if (!car) return 0;
    let events = 0;
    if (car.driver && !car.parked) {
      // Drag the driver out onto the sidewalk.
      const dp = spawnPed(random, city, state.nextPedId++);
      if (dp) { dp.x = car.x + 40; dp.y = car.y + 40; dp.panic = 3; state.peds.push(dp); }
      car.driver = false;
      addWanted(state, 1, 'curi mobil');
      events |= EVENT_CRIME | EVENT_CAR_STOLEN;
      state.carsStolen += 1;
    } else if (car.parked) {
      addWanted(state, 1, 'curi mobil');
      events |= EVENT_CRIME | EVENT_CAR_STOLEN;
      state.carsStolen += 1;
    }
    car.parked = false; car.ai = false;
    p.inCar = true; p.carId = car.id; p.angle = car.angle;
    return events;
  }

  function exitCar() {
    const p = state.player;
    const car = state.cars.find((c) => c.id === p.carId);
    if (!car) { p.inCar = false; p.carId = -1; return; }
    car.speed = 0; car.parked = true;
    p.inCar = false; p.carId = -1;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
    clampToWorld(p, PLAYER.radius);
    resolveBuildingCollision(city, p, PLAYER.radius);
  }

  function driveCar(car, cmd, dt) {
    const t = CAR_TYPES[car.type];
    const p = state.player;
    const forward = -cmd.my; // up (my=-1) means forward
    const steer = cmd.mx;
    const accel = forward > 0 ? t.accel : forward < 0 ? -t.accel * 0.7 : 0;
    car.speed += accel * dt;
    if (forward === 0) car.speed *= Math.max(0, 1 - 1.6 * dt);
    if (forward < 0 && car.speed > 0) car.speed -= 700 * dt; // brake
    car.speed = Math.max(-t.reverse, Math.min(t.top, car.speed));
    // Steering works at low speed too (a wedged car must be able to turn out).
    if (Math.abs(car.speed) > 5) {
      car.angle += steer * t.turn * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 60);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    let crashed = false;
    if (buildingAt(city, nx, ny, 24)) {
      // Wall slide: keep the component of motion that is still clear, so a
      // head-on hit stops the car instead of wedging it against the wall.
      crashed = true;
      car.speed *= 0.3;
      if (!buildingAt(city, nx, car.y, 24)) car.x = nx;
      else if (!buildingAt(city, car.x, ny, 24)) car.y = ny;
      else { car.x -= Math.cos(car.angle) * 6; car.y -= Math.sin(car.angle) * 6; } // wedged in a corner: back off the wall
      addParticle(car.x, car.y, '#f2c94c', 10, 160);
      state.shake = Math.min(10, state.shake + 5);
    } else {
      car.x = nx; car.y = ny;
    }
    clampToWorld(car, 26);
    if (car.y > WATER_Y - 60) { car.y = WATER_Y - 60; car.speed = 0; }
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
    return crashed;
  }

  function carCollisions(dt) {
    let events = 0;
    const cars = state.cars;
    for (const c of cars) c.hitTimer = Math.max(0, (c.hitTimer || 0) - dt);
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (b.dead) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 52 && d > 0.01) {
          const push = (52 - d) / 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
          // The player's car is heavier in a shove: police cannot pin it easily.
          const aIsPlayer = a.id === state.player.carId, bIsPlayer = b.id === state.player.carId;
          const aShare = aIsPlayer ? 0.25 : bIsPlayer ? 1.75 : 1;
          const bShare = bIsPlayer ? 0.25 : aIsPlayer ? 1.75 : 1;
          a.x -= ux * push * aShare; a.y -= uy * push * aShare;
          b.x += ux * push * bShare; b.y += uy * push * bShare;
          const playerInvolved = aIsPlayer || bIsPlayer;
          const hard = playerInvolved && (Math.abs(a.speed - b.speed) > 160 || Math.abs(a.speed) > 300 || Math.abs(b.speed) > 300);
          if (hard && a.hitTimer === 0 && b.hitTimer === 0) {
            // One impact, one dent: damage is per collision, not per frame of contact.
            a.hp -= 5; b.hp -= 5;
            a.hitTimer = 0.6; b.hitTimer = 0.6;
            addParticle((a.x + b.x) / 2, (a.y + b.y) / 2, '#f2c94c', 8, 140);
            events |= EVENT_CRASH;
            if (playerInvolved) state.shake = Math.min(12, state.shake + 4);
            if (a.hp <= 0) { a.dead = true; addParticle(a.x, a.y, '#e5534b', 20, 220); }
            if (b.hp <= 0) { b.dead = true; addParticle(b.x, b.y, '#e5534b', 20, 220); }
          }
          // Soft contact only separates the cars; speed is damped only on a
          // hard hit, and never on the player's car (police cannot pin it).
          if (aIsPlayer) b.speed *= 0.6;
          else if (bIsPlayer) a.speed *= 0.6;
          else { a.speed *= 0.85; b.speed *= 0.85; }
        }
      }
    }
    // Player car vs pedestrians: a crime, and the pedestrian goes down.
    const pc = state.cars.find((c) => c.id === state.player.carId);
    if (pc && Math.abs(pc.speed) > 60) {
      for (const ped of state.peds) {
        if (ped.dead || ped.cop) continue;
        if (Math.hypot(ped.x - pc.x, ped.y - pc.y) < 34) {
          ped.dead = true;
          addWanted(state, 1, 'tabrak pejalan kaki');
          addParticle(ped.x, ped.y, '#e5534b', 12, 180);
          scarePeds(state.peds, ped.x, ped.y, 320);
          events |= EVENT_CRIME;
        }
      }
    }
    return events;
  }

  function stepOnFoot(cmd, dt) {
    const p = state.player;
    const speed = cmd.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + cmd.mx * speed * dt;
    const ny = p.y + cmd.my * speed * dt;
    p.x = nx; p.y = ny;
    clampToWorld(p, PLAYER.radius);
    resolveBuildingCollision(city, p, PLAYER.radius);
    if (cmd.mx !== 0 || cmd.my !== 0) p.angle = Math.atan2(cmd.my, cmd.mx);
    p.speed = (cmd.mx !== 0 || cmd.my !== 0) ? speed : 0;
    if (Math.abs(p.speed) > 0 && random() < dt * 4) {
      state.particles.push({ x: p.x, y: p.y + 10, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffffff', size: 1.5 });
    }
  }

  function ensurePopulation(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;
    state.spawnTimer = 2;
    const aliveCars = state.cars.filter((c) => !c.dead && c.ai).length;
    if (aliveCars < TRAFFIC.cars) state.cars.push(spawnTrafficCar(random, city, state.nextCarId++));
    const alivePeds = state.peds.filter((p) => !p.dead && !p.cop).length;
    if (alivePeds < TRAFFIC.peds) { const pd = spawnPed(random, city, state.nextPedId++); if (pd) state.peds.push(pd); }
    state.cars = state.cars.filter((c) => !c.dead || c.id === state.player.carId);
    state.peds = state.peds.filter((p) => !p.dead);
  }

  function ensurePolice(dt) {
    const quota = policeQuota(Math.round(state.player.wanted));
    const cars = state.cars.filter((c) => c.police && !c.dead).length;
    const cops = state.peds.filter((p) => p.cop && !p.dead).length;
    state.policeTimer -= dt;
    if (state.policeTimer > 0) return;
    state.policeTimer = 1.5;
    if (cars + cops < quota) {
      if (state.player.wanted >= 2 && cars < Math.ceil(quota / 2)) spawnPoliceCar(state, random);
      else spawnFootCop(state, random);
    }
  }

  function spawnMissionEnemies() {
    if (state.enemiesSpawned) return;
    state.enemiesSpawned = true;
    for (let i = 0; i < 5; i += 1) {
      // Spawn on open ground, never inside a building.
      let ex = LANDMARKS.block.x, ey = LANDMARKS.block.y;
      for (let tries = 0; tries < 20; tries += 1) {
        ex = LANDMARKS.block.x + (random() - 0.5) * 320;
        ey = LANDMARKS.block.y + (random() - 0.5) * 220;
        if (!buildingAt(city, ex, ey, 20)) break;
      }
      const e = makeEnemy(state.nextEnemyId++, ex, ey);
      state.enemies.push(e);
    }
  }

  /**
   * One fixed step. cmd: { mx, my, run, enter, punch, shoot, aimX, aimY,
   * weapon, click }. Returns event flags.
   */
  function step(dt, cmd) {
    let events = 0;
    state.elapsed += dt;
    state.timeOfDay = (state.timeOfDay + (dt / DAY_LENGTH) * 24) % 24;
    state.killsThisStep = 0;
    const p = state.player;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.shootTimer > 0) p.shootTimer -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    // Slow health regen after 6 s without damage: missions stay winnable.
    if (p.health > 0 && p.health < PLAYER.health && state.elapsed - (state.lastHurt || 0) > 6) {
      p.health = Math.min(PLAYER.health, p.health + 6 * dt);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

    if (!state.busted && !state.wasted) {
      if (cmd.enter) { if (p.inCar) exitCar(); else events |= enterCar(); }
      if (cmd.weapon === 'fists') p.weapon = 'fists';
      if (cmd.weapon === 'pistol') { p.weapon = 'pistol'; if (p.ammo === 0) p.ammo = 60; }
      if (p.inCar) {
        const car = state.cars.find((c) => c.id === p.carId);
        if (!car || car.dead) { p.inCar = false; p.carId = -1; }
        else if (driveCar(car, cmd, dt)) {
          events |= EVENT_CRASH;
          // Crash damage is rate-limited: scraping a wall does not total a car.
          if (state.elapsed - (car.lastCrash || 0) > 0.8) {
            car.lastCrash = state.elapsed;
            car.hp -= 5;
            if (car.hp <= 0) { car.dead = true; addParticle(car.x, car.y, '#e5534b', 24, 240); }
          }
        }
        if (Math.abs(p.speed) > 320 && random() < dt * 8) {
          addParticle(car ? car.x - Math.cos(car.angle) * 40 : p.x, car ? car.y - Math.sin(car.angle) * 40 : p.y, '#cccccc', 1, 40);
        }
      } else {
        stepOnFoot(cmd, dt);
        if (cmd.punch) events |= punch(state, dt);
        if (cmd.shoot && p.weapon === 'pistol') events |= shoot(state, cmd.aimX, cmd.aimY);
        if (cmd.shoot && p.weapon === 'pistol' && p.ammo <= 0) { /* dry click */ }
      }
    }

    // Traffic + pedestrians.
    for (const car of state.cars) {
      if (car.police && !car.dead && state.player.wanted > 0) {
        // A police car that lost the player far away gives up the chase.
        const pdist = Math.hypot(car.x - p.x, car.y - p.y);
        if (pdist > 1200) { car.dead = true; continue; }
        car.chaseTime = (car.chaseTime || 0) + dt;
        // After 25 s without getting close, this unit gives up and leaves.
        if (car.chaseTime > 25 && pdist > 250) { car.dead = true; continue; }
        if (pdist < 250) car.chaseTime = 0;
        car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
        if (stepPoliceCar(car, p, dt, city) && car.ramTimer === 0) {
          car.ramTimer = 0.6;
          events |= EVENT_CRASH; state.shake = Math.min(12, state.shake + 3);
        }
      } else if (car.ai || (car.police && state.player.wanted <= 0)) {
        // A stood-down police car rejoins normal traffic.
        if (car.police && state.player.wanted <= 0) { car.ai = true; car.dir = 0; }
        stepTrafficCar(car, dt, state.cars, city, random);
      }
    }
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.cop) {
        // No wanted level, no chase: the cop stands down and leaves.
        if (state.player.wanted <= 0) { ped.dead = true; continue; }
        const pd = Math.hypot(ped.x - p.x, ped.y - p.y);
        // Arrest on touch (before any punch): getting caught is Busted, not death.
        if (pd < 40 && state.player.wanted > 0 && !p.inCar) {
          state.busted = true; events |= EVENT_BUSTED;
          continue;
        }
        // A foot cop cannot hurt the player through a car window.
        if (p.inCar) continue;
        const dmg = stepFootCop(ped, p, dt);
        if (dmg > 0) { damagePlayer(state, dmg); events |= EVENT_PLAYER_HIT; }
        // A cop who lost the player far away gives up and leaves.
        if (pd > 850 && state.player.wanted <= 1) ped.dead = true;
      } else stepPed(ped, dt, p.x, p.y, random);
    }
    events |= stepBullets(state, dt);
    for (const e of state.enemies) events |= stepEnemy(e, state, dt);
    state.enemies = state.enemies.filter((e) => !e.dead || state.elapsed < 99999);
    events |= carCollisions(dt);
    ensurePopulation(dt);
    decayWanted(state, dt);
    ensurePolice(dt);

    // Mission enemies appear when mission 4 reaches its kill stage.
    const m = state.missions;
    if (m.active && m.index === 3 && currentStage(m) && currentStage(m).kind === 'kill') spawnMissionEnemies();

    // Missions.
    const ctx = {
      inCar: p.inCar, carType: p.inCar ? (state.cars.find((c) => c.id === p.carId) || {}).type : null,
      wanted: state.player.wanted, killsThisStep: state.killsThisStep, playerX: p.x, playerY: p.y,
    };
    if (!m.active && !m.allDone && !m.started) startMission(m);
    else if (!m.active && !m.allDone && !m.failed && m.messageTimer <= 0) startMission(m); // next mission after the reward message
    else if (!m.active && !m.allDone && m.failed) { /* waiting: main loop restarts on player choice */ }
    const mr = updateMissions(m, state, ctx, dt);
    if (mr === 'complete') {
      events |= EVENT_MISSION_COMPLETE;
      state.missionsDone += 1;
      state.score += 1000;
      if (m.index === 2) addWanted(state, 3, 'bank'); // stage 2 of mission 3 sets wanted on pickup
    } else if (mr === 'failed') events |= EVENT_MISSION_FAIL;
    // Mission 3, stage 2: reaching the bank gives 3 stars immediately.
    if (m.active && m.index === 2 && m.stage === 1 && state.player.wanted < 3) addWanted(state, 3, 'bank');

    // Busted / wasted.
    if (state.wasted) events |= EVENT_WASTED;
    if (state.busted) events |= EVENT_BUSTED;

    // Particles.
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    return events;
  }

  function restartMission() {
    const m = state.missions;
    m.active = false; m.stage = 0; m.kills = 0; m.timer = 0; m.failed = false;
    m.enemiesSpawned = false; state.enemiesSpawned = false; state.enemies = [];
    startMission(m);
  }

  function respawn() {
    const p = state.player;
    p.health = PLAYER.health; p.wanted = 0; p.inCar = false; p.carId = -1;
    p.x = LANDMARKS.garage.x; p.y = LANDMARKS.garage.y + 120;
    state.busted = false; state.wasted = false;
    state.cars = state.cars.filter((c) => !c.police);
    state.peds = state.peds.filter((pd) => !pd.cop);
    p.money = Math.max(0, p.money - 100);
  }

  reset();
  return { state, reset, step, restartMission, respawn, addParticle };
}
