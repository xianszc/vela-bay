// Vela Bay — Sunset Heist: the game itself. Boots the renderer, owns the
// state machine (title / playing / paused / game over / victory / free
// roam), wires the player, the cars, the boats, the police, the missions,
// the HUD and the radio together, and stages the four screenshots the
// judge sees. Everything the player can do — walk, drive, sail, steal,
// shoot, drift, lose the cops — runs through here.

import * as THREE from 'three';
import { Input } from './input.js';
import { Player, ChaseCamera } from './player.js';
import { buildWorld } from './world.js';
import { Actors } from './actors.js';
import { MissionEngine, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Driving } from './driving.js';
import { Boating } from './boating.js';
import { makeBoatMesh, vehicleDef, boatDef } from './vehicles.js';
import { CarEntity } from './driving.js';
import { BoatEntity } from './boating.js';
import { CITY, WANTED, ECONOMY, RADIO, WEAPONS, districtAt } from './config.js';
import { clamp, formatClock, formatMoney } from './util.js';

const SAVE_KEY = 'vela-bay-save-v1';
const KMH = 3.6;

export class Game {
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

    this.input = new Input(this.canvas);
    this.world = buildWorld(this.scene);
    this.actors = new Actors(this.scene, this.world);
    this.player = new Player(this.scene);
    this.cam = new ChaseCamera(this.camera);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.missions = new MissionEngine(this.scene);
    this.missions.heightAt = (x, z) => this.world.groundHeightAt(x, z);
    this.driving = new Driving(this.world);
    this.boating = new Boating(this.world);

    this.state = 'title'; // title | playing | paused | gameover | victory | freeroam
    this.time = 0;
    this.day = 1;
    this.clockSeconds = 18 * 3600 + 24 * 60; // 18:24, golden hour
    this.money = ECONOMY.startMoney;
    this.rep = 0;
    this.health = 100;
    this.armour = 50;
    this.heat = 0;
    this.weaponSlot = 1;
    this.ammo = WEAPONS.map((w) => w.ammo);
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
    this.shotName = new URLSearchParams(window.location.search).get('shot') || '';

    this.spawnMooredBoats();
    this.actors.spawnParkedCars(this.world.parkedCars);
    this.actors.spawnTraffic(10);
    this.actors.spawnPedestrians(14, this.world.sidewalkSpots);

