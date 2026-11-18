// Solara Bay — keyboard and mouse input. Held keys give a move vector; one-shot
// presses (enter car, punch, pause, help, weapon switch) are queued as bit flags
// and taken once by the loop, so a press between frames is never lost or doubled.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HELP = 16;
export const ACTION_WEAPON1 = 32;
export const ACTION_WEAPON2 = 64;
export const ACTION_MUTE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;

  function onKeyDown(event) {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code); event.preventDefault(); return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { keys.add(event.code); return; }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (event.code === 'KeyH') actions |= ACTION_HELP;
    else if (event.code === 'Digit1') actions |= ACTION_WEAPON1;
    else if (event.code === 'Digit2') actions |= ACTION_WEAPON2;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  }
  function onKeyUp(event) { keys.delete(event.code); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
    mouseDown = true; mouseClicked = true;
    if (e.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  const has = (...codes) => codes.some((c) => keys.has(c));
  return {
    /** Normalised move vector from WASD / arrows (-1..1 each axis). */
    move() {
      const x = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
      const y = (has('ArrowDown', 'KeyS') ? 1 : 0) - (has('ArrowUp', 'KeyW') ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    running() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    /** Mouse position in CSS pixels relative to the canvas. */
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    /** True once per click; consumed by takeClick. */
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
