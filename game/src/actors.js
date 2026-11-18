// Everyone else in Vela Bay: traffic cars following their loops,
// pedestrians on the sidewalks, and the VBPD — patrol cars that chase,
// ram and block, a helicopter from 3 stars, and marine boats from 4
// stars when the player is on the water. The game reads the events this
// returns (busted, hits, police cars wrecked) to drive wanted level,
// health and missions.

import * as THREE from 'three';
import { Auto, Roadster } from './driving.js';
import { Hull, Sailing } from './boating.js';
import { buildCar, buildBoat, buildChopper, carSpec, boatSpec } from './vehicles.js';
import { buildFigure } from './player.js';
import { HEAT, TOWN } from './config.js';
import { rng32, choose, between, clampNum, turnToward } from './util.js';

const CALLSIGNS = ['EGRET', 'OSPREY', 'PELICAN', 'TERN', 'COOT', 'SANDPIPER', 'CURLEW', 'AVOCET', 'MERLIN', 'KESTREL'];
const MS_TO_KMH = 3.6;

export class Cast {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.roadster = new Roadster(world);
    this.sailing = new Sailing(world, scene);
    this.rng = rng32(TOWN.seed + 77);
    this.traffic = [];
    this.peds = [];
    this.parked = [];
    this.police = [];
    this.policeBoats = [];
    this.heli = null;
    this.rammedCount = 0;
    this.bustedTimer = 0;
    this.unitSeq = 1;
  }

  // ---- spawning -----------------------------------------------------------
  spawnParkedCars(spots) {
    const defs = [carSpec('city-sedan'), carSpec('bay-taxi'), carSpec('harbor-truck'), carSpec('sunset-coupe')];
    for (const spot of spots) {
      const spec = choose(this.rng, defs);
      const mesh = buildCar(spec);
      this.scene.add(mesh.group);
      const car = new Auto(spec, mesh, spot.x, spot.z, spot.heading);
      car.driver = null;
      this.parked.push(car);
    }
    // The hero: the teal VELA GT, parked on the avenue by the Grand Casino
    // downtown — on the road, so it is always reachable and drivable.
    const heroSpec = carSpec('teal-sport');
    const heroMesh = buildCar(heroSpec);
    this.scene.add(heroMesh.group);
    const hero = new Auto(heroSpec, heroMesh, -4, -26, Math.PI);
    hero.driver = null;
    hero.hero = true;
    this.parked.push(hero);
  }

  spawnTraffic(count) {
    const defs = [carSpec('city-sedan'), carSpec('bay-taxi'), carSpec('harbor-truck'), carSpec('sunset-coupe')];
    for (let i = 0; i < count; i++) {
      const spec = choose(this.rng, defs);
      const loop = choose(this.rng, this.world.loops);
      const pt = choose(this.rng, loop);
      const mesh = buildCar(spec);
      this.scene.add(mesh.group);
      const car = new Auto(spec, mesh, pt.x + between(this.rng, -2, 2), pt.z + between(this.rng, -2, 2), 0);
      car.driver = 'traffic';
      car.loop = loop;
      car.wp = Math.floor(this.rng() * loop.length);
      car.cruise = between(this.rng, 22, 38);
      this.traffic.push(car);
    }
  }

  spawnPedestrians(count, spots) {
    const shirts = [0xff7ab8, 0x9fd8ff, 0xffb020, 0x8fd8a8, 0xd8a0ff, 0xe8e4d8];
    const skins = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4a2a];
    for (let i = 0; i < count; i++) {
      const c = buildFigure(choose(this.rng, shirts), 0x2a2d3a, choose(this.rng, skins));
      this.scene.add(c.group);
      const spot = choose(this.rng, spots);
      const ped = {
        mesh: c.group, legs: c.legs, arms: c.arms,
        pos: c.group.position,
        heading: this.rng() * Math.PI * 2,
        speed: between(this.rng, 1.2, 2.2),
        target: { x: spot.x + between(this.rng, -14, 14), z: spot.z + between(this.rng, -14, 14) },
        phase: this.rng() * 10,
        down: 0, flee: 0,
      };
      ped.pos.set(spot.x, 0, spot.z);
      this.peds.push(ped);
    }
  }

  spawnPoliceCar(near) {
    const spec = carSpec('police-interceptor');
    const mesh = buildCar(spec);
    this.scene.add(mesh.group);
    const a = this.rng() * Math.PI * 2;
    const x = clampNum(near.x + Math.cos(a) * 65, -190, 190);
    const z = clampNum(near.z + Math.sin(a) * 65, -190, 190);
    const car = new Auto(spec, mesh, x, z, a);
    car.driver = 'police';
    car.unitName = choose(this.rng, CALLSIGNS) + '-' + (10 + this.unitSeq++);
    car.mode = 'pursuit';
    car.roadblockAt = null;
    this.police.push(car);
    return car;
  }

  spawnPoliceBoat(near) {
    const spec = boatSpec('police-boat');
    const mesh = buildBoat(spec);
    this.scene.add(mesh.group);
    const a = this.rng() * Math.PI * 2;
    const x = clampNum(near.x + Math.cos(a) * 55, -380, 380);
    const z = clampNum(near.z + Math.sin(a) * 55, 210, 410);
    const boat = new Hull(spec, mesh, x, z, a);
    boat.driver = 'police';
    boat.unitName = 'MARINE-' + (10 + this.unitSeq++);
    this.policeBoats.push(boat);
    return boat;
  }

  spawnHeli() {
    const mesh = buildChopper();
    this.scene.add(mesh.group);
    this.heli = { ...mesh, angle: 0, pos: new THREE.Vector3(0, 48, 0) };
  }

  removeEntity(list, ent) {
    const i = list.indexOf(ent);
    if (i >= 0) list.splice(i, 1);
    this.scene.remove(ent.mesh);
  }

  // ---- per-frame ----------------------------------------------------------
  // g: { playerPos, playerSpeedKmh, playerCar, playerBoat, onFoot,
  // wantedStars, inWater, time, dt }
  // Returns events for the game: { busted, playerDamage, hitPed,
  // policeWrecked }
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
      const steer = clampNum(turnToward(car.heading, wantHeading) * 1.4, -1, 1);
      const cruise = car.cruise / MS_TO_KMH;
      const throttle = car.speed < cruise ? 1 : 0;
      this.roadster.update(car, { throttle, steer, handbrake: false, nitro: false }, dt, allCars);
      car.flashLights(false, g.time);
    }

    // Pedestrians stroll, flee a fast player, fall when hit.
    for (const ped of this.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          const spot = choose(this.rng, this.world.sidewalkSpots);
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
          const spot = choose(this.rng, this.world.sidewalkSpots);
          ped.target = { x: spot.x + between(this.rng, -14, 14), z: spot.z + between(this.rng, -14, 14) };
        }
        ped.heading += turnToward(ped.heading, Math.atan2(-tx, -tz)) * Math.min(1, dt * 4);
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
    const wantCars = HEAT.carsPerStar[g.wantedStars] || 0;
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
        car.flashLights(false, g.time);
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
          car.heading += turnToward(car.heading, (g.playerHeading || 0) + Math.PI / 2) * Math.min(1, dt * 3);
        } else {
          car.mode = 'roadblock';
          steer = clampNum(turnToward(car.heading, Math.atan2(-bx, -bz)) * 1.5, -1, 1);
        }
      } else {
        car.mode = dist < 6 ? 'ramming' : 'pursuit';
        steer = clampNum(turnToward(car.heading, Math.atan2(-dx, -dz)) * 1.6, -1, 1);
        if (dist < 3 && g.playerSpeedKmh < 4) throttle = 0;
      }
      const ev = this.roadster.update(car, { throttle, steer, handbrake: false, nitro: false }, dt, allCars);
      car.flashLights(true, g.time);
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
    if (g.wantedStars >= HEAT.heliAtStar) {
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
    const wantBoats = g.wantedStars >= HEAT.boatsAtStar && g.inWater ? 2 : 0;
    while (this.policeBoats.length < wantBoats) this.spawnPoliceBoat(g.playerPos);
    while (this.policeBoats.length > wantBoats) {
      this.removeEntity(this.policeBoats, this.policeBoats[this.policeBoats.length - 1]);
    }
    for (const boat of this.policeBoats) {
      const dx = g.playerPos.x - boat.pos.x, dz = g.playerPos.z - boat.pos.z;
      const steer = clampNum(turnToward(boat.heading, Math.atan2(-dx, -dz)) * 1.4, -1, 1);
      this.sailing.update(boat, { throttle: 1, steer }, dt, g.time);
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