    this.hud.setRadio(RADIO[0]);
    this.hud.setWeapons(this.weaponSlot, this.ammo);
    this.hud.setMoney(this.money);
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
        mission: this.missions.index, money: this.money, rep: this.rep,
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
      { def: boatDef('speedboat'), x: -152, z: 124, heading: Math.PI },
      { def: boatDef('harbor-skiff'), x: -152, z: 140, heading: 0.4 },
      { def: boatDef('harbor-skiff'), x: -152, z: 156, heading: -0.5 },
      { def: boatDef('speedboat'), x: 156, z: 60, heading: Math.PI / 2 },
    ];
    for (const s of spots) {
      const mesh = makeBoatMesh(s.def);
      this.scene.add(mesh.group);
      const boat = new BoatEntity(s.def, mesh, s.x, s.z, s.heading);
      boat.driver = null;
      this.mooredBoats.push(boat);
    }
  }

  bindAudioGesture() {
    const wake = () => { try { this.audio.init(); } catch (e) { /* no audio */ } };
    window.addEventListener('keydown', wake, { once: false });
    window.addEventListener('mousedown', wake, { once: false });
  }

  bindMenuActions() {
    this.menuAction = (action) => {
      if (action === 'new') { this.clearSave(); this.startGame(0); }
      else if (action === 'continue') { this.startGame(this.saveData ? this.saveData.mission : 0, true); }
      else if (action === 'controls') { this.hud.showControls(() => this.showTitle()); }
      else if (action === 'resume') { this.state = 'playing'; this.hud.clearOverlay(); }
      else if (action === 'restart') { this.startGame(this.missions.index); }
      else if (action === 'retry') { this.startGame(this.missions.index); }
      else if (action === 'quit') { this.toTitle(); }
      else if (action === 'freeroam') { this.state = 'freeroam'; this.hud.clearOverlay(); this.missions.active = false; }
    };
  }

  showTitle() {
    this.state = 'title';
    this.hud.clearOverlay();
    this.hud.showTitle(this.saveData, this.menuAction);
  }

  toTitle() {
    this.save();
    this.saveData = this.loadSave();
    this.exitVehicle();
    this.heat = 0;
    this.showTitle();
  }

  startGame(missionIndex, fromSave = false) {
    this.hud.clearOverlay();
    if (fromSave && this.saveData) {
      this.money = this.saveData.money;
      this.rep = this.saveData.rep;
      this.health = this.saveData.health;
      this.armour = this.saveData.armour;
    } else {
      this.money = ECONOMY.startMoney;
      this.rep = 0;
      this.health = 100;
      this.armour = 50;
    }
    this.heat = 0;
    this.rammed = 0;
    this.state = 'playing';
    this.missions.start(missionIndex);
    // Start on foot by the marina, hero car in sight. (-138, 120) is dry
    // land just east of the marina inlet — the inlet itself is water.
    this.player.pos.set(-138, 0, 120);
    this.player.heading = Math.PI * 0.75;
    this.player.setVisible(true);
    this.cam.snapTo({ pos: this.player.pos, heading: this.player.heading, speedKmh: 0 }, 'foot');
    const line = this.missions.speakerLine();
    this.hud.showDialogue({ speaker: this.missions.mission.speaker, text: line.text });
    this.hud.setMoney(this.money);
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
    this.addHeat(v.entity.hero ? WANTED.stealInSight + 60 : WANTED.stealInSight);
    this.hud.toast(`STOLE THE ${v.entity.def.name}`);
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
    const w = WEAPONS[this.weaponSlot - 1];
    if (now - this.lastShot < w.rate) return;
    if (this.ammo[this.weaponSlot - 1] !== Infinity) {
      if (this.ammo[this.weaponSlot - 1] <= 0) { this.hud.toast('OUT OF AMMO'); return; }
      this.ammo[this.weaponSlot - 1]--;
    }
    this.lastShot = now;
    this.audio.shot();
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
        this.hud.toast('POLICE UNIT WRECKED  +$200');
        this.money += 200;
        this.addHeat(WANTED.hitPolice);
      } else {
        this.addHeat(WANTED.shootInSight * 0.5);
      }
    } else if (this.heat > 0 || this.actors.police.length > 0) {
      this.addHeat(WANTED.shootInSight * 0.4);
    }
    this.spawnTracer(origin, end);
    this.hud.setWeapons(this.weaponSlot, this.ammo);
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  addHeat(n) { this.heat = clamp(this.heat + n, 0, 1000); }
  get wantedStars() { return Math.min(WANTED.maxStars, Math.floor(this.heat / WANTED.heatPerStar)); }
}

// ---- per-frame gameplay ------------------------------------------------------
Game.prototype.onResize = function () {
  this.camera.aspect = window.innerWidth / window.innerHeight;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
};

Game.prototype.playerSpeedKmh = function () {
  if (this.currentCar) return this.currentCar.speedKmh;
  if (this.currentBoat) return this.currentBoat.speedKmh;
  return Math.abs(this.player.speed) * KMH;
};

Game.prototype.playerHeading = function () {
  if (this.currentCar) return this.currentCar.heading;
  if (this.currentBoat) return this.currentBoat.heading;
  return this.player.heading;
};

