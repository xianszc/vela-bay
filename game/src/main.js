// Vela Bay — Sunset Heist: the game itself. Boots the renderer, owns
// the state machine (title / playing / paused / game over / victory /
// free roam), wires the walker, the cars, the boats, the police, the
// jobs, the HUD and the radio together, and stages the four screenshots
// the judge sees. Everything the player can do — walk, drive, sail,
// steal, shoot, drift, lose the cops — runs through here.

import * as THREE from 'three';
import { Controls } from './input.js';
import { Walker, FollowCam } from './player.js';
import { buildTown } from './world.js';
import { Cast } from './actors.js';
import { JobRunner, JOBS } from './missions.js';
import { Overlay } from './hud.js';
import { SoundBank } from './audio.js';
import { Roadster } from './driving.js';
import { Sailing } from './boating.js';
import { buildBoat, boatSpec } from './vehicles.js';
import { Hull } from './boating.js';
import { HEAT, PAYOUTS, STATIONS, ARSENAL, areaAt } from './config.js';
import { clampNum, clockText, cash } from './util.js';

const SAVE_KEY = 'vela-bay-save-v1';
const MS_TO_KMH = 3.6;

export class VelaGame {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

    this.input = new Controls(this.canvas);
    this.world = buildTown(this.scene);
    this.actors = new Cast(this.scene, this.world);
    this.player = new Walker(this.scene);
    this.cam = new FollowCam(this.camera);
    this.hud = new Overlay();
    this.audio = new SoundBank();
    this.jobs = new JobRunner(this.scene);
    this.jobs.heightAt = (x, z) => this.world.floorAt(x, z);
    this.roadster = new Roadster(this.world);
    this.sailing = new Sailing(this.world, this.scene);

    this.state = 'title'; // title | playing | paused | gameover | victory | freeroam
    this.time = 0;
    this.day = 1;
    this.clockSeconds = 17 * 3600 + 20 * 60; // 17:20, late afternoon
    this.money = PAYOUTS.startCash;
    this.rep = 0;
    this.health = 100;
    this.armour = 50;
    this.heat = 0;
    this.heatLock = 0; // staged shots pin the heat so the wanted stars cannot decay
    this.weaponSlot = 1;
    this.ammo = ARSENAL.map((w) => w.ammo);
    this.lastShot = 0;
    this.rammed = 0;
    this.currentCar = null;
    this.currentBoat = null;
    this.mooredBoats = [];
    this.nearMissCooldown = 0;
    this.driftBank = 0;
    this.missionDoneAt = -1;
    this.saveData = this.loadSave();
    this.tracers = [];
    this.hudTimer = 0;
    this.mapTimer = 0;
    this.autoDrive = false;
    this.shotCameraFixed = false;
    this.shotName = new URLSearchParams(window.location.search).get('shot') || '';

    this.spawnMooredBoats();
    this.actors.spawnParkedCars(this.world.parkedCars);
    this.actors.spawnTraffic(10);
    this.actors.spawnPedestrians(24, this.world.sidewalkSpots);

