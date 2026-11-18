// The player on foot: a low-poly character built from boxes, with a
// simple walk-cycle swing, and the third-person chase camera that follows
// whoever the player is — on foot, in a car or in a boat. The camera
// orbits when the player drags the mouse and pulls back as the vehicle
// goes faster.

import * as THREE from 'three';
import { clampNum, easeTo, turnToward, faceCanvas } from './util.js';

function limbPiece(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function skinCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

// mood: 'smile' | 'grin' | 'calm' — the face texture goes on the -Z
// side of the head box, which is the direction the figure walks toward.
// opts.cap: give the figure a driver cap in the shirt colour (Rex).
export function buildFigure(shirt, pants, skin, mood = 'smile', opts = {}) {
  const g = new THREE.Group();
  // A jacket in a darker shade of the shirt, open at the chest so the
  // shirt shows — a real outfit, not a single-colour block.
  const jacketCol = new THREE.Color(shirt).multiplyScalar(0.5);
  const torso = limbPiece(0.62, 0.72, 0.34, shirt, 0, 1.18, 0);
  g.add(torso);
  g.add(limbPiece(0.66, 0.46, 0.38, jacketCol.getHex(), 0, 1.32, 0));
  g.add(limbPiece(0.2, 0.3, 0.06, 0xf2ede2, 0, 1.3, -0.22));
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.85 });
  const faceTex = new THREE.CanvasTexture(faceCanvas(skinCss(skin), mood));
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.85 });
  // Box face order: +X, -X, +Y, -Y, +Z, -Z. The face sits on -Z.
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.4),
    [skinMat, skinMat, skinMat, skinMat, skinMat, faceMat],
  );
  head.position.set(0, 1.78, 0);
  head.castShadow = true;
  g.add(head);
  // A neck, so the head sits on the body instead of floating on it.
  g.add(limbPiece(0.16, 0.14, 0.16, skin, 0, 1.58, 0));
  const hair = limbPiece(0.46, 0.16, 0.44, 0x1a1210, 0, 2.02, 0);
  g.add(hair);
  if (opts.cap) {
    // A driver cap in the shirt colour, with a brim over the face.
    g.add(limbPiece(0.46, 0.1, 0.44, shirt, 0, 2.08, 0));
    g.add(limbPiece(0.42, 0.05, 0.2, shirt, 0, 2.04, -0.28));
  }
  const legs = {
    left: limbPiece(0.24, 0.8, 0.26, pants, -0.17, 0.4, 0),
    right: limbPiece(0.24, 0.8, 0.26, pants, 0.17, 0.4, 0),
  };
  legs.left.geometry.translate(0, -0.4, 0);
  legs.left.position.y = 0.8;
  legs.right.geometry.translate(0, -0.4, 0);
  legs.right.position.y = 0.8;
  g.add(legs.left, legs.right);
  // Shoes at the end of each leg.
  for (const leg of [legs.left, legs.right]) {
    const shoe = limbPiece(0.26, 0.1, 0.38, 0x1a1210, 0, -0.76, -0.05);
    leg.add(shoe);
  }
  const arms = {
    left: limbPiece(0.2, 0.66, 0.22, shirt, -0.42, 1.42, 0),
    right: limbPiece(0.2, 0.66, 0.22, shirt, 0.42, 1.42, 0),
  };
  arms.left.geometry.translate(0, -0.3, 0);
  arms.left.position.y = 1.5;
  arms.right.geometry.translate(0, -0.3, 0);
  arms.right.position.y = 1.5;
  g.add(arms.left, arms.right);
  // Hands at the end of each arm, so a wave or a celebration reads.
  for (const arm of [arms.left, arms.right]) {
    const hand = limbPiece(0.16, 0.16, 0.16, skin, 0, -0.68, 0);
    arm.add(hand);
  }
  return { group: g, legs, arms };
}

