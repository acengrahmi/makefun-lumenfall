// input.js — keyboard and mouse state for Lumenfall.
// The game reads one plain "input frame" object every simulation step:
//   { moveX, moveY, aimX, aimY, firing, dashPressed, pausePressed, speedPressed }
// Live play fills it from the DOM here; the autopilot and the screenshot
// scenes build the same shape by hand, so all three drive identical code.

export function makeInputFrame() {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    firing: false,
    dashPressed: false,
    pausePressed: false,
    speedPressed: false,
  };
}

// Attaches DOM listeners and returns { frame, consume } — call snapshot()
// once per rendered frame to get the current frame with edge-triggered
// presses (dash/pause/speed) that clear after being read.
export function attachInput(canvas, toWorld) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let dashQueued = false;
  let pauseQueued = false;
  let speedQueued = false;

  const keyDir = (code) => {
    switch (code) {
      case 'KeyA': case 'ArrowLeft': return [-1, 0];
      case 'KeyD': case 'ArrowRight': return [1, 0];
      case 'KeyW': case 'ArrowUp': return [0, -1];
      case 'KeyS': case 'ArrowDown': return [0, 1];
      default: return null;
    }
  };

  window.addEventListener('keydown', (ev) => {
    if (keyDir(ev.code)) {
      keys.add(ev.code);
      ev.preventDefault();
    }
    if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight' || ev.code === 'Space') {
      if (!ev.repeat) dashQueued = true;
      ev.preventDefault();
    }
    if (ev.code === 'KeyP' || ev.code === 'Escape') {
      if (!ev.repeat) pauseQueued = true;
    }
    if (ev.code === 'Digit1' || ev.code === 'Digit2') {
      if (!ev.repeat) speedQueued = true;
    }
  });
  window.addEventListener('keyup', (ev) => {
    keys.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const p = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button === 0) mouse.down = true;
    canvas.setPointerCapture(ev.pointerId);
  });
  window.addEventListener('pointerup', (ev) => {
    if (ev.button === 0) mouse.down = false;
  });

  return {
    snapshot() {
      const frame = makeInputFrame();
      for (const code of keys) {
        const d = keyDir(code);
        if (d) {
          frame.moveX += d[0];
          frame.moveY += d[1];
        }
      }
      const len = Math.hypot(frame.moveX, frame.moveY);
      if (len > 1) {
        frame.moveX /= len;
        frame.moveY /= len;
      }
      frame.aimX = mouse.x;
      frame.aimY = mouse.y;
      frame.firing = mouse.down;
      frame.dashPressed = dashQueued;
      frame.pausePressed = pauseQueued;
      frame.speedPressed = speedQueued;
      dashQueued = false;
      pauseQueued = false;
      speedQueued = false;
      return frame;
    },
    mousePosition() {
      return { x: mouse.x, y: mouse.y };
    },
  };
}