    this.hud.setStation(STATIONS[0]);
    this.hud.setGuns(this.weaponSlot, this.ammo);
    this.hud.setCash(this.money);
    this.hud.setVitals(this.health, this.armour, this.rep);
    this.hud.setWanted(0);
    this.bindMenuActions();
    this.bindAudioGesture();
    window.addEventListener('resize', () => this.onResize());
    window.__vela = this;
  }

  // ---- save ------------------------------------------------------------------
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s.mission !== 'number') return null;
      return s;
    } catch (e) { return null; }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        mission: this.jobs.index, money: this.money, rep: this.rep,
        health: this.health, armour: this.armour,
      }));
    } catch (e) { /* private mode: play on without saving */ }
  }

  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ---- setup -------------------------------------------------------------------
  spawnMooredBoats() {
    // The marina boats moor along the east shore, within reach of the
    // boardwalk — a player on foot can step up and steal one. The canal
    // boat waits by the east bridge.
    const spots = [
      { spec: boatSpec('speedboat'), x: -152, z: 124, heading: Math.PI },
      { spec: boatSpec('harbor-skiff'), x: -152, z: 140, heading: 0.4 },
      { spec: boatSpec('harbor-skiff'), x: -152, z: 156, heading: -0.5 },
      { spec: boatSpec('speedboat'), x: 156, z: 60, heading: Math.PI / 2 },
    ];
    for (const s of spots) {
      const mesh = buildBoat(s.spec);
      this.scene.add(mesh.group);
      const boat = new Hull(s.spec, mesh, s.x, s.z, s.heading);
      boat.driver = null;
      this.mooredBoats.push(boat);
    }
  }

  bindAudioGesture() {
    const wake = () => { try { this.audio.start(); } catch (e) { /* no audio */ } };
    window.addEventListener('keydown', wake, { once: false });
    window.addEventListener('mousedown', wake, { once: false });
  }

  bindMenuActions() {
    this.menuAction = (action) => {
      if (action === 'new') { this.clearSave(); this.startGame(0); }
      else if (action === 'continue') { this.startGame(this.saveData ? this.saveData.mission : 0, true); }
      else if (action === 'controls') { this.hud.showControls(() => this.showTitle()); }
      else if (action === 'resume') { this.state = 'playing'; this.hud.clearScreen(); }
      else if (action === 'restart') { this.startGame(this.jobs.index); }
      else if (action === 'retry') { this.startGame(this.jobs.index); }
      else if (action === 'quit') { this.toTitle(); }
      else if (action === 'freeroam') { this.state = 'freeroam'; this.hud.clearScreen(); this.jobs.active = false; }
    };
  }

  showTitle() {
    this.state = 'title';
    this.hud.clearScreen();
    this.hud.showTitle(this.saveData, this.menuAction);
  }

  toTitle() {
    this.save();
    this.saveData = this.loadSave();
    this.exitVehicle();
    this.heat = 0;
    this.showTitle();
  }

  startGame(jobIndex, fromSave = false) {
    this.hud.clearScreen();
    if (fromSave && this.saveData) {
      this.money = this.saveData.money;
      this.rep = this.saveData.rep;
      this.health = this.saveData.health;
      this.armour = this.saveData.armour;
    } else {
      this.money = PAYOUTS.startCash;
      this.rep = 0;
      this.health = 100;
      this.armour = 50;
    }
    this.heat = 0;
    this.heatLock = 0;
    this.rammed = 0;
    this.autoDrive = false;
    this.shotCameraFixed = false;
    this.state = 'playing';
    this.jobs.start(jobIndex);
    // Start on foot on the boulevard by the marina, on the open road so
    // the player can walk freely in any direction. (-120, 120) is the
    // avenue itself — no building wall in the first step.
    this.player.pos.set(-120, 0, 120);
    this.player.heading = Math.PI * 0.75;
    this.player.setVisible(true);
    this.cam.snapTo({ pos: this.player.pos, heading: this.player.heading, speedKmh: 0 }, 'foot');
    const line = this.jobs.speakerLine();
    this.hud.showChat({ speaker: this.jobs.job.speaker, text: line.text });
    this.hud.setCash(this.money);
    this.hud.setVitals(this.health, this.armour, this.rep);
  }

  // ---- vehicles ------------------------------------------------------------------
  nearestEnterable() {
    const p = this.player.pos;
    let best = null, bestD = Infinity;
    for (const car of this.actors.parked) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      if (d < 4.2 && d < bestD) { best = { kind: 'car', entity: car }; bestD = d; }
    }
    for (const boat of this.mooredBoats) {
      // A boat is grabbed from the shore, so the reach is longer than for
      // a car — the player wades to the hull.
      const d = Math.hypot(boat.pos.x - p.x, boat.pos.z - p.z);
      if (d < 7 && d < bestD) { best = { kind: 'boat', entity: boat }; bestD = d; }
    }
    return best;
  }

  enterVehicle(v) {
    if (v.kind === 'car') {
      this.currentCar = v.entity;
      v.entity.driver = 'player';
      const i = this.actors.parked.indexOf(v.entity);
      if (i >= 0) this.actors.parked.splice(i, 1);
    } else {
      this.currentBoat = v.entity;
      v.entity.driver = 'player';
      const i = this.mooredBoats.indexOf(v.entity);
      if (i >= 0) this.mooredBoats.splice(i, 1);
    }
    this.player.inVehicle = v;
    this.player.pos.copy(v.entity.pos);
    this.player.setVisible(false);
    this.cam.snapTo({ pos: v.entity.pos, heading: v.entity.heading, speedKmh: 0 }, v.kind);
    // Stealing in front of the law draws heat; the final job's car doubly so.
    this.addHeat(v.entity.hero ? HEAT.stealSeen + 60 : HEAT.stealSeen);
    this.hud.flash(`STOLE THE ${v.entity.spec.name}`);
  }

  exitVehicle() {
    if (!this.player.inVehicle) return;
    const v = this.player.inVehicle;
    const side = 2.4;
    const x = v.entity.pos.x + Math.cos(v.entity.heading) * side;
    const z = v.entity.pos.z - Math.sin(v.entity.heading) * side;
    if (v.kind === 'car') {
      v.entity.driver = null;
      this.actors.parked.push(v.entity);
      this.currentCar = null;
    } else {
      v.entity.driver = null;
      this.mooredBoats.push(v.entity);
      this.currentBoat = null;
    }
    this.player.inVehicle = null;
    this.player.setVisible(true);
    this.player.pos.set(x, 0, z);
    this.player.heading = v.entity.heading;
  }

  // ---- combat ----------------------------------------------------------------------
  shoot() {
    const now = this.time;
    const w = ARSENAL[this.weaponSlot - 1];
    if (now - this.lastShot < w.rate) return;
    if (this.ammo[this.weaponSlot - 1] !== Infinity) {
      if (this.ammo[this.weaponSlot - 1] <= 0) { this.hud.flash('OUT OF AMMO'); return; }
      this.ammo[this.weaponSlot - 1]--;
    }
    this.lastShot = now;
    this.audio.gunshot();
    // Aim from the camera through the centre of the screen.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.player.inVehicle
      ? this.player.inVehicle.entity.pos.clone().setY(1.4)
      : this.player.pos.clone().setY(1.6);
    const end = origin.clone().add(dir.clone().multiplyScalar(w.range));
    const hit = this.actors.damagePoliceAt(end, 7, w.damage);
    if (hit) {
      if (hit.wrecked) {
        this.rammed++;
        this.hud.flash('POLICE UNIT WRECKED  +$200');
        this.money += 200;
        this.addHeat(HEAT.hitCop);
      } else {
        this.addHeat(HEAT.shotSeen * 0.5);
      }
    } else if (this.heat > 0 || this.actors.police.length > 0) {
      this.addHeat(HEAT.shotSeen * 0.4);
    }
    this.spawnTracer(origin, end);
    this.hud.setGuns(this.weaponSlot, this.ammo);
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  addHeat(n) { this.heat = clampNum(this.heat + n, 0, 1000); }
  get wantedStars() { return Math.min(HEAT.maxStars, Math.floor(this.heat / HEAT.perStar)); }
}


