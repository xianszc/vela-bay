// Every vehicle mesh in Vela Bay is built from boxes and cylinders here —
// no model files, no downloads. Cars share one builder with per-type
// proportions; boats and the police helicopter get their own. Each builder
// returns the group plus the parts the physics has to move (the wheels, the
// rotors, the light bar).

import * as THREE from 'three';
import { VEHICLES, BOATS } from './config.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });
}

function part(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makeWheel(radius = 0.42, width = 0.32) {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), std(0x14161c, { roughness: 0.95 }));
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  wheel.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 10), std(0xd8d8e0, { metalness: 0.7, roughness: 0.3 }));
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  return wheel;
}

// Cars face -Z when heading = 0 (three.js convention used by the physics).
export function makeCarMesh(def) {
  const g = new THREE.Group();
  const body = std(def.color);
  const dark = std(0x14161f, { roughness: 0.3, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.12, metalness: 0.7 });
  const isTruck = def.kind === 'truck';
  const isSport = def.kind === 'sport';
  const len = isTruck ? 5.6 : isSport ? 4.4 : 4.7;
  const wid = isTruck ? 2.3 : 2.0;
  const bodyH = isTruck ? 1.5 : 0.62;

  // Lower body.
  g.add(part(wid, bodyH, len, body, 0, 0.62, 0));
  // Cabin / hood shape.
  if (isTruck) {
    g.add(part(wid - 0.1, 1.5, 1.7, body, 0, 1.9, -1.6));
    g.add(part(wid - 0.2, 0.9, 3.2, std(0x8a6a4a, { roughness: 0.8 }), 0, 1.6, 0.9));
    g.add(part(wid - 0.3, 0.18, 3.0, dark, 0, 2.1, 0.9));
  } else {
    const cabin = part(wid - 0.35, 0.55, isSport ? 1.9 : 2.4, glass, 0, 1.18, isSport ? 0.25 : 0.1);
    g.add(cabin);
    g.add(part(wid - 0.2, 0.16, isSport ? 1.5 : 2.0, body, 0, 1.5, isSport ? 0.25 : 0.1));
    if (isSport) {
      // Spoiler and hood scoop.
      g.add(part(wid - 0.3, 0.08, 0.5, dark, 0, 1.02, 2.0));
      g.add(part(0.12, 0.3, 0.12, dark, -wid / 2 + 0.2, 1.15, 2.05));
      g.add(part(0.12, 0.3, 0.12, dark, wid / 2 - 0.2, 1.15, 2.05));
      g.add(part(wid * 0.5, 0.08, 0.5, dark, 0, 0.98, -1.4));
    }
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffe9a8, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a3c, emissive: 0xff2a3c, emissiveIntensity: 1.2 });
  g.add(part(0.42, 0.16, 0.08, headMat, -wid / 2 + 0.35, 0.72, -len / 2 - 0.01));
  g.add(part(0.42, 0.16, 0.08, headMat, wid / 2 - 0.35, 0.72, -len / 2 - 0.01));
  g.add(part(wid - 0.3, 0.14, 0.08, tailMat, 0, 0.72, len / 2 + 0.01));

  if (def.kind === 'taxi') {
    const sign = part(0.9, 0.22, 0.5, std(0xffc93c, { emissive: 0xffc93c, emissiveIntensity: 0.5 }), 0, 1.55, 0.1);
    g.add(sign);
  }
  let lightBar = null;
  if (def.kind === 'police') {
    // Black doors and a red/blue light bar.
    g.add(part(wid + 0.02, 0.4, 2.0, std(0x14161f), 0, 0.62, 0.1));
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 2 }));
    blue.position.x = 0.3;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.52, 0.1);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    const badge = part(wid + 0.02, 0.3, 0.9, std(0xf2f2ee), 0, 0.95, -0.6);
    g.add(badge);
  }

  // Wheels.
  const wheels = {};
  const wheelY = 0.42;
  const fx = -len / 2 + 0.95, rx = len / 2 - 0.95;
  for (const [name, x, z] of [['fl', -wid / 2 + 0.12, fx], ['fr', wid / 2 - 0.12, fx], ['rl', -wid / 2 + 0.12, rx], ['rr', wid / 2 - 0.12, rx]]) {
    const w = makeWheel(isTruck ? 0.52 : 0.42, 0.34);
    w.position.set(x, wheelY, z);
    g.add(w);
    wheels[name] = w;
  }
  return { group: g, wheels, lightBar, length: len, width: wid };
}

export function makeBoatMesh(def) {
  const g = new THREE.Group();
  const hull = std(def.color);
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
  const deck = part(1.9, 0.18, 4.6, std(0xe8e4d8, { roughness: 0.8 }), 0, 1.05, 0.4);
  g.add(deck);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.12, metalness: 0.7 });
  g.add(part(1.7, 0.7, 0.2, glass, 0, 1.5, -0.9));
  g.add(part(1.9, 0.5, 1.4, hull, 0, 1.35, 0.2));
  // Outboard motor.
  g.add(part(0.5, 0.9, 0.5, std(0x2a2d3a), 0, 0.6, 3.3));
  if (def.kind === 'police-boat') {
    g.add(part(2.0, 0.24, 1.2, std(0x2266ff), 0, 0.75, 0.4));
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

export function makeHelicopterMesh() {
  const g = new THREE.Group();
  const body = std(0x1a2a3a, { metalness: 0.5, roughness: 0.4 });
  g.add(part(2.2, 1.5, 4.2, body, 0, 0, 0));
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6 });
  g.add(part(1.9, 1.0, 1.2, glass, 0, 0.15, -1.8));
  g.add(part(0.5, 0.5, 4.4, std(0x2a2d3a), 0, 0.2, 3.6));
  const tailFin = part(0.18, 1.4, 1.0, std(0x2a2d3a), 0, 0.7, 5.4);
  g.add(tailFin);
  // Skids.
  g.add(part(0.14, 0.14, 3.4, std(0x2a2d3a), -0.9, -1.0, 0));
  g.add(part(0.14, 0.14, 3.4, std(0x2a2d3a), 0.9, -1.0, 0));
  // Main rotor and tail rotor.
  const rotor = new THREE.Group();
  const bladeMat = std(0x14161c, { roughness: 0.6 });
  rotor.add(part(9.2, 0.08, 0.5, bladeMat, 0, 0, 0));
  rotor.add(part(0.5, 0.08, 9.2, bladeMat, 0, 0, 0));
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.add(part(0.08, 2.0, 0.3, bladeMat, 0, 0, 0));
  tailRotor.position.set(0.4, 0.5, 5.5);
  g.add(tailRotor);
  // Searchlight cone (a translucent cone under the belly).
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -14;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff2b8, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.add(spot.target);
  spot.target.position.set(0, -26, 0);
  return { group: g, rotor, tailRotor, cone, spot };
}

export function vehicleDef(id) {
  return VEHICLES.find((v) => v.id === id);
}

export function boatDef(id) {
  return BOATS.find((b) => b.id === id);
}
