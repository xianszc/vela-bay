// Arcade car physics: accelerate, brake, steer, handbrake drift, nitro —
// tuned to feel fast on the avenues and loose enough to slide around
// corners. Collisions are circle-vs-AABB on the XZ plane against the
// world's building boxes, plus circle-vs-circle against other cars. Cars
// cannot enter the water: the shore pushes them back.

import * as THREE from 'three';
import { clamp, angleDelta, damp } from './util.js';

const KMH = 3.6; // m/s -> km/h

export class CarEntity {
  constructor(def, mesh, x, z, heading) {
    this.def = def;
    this.mesh = mesh.group;
    this.wheels = mesh.wheels;
    this.lightBar = mesh.lightBar || null;
    this.length = mesh.length;
    this.width = mesh.width;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0; // m/s, signed
    this.steer = 0;
    this.condition = 100;
    this.nitro = 100;
    this.drifting = false;
    this.driftTime = 0;
    this.slip = 0; // lateral slide velocity
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.stolen = false;
    this.flashPhase = Math.random() * 10;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  get speedKmh() { return Math.abs(this.speed) * KMH; }

  setLightBar(on, time) {
    if (!this.lightBar) return;
    const phase = Math.floor(time * 6 + this.flashPhase) % 2;
    this.lightBar.userData.red.material.emissiveIntensity = on && phase === 0 ? 3 : 0.25;
    this.lightBar.userData.blue.material.emissiveIntensity = on && phase === 1 ? 3 : 0.25;
  }
}

// Resolve a circle (x, z, r) against an AABB list. Returns the corrected x/z.
export function collideCircleAABBs(x, z, r, colliders) {
  for (const c of colliders) {
    const nx = clamp(x, c.x0, c.x1);
    const nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
      }
    }
  }
  return { x, z };
}

export class Driving {
  constructor(world) {
    this.world = world;
  }

  // Drive one car for one frame. `cmd` is { throttle, steer, handbrake, nitro }.
  // `others` are other cars to bump into. Returns events: { crashed, drifted }.
  update(car, cmd, dt, others) {
    const def = car.def;
    const events = { crashed: 0, drifted: false };
    const topSpeed = def.topSpeed / KMH * (car.nitro > 0 && cmd.nitro ? 1.28 : 1);
    const accel = def.accel * (cmd.nitro && car.nitro > 0 ? 1.5 : 1);

    // Throttle / brake / reverse.
    if (cmd.throttle > 0) {
      car.speed += accel * dt * (car.speed < 0 ? 2.2 : 1);
    } else if (cmd.throttle < 0) {
      if (car.speed > 0.5) car.speed -= def.brake * dt;
      else car.speed -= accel * 0.55 * dt;
    } else {
      car.speed = damp(car.speed, 0, 1.2, dt);
    }
    // Drag and the reverse cap.
    car.speed = damp(car.speed, 0, 0.12, dt);
    if (car.speed > topSpeed) car.speed = damp(car.speed, topSpeed, 3, dt);
    if (car.speed < -topSpeed * 0.35) car.speed = -topSpeed * 0.35;

    // Steering tightens at low speed, loosens at high speed.
    const steerTarget = cmd.steer * clamp(1.15 - Math.abs(car.speed) / (topSpeed * 1.4), 0.35, 1);
    car.steer = damp(car.steer, steerTarget, 8, dt);
    const grip = cmd.handbrake ? 0.35 : def.grip;
    const turnRate = car.steer * (1.9 * grip) * clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.heading += turnRate * dt;

    // Handbrake drift: keep some sideways slide.
    car.drifting = cmd.handbrake && Math.abs(car.speed) > 8;
    if (car.drifting) {
      car.slip = damp(car.slip, car.steer * 3.2, 4, dt);
      car.driftTime += dt;
      events.drifted = true;
    } else {
      car.slip = damp(car.slip, 0, 6, dt);
      car.driftTime = 0;
    }

    // Nitro drains while held, refills slowly.
    if (cmd.nitro && car.nitro > 0 && car.speed > 4) car.nitro = Math.max(0, car.nitro - 34 * dt);
    else car.nitro = Math.min(100, car.nitro + 5 * dt);

    // Integrate.
    const forwardX = -Math.sin(car.heading);
    const forwardZ = -Math.cos(car.heading);
    const rightX = Math.cos(car.heading);
    const rightZ = -Math.sin(car.heading);
    let nx = car.pos.x + (forwardX * car.speed + rightX * car.slip) * dt;
    let nz = car.pos.z + (forwardZ * car.speed + rightZ * car.slip) * dt;

    // Stay out of the water and off the island shore unless on the causeway
    // or on Isla Luna itself.
    if (this.world.isWater(nx, nz)) {
      const onCauseway = Math.abs(nx - (-60)) < 7 && nz > 180 && nz < 320;
      const onIsland = Math.hypot(nx - (-60), nz - 312) < 66;
      if (!onCauseway && !onIsland) {
        nx = car.pos.x; nz = car.pos.z;
        car.speed *= 0.4;
        events.crashed = Math.abs(car.speed);
      }
    }

    // Buildings.
    const fixed = collideCircleAABBs(nx, nz, 1.5, this.world.colliders);
    if (fixed.x !== nx || fixed.z !== nz) {
      const impact = Math.abs(car.speed);
      if (impact > 6) events.crashed = impact;
      car.speed *= 0.45;
      nx = fixed.x; nz = fixed.z;
    }

    // Other cars: soft push-apart.
    for (const o of others) {
      if (o === car) continue;
      const dx = nx - o.pos.x, dz = nz - o.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 2.6;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        nx += (dx / d) * push;
        nz += (dz / d) * push;
        const impact = Math.abs(car.speed - o.speed);
        if (impact > 5) events.crashed = Math.max(events.crashed, impact);
        car.speed *= 0.92;
        if (typeof o.speed === 'number' && o.driver !== 'player') o.speed *= 0.9;
      }
    }

    car.pos.x = nx; car.pos.z = nz;
    car.pos.y = this.world.groundHeightAt ? this.world.groundHeightAt(nx, nz) : 0;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    // Body roll and pitch sell the speed.
    car.mesh.rotation.z = damp(car.mesh.rotation.z || 0, -car.steer * 0.05, 6, dt);
    car.mesh.rotation.x = damp(car.mesh.rotation.x || 0, clamp(-cmd.throttle * 0.02, -0.03, 0.03), 6, dt);
    // Wheels spin and steer.
    const spin = (car.speed * dt) / 0.42;
    for (const [name, w] of Object.entries(car.wheels)) {
      w.rotation.x += spin;
      if (name === 'fl' || name === 'fr') w.rotation.y = car.steer * 0.42;
    }
    return events;
  }
}