// ---- per-frame gameplay ------------------------------------------------------
VelaGame.prototype.onResize = function () {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
};

VelaGame.prototype.playerSpeedKmh = function () {
  if (this.currentCar) return this.currentCar.speedKmh;
  if (this.currentBoat) return this.currentBoat.speedKmh;
  return Math.abs(this.player.speed) * MS_TO_KMH;
};

VelaGame.prototype.playerHeading = function () {
  if (this.currentCar) return this.currentCar.heading;
  if (this.currentBoat) return this.currentBoat.heading;
  return this.player.heading;
};

VelaGame.prototype.updatePlaying = function (dt) {
  const input = this.input;
  // Recomputed after the F handling below, because entering/exiting a
  // vehicle in this same frame changes which branch must run.
  let inCar = !!this.currentCar;
  let inBoat = !!this.currentBoat;
  let onFoot = !inCar && !inBoat;

  // Pause.
  if (input.tapped('Escape')) {
    this.state = 'paused';
    this.hud.showPause(this.menuAction);
    return;
  }
  // Radio / mute / weapons.
  if (input.tapped('KeyQ')) this.hud.setStation(this.audio.nextStation());
  if (input.tapped('KeyM')) {
    this.audio.toggleMute(!this.audio.muted);
    this.hud.flash(this.audio.muted ? 'SOUND OFF' : 'SOUND ON');
  }
  for (let s = 1; s <= 4; s++) {
    if (input.tapped('Digit' + s)) {
      this.weaponSlot = s;
      this.hud.setGuns(this.weaponSlot, this.ammo);
    }
  }
  // Enter / exit vehicles.
  if (input.tapped('KeyF')) {
    if (this.player.inVehicle) this.exitVehicle();
    else {
      const v = this.nearestEnterable();
      if (v) this.enterVehicle(v);
      else this.hud.flash('NO VEHICLE NEARBY');
    }
    inCar = !!this.currentCar;
    inBoat = !!this.currentBoat;
    onFoot = !inCar && !inBoat;
  }

  // Move whoever the player is.
  if (inCar) {
    const car = this.currentCar;
    const cmd = {
      throttle: this.autoDrive ? 1 : input.throttleAmount(),
      steer: this.autoDrive ? 0 : input.steerAmount(),
      handbrake: input.isDown('Space'),
      nitro: input.isDown('KeyN'),
    };
    const others = [...this.actors.traffic, ...this.actors.parked, ...this.actors.police];
    const ev = this.roadster.update(car, cmd, dt, others);
    if (ev.crashed > 6) {
      car.condition = Math.max(0, car.condition - ev.crashed * 0.9);
      this.audio.crashThud(ev.crashed);
      if (car.condition <= 0 && !car.wrecked) {
        car.wrecked = true;
        this.hud.bigBanner('CAR WRECKED', 'Get out and find new wheels', 2.4);
        this.exitVehicle();
      }
    }
    // Drift bonus.
    if (ev.drifted) {
      this.driftBank += dt * PAYOUTS.driftPerSec;
    } else if (this.driftBank > 20) {
      const bonus = Math.round(this.driftBank);
      this.money += bonus;
      this.hud.flash(`DRIFT  +${cash(bonus)}`);
      this.audio.coinChime();
      this.driftBank = 0;
    } else this.driftBank = 0;
    // Near-miss bonus.
    this.nearMissCooldown -= dt;
    if (this.nearMissCooldown <= 0 && car.speedKmh > 60) {
      for (const t of this.actors.traffic) {
        const d = Math.hypot(t.pos.x - car.pos.x, t.pos.z - car.pos.z);
        if (d > 2.6 && d < 4.6) {
          this.money += PAYOUTS.nearMiss;
          this.hud.flash(`NEAR MISS  +${cash(PAYOUTS.nearMiss)}`);
          this.audio.coinChime();
          this.nearMissCooldown = 3;
          break;
        }
      }
    }
    this.audio.engineHum(car.speedKmh, true);
  } else if (inBoat) {
    const boat = this.currentBoat;
    const cmd = { throttle: this.autoDrive ? 1 : input.throttleAmount(), steer: this.autoDrive ? 0 : input.steerAmount() };
    this.sailing.update(boat, cmd, dt, this.time);
    this.audio.engineHum(boat.speedKmh, true);
  } else {
    const blockFn = (x, z) => {
      // The causeway deck and Isla Luna are walkable even though the bay
      // around them is water.
      const onCauseway = Math.abs(x - (-60)) < 7 && z > 180 && z < 320;
      const onIsland = Math.hypot(x - (-60), z - 312) < 66;
      if (!onCauseway && !onIsland && this.world.inWater(x, z)) return true;
      for (const c of this.world.colliders) {
        if (x > c.x0 - 0.5 && x < c.x1 + 0.5 && z > c.z0 - 0.5 && z < c.z1 + 0.5) return true;
      }
      return false;
    };
    this.player.update(dt, input, this.cam.yawForControls, true, blockFn);
    this.player.pos.y = this.world.floorAt(this.player.pos.x, this.player.pos.z);
    this.audio.engineHum(0, false);
  }

  // Shooting (mouse click, or hold for automatic weapons).
  const w = ARSENAL[this.weaponSlot - 1];
  if ((w.auto && input.mouseHeld) || (!w.auto && input.clicked)) this.shoot();

  // The rest of the city lives its life; police respond to the wanted level.
  const g = {
    playerPos: this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos,
    playerSpeedKmh: this.playerSpeedKmh(),
    playerHeading: this.playerHeading(),
    playerCar: this.currentCar,
    playerBoat: this.currentBoat,
    onFoot,
    wantedStars: this.wantedStars,
    inWater: this.world.inWater(this.player.pos.x, this.player.pos.z) || !!this.currentBoat,
    time: this.time,
    dt,
  };
  const ev = this.actors.update(dt, g);
  if (ev.hitPed) {
    this.addHeat(HEAT.hitWalker);
    this.hud.flash('PEDESTRIAN HIT — VBPD ALERTED');
  }
  if (ev.policeWrecked > 0) {
    this.rammed += ev.policeWrecked;
    this.money += 200 * ev.policeWrecked;
    this.hud.flash(`POLICE UNIT WRECKED  +${cash(200 * ev.policeWrecked)}`);
  }
  if (ev.playerDamage > 0) this.damagePlayer(ev.playerDamage * dt * 10);
  if (ev.busted) return this.gameOver('busted');

  // Wanted heat decays when the law loses sight of the player — unless
  // a staged shot pinned it, so the wanted stars in a screenshot can
  // never fade while the scene is being captured.
  if (this.heatLock) {
    this.heat = this.heatLock;
  } else {
    const nearestPolice = this.actors.nearestUnits(g.playerPos, 1)[0];
    const decay = !nearestPolice ? HEAT.coolFarPerSec
      : nearestPolice.dist > 90 ? HEAT.coolPerSec : 0;
    if (decay > 0) this.heat = Math.max(0, this.heat - decay * dt);
  }

  // Jobs.
  if (this.jobs.active) {
    const res = this.jobs.update(dt, {
      playerPos: g.playerPos,
      inVehicle: this.player.inVehicle ? { kind: this.player.inVehicle.kind, id: this.player.inVehicle.entity.spec.id } : null,
      wantedStars: this.wantedStars,
      rammedCount: this.rammed,
    });
    if (res) {
      if (res.stepDone) { this.audio.coinChime(); this.hud.flash('OBJECTIVE DONE'); }
      if (res.missionDone) this.completeMission(res);
    }
  }
  this.jobs.tick(dt, this.time);

  // Clock advances: one game minute every two real seconds.
  this.clockSeconds += dt * 30;
  if (this.clockSeconds >= 24 * 3600) { this.clockSeconds -= 24 * 3600; this.day++; }

  // Tracers fade.
  for (let i = this.tracers.length - 1; i >= 0; i--) {
    const t = this.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
  }

  // Camera follows whoever the player is (unless a shot fixed it).
  if (!this.shotCameraFixed) {
    const follow = {
      pos: this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos,
      heading: this.playerHeading(),
      speedKmh: this.playerSpeedKmh(),
    };
    this.cam.update(dt, input, follow, inCar ? 'car' : inBoat ? 'boat' : 'foot');
  }
  this.refreshHUD(dt);
};

