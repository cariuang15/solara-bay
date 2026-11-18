// Solara Bay — the city itself: road grid, building blocks, parks, beach and sea,
// landmarks, and the collision / road queries every other system uses.
// All layout is seeded, so the same seed always builds the same city.
import { WORLD } from './config.js';

export const ROAD_W = 96;
export const V_ROADS = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const H_ROADS = [300, 650, 1000, 1350, 1700, 2050];
export const BEACH_Y = 2320; // sand starts here
export const WATER_Y = 2460; // sea starts here

// Landmarks the story and the missions point at. Every one sits ON a road (or on
// the beach for the pier/yacht), so a car — and a player on foot — can reach it.
export const LANDMARKS = {
  garage:    { name: 'Garasi Rosa',   x: 700,  y: 480,  label: 'Garasi' },
  safehouse: { name: 'Safehouse',     x: 1900, y: 480,  label: 'Safehouse' },
  bank:      { name: 'Bank Solara',   x: 1100, y: 480,  label: 'Bank' },
  pier:      { name: 'Dermaga',       x: 1500, y: 2400, label: 'Dermaga' },
  yacht:     { name: 'Yacht Marina',  x: 1750, y: 2400, label: 'Yacht' },
  market:    { name: 'Pasar Ikan',    x: 900,  y: 1000, label: 'Pasar' },
  plaza:     { name: 'Plaza Solara',  x: 2100, y: 1000, label: 'Plaza' },
  block:     { name: 'Blok Geng',     x: 2500, y: 1700, label: 'Blok Geng' },
  depot:     { name: 'Depot Pelabuhan', x: 2900, y: 1000, label: 'Depot' },
};

const ROOF_COLORS = ['#c98f5f', '#b5764a', '#8fa3b8', '#a8b08a', '#c9a35f', '#7d8aa0', '#d08a7a', '#6f9e8a'];

export function createCity(random) {
  const buildings = [];
  const parks = [];
  // One building (or park) per block between neighbouring roads.
  for (let ci = 0; ci < V_ROADS.length - 1; ci += 1) {
    for (let ri = 0; ri < H_ROADS.length - 1; ri += 1) {
      const x0 = V_ROADS[ci] + ROAD_W / 2 + 14;
      const y0 = H_ROADS[ri] + ROAD_W / 2 + 14;
      const x1 = V_ROADS[ci + 1] - ROAD_W / 2 - 14;
      const y1 = H_ROADS[ri + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const isPark = random() < 0.18;
      if (isPark) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const n = 1 + Math.floor(random() * 2);
      for (let b = 0; b < n; b += 1) {
        const bw = 90 + random() * 130, bh = 70 + random() * 110;
        const bx = Math.min(x1 - bw, Math.max(x0, cx + (random() - 0.5) * (x1 - x0 - bw) + (b - 0.5) * 40));
        const by = Math.min(y1 - bh, Math.max(y0, cy + (random() - 0.5) * (y1 - y0 - bh)));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          height: 1 + Math.floor(random() * 4),
          color: ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)],
          windows: random() < 0.7,
        });
      }
    }
  }
  // A tall hotel row facing the beach, and the pier jutting into the sea.
  for (let i = 0; i < 5; i += 1) {
    buildings.push({ x: 420 + i * 560, y: 2140, w: 180, h: 110, height: 3 + (i % 3), color: ROOF_COLORS[i % ROOF_COLORS.length], windows: true });
  }
  return { buildings, parks, vRoads: V_ROADS, hRoads: H_ROADS };
}

/** True when the point is on a road (within half the road width of a road centre line). */
export function isOnRoad(x, y) {
  for (const rx of V_ROADS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of H_ROADS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

/** Nearest road centre point to (x, y): the point traffic and routing snap to. */
export function nearestRoadPoint(x, y) {
  let bestX = V_ROADS[0], bestD = Infinity;
  for (const rx of V_ROADS) { const d = Math.abs(x - rx); if (d < bestD) { bestD = d; bestX = rx; } }
  let bestY = H_ROADS[0]; bestD = Infinity;
  for (const ry of H_ROADS) { const d = Math.abs(y - ry); if (d < bestD) { bestD = d; bestY = ry; } }
  return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}

/** Circle-vs-building collision: returns the building hit, or null. */
export function buildingAt(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true when it was pushed. */
export function resolveBuildingCollision(city, p, r) {
  const b = buildingAt(city, p.x, p.y, r);
  if (!b) return false;
  const dxl = p.x + r - b.x, dxr = b.x + b.w - (p.x - r);
  const dyt = p.y + r - b.y, dyb = b.y + b.h - (p.y - r);
  const m = Math.min(dxl, dxr, dyt, dyb);
  if (m === dxl) p.x = b.x - r; else if (m === dxr) p.x = b.x + b.w + r;
  else if (m === dyt) p.y = b.y - r; else p.y = b.y + b.h + r;
  return true;
}

/** Keep a point inside the drivable/walkable world (beach is walkable, sea is not). */
export function clampToWorld(p, r) {
  p.x = Math.max(r, Math.min(WORLD.width - r, p.x));
  p.y = Math.max(r, Math.min(WATER_Y - 30 - r, p.y));
}

export function isInWater(x, y) { return y > WATER_Y; }
export function isOnBeach(x, y) { return y > BEACH_Y && y <= WATER_Y; }
