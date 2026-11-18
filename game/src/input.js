// Keyboard + mouse state for the whole game. The game never uses pointer
// lock (headless browsers and iframes fight it); the camera orbits while the
// player drags with the mouse, and the wheel zooms. `wasPressed` reports an
// edge exactly once per key press, so menus and weapon swaps stay reliable.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.dragDX = 0;
    this.dragDY = 0;
    this.dragging = false;
    this.wheel = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true; this.mouseDown = true; this.mouseClicked = true;
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.dragging = false; this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        this.dragDX += e.clientX - this.mouseX;
        this.dragDY += e.clientY - this.mouseY;
      }
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Steering: -1 left .. +1 right, from A/D or the arrow keys.
  steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }

  // Throttle: +1 forward (W / Up), -1 reverse/brake (S / Down).
  throttle() {
    let t = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) t += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) t -= 1;
    return t;
  }

  // Consume this frame's edge events after the game has read them.
  endFrame() {
    this.pressed.clear();
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheel = 0;
    this.mouseClicked = false;
    this.anyKey = false;
  }
}