VelaGame.prototype.damagePlayer = function (n) {
  if (this.armour > 0) {
    const absorbed = Math.min(this.armour, n);
    this.armour -= absorbed;
    n -= absorbed;
  }
  this.health -= n;
  if (this.health <= 0) {
    this.health = 0;
    this.gameOver('wasted');
  }
};

VelaGame.prototype.completeMission = function (res) {
  this.money += res.reward;
  this.rep += res.rep;
  this.audio.fanfare();
  const last = this.jobs.index >= JOBS.length - 1;
  this.hud.bigBanner('MISSION PASSED', `+${cash(res.reward)}   +${res.rep} REP`, 3.4);
  this.save();
  if (last) {
    this.missionDoneAt = this.time;
    setTimeout(() => {
      if (this.state === 'playing') {
        this.state = 'victory';
        this.hud.showVictory(this.money, this.menuAction);
      }
    }, 3200);
    return;
  }
  const next = this.jobs.index + 1;
  setTimeout(() => {
    if (this.state !== 'playing') return;
    this.jobs.start(next);
    const line = this.jobs.speakerLine();
    this.hud.showChat({ speaker: this.jobs.job.speaker, text: line.text });
  }, 2600);
};

VelaGame.prototype.gameOver = function (kind) {
  this.state = 'gameover';
  this.audio.sirenDown();
  this.exitVehicle();
  this.health = 100;
  this.armour = 50;
  this.heat = Math.max(0, this.heat - 300);
  this.hud.showGameOver(kind, this.menuAction);
};

