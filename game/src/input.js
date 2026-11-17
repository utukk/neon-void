// Neon Void — input. Keyboard state plus mouse position (converted to
// the game's logical coordinates) and button state. `pressed` holds the
// edge-triggered keys consumed once per frame by the game loop.
const keys = new Set();
const pressed = new Set();

export const input = {
  mouse: { x: 0, y: 0, down: false },
  // Call once per frame after the game has read the input.
  endFrame() { pressed.clear(); },
  isDown(code) { return keys.has(code); },
  wasPressed(code) { return pressed.has(code); },
  // Movement axis from WASD or the arrow keys, normalised.
  moveAxis() {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  },
  get firing() {
    return this.mouse.down || keys.has('Space');
  },
};

// Wire the listeners. `toLogical` maps a client point into the game's
// 960x540 logical space using the canvas's current on-screen rect.
export function bindInput(canvas, toLogical) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  window.addEventListener('blur', () => { keys.clear(); input.mouse.down = false; });

  const updateMouse = (e) => {
    const p = toLogical(e.clientX, e.clientY);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
  };
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouse.down = true; updateMouse(e); }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
