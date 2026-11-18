// Every vehicle mesh in Vela Bay is built from boxes and cylinders
// here — no model files, no downloads. Cars share one builder with
// per-type proportions; boats and the police helicopter get their own.
// Each builder returns the group plus the parts the physics has to move
// (the wheels, the rotors, the light bar).

import * as THREE from 'three';
import { CAR_TYPES, BOAT_TYPES } from './config.js';

function paint(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });
}

function boxPart(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildWheel(radius = 0.42, width = 0.32) {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), paint(0x14161c, { roughness: 0.95 }));
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  wheel.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 10), paint(0xd8d8e0, { metalness: 0.7, roughness: 0.3 }));
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  // A bright alloy rim ring on each face, so the wheels read as real
  // sports rims instead of plain black discs.
  const rimMat = paint(0xe8e8f0, { metalness: 0.85, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.045, 8, 20), rimMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (width / 2 + 0.01);
    wheel.add(rim);
  }
  return wheel;
}

// Cars face -Z when heading = 0 (three.js convention used by the physics).
export function buildCar(spec) {
  const g = new THREE.Group();
  const isTruck = spec.kind === 'truck';
  const isSport = spec.kind === 'sport';
  // Sports cars get glossy, eye-catching paint — a real sports-car shine,
  // not a matte box. The hero VELA GT is a sport car.
  const body = paint(spec.color, isSport ? { roughness: 0.22, metalness: 0.65 } : {});
  const dark = paint(0x14161f, { roughness: 0.3, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.12, metalness: 0.7 });
  const len = isTruck ? 5.6 : isSport ? 4.4 : 4.7;
  const wid = isTruck ? 2.3 : 2.0;
  const bodyH = isTruck ? 1.5 : 0.62;

  // Lower body.
  g.add(boxPart(wid, bodyH, len, body, 0, 0.62, 0));
  // Cabin / hood shape.
  if (isTruck) {
    g.add(boxPart(wid - 0.1, 1.5, 1.7, body, 0, 1.9, -1.6));
    g.add(boxPart(wid - 0.2, 0.9, 3.2, paint(0x8a6a4a, { roughness: 0.8 }), 0, 1.6, 0.9));
    g.add(boxPart(wid - 0.3, 0.18, 3.0, dark, 0, 2.1, 0.9));
  } else {
    const cabin = boxPart(wid - 0.35, 0.55, isSport ? 1.9 : 2.4, glass, 0, 1.18, isSport ? 0.25 : 0.1);
    g.add(cabin);
    g.add(boxPart(wid - 0.2, 0.16, isSport ? 1.5 : 2.0, body, 0, 1.5, isSport ? 0.25 : 0.1));
    if (isSport) {
      // Spoiler and hood scoop.
      g.add(boxPart(wid - 0.3, 0.08, 0.5, dark, 0, 1.02, 2.0));
      g.add(boxPart(0.12, 0.3, 0.12, dark, -wid / 2 + 0.2, 1.15, 2.05));
      g.add(boxPart(0.12, 0.3, 0.12, dark, wid / 2 - 0.2, 1.15, 2.05));
      g.add(boxPart(wid * 0.5, 0.08, 0.5, dark, 0, 0.98, -1.4));
      // Sloped hood, side mirrors, front grille + bumper, and a racing
      // stripe over the hood and roof — the details that make a sports
      // car read as a real car instead of a plain box.
      const hood = boxPart(wid - 0.15, 0.1, 1.1, body, 0, 0.95, -1.55);
      hood.rotation.x = -0.07;
      g.add(hood);
      g.add(boxPart(0.14, 0.1, 0.22, dark, -wid / 2 - 0.05, 1.12, -0.55));
      g.add(boxPart(0.14, 0.1, 0.22, dark, wid / 2 + 0.05, 1.12, -0.55));
      g.add(boxPart(wid - 0.5, 0.2, 0.08, dark, 0, 0.42, -len / 2 - 0.01));
      g.add(boxPart(wid, 0.14, 0.18, body, 0, 0.32, -len / 2 + 0.02));
      g.add(boxPart(0.42, 0.03, 1.6, dark, 0, 0.94, -1.3));
      g.add(boxPart(0.42, 0.03, 1.4, dark, 0, 1.6, 0.25));
    }
  }
  // Headlights and taillights — bigger and brighter on sports cars, so
  // they glow in the afternoon light.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffe9a8, emissiveIntensity: isSport ? 2.4 : 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a3c, emissive: 0xff2a3c, emissiveIntensity: isSport ? 1.8 : 1.2 });
  const headW = isSport ? 0.55 : 0.42, headH = isSport ? 0.2 : 0.16;
  g.add(boxPart(headW, headH, 0.08, headMat, -wid / 2 + 0.35, 0.72, -len / 2 - 0.01));
  g.add(boxPart(headW, headH, 0.08, headMat, wid / 2 - 0.35, 0.72, -len / 2 - 0.01));
  g.add(boxPart(wid - 0.3, 0.14, 0.08, tailMat, 0, 0.72, len / 2 + 0.01));

  if (spec.kind === 'taxi') {
    const sign = boxPart(0.9, 0.22, 0.5, paint(0xffc93c, { emissive: 0xffc93c, emissiveIntensity: 0.5 }), 0, 1.55, 0.1);
    g.add(sign);
  }
  let lightBar = null;
  if (spec.kind === 'police') {
    // Black doors and a red/blue light bar.
    g.add(boxPart(wid + 0.02, 0.4, 2.0, paint(0x14161f), 0, 0.62, 0.1));
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 2 }));
    blue.position.x = 0.3;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.52, 0.1);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    const badge = boxPart(wid + 0.02, 0.3, 0.9, paint(0xf2f2ee), 0, 0.95, -0.6);
    g.add(badge);
  }

  // Wheels.
  const wheels = {};
  const wheelY = 0.42;
  const fx = -len / 2 + 0.95, rx = len / 2 - 0.95;
  for (const [name, x, z] of [['fl', -wid / 2 + 0.12, fx], ['fr', wid / 2 - 0.12, fx], ['rl', -wid / 2 + 0.12, rx], ['rr', wid / 2 - 0.12, rx]]) {
    const w = buildWheel(isTruck ? 0.52 : 0.42, 0.34);
    w.position.set(x, wheelY, z);
    g.add(w);
    wheels[name] = w;
  }
  return { group: g, wheels, lightBar, length: len, width: wid };
}

