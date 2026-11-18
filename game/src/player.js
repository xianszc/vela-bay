// The player on foot: a realistic low-poly human — rounded forms, real
// proportions, a face with eyes and a smile — with a simple walk-cycle
// swing, and the third-person chase camera that follows whoever the
// player is — on foot, in a car or in a boat. The camera orbits when the
// player drags the mouse and pulls back as the vehicle goes faster.

import * as THREE from 'three';
import { clampNum, easeTo, turnToward } from './util.js';

// ---- realistic human figures -------------------------------------------
// A person, not a box doll: real proportions (head ~1/7.5 of the 1.8 m
// height), smooth rounded forms (capsules, spheres, cylinders — never
// sharp boxes), a face with eyes, nose, a smile and hair, and a jacket
// and trousers that follow the body. Limbs are two-segment (thigh + shin,
// upper arm + forearm) with a slight natural bend, so a walk, a wave or
// a celebration reads as a human moving, not a doll pivoting.
// The figure faces -Z. buildFigure returns the group plus the leg and
// arm pivots (Groups at the hips and shoulders) that the walk cycle and
// the staged poses rotate.
function rmat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...opts });
}
function capsulePart(r, len, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), rmat(color, opts));
  m.castShadow = true;
  return m;
}
function ballPart(r, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), rmat(color, opts));
  m.castShadow = true;
  return m;
}
function tubePart(r, h, color, opts = {}, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), rmat(color, opts));
  m.castShadow = true;
  return m;
}

// mood: 'smile' | 'grin' | 'calm' — sizes the smile.
// opts.cap: give the figure a driver cap in the shirt colour (Rex).
export function buildFigure(shirt, pants, skin, mood = 'smile', opts = {}) {
  const g = new THREE.Group();
  const jacketCol = new THREE.Color(shirt).multiplyScalar(0.45).getHex();
  const dark = 0x1a1210;

  // --- torso: a rounded capsule, jacket over a shirt ---
  const torso = capsulePart(0.19, 0.26, shirt);
  torso.scale.set(1.18, 1, 0.82);
  torso.position.set(0, 1.18, 0);
  g.add(torso);
  // Jacket: a slightly wider, shorter capsule over the chest, so the
  // shirt shows below it — a real outfit, not a single-colour block.
  const jacket = capsulePart(0.21, 0.06, jacketCol);
  jacket.scale.set(1.18, 1, 0.82);
  jacket.position.set(0, 1.24, 0);
  g.add(jacket);
  // Shirt V on the chest front, poking out of the open jacket.
  const chest = ballPart(0.13, 0xf2ede2);
  chest.scale.set(0.9, 1.1, 0.35);
  chest.position.set(0, 1.28, -0.185);
  g.add(chest);
  // Hips / pelvis.
  const hips = ballPart(0.19, pants);
  hips.scale.set(1.1, 0.75, 0.9);
  hips.position.set(0, 0.86, 0);
  g.add(hips);
  // Neck, so the head sits on the body instead of floating on it.
  const neck = tubePart(0.05, 0.1, skin);
  neck.position.set(0, 1.53, 0);
  g.add(neck);
  // Rounded shoulders.
  for (const sx of [-1, 1]) {
    const sh = ballPart(0.09, shirt);
    sh.position.set(sx * 0.24, 1.44, 0);
    g.add(sh);
  }

  // --- head: a sphere with a real face ---
  const head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  const skull = ballPart(0.125, skin);
  head.add(skull);
  // Hair: a flattened cap over the top-back of the skull.
  const hair = ballPart(0.132, dark);
  hair.scale.set(1.0, 0.75, 1.0);
  hair.position.set(0, 0.035, 0.02);
  head.add(hair);
  // Ears.
  for (const sx of [-1, 1]) {
    const ear = ballPart(0.028, skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sx * 0.125, 0, 0);
    head.add(ear);
  }
  // Eyes: dark spheres set into the face, with a white glint.
  for (const sx of [-1, 1]) {
    const eye = ballPart(0.02, dark);
    eye.position.set(sx * 0.048, 0.02, -0.112);
    head.add(eye);
    const glint = ballPart(0.007, 0xffffff);
    glint.position.set(sx * 0.048 + 0.006, 0.028, -0.128);
    head.add(glint);
  }
  // Eyebrows.
  for (const sx of [-1, 1]) {
    const brow = ballPart(0.022, dark);
    brow.scale.set(1.6, 0.45, 0.5);
    brow.position.set(sx * 0.048, 0.055, -0.115);
    head.add(brow);
  }
  // Nose: a small rounded cone pointing forward.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 8), rmat(skin));
  nose.rotation.x = -Math.PI / 2 - 0.35;
  nose.position.set(0, -0.015, -0.125);
  nose.castShadow = true;
  head.add(nose);
  // Smile: a thin torus arc — a real mouth curve, not a painted line.
  const smileR = mood === 'grin' ? 0.045 : mood === 'calm' ? 0.028 : 0.038;
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(smileR, 0.007, 8, 20, Math.PI),
    rmat(0x6a2a1a, { roughness: 0.6 }),
  );
  smile.rotation.z = Math.PI; // lower half = a smile curve
  smile.position.set(0, -0.055, -0.118);
  head.add(smile);
  // Blush on the cheeks.
  for (const sx of [-1, 1]) {
    const blush = ballPart(0.02, 0xff8a8a);
    blush.scale.set(1.2, 0.7, 0.4);
    blush.position.set(sx * 0.075, -0.03, -0.12);
    head.add(blush);
  }
  if (opts.cap) {
    // A driver cap in the shirt colour, with a brim over the forehead.
    const capTop = tubePart(0.14, 0.05, shirt, {}, 14);
    capTop.position.set(0, 0.115, 0.01);
    head.add(capTop);
    const brim = ballPart(0.09, shirt);
    brim.scale.set(1.3, 0.25, 1.0);
    brim.position.set(0, 0.07, -0.095);
    head.add(brim);
  }
  g.add(head);

  // --- legs: thigh + shin + shoe, pivoting at the hip ---
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 0.84, 0);
    const thigh = capsulePart(0.085, 0.3, pants);
    thigh.position.y = -0.2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const shin = capsulePart(0.07, 0.3, pants);
    shin.position.y = -0.2;
    knee.add(shin);
    const shoe = ballPart(0.09, dark);
    shoe.scale.set(0.9, 0.55, 1.5);
    shoe.position.set(0, -0.38, -0.04);
    knee.add(shoe);
    // A slight natural knee bend so the leg never looks like a stiff rod.
    knee.rotation.x = 0.12;
    hip.add(knee);
    g.add(hip);
    return hip;
  }
  const legs = { left: makeLeg(-1), right: makeLeg(1) };

  // --- arms: upper arm + forearm + hand, pivoting at the shoulder ---
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.44, 0);
    const upper = capsulePart(0.06, 0.22, shirt);
    upper.position.y = -0.15;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = capsulePart(0.052, 0.2, shirt);
    fore.position.y = -0.14;
    elbow.add(fore);
    const hand = ballPart(0.06, skin);
    hand.scale.set(0.85, 1.1, 0.9);
    hand.position.y = -0.3;
    elbow.add(hand);
    // A relaxed natural elbow bend.
    elbow.rotation.x = -0.28;
    shoulder.add(elbow);
    g.add(shoulder);
    return shoulder;
  }
  const arms = { left: makeArm(-1), right: makeArm(1) };

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
