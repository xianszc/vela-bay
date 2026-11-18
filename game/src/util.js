// Small pure helpers shared by every system: a seeded random stream so
// the town is identical on every load (screenshots stay reproducible),
// maths helpers, and canvas-texture builders so the game needs no image
// files at all.

export function rng32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function choose(rng, list) { return list[Math.floor(rng() * list.length)]; }
export function between(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function intBetween(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function clampNum(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function mix(a, b, t) { return a + (b - a) * t; }
export function easeTo(now, goal, rate, dt) {
  return mix(now, goal, 1 - Math.exp(-rate * dt));
}

// Shortest signed turn from angle `from` toward angle `to`.
export function turnToward(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function cash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function clockText(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor(seconds / 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// A small canvas texture with a grid of lit windows, for building faces.
export function windowsCanvas(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const warm = ['#ffd27a', '#ffb020', '#ffe9a8', '#9fd8ff'];
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      if (rng() < litRatio) {
        g.fillStyle = choose(rng, warm);
        g.globalAlpha = 0.75 + rng() * 0.25;
      } else {
        g.fillStyle = '#1c2033';
        g.globalAlpha = 0.9;
      }
      g.fillRect(x, y, 11, 14);
    }
  }
  g.globalAlpha = 1;
  return c;
}

// A canvas texture with big painted letters, for billboards and neon signs.
export function signCanvas(lines, fg, bg, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 84px Arial, sans-serif';
  lines.forEach((line, i) => {
    g.fillText(line, 256, 96 + i * 84 - (lines.length - 1) * 42);
  });
  if (sub) {
    g.font = 'bold 34px Arial, sans-serif';
    g.fillText(sub, 256, 208);
  }
  return c;
}

// A soft radial glow sprite, used for the sun halo and the helicopter beam.
export function glowCanvas(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return c;
}
