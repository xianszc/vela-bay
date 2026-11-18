// The story of Vela Bay: eight jobs, one crew, one long sunset. Each
// job is a list of steps; a step is a place to reach, a vehicle to
// steal, a chase to survive or a police car to wreck. The runner moves a
// glowing beacon to the current step and tells the game when a step, or
// a whole job, is done.

import * as THREE from 'three';
import { PAYOUTS, CREW } from './config.js';

export const JOBS = [
  {
    id: 'warm-up', title: 'WARM-UP LAP', speaker: 'rex',
    brief: "Rex: New kid on the crew. Take one easy lap around Downtown and meet me at the marina. Try not to scratch anything.",
    steps: [{ text: 'Drive to the marina marker', type: 'goto', x: -138, z: 140, radius: 10 }],
  },
  {
    id: 'first-wheels', title: 'FIRST WHEELS', speaker: 'rex',
    brief: 'Rex: A crew needs wheels and we do not pay for them. Jack any parked car on the street. The cops will notice — that is half the fun.',
    steps: [{ text: 'Steal any car (walk up and press F)', type: 'stealCar' }],
  },
  {
    id: 'the-pickup', title: 'THE PICKUP', speaker: 'mara',
    brief: "Mara: I am up in Old Town with the harbour charts. Come fetch me before the tide turns. Bring the car, not the cops.",
    steps: [{ text: 'Drive to Old Town Hill', type: 'goto', x: -180, z: -140, radius: 12 }],
  },
  {
    id: 'canal-run', title: 'CANAL RUN', speaker: 'theo',
    brief: 'Theo: The mark moved his money through the canals. Run the canal route and shake the tail before you reach the east bridge.',
    steps: [
      { text: 'Reach the canal bridge', type: 'goto', x: 134, z: 120, radius: 12 },
      { text: 'Lose the cops, then reach the east bridge', type: 'loseCops', x: 134, z: 0, radius: 12, maxStars: 1 },
    ],
  },
  {
    id: 'boat-heist', title: 'BOAT HEIST', speaker: 'mara',
    brief: "Mara: The good stuff moves by water. Steal a boat at the marina and run it out to Isla Luna. The marine unit will try to stop you.",
    steps: [
      { text: 'Steal a boat at the marina', type: 'stealBoat' },
      { text: 'Sail to Isla Luna', type: 'gotoWater', x: -80, z: 250, radius: 16 },
    ],
  },
  {
    id: 'long-way-home', title: 'THE LONG WAY HOME', speaker: 'theo',
    brief: 'Theo: The safehouse is hot. Shake the tail on the causeway, then bring the car home in one piece.',
    steps: [
      { text: 'Cross the causeway to Isla Luna', type: 'goto', x: -60, z: 312, radius: 14 },
      { text: 'Lose the cops (1 star or less)', type: 'loseCops', x: -60, z: 312, radius: 14, maxStars: 1 },
    ],
  },
  {
    id: 'roadblock-run', title: 'ROADBLOCK RUN', speaker: 'rex',
    brief: 'Rex: They put a roadblock on the causeway. Smash straight through it. Wreck two of their interceptors and the rest will think twice.',
    steps: [
      { text: 'Wreck 2 police cars (ram them hard)', type: 'ram', count: 2 },
      { text: 'Reach the boardwalk', type: 'goto', x: 0, z: 186, radius: 12 },
    ],
  },
  {
    id: 'sunset-heist', title: 'THE SUNSET HEIST', speaker: 'dario',
    brief: "Dario: Tonight we take the Vela GT from the Grand Casino and vanish across the bay. Five stars, boats, a helicopter — everything. Don't come back without the car.",
    steps: [
      { text: 'Steal the teal VELA GT at the casino', type: 'stealCar', carId: 'teal-sport' },
      { text: 'Escape to Isla Luna', type: 'goto', x: -60, z: 312, radius: 14 },
      { text: 'Lose the cops (1 star or less)', type: 'loseCops', x: -60, z: 312, radius: 14, maxStars: 1 },
    ],
  },
];

export class JobRunner {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.step = 0;
    this.active = false;
    this.done = false;
    this.rammed = 0;
    this.stepTimer = 0;
    // The beacon: a glowing pillar the player can see across the city.
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0x14e0c8, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, this.beaconMat);
    this.beacon.position.set(0, 30, 0);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(3, 4.4, 24);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x14e0c8, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(0, 0.3, 0);
    this.ring.visible = false;
    scene.add(this.ring);
  }

  get job() { return JOBS[this.index]; }
  get currentStep() { return this.active ? this.job.steps[this.step] : null; }

  start(index) {
    this.index = index;
    this.step = 0;
    this.active = true;
    this.done = false;
    this.rammed = 0;
    this.stepTimer = 0;
    this.moveBeacon();
  }

  moveBeacon() {
    const s = this.currentStep;
    if (!s || s.x === undefined) {
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    const hy = this.heightAt ? this.heightAt(s.x, s.z) : 0;
    this.beacon.visible = true;
    this.ring.visible = true;
    this.beacon.position.set(s.x, hy + 30, s.z);
    this.ring.position.set(s.x, hy + 0.3, s.z);
  }

  // g: the game context — playerPos, inVehicle, wantedStars, rammedCount.
  // Returns { stepDone, missionDone, message }.
  update(dt, g) {
    if (!this.active || this.done) return null;
    const s = this.currentStep;
    if (!s) return null;
    this.stepTimer += dt;
    const p = g.playerPos;
    let done = false;
    if (s.type === 'goto' || s.type === 'gotoWater') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.radius) done = true;
    } else if (s.type === 'stealCar') {
      if (g.inVehicle && g.inVehicle.kind === 'car') {
        if (!s.carId || g.inVehicle.id === s.carId) done = true;
      }
    } else if (s.type === 'stealBoat') {
      if (g.inVehicle && g.inVehicle.kind === 'boat') done = true;
    } else if (s.type === 'loseCops') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.radius && g.wantedStars <= (s.maxStars ?? 1)) done = true;
    } else if (s.type === 'ram') {
      if (g.rammedCount >= s.count) done = true;
    }
    if (!done) return null;
    this.step++;
    this.stepTimer = 0;
    if (this.step >= this.job.steps.length) {
      this.active = false;
      this.done = true;
      this.beacon.visible = false;
      this.ring.visible = false;
      return { missionDone: true, reward: PAYOUTS.jobCash[this.index], rep: PAYOUTS.jobRep[this.index] };
    }
    this.moveBeacon();
    return { stepDone: true };
  }

  tick(dt, time) {
    if (this.beacon.visible) {
      this.beaconMat.opacity = 0.22 + Math.sin(time * 3) * 0.08;
      const s = 1 + Math.sin(time * 3) * 0.08;
      this.ring.scale.set(s, s, 1);
    }
  }

  speakerLine() {
    const j = this.job;
    const c = CREW[j.speaker];
    return { name: c.name, role: c.role, color: c.color, initials: c.initials, text: j.brief };
  }

  progressText() {
    const j = this.job;
    return `MISSION ${this.index + 1} / ${JOBS.length}: ${j.title}`;
  }

  stepText() {
    const s = this.currentStep;
    if (!s) return 'Job done.';
    return s.text;
  }
}
