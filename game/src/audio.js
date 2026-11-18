// Sound for Vela Bay: a tiny WebAudio synth engine. The radio plays a
// looping bassline and arpeggio per station (different tempo and root note),
// the engine hum follows the speed, and one-shots cover shots, crashes,
// pickups and the mission-passed jingle. Everything is generated — the game
// ships no audio files. Audio only starts after a user gesture.

import { RADIO } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.station = 0;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.nextNoteTime = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    // Engine hum: two detuned saws through a low-pass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(lp); osc2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); osc2.start();
    this.engineOsc2 = osc2;
    this.startRadio();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  // --- radio ---------------------------------------------------------------
  startRadio() {
    if (!this.ctx || this.musicTimer) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleRadio(), 90);
  }

  scheduleRadio() {
    if (!this.ctx) return;
    const st = RADIO[this.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const s = this.step;
      const roots = [1, 1, 0.75, 0.5, 1, 1, 1.335, 0.667];
      const bass = st.root * roots[s % 8];
      if (s % 2 === 0) this.note(bass, t, spb * 1.8, 'triangle', 0.5, this.musicGain);
      if (s % 4 === 2) this.note(bass * 2, t, spb, 'square', 0.10, this.musicGain);
      const arpNotes = st.mood === 'funk'
        ? [4, 5.04, 6, 8]
        : st.mood === 'drive' ? [2, 3, 4, 6] : [2, 2.52, 3.36, 4];
      const arp = st.root * arpNotes[s % 4];
      if (s % 2 === 1) this.note(arp, t, spb * 0.9, 'sine', 0.16, this.musicGain);
      // Hat tick on the off-beat.
      if (s % 2 === 1) this.noise(t, 0.03, 0.05, this.musicGain);
      this.step++;
      this.nextNoteTime += spb;
    }
  }

  nextStation() {
    this.station = (this.station + 1) % RADIO.length;
    return RADIO[this.station];
  }

  // --- engine --------------------------------------------------------------
  engine(speedKmh, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + Math.min(0.16, speedKmh / 900) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 48 + speedKmh * 0.55;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(f * 1.007, this.ctx.currentTime, 0.05);
  }

  // --- one-shots -----------------------------------------------------------
  note(freq, when, dur, type, vol, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  noise(when, dur, vol, dest) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(dest || this.sfxGain);
    src.start(when);
  }

  shot() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.12, 0.5);
    this.note(180, this.ctx.currentTime, 0.08, 'square', 0.25);
  }

  crash(hard) {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, 0.25, Math.min(0.7, 0.25 + hard * 0.03));
    this.note(70, this.ctx.currentTime, 0.22, 'sawtooth', 0.3);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.note(660, t, 0.1, 'sine', 0.3);
    this.note(880, t + 0.09, 0.14, 'sine', 0.3);
  }

  missionPassed() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.note(f, t + i * 0.12, 0.28, 'triangle', 0.32));
  }

  busted() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 330, 262].forEach((f, i) => this.note(f, t + i * 0.18, 0.3, 'sawtooth', 0.22));
  }
}
