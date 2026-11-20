// Pedestrians for Port Solano. Simple walkers with coloured shirts who
// stroll the sidewalks, turn at corners, and scatter when a car comes at
// them. Hitting one is a crime — the wanted system notices.
import * as THREE from 'three';
import { CFG, clamp, mulberry32, range } from './config.js';

const SHIRTS = [0xe86a7a, 0x6fa8d8, 0xffd27d, 0x9fd08a, 0xc9a7e8, 0xf2e3c9, 0x7fd1c0];

export class Pedestrians {
  constructor(scene, seed, count = 26) {
    this.scene = scene;
    this.rng = mulberry32(seed + 131);
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let i = 0; i < count; i++) this.list.push(this._spawn());
  }

  _makeMesh(shirtColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: shirtColor }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
    );
    head.position.y = 1.68;
    head.castShadow = true;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2e3440 }),
    );
    legs.position.y = 0.25;
    g.add(legs);
    return g;
  }

  _spawn(x, z) {
    const horizontal = this.rng() < 0.5;
    const street = Math.floor(range(this.rng, -5, 5)) * CFG.pitch;
    const along = x !== undefined ? x : range(this.rng, -195, 195);
    const side = this.rng() < 0.5 ? 1 : -1;
    const px = horizontal ? along : street + side * 6.6;
    const pz = horizontal ? street + side * 6.6 : (z !== undefined ? z : along);
    const mesh = this._makeMesh(SHIRTS[Math.floor(this.rng() * SHIRTS.length)]);
    mesh.position.set(px, 0, pz);
    this.group.add(mesh);
    return {
      mesh,
      x: px,
      z: pz,
      axis: horizontal ? 'x' : 'z',
      dir: this.rng() < 0.5 ? 1 : -1,
      speed: range(this.rng, 1.1, 2.1),
      state: 'walk',
      timer: 0,
      lastBlock: Math.floor(along / CFG.pitch),
      street,
    };
  }

  update(dt, playerPos, playerSpeed) {
    for (const p of this.list) {
      if (p.state === 'down') {
        p.timer -= dt;
        if (p.timer <= 0) {
          // Get back up and walk away, shaken.
          p.state = 'walk';
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
          p.speed = 2.6;
        }
        continue;
      }
      if (p.state === 'flee') {
        p.timer -= dt;
        if (p.timer <= 0) p.state = 'walk';
      }
      // Scatter from a fast car heading their way.
      if (playerSpeed > 6) {
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 12) {
          p.state = 'flee';
          p.timer = 1.6;
          p.fleeX = dx / (d || 1);
          p.fleeZ = dz / (d || 1);
        }
      }
      let vx = 0;
      let vz = 0;
      if (p.state === 'flee') {
        vx = p.fleeX * 3.4;
        vz = p.fleeZ * 3.4;
      } else {
        const step = p.speed * p.dir * dt;
        if (p.axis === 'x') {
          p.x += step;
          const block = Math.floor(p.x / CFG.pitch);
          if (block !== p.lastBlock) {
            p.lastBlock = block;
            if (Math.abs(p.x) > 190) p.dir *= -1;
            else if (this.rng() < 0.3) {
              p.axis = 'z';
              p.street = Math.round(p.x / CFG.pitch) * CFG.pitch;
              p.z = p.street + (this.rng() < 0.5 ? 6.6 : -6.6);
              p.dir = this.rng() < 0.5 ? 1 : -1;
            }
          }
          vx = p.speed * p.dir;
        } else {
          p.z += step;
          const block = Math.floor(p.z / CFG.pitch);
          if (block !== p.lastBlock) {
            p.lastBlock = block;
            if (Math.abs(p.z) > 190) p.dir *= -1;
            else if (this.rng() < 0.3) {
              p.axis = 'x';
              p.street = Math.round(p.z / CFG.pitch) * CFG.pitch;
              p.x = p.street + (this.rng() < 0.5 ? 6.6 : -6.6);
              p.dir = this.rng() < 0.5 ? 1 : -1;
            }
          }
          vz = p.speed * p.dir;
        }
      }
      p.x = clamp(p.x, -205, 205);
      p.z = clamp(p.z, -205, 200);
      p.mesh.position.set(p.x, 0, p.z);
      if (vx || vz) p.mesh.rotation.y = Math.atan2(vx, vz);
      // Little walking bob.
      p.mesh.position.y = Math.abs(Math.sin(performance.now() / 180 + p.x)) * 0.05;
    }
  }

  // A car hit or a bullet puts a pedestrian down.
  knockDown(p) {
    if (p.state === 'down') return;
    p.state = 'down';
    p.timer = 5;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.3;
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