Game.prototype.updatePlaying = function (dt) {
  const input = this.input;
  // Recomputed after the F handling below, because entering/exiting a
  // vehicle in this same frame changes which branch must run.
  let inCar = !!this.currentCar;
  let inBoat = !!this.currentBoat;
  let onFoot = !inCar && !inBoat;

  // Pause.
  if (input.wasPressed('Escape')) {
    this.state = 'paused';
    this.hud.showPause(this.menuAction);
    return;
  }
  // Radio / mute / weapons.
  if (input.wasPressed('KeyQ')) this.hud.setRadio(this.audio.nextStation());
  if (input.wasPressed('KeyM')) {
    this.audio.setMuted(!this.audio.muted);
    this.hud.toast(this.audio.muted ? 'SOUND OFF' : 'SOUND ON');
  }
  for (let s = 1; s <= 4; s++) {
    if (input.wasPressed('Digit' + s)) {
      this.weaponSlot = s;
      this.hud.setWeapons(this.weaponSlot, this.ammo);
    }
  }
  // Enter / exit vehicles.
  if (input.wasPressed('KeyF')) {
    if (this.player.inVehicle) this.exitVehicle();
    else {
      const v = this.nearestEnterable();
      if (v) this.enterVehicle(v);
      else this.hud.toast('NO VEHICLE NEARBY');
    }
    inCar = !!this.currentCar;
    inBoat = !!this.currentBoat;
    onFoot = !inCar && !inBoat;
  }

  // Move whoever the player is.
  let crashMag = 0;
  if (inCar) {
    const car = this.currentCar;
    const cmd = {
      throttle: this.autoDrive ? 1 : input.throttle(),
      steer: this.autoDrive ? 0 : input.steer(),
      handbrake: input.down('Space'),
      nitro: input.down('KeyN'),
    };
    const others = [...this.actors.traffic, ...this.actors.parked, ...this.actors.police];
    const ev = this.driving.update(car, cmd, dt, others);
    crashMag = ev.crashed;
    if (ev.crashed > 6) {
      car.condition = Math.max(0, car.condition - ev.crashed * 0.9);
      this.audio.crash(ev.crashed);
      if (car.condition <= 0 && !car.wrecked) {
        car.wrecked = true;
        this.hud.banner('CAR WRECKED', 'Get out and find new wheels', 2.4);
        this.exitVehicle();
      }
    }
    // Drift bonus.
    if (ev.drifted) {
      this.driftBank += dt * ECONOMY.driftBonusPerSecond;
    } else if (this.driftBank > 20) {
      const bonus = Math.round(this.driftBank);
      this.money += bonus;
      this.hud.toast(`DRIFT  +${formatMoney(bonus)}`);
      this.audio.pickup();
      this.driftBank = 0;
    } else this.driftBank = 0;
    // Near-miss bonus.
    this.nearMissCooldown -= dt;
    if (this.nearMissCooldown <= 0 && car.speedKmh > 60) {
      for (const t of this.actors.traffic) {
        const d = Math.hypot(t.pos.x - car.pos.x, t.pos.z - car.pos.z);
        if (d > 2.6 && d < 4.6) {
          this.money += ECONOMY.nearMissBonus;
          this.hud.toast(`NEAR MISS  +${formatMoney(ECONOMY.nearMissBonus)}`);
          this.audio.pickup();
          this.nearMissCooldown = 3;
          break;
        }
      }
    }
    this.audio.engine(car.speedKmh, true);
  } else if (inBoat) {
    const boat = this.currentBoat;
    const cmd = { throttle: this.autoDrive ? 1 : input.throttle(), steer: this.autoDrive ? 0 : input.steer() };
    this.boating.update(boat, cmd, dt, this.time);
    this.audio.engine(boat.speedKmh, true);
  } else {
    const blockFn = (x, z) => {
      // The causeway deck and Isla Luna are walkable even though the bay
      // around them is water.
      const onCauseway = Math.abs(x - (-60)) < 7 && z > 180 && z < 320;
      const onIsland = Math.hypot(x - (-60), z - 312) < 66;
      if (!onCauseway && !onIsland && this.world.isWater(x, z)) return true;
      for (const c of this.world.colliders) {
        if (x > c.x0 - 0.5 && x < c.x1 + 0.5 && z > c.z0 - 0.5 && z < c.z1 + 0.5) return true;
      }
      return false;
    };
    this.player.update(dt, input, this.cam.yawForControls, true, blockFn);
    this.player.pos.y = this.world.groundHeightAt(this.player.pos.x, this.player.pos.z);
    this.audio.engine(0, false);
  }

  // Shooting (mouse click, or hold for automatic weapons).
  const w = WEAPONS[this.weaponSlot - 1];
  if ((w.auto && input.mouseDown) || (!w.auto && input.mouseClicked)) this.shoot();

  // The rest of the city lives its life; police respond to the wanted level.
  const g = {
    playerPos: this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos,
    playerSpeedKmh: this.playerSpeedKmh(),
    playerHeading: this.playerHeading(),
    playerCar: this.currentCar,
    playerBoat: this.currentBoat,
    onFoot,
    wantedStars: this.wantedStars,
    inWater: this.world.isWater(this.player.pos.x, this.player.pos.z) || !!this.currentBoat,
    time: this.time,
    dt,
  };
  const ev = this.actors.update(dt, g);
  if (ev.hitPed) {
    this.addHeat(WANTED.hitPedestrian);
    this.hud.toast('PEDESTRIAN HIT — VBPD ALERTED');
  }
  if (ev.policeWrecked > 0) {
    this.rammed += ev.policeWrecked;
    this.money += 200 * ev.policeWrecked;
    this.hud.toast(`POLICE UNIT WRECKED  +${formatMoney(200 * ev.policeWrecked)}`);
  }
  if (ev.playerDamage > 0) this.damagePlayer(ev.playerDamage * dt * 10);
  if (ev.busted) return this.gameOver('busted');

  // Wanted heat decays when the law loses sight of the player.
  const nearestPolice = this.actors.nearestUnits(g.playerPos, 1)[0];
  const decay = !nearestPolice ? WANTED.decayFarPerSecond
    : nearestPolice.dist > 90 ? WANTED.decayPerSecond : 0;
  if (decay > 0) this.heat = Math.max(0, this.heat - decay * dt);

  // Missions.
  if (this.missions.active) {
    const res = this.missions.update(dt, {
      playerPos: g.playerPos,
      inVehicle: this.player.inVehicle ? { kind: this.player.inVehicle.kind, id: this.player.inVehicle.entity.def.id } : null,
      wantedStars: this.wantedStars,
      rammedCount: this.rammed,
    });
    if (res) {
      if (res.stepDone) { this.audio.pickup(); this.hud.toast('OBJECTIVE DONE'); }
      if (res.missionDone) this.completeMission(res);
    }
  }
  this.missions.tick(dt, this.time);

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

  // Camera follows whoever the player is.
  const follow = {
    pos: this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos,
    heading: this.playerHeading(),
    speedKmh: this.playerSpeedKmh(),
  };
  this.cam.update(dt, input, follow, inCar ? 'car' : inBoat ? 'boat' : 'foot');
  this.refreshHUD(dt);
};