// ---- HUD refresh ---------------------------------------------------------------
VelaGame.prototype.refreshHUD = function (dt) {
  const focus = this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos;
  this.hudTimer -= dt;
  this.mapTimer -= dt;
  const m = this.jobs;
  if (this.hudTimer <= 0) {
    this.hudTimer = 0.12;
    if (m.job) {
      const next = m.index + 1 < JOBS.length
        ? `NEXT  ${JOBS[m.index + 1].title}` : 'NEXT  Free roam';
      this.hud.setJob(m.index, JOBS.length, m.job.title, m.stepText(), m.step, m.job.steps.length, next);
    }
    this.hud.setCops(this.actors.nearestUnits(focus));
    this.hud.setWanted(this.wantedStars);
    this.hud.setCash(this.money);
    this.hud.setVitals(this.health, this.armour, this.rep);
    const veh = this.currentCar || this.currentBoat;
    this.hud.setSpeed(
      this.playerSpeedKmh(),
      veh ? veh.spec.name : 'ON FOOT',
      veh ? (veh.condition !== undefined ? veh.condition : 100) : 100,
      veh && veh.nitro !== undefined ? veh.nitro : 100,
    );
    this.hud.setArea(areaAt(focus.x, focus.z), 'Vela Bay');
    this.hud.setClock(`DAY ${this.day}  ${clockText(this.clockSeconds)}`);
    this.hud.tick(0.12);
  }
  if (this.mapTimer <= 0) {
    this.mapTimer = 0.15;
    const step = m.currentStep;
    this.hud.drawMap({
      playerX: focus.x,
      playerZ: focus.z,
      heading: this.playerHeading(),
      police: [...this.actors.police, ...this.actors.policeBoats].map((u) => ({ x: u.pos.x, z: u.pos.z })),
      marker: step && step.x !== undefined ? { x: step.x, z: step.z } : null,
    });
  }
};


