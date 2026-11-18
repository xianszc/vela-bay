// Boats on the bay, the canal and the marina: throttle and rudder, a gentle
// bob on the swell, and a wake that follows the stern. Boats are confined to
// water — the shore pushes them back, and the causeway pillars are solid.

import * as THREE from 'three';
import { clamp, damp } from './util.js';

const KMH = 3.6;

export class BoatEntity {
  constructor(def, mesh, x, z, heading) {
    this.def = def;
    this.mesh = mesh.group;
    this.length = mesh.length;
    this.width = mesh.width;
    this.pos = new THREE.Vector3(x, 0.35, z);
    this.heading = heading;
    this.speed = 0;
    this.driver = null; // 'player' | 'police' | null (moored)
    this.bobPhase = Math.random() * 10;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  get speedKmh() { return Math.abs(this.speed) * KMH; }
}

export class Boating {
  constructor(world) {
    this.world = world;
  }

  // cmd: { throttle, steer }. Returns { beached } when the shore stopped it.
  update(boat, cmd, dt, time) {
    const def = boat.def;
    const top = def.topSpeed / KMH;
    if (cmd.throttle > 0) boat.speed += def.accel * dt;
    else if (cmd.throttle < 0) boat.speed -= def.accel * 0.8 * dt;
    else boat.speed = damp(boat.speed, 0, 0.8, dt);
    if (boat.speed > top) boat.speed = damp(boat.speed, top, 2, dt);
    if (boat.speed < -top * 0.3) boat.speed = -top * 0.3;

    const turn = cmd.steer * def.turn * clamp(Math.abs(boat.speed) / 8, 0, 1) * (boat.speed >= 0 ? 1 : -1);
    boat.heading += turn * dt * 0.9;

    const fx = -Math.sin(boat.heading);
    const fz = -Math.cos(boat.heading);
    let nx = boat.pos.x + fx * boat.speed * dt;
    let nz = boat.pos.z + fz * boat.speed * dt;

    let beached = false;
    if (!this.world.isWater(nx, nz)) {
      nx = boat.pos.x; nz = boat.pos.z;
      boat.speed *= 0.35;
      beached = true;
    }
    // The causeway pillars and the bridge deck edges are solid in the bay.
    if (Math.abs(nx - (-60)) < 4.5 && nz > 186 && nz < 314 && Math.abs(nz - 250) < 64) {
      nx = boat.pos.x; nz = boat.pos.z;
      boat.speed *= 0.3;
      beached = true;
    }
    boat.pos.x = nx; boat.pos.z = nz;

    // Bob and heel on the swell.
    const bob = Math.sin(time * 1.3 + boat.bobPhase) * 0.08 + Math.sin(time * 0.7 + boat.bobPhase * 2) * 0.05;
    boat.pos.y = 0.35 + bob;
    boat.mesh.position.copy(boat.pos);
    boat.mesh.rotation.y = boat.heading;
    boat.mesh.rotation.z = clamp(-cmd.steer * 0.06 * clamp(boat.speed / 10, 0, 1), -0.1, 0.1);
    boat.mesh.rotation.x = Math.sin(time * 1.1 + boat.bobPhase) * 0.02;
    return { beached };
  }
}