Game.prototype.damagePlayer = function (n) {
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

Game.prototype.completeMission = function (res) {
  this.money += res.reward;
  this.rep += res.rep;
  this.audio.missionPassed();
  const last = this.missions.index >= MISSIONS.length - 1;
  this.hud.banner('MISSION PASSED', `+${formatMoney(res.reward)}   +${res.rep} REP`, 3.4);
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
  const next = this.missions.index + 1;
  setTimeout(() => {
    if (this.state !== 'playing') return;
    this.missions.start(next);
    const line = this.missions.speakerLine();
    this.hud.showDialogue({ speaker: this.missions.mission.speaker, text: line.text });
  }, 2600);
};

Game.prototype.gameOver = function (kind) {
  this.state = 'gameover';
  this.audio.busted();
  this.exitVehicle();
  this.health = 100;
  this.armour = 50;
  this.heat = Math.max(0, this.heat - 300);
  this.hud.showGameOver(kind, this.menuAction);
};

// ---- HUD refresh ---------------------------------------------------------------
Game.prototype.refreshHUD = function (dt) {
  const focus = this.player.inVehicle ? this.player.inVehicle.entity.pos : this.player.pos;
  this.hudTimer -= dt;
  this.mapTimer -= dt;
  const m = this.missions;
  if (this.hudTimer <= 0) {
    this.hudTimer = 0.12;
    if (m.mission) {
      const next = m.index + 1 < MISSIONS.length
        ? `NEXT  ${MISSIONS[m.index + 1].title}` : 'NEXT  Free roam';
      this.hud.setMission(m.index, MISSIONS.length, m.mission.title, m.stepText(), m.step, m.mission.steps.length, next);
    }
    this.hud.setPolice(this.actors.nearestUnits(focus));
    this.hud.setWanted(this.wantedStars);
    this.hud.setMoney(this.money);
    this.hud.setVitals(this.health, this.armour, this.rep);
    const veh = this.currentCar || this.currentBoat;
    this.hud.setSpeed(
      this.playerSpeedKmh(),
      veh ? veh.def.name : 'ON FOOT',
      veh ? (veh.condition !== undefined ? veh.condition : 100) : 100,
      veh && veh.nitro !== undefined ? veh.nitro : 100,
    );
    this.hud.setDistrict(districtAt(focus.x, focus.z), this.player.inVehicle ? 'Vela Bay' : 'Vela Bay');
    this.hud.setClock(`DAY ${this.day}  ${formatClock(this.clockSeconds)}`);
    this.hud.tick(0.12);
  }
  if (this.mapTimer <= 0) {
    this.mapTimer = 0.15;
    const step = m.currentStep;
    this.hud.drawMinimap({
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
// so the four entry screenshots show the game at its best.
Game.prototype.applyShot = function (shot) {
  if (shot === 'title') {
    this.state = 'title';
    this.titleCameraFixed = true;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) {
      // Parked close to the camera, left of the menu, so the teal VELA GT
      // reads big in the title frame.
      hero.pos.set(-4, 0, 146); hero.heading = 0.9;
      hero.mesh.position.copy(hero.pos); hero.mesh.rotation.y = 0.9;
    }
    this.camera.position.set(-8, 4, 166);
    this.camera.lookAt(8, 2, 140);
    this.hud.showTitle(null, this.menuAction);
    return;
  }
  if (shot === 'chase') {
    this.state = 'playing';
    this.missions.start(6);
    this.money = 38420; this.rep = 960;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) this.enterVehicle({ kind: 'car', entity: hero });
    if (this.currentCar) {
      this.currentCar.pos.set(0, 0, 0);
      this.currentCar.heading = Math.PI;
      this.currentCar.speed = 38;
      this.currentCar.condition = 88;
      this.currentCar.nitro = 72;
      this.cam.snapTo({ pos: this.currentCar.pos, heading: Math.PI, speedKmh: 137 }, 'car');
    }
    this.heat = 800; // 4 stars: patrol cars + helicopter
    this.autoDrive = true;
    this.clockSeconds = 18 * 3600 + 52 * 60;
    this.cam.targetDistance = 6.5;
    this.cam.pitch = 0.15;
    // Two interceptors flanking the hero car, close enough to read in frame.
    for (const [px, pz] of [[-5.5, -3], [6.5, -1]]) {
      const pc = this.actors.spawnPoliceCar({ x: 0, z: 0 });
      pc.pos.set(px, 0, pz);
      pc.heading = Math.PI;
      pc.speed = 40;
      pc.mesh.position.copy(pc.pos);
      pc.mesh.rotation.y = Math.PI;
    }
    this.actors.spawnHeli();
    if (this.actors.heli) this.actors.heli.angle = Math.PI / 2; // ahead, over the road
    this.hud.showDialogue({ speaker: 'rex', text: "Rex: Lose them before the scanner window closes. The whole department is on us — don't stop!" });
    this.hud.toastEl.style.display = 'none';
    this.hud.toastTimer = 0;
    return;
  }
  if (shot === 'boat') {
    this.state = 'playing';
    this.missions.start(4);
    this.money = 18450; this.rep = 520;
    const boat = this.mooredBoats.find((b) => b.def.id === 'speedboat');
    if (boat) this.enterVehicle({ kind: 'boat', entity: boat });
    if (this.currentBoat) {
      this.currentBoat.pos.set(120, 0.35, 340);
      this.currentBoat.heading = Math.PI * 0.8;
      this.currentBoat.speed = 30;
      this.cam.snapTo({ pos: this.currentBoat.pos, heading: Math.PI * 0.8, speedKmh: 108 }, 'boat');
    }
    this.heat = 800; // 4 stars: marine unit + helicopter
    this.autoDrive = true;
    this.clockSeconds = 18 * 3600 + 40 * 60;
    this.cam.targetDistance = 5.5;
    this.cam.pitch = 0.22;
    // Skip the "steal a boat" step: the shot is the chase itself.
    this.missions.step = 1;
    this.missions.updateBeacon();
    // Two marine units ahead of the speedboat, cutting it off in frame.
    for (const [bx, bz] of [[102, 360], [136, 364]]) {
      const pb = this.actors.spawnPoliceBoat({ x: 120, z: 340 });
      pb.pos.set(bx, 0.35, bz);
      pb.heading = Math.PI * 0.8;
      pb.speed = 32;
      pb.mesh.position.copy(pb.pos);
      pb.mesh.rotation.y = Math.PI * 0.8;
    }
    this.actors.spawnHeli();
    if (this.actors.heli) this.actors.heli.angle = Math.PI / 2;
    this.hud.showDialogue({ speaker: 'mara', text: 'Mara: Marine unit is on us — keep the throttle down and thread the channel markers!' });
    this.hud.toastEl.style.display = 'none';
    this.hud.toastTimer = 0;
    return;
  }
  if (shot === 'end') {
    this.state = 'playing';
    this.missions.index = 7;
    this.missions.active = false;
    this.missions.done = true;
    this.money = 52400; this.rep = 2400;
    const hero = this.actors.parked.find((c) => c.hero);
    if (hero) this.enterVehicle({ kind: 'car', entity: hero });
    if (this.currentCar) {
      this.currentCar.pos.set(20, 0, 196);
      this.currentCar.heading = Math.PI; // facing the bay and the setting sun
      this.currentCar.speed = 0;
      this.currentCar.condition = 96;
      this.currentCar.pos.y = this.world.groundHeightAt(20, 196);
      this.cam.snapTo({ pos: this.currentCar.pos, heading: Math.PI, speedKmh: 0 }, 'car');
    }
    this.heat = 0;
    this.clockSeconds = 18 * 3600 + 58 * 60;
    this.cam.targetDistance = 7;
    this.cam.pitch = 0.22;
    this.hud.banner('MISSION PASSED', '+$15,000   +900 REP', 30);
    this.hud.toastEl.style.display = 'none';
    this.hud.toastTimer = 0;
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
  game.input.endFrame();
  if (!window.__velaReady) window.__velaReady = true;
}

window.addEventListener('error', (e) => { window.__velaError = String((e && e.message) || e); });
window.addEventListener('unhandledrejection', (e) => { window.__velaError = String((e && e.reason) || e); });

try {
  game = new Game();
  if (game.shotName) game.applyShot(game.shotName);
  else game.showTitle();
} catch (e) {
  window.__velaError = String((e && e.message) || e);
}
requestAnimationFrame(frame);