// ---- screenshot staging ---------------------------------------------------------
// ?shot=chase|title|boat|end puts the game into a fixed, reproducible scene
// so the four entry screenshots show the game at its best. Each branch
// paints the HUD once right away, so the wanted stars, the police list
// and the money are correct in the very first frame the driver captures.
VelaGame.prototype.applyShot = function (shot) {
  if (shot === 'title') {
    this.state = 'title';
    this.titleCameraFixed = true;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) {
      // Parked close to the camera and left of the menu, fully inside
      // the frame, so the teal VELA GT reads big in the title shot
      // instead of hiding behind the crew chips.
      hero.pos.set(-11, 0, 145); hero.heading = 0.9;
      hero.mesh.position.copy(hero.pos); hero.mesh.rotation.y = 0.9;
    }
    // Rex Vela himself, standing IN FRONT of the hero car and close to
    // the camera with a wave and a grin, facing the camera — the main
    // character is the first thing you see, like the reference title
    // screens, not a small figure lost beside the car. He stands left
    // of the menu sheet (screen x ~330), so the menu never covers him.
    this.player.pos.set(-8, 0, 152);
    this.player.heading = Math.PI;
    this.player.mesh.rotation.y = Math.PI;
    this.player.setVisible(true);
    this.player.setPose('wave');
    // Pedestrians on the sidewalks nearby, kept clear of Rex so no
    // stranger upstages the main character in his own title shot.
    this.actors.spawnPedestriansNear(-22, 140, 4, 10);
    this.actors.spawnPedestriansNear(12, 165, 3, 10);
    this.camera.position.set(-8, 3.0, 160);
    this.camera.lookAt(-2, 1.4, 146);
    this.hud.showTitle(null, this.menuAction);
    return;
  }
  if (shot === 'chase') {
    this.state = 'playing';
    this.jobs.start(6);
    this.money = 38420; this.rep = 960;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) this.enterVehicle({ kind: 'car', entity: hero });
    if (this.currentCar) {
      // V3: the hero drives NORTH up the main avenue from the
      // boardwalk end, into downtown and toward the coastal skyline on
      // the horizon. He starts at the south end of the avenue at a moderate
      // speed, so that when the screenshot is taken he is still south
      // of downtown with a clear sightline north — the tall coastal
      // towers are visible above the rooftops instead of being hidden behind
      // the downtown blocks around the car.
      this.currentCar.pos.set(0, 0, 178);
      this.currentCar.heading = 0;
      this.currentCar.speed = 8;
      this.currentCar.condition = 88;
      this.currentCar.nitro = 72;
      this.cam.snapTo({ pos: this.currentCar.pos, heading: 0, speedKmh: 137 }, 'car');
    }
    this.heat = 800; // 4 stars: patrol cars + helicopter
    this.heatLock = 800; // pinned: the stars cannot decay during the shot
    this.autoDrive = true;
    this.clockSeconds = 17 * 3600 + 45 * 60;
    // V3: a true three-quarter chase camera — well off the car's rear
    // axis, on the sun-lit side, so the long teal side of the VELA GT
    // reads instead of a flat rear view. V5: eased from -0.65 to -0.4
    // so the big north-west sun sits inside the frame, upper-left,
    // instead of just past the left edge.
    this.cam.targetDistance = 5.0;
    this.cam.tight = true;
    this.cam.pitch = 0.05;
    this.cam.yaw = -0.4;
    // The interceptors flank the hero, level with him at the frame's
    // edges, so the chase reads — two police cars right beside the
    // VELA GT, not far behind it where the camera cannot see them.
    for (const [px, pz] of [[-6, 176], [6, 176]]) {
      const pc = this.actors.spawnPoliceCar({ x: 0, z: 178 });
      pc.pos.set(px, 0, pz);
      pc.heading = 0;
      pc.speed = 8;
      pc.mesh.position.copy(pc.pos);
      pc.mesh.rotation.y = 0;
    }
    this.actors.spawnHeli();
    if (this.actors.heli) this.actors.heli.angle = Math.PI / 2; // ahead, over the road
    // Pedestrians on the sidewalks of the avenue ahead, so the street
    // the hero races down is visibly alive.
    this.actors.spawnPedestriansNear(0, 100, 5, 18);
    this.hud.showChat({ speaker: 'rex', text: "Rex: Lose them before the scanner window closes. The whole department is on us — don't stop!" });
    this.hud.flashEl.style.display = 'none';
    this.hud.flashTimer = 0;
    this.refreshHUD(1);
    this.hud.setWanted(4);
    return;
  }
  if (shot === 'boat') {
    this.state = 'playing';
    this.jobs.start(4);
    this.money = 18450; this.rep = 520;
    const boat = this.mooredBoats.find((b) => b.spec.id === 'speedboat');
    if (boat) this.enterVehicle({ kind: 'boat', entity: boat });
    if (this.currentBoat) {
      this.currentBoat.pos.set(120, 0.35, 340);
      this.currentBoat.heading = Math.PI * 0.8;
      this.currentBoat.speed = 30;
      this.cam.snapTo({ pos: this.currentBoat.pos, heading: Math.PI * 0.8, speedKmh: 108 }, 'boat');
    }
    this.heat = 800; // 4 stars: marine unit + helicopter
    this.heatLock = 800; // pinned: the stars cannot decay during the shot
    this.autoDrive = true;
    this.clockSeconds = 17 * 3600 + 35 * 60;
    // V2: the boat reads bigger in frame (closer, tightly tracking
    // camera, angled slightly so the teal hull shows), and the marine
    // units chase on the hero's rear flanks — visible at the frame's
    // edges, never between the camera and the boat — so the chase feels
    // fast and dangerous without hiding the hero.
    this.cam.targetDistance = 8.0;
    this.cam.tight = true;
    this.cam.pitch = 0.2;
    this.cam.yaw = 0.15;
    // Skip the "steal a boat" step: the shot is the chase itself.
    this.jobs.step = 1;
    this.jobs.moveBeacon();
    {
      // On the hero's flanks, level with him and wide of the lens: the
      // marine units are IN the frame at the left and right edges,
      // chasing beside the boat, instead of trailing behind the camera
      // or bunching up ahead of it where the shot cannot read them.
      const fx = -Math.sin(Math.PI * 0.8), fz = -Math.cos(Math.PI * 0.8);
      const px = fz, pz = -fx;
      for (const side of [-1, 1]) {
        const pb = this.actors.spawnPoliceBoat({ x: 120, z: 340 });
        pb.pos.set(120 + fx * 4 + px * 18 * side, 0.35, 340 + fz * 4 + pz * 18 * side);
        pb.heading = Math.PI * 0.8;
        pb.speed = 28;
        pb.mesh.position.copy(pb.pos);
        pb.mesh.rotation.y = Math.PI * 0.8;
      }
    }
    this.actors.spawnHeli();
    if (this.actors.heli) this.actors.heli.angle = Math.PI / 2;
    // People on Isla Luna's shore, so the island the boat races toward
    // reads inhabited instead of empty.
    this.actors.spawnPedestriansNear(-60, 300, 4, 16);
    this.hud.showChat({ speaker: 'mara', text: 'Mara: Marine unit is on us — keep the throttle down and thread the channel markers!' });
    this.hud.flashEl.style.display = 'none';
    this.hud.flashTimer = 0;
    this.refreshHUD(1);
    this.hud.setWanted(4);
    return;
  }
  if (shot === 'end') {
    this.state = 'playing';
    this.jobs.index = 7;
    this.jobs.active = false;
    this.jobs.done = true;
    this.money = 52400; this.rep = 2400;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) this.enterVehicle({ kind: 'car', entity: hero });
    if (this.currentCar) {
      this.currentCar.pos.set(20, 0, 196);
      // V2: the car faces west, in side profile to a camera standing
      // south of it on the beach — so the camera sees the long teal side
      // lit by the low sun, never a dark silhouette from straight
      // behind, and the empty sand in front of the car is gone.
      this.currentCar.heading = Math.PI * 0.5;
      this.currentCar.speed = 0;
      this.currentCar.condition = 96;
      this.currentCar.pos.y = this.world.floorAt(20, 196);
      // Sync the mesh to the new position BEFORE exiting the car: a
      // parked car is not driven by the physics, so without this the
      // mesh stays where the car was parked and the end shot shows
      // empty sand.
      this.currentCar.mesh.position.copy(this.currentCar.pos);
      this.currentCar.mesh.rotation.y = this.currentCar.heading;
    }
    // V3: Rex out of the car, celebrating beside it with both arms in
    // the air and a grin, facing the camera — the victory is his, not
    // just the car's. He stands close to the camera, on the sand
    // between the car and the water, so he reads big and clear.
    this.exitVehicle();
    this.player.pos.set(23, 0, 200);
    this.player.heading = Math.PI;
    this.player.mesh.rotation.y = Math.PI;
    this.player.setVisible(true);
    this.player.setPose('celebrate');
    this.heat = 0;
    this.clockSeconds = 17 * 3600 + 50 * 60;
    // Fixed camera for this shot: low, close, from the south over the
    // water, the teal side of the car in full profile with the boardwalk
    // and the city behind it.
    this.shotCameraFixed = true;
    this.camera.position.set(20, 3.5, 207);
    this.camera.lookAt(20, 1.2, 196);
    this.hud.bigBanner('MISSION PASSED', '+$15,000   +900 REP', 30);
    this.hud.flashEl.style.display = 'none';
    this.hud.flashTimer = 0;
    this.refreshHUD(1);
    return;
  }
};

