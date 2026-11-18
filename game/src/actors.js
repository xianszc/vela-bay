// Everyone else in Vela Bay: traffic cars following their loops, pedestrians
// on the sidewalks, and the VBPD — patrol cars that chase, ram and block,
// a helicopter from 3 stars, and marine boats from 4 stars when the player
// is on the water. The game reads the events this returns (busted, hits,
// police cars wrecked) to drive wanted level, health and missions.

import * as THREE from 'three';
import { CarEntity, Driving } from './driving.js';
import { BoatEntity, Boating } from './boating.js';
import { makeCarMesh, makeBoatMesh, makeHelicopterMesh, vehicleDef, boatDef } from './vehicles.js';
import { makeCharacterMesh } from './player.js';
import { VEHICLES, BOATS, WANTED, CITY } from './config.js';
import { mulberry32, pick, range, clamp, angleDelta } from './util.js';

const UNIT_NAMES = ['IBIS', 'TARPON', 'HERON', 'KESTREL', 'MARLIN', 'GULL', 'SNAPPER', 'OSPREY', 'FALCON', 'DOLPHIN'];
const KMH = 3.6;

export class Actors {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.driving = new Driving(world);
    this.boating = new Boating(world);
    this.rng = mulberry32(CITY.seed + 77);
    this.traffic = [];
    this.peds = [];
    this.parked = [];
    this.police = [];
    this.policeBoats = [];
    this.heli = null;
    this.rammedCount = 0;
    this.bustedTimer = 0;
    this.unitSeq = 1;
    this.smoke = [];
  }

  // ---- spawning -----------------------------------------------------------
  spawnParkedCars(parkedSpots) {
    const defs = [vehicleDef('city-sedan'), vehicleDef('bay-taxi'), vehicleDef('harbor-truck'), vehicleDef('sunset-coupe')];
    for (const spot of parkedSpots) {
      const def = pick(this.rng, defs);
      const mesh = makeCarMesh(def);
      this.scene.add(mesh.group);
      const car = new CarEntity(def, mesh, spot.x, spot.z, spot.heading);
      car.driver = null;
      this.parked.push(car);
    }
    // The hero: the teal VELA GT, parked on the avenue by the Grand Casino
    // downtown — on the road, so it is always reachable and drivable.
    const heroDef = vehicleDef('teal-sport');
    const heroMesh = makeCarMesh(heroDef);
    this.scene.add(heroMesh.group);
    const hero = new CarEntity(heroDef, heroMesh, -4, -26, Math.PI);
    hero.driver = null;
    hero.hero = true;
    this.parked.push(hero);
  }

  spawnTraffic(count) {
    const defs = [vehicleDef('city-sedan'), vehicleDef('bay-taxi'), vehicleDef('harbor-truck'), vehicleDef('sunset-coupe')];
    for (let i = 0; i < count; i++) {
      const def = pick(this.rng, defs);
      const loop = pick(this.rng, this.world.loops);
      const pt = pick(this.rng, loop);
      const mesh = makeCarMesh(def);
      this.scene.add(mesh.group);
      const car = new CarEntity(def, mesh, pt.x + range(this.rng, -2, 2), pt.z + range(this.rng, -2, 2), 0);
      car.driver = 'traffic';
      car.loop = loop;
      car.wp = Math.floor(this.rng() * loop.length);
      car.cruise = range(this.rng, 22, 38);
      this.traffic.push(car);
    }
  }

  spawnPedestrians(count, spots) {
    const shirts = [0xff7ab8, 0x9fd8ff, 0xffb020, 0x8fd8a8, 0xd8a0ff, 0xe8e4d8];
    const skins = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4a2a];
    for (let i = 0; i < count; i++) {
      const c = makeCharacterMesh(pick(this.rng, shirts), 0x2a2d3a, pick(this.rng, skins));
      this.scene.add(c.group);
      const spot = pick(this.rng, spots);
      const ped = {
        mesh: c.group, legs: c.legs, arms: c.arms,
        pos: c.group.position,
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.2, 2.2),
        target: { x: spot.x + range(this.rng, -14, 14), z: spot.z + range(this.rng, -14, 14) },
        phase: this.rng() * 10,
        down: 0, flee: 0,
      };
      ped.pos.set(spot.x, 0, spot.z);
      this.peds.push(ped);
    }
  }

  spawnPoliceCar(near) {
    const def = vehicleDef('police-interceptor');
    const mesh = makeCarMesh(def);
    this.scene.add(mesh.group);
    const a = this.rng() * Math.PI * 2;
    const x = clamp(near.x + Math.cos(a) * 65, -190, 190);
    const z = clamp(near.z + Math.sin(a) * 65, -190, 190);
    const car = new CarEntity(def, mesh, x, z, a);
    car.driver = 'police';
    car.unitName = pick(this.rng, UNIT_NAMES) + '-' + (10 + this.unitSeq++);
    car.mode = 'pursuit';
    car.roadblockAt = null;
    this.police.push(car);
    return car;
  }

  spawnPoliceBoat(near) {
    const def = boatDef('police-boat');
    const mesh = makeBoatMesh(def);
    this.scene.add(mesh.group);
    const a = this.rng() * Math.PI * 2;
    const x = clamp(near.x + Math.cos(a) * 55, -380, 380);
    const z = clamp(near.z + Math.sin(a) * 55, 210, 410);
    const boat = new BoatEntity(def, mesh, x, z, a);
    boat.driver = 'police';
    boat.unitName = 'MARINE-' + (10 + this.unitSeq++);
    this.policeBoats.push(boat);
    return boat;
  }

  spawnHeli() {
    const mesh = makeHelicopterMesh();
    this.scene.add(mesh.group);
    this.heli = { ...mesh, angle: 0, pos: new THREE.Vector3(0, 48, 0) };
  }

  removeEntity(list, ent) {
    const i = list.indexOf(ent);
    if (i >= 0) list.splice(i, 1);
    this.scene.remove(ent.mesh);
  }

  // ---- per-frame ----------------------------------------------------------
  // g: { playerPos, playerSpeedKmh, playerCar, playerBoat, onFoot, wantedStars, inWater, time, dt }
  // Returns events for the game: { busted, playerDamage, hitPed, policeWrecked }
  update(dt, g) {
    const events = { busted: false, playerDamage: 0, hitPed: false, policeWrecked: 0 };
    const allCars = [...this.traffic, ...this.parked, ...this.police];
    if (g.playerCar) allCars.push(g.playerCar);

    // Traffic follows its loop.
    for (const car of this.traffic) {
      const target = car.loop[car.wp];
      const dx = target.x - car.pos.x, dz = target.z - car.pos.z;
      if (Math.hypot(dx, dz) < 6) { car.wp = (car.wp + 1) % car.loop.length; continue; }
      const wantHeading = Math.atan2(-dx, -dz);
      const steer = clamp(angleDelta(car.heading, wantHeading) * 1.4, -1, 1);
      const cruise = car.cruise / KMH;
      const throttle = car.speed < cruise ? 1 : 0;
      this.driving.update(car, { throttle, steer, handbrake: false, nitro: false }, dt, allCars);
      car.setLightBar(false, g.time);
    }

    // Pedestrians stroll, flee a fast player, fall when hit.
    for (const ped of this.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          const spot = pick(this.rng, this.world.sidewalkSpots);
          ped.pos.set(spot.x, 0, spot.z);
        }
        continue;
      }
      const dx = g.playerPos.x - ped.pos.x, dz = g.playerPos.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      const danger = dist < 9 && g.playerSpeedKmh > 12;
      if (danger) ped.flee = 1.2;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.heading = Math.atan2(-dx, -dz) + Math.PI;
        ped.speed = 4.2;
      } else {
        const tx = ped.target.x - ped.pos.x, tz = ped.target.z - ped.pos.z;
        if (Math.hypot(tx, tz) < 2) {
          const spot = pick(this.rng, this.world.sidewalkSpots);
          ped.target = { x: spot.x + range(this.rng, -14, 14), z: spot.z + range(this.rng, -14, 14) };
        }
        ped.heading += angleDelta(ped.heading, Math.atan2(-tx, -tz)) * Math.min(1, dt * 4);
        ped.speed = 1.6;
      }
      ped.pos.x += -Math.sin(ped.heading) * ped.speed * dt;
      ped.pos.z += -Math.cos(ped.heading) * ped.speed * dt;
      ped.mesh.rotation.y = ped.heading;
      ped.phase += ped.speed * dt * 2.4;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.legs.left.rotation.x = swing;
      ped.legs.right.rotation.x = -swing;
      ped.arms.left.rotation.x = -swing * 0.8;
      ped.arms.right.rotation.x = swing * 0.8;
      // Hit by the player's car?
      if (g.playerCar && dist < 2.3 && g.playerSpeedKmh > 9) {
        ped.down = 4;
        ped.mesh.rotation.x = Math.PI / 2 - 0.2;
        events.hitPed = true;
      }
    }

    // ---- police ------------------------------------------------------------
    const wantCars = WANTED.policeCarsPerStar[g.wantedStars] || 0;
    while (this.police.length < wantCars) this.spawnPoliceCar(g.playerPos);
    while (this.police.length > wantCars) {
      const far = this.police.reduce((a, b) => {
        const da = Math.hypot(a.pos.x - g.playerPos.x, a.pos.z - g.playerPos.z);
        const db = Math.hypot(b.pos.x - g.playerPos.x, b.pos.z - g.playerPos.z);
        return da > db ? a : b;
      });
      this.removeEntity(this.police, far);
    }
    const roadblock = g.wantedStars >= 4 && this.police.length > 0;
    for (let i = 0; i < this.police.length; i++) {
      const car = this.police[i];
      if (car.condition <= 0) {
        car.disabledTimer = (car.disabledTimer || 0) + dt;
        car.setLightBar(false, g.time);
        if (car.disabledTimer > 12) this.removeEntity(this.police, car);
        continue;
      }
      const dx = g.playerPos.x - car.pos.x, dz = g.playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      let steer = 0, throttle = 1;
      if (roadblock && i === 0 && dist > 18) {
        // First unit sets a roadblock ahead of the player.
        const aheadX = g.playerPos.x - Math.sin(g.playerHeading || 0) * 26;
        const aheadZ = g.playerPos.z - Math.cos(g.playerHeading || 0) * 26;
        const bx = aheadX - car.pos.x, bz = aheadZ - car.pos.z;
        const bd = Math.hypot(bx, bz);
        if (bd < 5) {
          car.mode = 'roadblock';
          throttle = 0;
          car.speed = 0;
          car.heading += angleDelta(car.heading, (g.playerHeading || 0) + Math.PI / 2) * Math.min(1, dt * 3);
        } else {
          car.mode = 'roadblock';
          steer = clamp(angleDelta(car.heading, Math.atan2(-bx, -bz)) * 1.5, -1, 1);
        }
      } else {
        car.mode = dist < 6 ? 'ramming' : 'pursuit';
        steer = clamp(angleDelta(car.heading, Math.atan2(-dx, -dz)) * 1.6, -1, 1);
        if (dist < 3 && g.playerSpeedKmh < 4) throttle = 0;
      }
      const ev = this.driving.update(car, { throttle, steer, handbrake: false, nitro: false }, dt, allCars);
      car.setLightBar(true, g.time);
      if (ev.crashed > 12) {
        car.condition -= ev.crashed * 1.4;
        if (car.condition <= 0) {
          car.condition = 0;
          this.rammedCount++;
          events.policeWrecked++;
        }
      }
      // Ram the player: damage on contact at speed.
      if (g.playerCar && dist < 3.4 && car.speed > 6) {
        g.playerCar.condition = Math.max(0, g.playerCar.condition - car.speed * 0.12);
        events.playerDamage += car.speed * 0.1;
      } else if (g.onFoot && dist < 2.2 && car.speed > 3) {
        events.playerDamage += 14 * dt * 4;
      }
    }

    // Helicopter from 3 stars.
    if (g.wantedStars >= WANTED.heliFromStar) {
      if (!this.heli) this.spawnHeli();
      const h = this.heli;
      h.angle += dt * 0.35;
      h.pos.set(
        g.playerPos.x + Math.cos(h.angle) * 70,
        34 + Math.sin(g.time * 0.6) * 2,
        g.playerPos.z + Math.sin(h.angle) * 70,
      );
      h.group.position.copy(h.pos);
      h.group.rotation.y = Math.atan2(g.playerPos.x - h.pos.x, g.playerPos.z - h.pos.z) + Math.PI;
      h.rotor.rotation.y += dt * 22;
      h.tailRotor.rotation.x += dt * 18;
      h.spot.target.position.set(g.playerPos.x - h.pos.x, -34, g.playerPos.z - h.pos.z);
      h.spot.target.updateMatrixWorld();
    } else if (this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }

    // Police boats from 4 stars while the player is in or near the water.
    const wantBoats = g.wantedStars >= WANTED.boatsFromStar && g.inWater ? 2 : 0;
    while (this.policeBoats.length < wantBoats) this.spawnPoliceBoat(g.playerPos);
    while (this.policeBoats.length > wantBoats) {
      this.removeEntity(this.policeBoats, this.policeBoats[this.policeBoats.length - 1]);
    }
    for (const boat of this.policeBoats) {
      const dx = g.playerPos.x - boat.pos.x, dz = g.playerPos.z - boat.pos.z;
      const steer = clamp(angleDelta(boat.heading, Math.atan2(-dx, -dz)) * 1.4, -1, 1);
      this.boating.update(boat, { throttle: 1, steer }, dt, g.time);
    }

    // Busted: a police unit sits on the player while the player is slow.
    let nearest = Infinity;
    for (const car of this.police) {
      nearest = Math.min(nearest, Math.hypot(car.pos.x - g.playerPos.x, car.pos.z - g.playerPos.z));
    }
    if (g.wantedStars > 0 && nearest < 4.5 && g.playerSpeedKmh < 5) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.6) events.busted = true;
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return events;
  }

  // Nearest police units for the HUD response list.
  nearestUnits(playerPos, max = 5) {
    const list = [];
    for (const car of this.police) {
      if (car.condition <= 0) continue;
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      list.push({ name: car.unitName, dist: d, tactic: car.mode === 'roadblock' ? 'ROADBLOCK' : car.mode === 'ramming' ? 'RAMMING' : 'PURSUIT' });
    }
    if (this.heli) {
      list.push({ name: 'HELI-1', dist: Math.hypot(this.heli.pos.x - playerPos.x, this.heli.pos.z - playerPos.z), tactic: 'SPOTLIGHT' });
    }
    for (const boat of this.policeBoats) {
      const d = Math.hypot(boat.pos.x - playerPos.x, boat.pos.z - playerPos.z);
      list.push({ name: boat.unitName, dist: d, tactic: 'PURSUIT' });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, max);
  }

  damagePoliceAt(pos, range, dmg) {
    // Returns the police car hit (if any) within range of a shot point.
    let best = null, bestD = Infinity;
    for (const car of this.police) {
      if (car.condition <= 0) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < range && d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      best.condition -= dmg;
      if (best.condition <= 0) {
        best.condition = 0;
        this.rammedCount++;
        return { wrecked: true, car: best };
      }
      return { hit: true, car: best };
    }
    return null;
  }
}
