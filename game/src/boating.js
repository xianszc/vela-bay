// Boats on the bay, the canal and the marina: throttle and rudder, a
// gentle bob on the swell, and a white wake that trails the stern at
// speed. Boats are confined to water — the shore pushes them back, and
// the causeway pillars are solid.

import * as THREE from 'three';
import { clampNum, easeTo } from './util.js';

const MS_TO_KMH = 3.6;

export class Hull {
  constructor(spec, mesh, x, z, heading) {
    this.spec = spec;
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

  get speedKmh() { return Math.abs(this.speed) * MS_TO_KMH; }
}

export class Sailing {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.wakePool = [];
    this.wakeTimer = 0;
    // A small pool of flat white foam puffs, recycled as the wake trail.
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 42; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xeaf6ff, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.wakePool.push({ mesh: m, life: 0, max: 1 });
    }
  }

  dropWake(x, z, big) {
    const puff = this.wakePool.find((p) => p.life <= 0);
    if (!puff) return;
    puff.life = puff.max = big ? 1.5 : 0.9;
    puff.mesh.visible = true;
    puff.mesh.position.set(x + (Math.random() - 0.5) * 1.2, 0.42, z + (Math.random() - 0.5) * 1.2);
    const s = big ? 2.6 + Math.random() * 1.4 : 1.4 + Math.random() * 0.9;
    puff.mesh.scale.set(s, s * 0.7, 1);
    puff.mesh.rotation.z = Math.random() * Math.PI;
  }

  tickWake(dt) {
    for (const p of this.wakePool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.mesh.material.opacity = k * 0.55;
      const s = p.mesh.scale.x * (1 + dt * 0.8);
      p.mesh.scale.set(s, s * 0.7, 1);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }

  // cmd: { throttle, steer }. Returns { beached } when the shore stopped it.
  update(boat, cmd, dt, time) {
    const spec = boat.spec;
    const top = spec.topSpeed / MS_TO_KMH;
    // Throttle only below the top speed, so the top speed is a real cap —
    // not an asymptote the boat can sit well above.
    if (cmd.throttle > 0 && boat.speed < top) boat.speed += spec.accel * dt;
    else if (cmd.throttle < 0) boat.speed -= spec.accel * 0.8 * dt;
    else boat.speed = easeTo(boat.speed, 0, 0.8, dt);
    if (boat.speed > top) boat.speed = easeTo(boat.speed, top, 2, dt);
    if (boat.speed < -top * 0.3) boat.speed = -top * 0.3;

    const turn = cmd.steer * spec.turn * clampNum(Math.abs(boat.speed) / 8, 0, 1) * (boat.speed >= 0 ? 1 : -1);
    boat.heading += turn * dt * 0.9;

    const fx = -Math.sin(boat.heading);
    const fz = -Math.cos(boat.heading);
    let nx = boat.pos.x + fx * boat.speed * dt;
    let nz = boat.pos.z + fz * boat.speed * dt;

    let beached = false;
    if (!this.world.inWater(nx, nz)) {
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
    boat.mesh.rotation.z = clampNum(-cmd.steer * 0.06 * clampNum(boat.speed / 10, 0, 1), -0.1, 0.1);
    boat.mesh.rotation.x = Math.sin(time * 1.1 + boat.bobPhase) * 0.02;

    // Wake: foam at the stern while moving, spray while turning hard.
    this.wakeTimer -= dt;
    const fast = Math.abs(boat.speed) > 7;
    if (fast && this.wakeTimer <= 0) {
      this.wakeTimer = 0.07;
      const bx = boat.pos.x + Math.sin(boat.heading) * (boat.length / 2);
      const bz = boat.pos.z + Math.cos(boat.heading) * (boat.length / 2);
      this.dropWake(bx, bz, Math.abs(boat.speed) > 20);
      if (Math.abs(cmd.steer) > 0.6) this.dropWake(bx, bz, true);
    }
    this.tickWake(dt);
    return { beached };
  }
}