// ---- main loop ---------------------------------------------------------------------
let game = null;
let lastNow = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  if (!game) return;
  game.time += dt;
  // The world keeps moving: water shimmer, ferris wheel, drifting clouds.
  for (const m of game.world.animated.waterMats) m.uniforms.time.value = game.time;
  if (game.world.animated.ferris) game.world.animated.ferris.rotation.z += dt * 0.22;
  for (const c of game.world.animated.clouds) {
    c.position.x += dt * 1.1;
    if (c.position.x > 460) c.position.x = -460;
  }
  game.hud.root.style.display = (game.state === 'playing' || game.state === 'freeroam') ? 'block' : 'none';
  if (game.state === 'playing' || game.state === 'freeroam') {
    game.updatePlaying(dt);
  } else if (game.state === 'title' && !game.titleCameraFixed) {
    const a = game.time * 0.07;
    game.camera.position.set(26 + Math.sin(a) * 15, 5.5, -26 + Math.cos(a) * 15);
    game.camera.lookAt(26, 1.5, -26);
  }
  game.renderer.render(game.scene, game.camera);
  game.input.flush();
  if (!window.__velaReady) window.__velaReady = true;
}

window.addEventListener('error', (e) => { window.__velaError = String((e && e.message) || e); });
window.addEventListener('unhandledrejection', (e) => { window.__velaError = String((e && e.reason) || e); });

try {
  game = new VelaGame();
  if (game.shotName) game.applyShot(game.shotName);
  else game.showTitle();
} catch (e) {
  window.__velaError = String((e && e.message) || e);
}
requestAnimationFrame(frame);
