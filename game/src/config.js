// Solara Bay — every tuning number and colour in one place.
// Top-down open world: a 3600x2600 coastal city. The renderer shows a 1280x720
// camera window that follows the player, so no rule depends on screen size.
export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 13, walkSpeed: 170, runSpeed: 285, health: 100,
  punchDamage: 25, punchRange: 34, punchRate: 0.35,
};
export const CAR_TYPES = {
  sedan:   { name: 'Sedan',  accel: 420, top: 430, reverse: 150, turn: 2.6, color: '#4a90d9', w: 46, l: 82, hp: 100 },
  taxi:    { name: 'Taksi',  accel: 400, top: 410, reverse: 150, turn: 2.6, color: '#f2c230', w: 46, l: 82, hp: 100 },
  truck:   { name: 'Truk',   accel: 260, top: 300, reverse: 110, turn: 1.9, color: '#8a7d6b', w: 52, l: 104, hp: 160 },
  sport:   { name: 'Sport',  accel: 620, top: 620, reverse: 180, turn: 3.1, color: '#d93a4a', w: 44, l: 84, hp: 90 },
  police:  { name: 'Polisi', accel: 560, top: 560, reverse: 170, turn: 3.0, color: '#1d2f4d', w: 46, l: 84, hp: 140 },
  van:     { name: 'Van',    accel: 320, top: 340, reverse: 120, turn: 2.2, color: '#7fae7a', w: 50, l: 96, hp: 130 },
};
export const CAR_TYPE_KEYS = ['sedan', 'taxi', 'truck', 'sport', 'police', 'van'];

export const TRAFFIC = { cars: 34, peds: 50, pedSpeed: 55, fleeSpeed: 190 };
export const WANTED = { max: 5, decayPerSec: 0.045, hideRadius: 520 };
export const WEAPONS = {
  fists: { name: 'Tangan Kosong', damage: 25, rate: 0.35, range: 34, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, range: 420, ammo: 120, bulletSpeed: 900 },
};
export const MISSION_REWARDS = [400, 600, 900, 1200, 1000, 2500];
export const DAY_LENGTH = 240; // seconds per full day/night cycle

export const PALETTE = {
  grass: '#5da85f', grass2: '#54a058', road: '#3c3f46', roadLine: '#e8d44d',
  sidewalk: '#9aa0a8', building: '#c98f5f', water: '#2e7fb8', sand: '#e6d29a',
  park: '#3f8f4f', panel: '#141a24', text: '#f2f4f6', muted: '#9aa4b2',
  gold: '#f2c94c', red: '#e5534b', blue: '#4fc3f7', green: '#58c96b',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solara-bay.save.v1';
export const BEST_KEY = 'solara-bay.best';
