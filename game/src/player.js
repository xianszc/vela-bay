// The player on foot: a low-poly character built from boxes, with a simple
// walk-cycle swing, and the third-person chase camera that follows whoever
// the player is — on foot, in a car or in a boat. The camera orbits when the
// player drags the mouse and pulls back when the vehicle goes fast.

import * as THREE from 'three';
import { clamp, damp, angleDelta } from './util.js';

function limb(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeCharacterMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const torso = limb(0.62, 0.72, 0.34, shirt, 0, 1.18, 0);
  g.add(torso);
  const head = limb(0.42, 0.42, 0.4, skin, 0, 1.78, 0);
  g.add(head);
  const hair = limb(0.46, 0.16, 0.44, 0x1a1210, 0, 2.02, 0);
  g.add(hair);
  const legs = {
    left: limb(0.24, 0.8, 0.26, pants, -0.17, 0.4, 0),
    right: limb(0.24, 0.8, 0.26, pants, 0.17, 0.4, 0),
  };
  legs.left.geometry.translate(0, -0.4, 0);
  legs.left.position.y = 0.8;
  legs.right.geometry.translate(0, -0.4, 0);
  legs.right.position.y = 0.8;
  g.add(legs.left, legs.right);
  const arms = {
    left: limb(0.2, 0.66, 0.22, shirt, -0.42, 1.42, 0),
    right: limb(0.2, 0.66, 0.22, shirt, 0.42, 1.42, 0),
  };
  arms.left.geometry.translate(0, -0.3, 0);
  arms.left.position.y = 1.5;
  arms.right.geometry.translate(0, -0.3, 0);
  arms.right.position.y = 1.5;
  g.add(arms.left, arms.right);
  return { group: g, legs, arms };
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    const c = makeCharacterMesh(0x14e0c8, 0x23253a, 0xc98a5e);
    this.mesh = c.group;
    this.legs = c.legs;
    this.arms = c.arms;
    this.mesh.position.set(0, 0, -8);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0; // facing -Z
    this.speed = 0;
    this.walkPhase = 0;
    this.inVehicle = null; // { kind: 'car'|'boat', entity } or null
    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.mesh.visible = v;
  }

  // Walk with WASD, relative to the camera yaw. Returns the distance moved.
  update(dt, input, camYaw, canMove, blockFn) {
    if (this.inVehicle) return 0;
    let fx = 0, fz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) fz -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) fz += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) fx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) fx += 1;
    const moving = fx !== 0 || fz !== 0;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const targetSpeed = moving ? (sprint ? 7.5 : 4.4) : 0;
    this.speed = damp(this.speed, targetSpeed, 8, dt);
    if (moving) {
      const len = Math.hypot(fx, fz);
      const nx = fx / len, nz = fz / len;
      // Rotate the input vector by the camera yaw.
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = nx * cos - nz * sin;
      const wz = nx * sin + nz * cos;
      const targetHeading = Math.atan2(wx, wz) + Math.PI;
      this.heading += angleDelta(this.heading, targetHeading) * Math.min(1, dt * 10);
      const stepX = Math.sin(this.heading) * -1 * this.speed * dt;
      const stepZ = Math.cos(this.heading) * -1 * this.speed * dt;
      const nxPos = this.pos.x + stepX;
      const nzPos = this.pos.z + stepZ;
      if (!blockFn(nxPos, this.pos.z)) this.pos.x = nxPos;
      if (!blockFn(this.pos.x, nzPos)) this.pos.z = nzPos;
      this.walkPhase += this.speed * dt * 1.6;
    }
    this.mesh.rotation.y = this.heading;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legs.left.rotation.x = swing;
    this.legs.right.rotation.x = -swing;
    this.arms.left.rotation.x = -swing * 0.8;
    this.arms.right.rotation.x = swing * 0.8;
    return this.speed * dt;
  }
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // orbit offset around the target, radians
    this.pitch = 0.26;
    this.distance = 8;
    this.targetDistance = 8;
    this.smoothPos = new THREE.Vector3(0, 6, 12);
    this.smoothLook = new THREE.Vector3();
  }

  // follow: { pos: Vector3, heading: number, speedKmh: number }
  update(dt, input, follow, mode) {
    this.yaw -= input.dragDX * 0.005;
    this.pitch = clamp(this.pitch + input.dragDY * 0.004, 0.08, 0.85);
    if (input.wheel !== 0) this.targetDistance = clamp(this.targetDistance + input.wheel * 0.01, 6, 16);
    const speedBoost = clamp((follow.speedKmh || 0) / 200, 0, 1);
    const dist = this.targetDistance + speedBoost * 2;
    const back = mode === 'car' ? 1 : 0.9;
    const baseYaw = follow.heading + this.yaw;
    const cx = follow.pos.x + Math.sin(baseYaw) * dist * back;
    const cz = follow.pos.z + Math.cos(baseYaw) * dist * back;
    const cy = follow.pos.y + 1.7 + Math.sin(this.pitch) * dist * 0.55;
    const desired = new THREE.Vector3(cx, cy, cz);
    this.smoothPos.lerp(desired, 1 - Math.exp(-6 * dt));
    const look = new THREE.Vector3(
      follow.pos.x,
      follow.pos.y + (mode === 'car' ? 1.3 : 1.2),
      follow.pos.z,
    );
    this.smoothLook.lerp(look, 1 - Math.exp(-10 * dt));
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
    // A touch of FOV kick at speed.
    const targetFov = 60 + speedBoost * 6;
    if (Math.abs(this.camera.fov - targetFov) > 0.2) {
      this.camera.fov = damp(this.camera.fov, targetFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  // The yaw the on-foot controls steer against.
  get yawForControls() {
    return this.yaw;
  }

  snapTo(follow, mode) {
    const baseYaw = follow.heading + this.yaw;
    const dist = this.targetDistance;
    this.smoothPos.set(
      follow.pos.x + Math.sin(baseYaw) * dist,
      follow.pos.y + 3 + Math.sin(this.pitch) * dist * 0.5,
      follow.pos.z + Math.cos(baseYaw) * dist,
    );
    this.smoothLook.set(follow.pos.x, follow.pos.y + 1.5, follow.pos.z);
  }
}