export class Walker {
  constructor(scene) {
    this.scene = scene;
    const c = buildFigure(0x14e0c8, 0x23253a, 0xc98a5e, 'grin', { cap: true });
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

  // A staged pose for screenshots and menus: 'crossed' (arms folded,
  // confident), 'wave' (one arm raised, greeting) or 'celebrate' (both
  // arms in the air). The pose holds while the figure stands still and
  // clears itself the moment the player starts walking again.
  setPose(name) {
    this.pose = name;
    this.applyPose();
  }

  clearPose() { this.pose = null; }

  applyPose() {
    const a = this.arms;
    if (!this.pose) {
      a.left.rotation.set(0, 0, 0);
      a.right.rotation.set(0, 0, 0);
      return;
    }
    if (this.pose === 'crossed') {
      a.left.rotation.set(-1.15, 0, 0.9);
      a.right.rotation.set(-1.15, 0, -0.9);
    } else if (this.pose === 'wave') {
      a.left.rotation.set(0, 0, 0);
      a.right.rotation.set(-2.7, 0, -0.35);
    } else if (this.pose === 'celebrate') {
      a.left.rotation.set(-2.8, 0, 0.35);
      a.right.rotation.set(-2.8, 0, -0.35);
    }
  }

  // Walk with WASD, relative to the camera yaw. Returns distance moved.
  update(dt, input, camYaw, canMove, blockFn) {
    if (this.inVehicle) return 0;
    let fx = 0, fz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) fz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) fz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) fx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) fx += 1;
    const moving = fx !== 0 || fz !== 0;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const targetSpeed = moving ? (sprint ? 7.5 : 4.4) : 0;
    this.speed = easeTo(this.speed, targetSpeed, 8, dt);
    if (moving) {
      const len = Math.hypot(fx, fz);
      const nx = fx / len, nz = fz / len;
      // Rotate the input vector by the camera yaw.
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = nx * cos - nz * sin;
      const wz = nx * sin + nz * cos;
      const targetHeading = Math.atan2(wx, wz) + Math.PI;
      this.heading += turnToward(this.heading, targetHeading) * Math.min(1, dt * 10);
      const stepX = Math.sin(this.heading) * -1 * this.speed * dt;
      const stepZ = Math.cos(this.heading) * -1 * this.speed * dt;
      const nxPos = this.pos.x + stepX;
      const nzPos = this.pos.z + stepZ;
      if (!blockFn(nxPos, this.pos.z)) this.pos.x = nxPos;
      if (!blockFn(this.pos.x, nzPos)) this.pos.z = nzPos;
      this.walkPhase += this.speed * dt * 1.6;
    }
    this.mesh.rotation.y = this.heading;
    if (moving) {
      // Walking clears any staged pose.
      if (this.pose) { this.pose = null; }
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.legs.left.rotation.x = swing;
      this.legs.right.rotation.x = -swing;
      this.arms.left.rotation.x = -swing * 0.8;
      this.arms.right.rotation.x = swing * 0.8;
    } else if (this.pose) {
      this.legs.left.rotation.x = 0;
      this.legs.right.rotation.x = 0;
      this.applyPose();
    } else {
      this.legs.left.rotation.x = 0;
      this.legs.right.rotation.x = 0;
      this.arms.left.rotation.x = 0;
      this.arms.right.rotation.x = 0;
    }
    return this.speed * dt;
  }
}

export class FollowCam {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // orbit offset around the target, radians
    this.pitch = 0.26;
    this.distance = 8;
    this.targetDistance = 8;
    this.smoothPos = new THREE.Vector3(0, 6, 12);
    this.smoothLook = new THREE.Vector3();
    this.tight = false; // staged shots track with almost no lag
  }

  // follow: { pos: Vector3, heading: number, speedKmh: number }
  update(dt, input, follow, mode) {
    this.yaw -= input.dragX * 0.005;
    this.pitch = clampNum(this.pitch + input.dragY * 0.004, 0.08, 0.85);
    if (input.wheelDelta !== 0) this.targetDistance = clampNum(this.targetDistance + input.wheelDelta * 0.01, 4.5, 16);
    const speedBoost = clampNum((follow.speedKmh || 0) / 200, 0, 1);
    const dist = this.targetDistance + speedBoost * 1;
    const back = mode === 'car' ? 1 : 0.9;
    const baseYaw = follow.heading + this.yaw;
    const cx = follow.pos.x + Math.sin(baseYaw) * dist * back;
    const cz = follow.pos.z + Math.cos(baseYaw) * dist * back;
    const cy = follow.pos.y + 1.7 + Math.sin(this.pitch) * dist * 0.55;
    const desired = new THREE.Vector3(cx, cy, cz);
    // A chase camera that lags far behind a fast car makes the hero look
    // tiny in screenshots, so the lerp rate is high — and higher still
    // for staged shots, where the frame has to be exact.
    const rate = this.tight ? 20 : 8;
    this.smoothPos.lerp(desired, 1 - Math.exp(-rate * dt));
    const look = new THREE.Vector3(
      follow.pos.x,
      follow.pos.y + (mode === 'car' ? 1.3 : 1.2),
      follow.pos.z,
    );
    this.smoothLook.lerp(look, 1 - Math.exp(-12 * dt));
    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
    // A touch of FOV kick at speed.
    const targetFov = 60 + speedBoost * 6;
    if (Math.abs(this.camera.fov - targetFov) > 0.2) {
      this.camera.fov = easeTo(this.camera.fov, targetFov, 4, dt);
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
