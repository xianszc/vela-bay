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
// palette: 'warm' (sunset-lit flats) or 'cool' (blue glass towers).
export function windowsCanvas(rng, base, litRatio, palette = 'warm') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const warm = ['#ffd27a', '#ffb020', '#ffe9a8', '#9fd8ff'];
  const cool = ['#9fd8ff', '#cfe8ff', '#ffd27a', '#7fb8e8'];
  const lit = palette === 'cool' ? cool : warm;
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      if (rng() < litRatio) {
        g.fillStyle = choose(rng, lit);
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

// A canvas texture of tall vertical window strips, for New York-style
// towers (Empire State, Chrysler): narrow lit columns running the full
// height of the shaft, so the tower reads as an art-deco skyscraper
// instead of a plain glass box. palette: 'warm' or 'cool'.
export function stripWindowsCanvas(rng, base, litRatio, palette = 'warm') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const warm = ['#ffd27a', '#ffb020', '#ffe9a8', '#9fd8ff'];
  const cool = ['#9fd8ff', '#cfe8ff', '#ffd27a', '#7fb8e8'];
  const lit = palette === 'cool' ? cool : warm;
  // Vertical strips: a column of small windows every 16 px across,
  // unbroken from the base to the crown.
  for (let x = 6; x < 124; x += 16) {
    for (let y = 6; y < 250; y += 18) {
      if (rng() < litRatio) {
        g.fillStyle = choose(rng, lit);
        g.globalAlpha = 0.7 + rng() * 0.3;
      } else {
        g.fillStyle = '#1c2033';
        g.globalAlpha = 0.9;
      }
      g.fillRect(x, y, 8, 11);
    }
  }
  g.globalAlpha = 1;
  return c;
}

// A face for a low-poly character's head: eyes, brows and a smile drawn
// on a skin-coloured canvas, so the character reads as a person with an
// expression instead of a blank box. mood: 'smile' | 'grin' | 'calm'.
export function faceCanvas(skin, mood = 'smile') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
  // Soft shading at the edges so the face is not flat.
  const shade = g.createRadialGradient(64, 64, 20, 64, 64, 90);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade; g.fillRect(0, 0, 128, 128);
  // Blush.
  g.fillStyle = 'rgba(255,120,120,0.35)';
  g.beginPath(); g.ellipse(28, 84, 12, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(100, 84, 12, 7, 0, 0, Math.PI * 2); g.fill();
  // Eyes: white, dark pupils, and a confident brow above each.
  for (const ex of [40, 88]) {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(ex, 56, 11, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a1210';
    g.beginPath(); g.arc(ex, 58, 5.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(ex + 2, 55, 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1210'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ex - 11, 38); g.lineTo(ex + 11, 36); g.stroke();
  }
  // Smile: a wide open grin, a closed smile, or a calm small smile.
  g.strokeStyle = '#5a2a1a'; g.lineWidth = 4; g.lineCap = 'round';
  if (mood === 'grin') {
    g.fillStyle = '#7a2a1a';
    g.beginPath(); g.ellipse(64, 92, 20, 11, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#fff';
    g.fillRect(46, 92, 36, 5);
  } else if (mood === 'calm') {
    g.beginPath(); g.moveTo(52, 94); g.quadraticCurveTo(64, 100, 76, 94); g.stroke();
  } else {
    g.lineWidth = 5;
    g.beginPath(); g.arc(64, 84, 16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
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
