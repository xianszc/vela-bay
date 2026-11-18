// Sound for Vela Bay: a small WebAudio synth. The radio plays a looping
// bassline and arpeggio per station (different tempo and root note), the
// engine hum follows the speed, and one-shots cover shots, crashes,
// pickups and the mission-passed jingle. Everything is generated — the
// game ships no audio files. Audio only starts after a user gesture.

import { STATIONS } from './config.js';

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.humOsc = null;
    this.humOsc2 = null;
    this.humGain = null;
    this.station = 0;
    this.muted = false;
    this.radioTimer = null;
    this.beat = 0;
    this.nextBeatAt = 0;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.5;
    this.sfxBus.connect(this.master);
    // Engine hum: two detuned saws through a low-pass filter.
    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.value = 55;
    this.humOsc2 = this.ctx.createOscillator();
    this.humOsc2.type = 'sawtooth';
    this.humOsc2.frequency.value = 55.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.0;
    this.humOsc.connect(lp); this.humOsc2.connect(lp);
    lp.connect(this.humGain); this.humGain.connect(this.master);
    this.humOsc.start(); this.humOsc2.start();
    this.beginRadio();
  }

  toggleMute(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  // --- radio ---------------------------------------------------------------
  beginRadio() {
    if (!this.ctx || this.radioTimer) return;
    this.beat = 0;
    this.nextBeatAt = this.ctx.currentTime + 0.1;
    this.radioTimer = setInterval(() => this.queueRadio(), 90);
  }

  queueRadio() {
    if (!this.ctx) return;
    const st = STATIONS[this.station];
    const eighth = 60 / st.bpm / 2;
    while (this.nextBeatAt < this.ctx.currentTime + 0.35) {
      const t = this.nextBeatAt;
      const s = this.beat;
      const roots = [1, 1, 0.75, 0.5, 1, 1, 1.335, 0.667];
      const bass = st.root * roots[s % 8];
      if (s % 2 === 0) this.tone(bass, t, eighth * 1.8, 'triangle', 0.5, this.musicBus);
      if (s % 4 === 2) this.tone(bass * 2, t, eighth, 'square', 0.10, this.musicBus);
      const arpSteps = st.mood === 'funk'
        ? [4, 5.04, 6, 8]
        : st.mood === 'drive' ? [2, 3, 4, 6] : [2, 2.52, 3.36, 4];
      const arp = st.root * arpSteps[s % 4];
      if (s % 2 === 1) this.tone(arp, t, eighth * 0.9, 'sine', 0.16, this.musicBus);
      // Hat tick on the off-beat.
      if (s % 2 === 1) this.hiss(t, 0.03, 0.05, this.musicBus);
      this.beat++;
      this.nextBeatAt += eighth;
    }
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    return STATIONS[this.station];
  }

  // --- engine --------------------------------------------------------------
  engineHum(speedKmh, driving) {
    if (!this.ctx || !this.humOsc) return;
    const target = driving ? 0.05 + Math.min(0.16, speedKmh / 900) : 0.0;
    this.humGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 48 + speedKmh * 0.55;
    this.humOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.humOsc2.frequency.setTargetAtTime(f * 1.007, this.ctx.currentTime, 0.05);
  }

  // --- one-shots -----------------------------------------------------------
  tone(freq, when, dur, type, vol, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    o.start(when); o.stop(when + dur + 0.05);
  }

  hiss(when, dur, vol, dest) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(dest || this.sfxBus);
    src.start(when);
  }

  gunshot() {
    if (!this.ctx) return;
    this.hiss(this.ctx.currentTime, 0.12, 0.5);
    this.tone(180, this.ctx.currentTime, 0.08, 'square', 0.25);
  }

  crashThud(hard) {
    if (!this.ctx) return;
    this.hiss(this.ctx.currentTime, 0.25, Math.min(0.7, 0.25 + hard * 0.03));
    this.tone(70, this.ctx.currentTime, 0.22, 'sawtooth', 0.3);
  }

  coinChime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(660, t, 0.1, 'sine', 0.3);
    this.tone(880, t + 0.09, 0.14, 'sine', 0.3);
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.12, 0.28, 'triangle', 0.32));
  }

  sirenDown() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 330, 262].forEach((f, i) => this.tone(f, t + i * 0.18, 0.3, 'sawtooth', 0.22));
  }
}
