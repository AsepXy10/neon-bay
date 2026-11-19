// Keyboard and mouse. Held keys steer and drive; one-shot presses (enter a
// car, reload, pause, confirm) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked for aiming, and clicks queue a shot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_RELOAD = 8;
export const ACTION_INTERACT = 16;
export const ACTION_SHOOT = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const INTERACT = new Set(['KeyF', 'Space']);
const MUTE = new Set(['KeyM']);
const TIME = new Set(['KeyN']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mutePressed = false;
  let timePressed = false;
  const mouse = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (RUN.has(event.code)) keys.run = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER_CAR.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER_CAR; }
    else if (RELOAD.has(event.code)) { if (!event.repeat) actions |= ACTION_RELOAD; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (MUTE.has(event.code)) { if (!event.repeat) mutePressed = true; }
    else if (TIME.has(event.code)) { if (!event.repeat) timePressed = true; }
    else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (RUN.has(event.code)) keys.run = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.run = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.inside = true;
    if (event.button === 0) actions |= ACTION_SHOOT;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; });

  return {
    /** Steering: -1 left, 1 right, 0 neither or both. */
    steer() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    /** Throttle: 1 forward, -1 back, 0 none. */
    throttle() { return (keys.up ? 1 : 0) - (keys.down ? 1 : 0); },
    /** On-foot movement, as a unit-ish x/y pair. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    get running() { return keys.run; },
    get mouse() { return mouse; },
    takeMute() { const v = mutePressed; mutePressed = false; return v; },
    takeTimeToggle() { const v = timePressed; timePressed = false; return v; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
