// Keyboard + mouse state for the whole game. The game never uses pointer
// lock (headless browsers and iframes fight it); the camera orbits while
// the player drags with the mouse, and the wheel zooms. `tapped` reports
// an edge exactly once per key press, so menus and weapon swaps stay
// reliable.

export class Controls {
  constructor(canvas) {
    this.held = new Set();
    this.tappedSet = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.dragX = 0;
    this.dragY = 0;
    this.dragging = false;
    this.wheelDelta = 0;
    this.mouseHeld = false;
    this.clicked = false;
    this.anyPress = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.tappedSet.add(e.code);
      this.anyPress = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => { this.held.clear(); this.dragging = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true; this.mouseHeld = true; this.clicked = true;
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.dragging = false; this.mouseHeld = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        this.dragX += e.clientX - this.mouseX;
        this.dragY += e.clientY - this.mouseY;
      }
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => { this.wheelDelta += e.deltaY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) { return this.held.has(code); }
  tapped(code) { return this.tappedSet.has(code); }

  // Steering: -1 left .. +1 right, from A/D or the arrow keys.
  steerAmount() {
    let s = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) s -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) s += 1;
    return s;
  }

  // Throttle: +1 forward (W / Up), -1 reverse/brake (S / Down).
  throttleAmount() {
    let t = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) t += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) t -= 1;
    return t;
  }

  // Consume this frame's edge events after the game has read them.
  flush() {
    this.tappedSet.clear();
    this.dragX = 0;
    this.dragY = 0;
    this.wheelDelta = 0;
    this.clicked = false;
    this.anyPress = false;
  }
}