export function buildBoat(spec) {
  const g = new THREE.Group();
  const hull = paint(spec.color);
  const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 6.4), hull);
  hullMesh.position.y = 0.55;
  hullMesh.castShadow = true;
  g.add(hullMesh);
  // Bow taper.
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 4), hull);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(0, 0.55, -3.9);
  bow.castShadow = true;
  g.add(bow);
  const deck = boxPart(1.9, 0.18, 4.6, paint(0xe8e4d8, { roughness: 0.8 }), 0, 1.05, 0.4);
  g.add(deck);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.12, metalness: 0.7 });
  const shield = boxPart(1.7, 0.7, 0.2, glass, 0, 1.5, -0.9);
  shield.rotation.x = -0.22;
  g.add(shield);
  g.add(boxPart(1.9, 0.5, 1.4, hull, 0, 1.35, 0.2));
  // Glossy white racing stripe along each side of the hull, so the boat
  // reads as a sleek speedboat instead of a plain coloured box.
  const stripeMat = paint(0xf2f2ee, { roughness: 0.3, metalness: 0.4 });
  g.add(boxPart(0.06, 0.22, 5.6, stripeMat, -1.12, 0.72, 0));
  g.add(boxPart(0.06, 0.22, 5.6, stripeMat, 1.12, 0.72, 0));
  // Outboard motor.
  g.add(boxPart(0.5, 0.9, 0.5, paint(0x2a2d3a), 0, 0.6, 3.3));
  // A slim antenna with a small flag, so the boat has a vertical accent.
  const mast = boxPart(0.06, 1.1, 0.06, paint(0x2a2d3a), 0.8, 1.9, 0.9);
  g.add(mast);
  g.add(boxPart(0.4, 0.24, 0.04, paint(0xff5da2), 1.0, 2.35, 0.9));
  if (spec.kind === 'police-boat') {
    g.add(boxPart(2.0, 0.24, 1.2, paint(0x2266ff), 0, 0.75, 0.4));
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.x = -0.25;
    const blue = red.clone();
    blue.material = new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 2 });
    blue.position.x = 0.25;
    bar.add(red, blue);
    bar.position.set(0, 1.75, 0.2);
    bar.userData = { red, blue };
    g.add(bar);
    g.userData.lightBar = bar;
  }
  return { group: g, length: 6.8, width: 2.2 };
}

export function buildChopper() {
  const g = new THREE.Group();
  const body = paint(0x1a2a3a, { metalness: 0.5, roughness: 0.4 });
  g.add(boxPart(2.2, 1.5, 4.2, body, 0, 0, 0));
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6 });
  g.add(boxPart(1.9, 1.0, 1.2, glass, 0, 0.15, -1.8));
  g.add(boxPart(0.5, 0.5, 4.4, paint(0x2a2d3a), 0, 0.2, 3.6));
  const tailFin = boxPart(0.18, 1.4, 1.0, paint(0x2a2d3a), 0, 0.7, 5.4);
  g.add(tailFin);
  // Skids.
  g.add(boxPart(0.14, 0.14, 3.4, paint(0x2a2d3a), -0.9, -1.0, 0));
  g.add(boxPart(0.14, 0.14, 3.4, paint(0x2a2d3a), 0.9, -1.0, 0));
  // Main rotor and tail rotor.
  const rotor = new THREE.Group();
  const bladeMat = paint(0x14161c, { roughness: 0.6 });
  rotor.add(boxPart(9.2, 0.08, 0.5, bladeMat, 0, 0, 0));
  rotor.add(boxPart(0.5, 0.08, 9.2, bladeMat, 0, 0, 0));
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.add(boxPart(0.08, 2.0, 0.3, bladeMat, 0, 0, 0));
  tailRotor.position.set(0.4, 0.5, 5.5);
  g.add(tailRotor);
  // Searchlight cone (a translucent cone under the belly). Narrow at
  // the heli, spreading downward to the ground — a real searchlight
  // beam, not an inverted triangle in the sky.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -14;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff2b8, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.add(spot.target);
  spot.target.position.set(0, -26, 0);
  return { group: g, rotor, tailRotor, cone, spot };
}

export function carSpec(id) {
  return CAR_TYPES.find((v) => v.id === id);
}

export function boatSpec(id) {
  return BOAT_TYPES.find((b) => b.id === id);
}
