// Combat and pickups for Sunset Shores: a pistol with a raycast shot and a
// short tracer, a punch for close quarters, and health packs and ammo crates
// scattered around Port Solano that refill on a timer.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CFG.pistolRange;
    this.tracer = null;
    this.tracerTimer = 0;
    this.cooldown = 0;
    this.healthPacks = [];
    this.ammoCrates = [];
    this._placePickups();
  }

  _placePickups() {
    const healthSpots = [
      { x: 60, z: 40 }, { x: 4, z: 236 }, { x: -150, z: 214 }, { x: -20, z: -2 },
    ];
    const ammoSpots = [
      { x: -14, z: -8 }, { x: 56, z: 48 }, { x: -8, z: 230 },
    ];
    for (const s of healthSpots) this.healthPacks.push(this._makePickup(s.x, s.z, 'health'));
    for (const s of ammoSpots) this.ammoCrates.push(this._makePickup(s.x, s.z, 'ammo'));
  }

  _makePickup(x, z, kind) {
    const group = new THREE.Group();
    const color = kind === 'health' ? 0x35d05a : 0xffc93e;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshLambertMaterial({ color }),
    );
    box.position.y = 1;
    box.castShadow = true;
    group.add(box);
    // A white cross on health packs, a stripe on ammo crates.
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(kind === 'health' ? 0.9 : 1.42, 0.28, 0.1), markMat);
    m1.position.set(0, 1, 0.72);
    group.add(m1);
    if (kind === 'health') {
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.1), markMat);
      m2.position.set(0, 1, 0.72);
      group.add(m2);
    }
    group.position.set(x, 0, z);
    group.userData.kind = kind;
    group.userData.respawn = 0;
    this.scene.add(group);
    return group;
  }

  update(dt, px, pz, state, hooks) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.tracer) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) {
        this.scene.remove(this.tracer);
        this.tracer = null;
      }
    }
    const check = (list, onTake) => {
      for (const g of list) {
        if (!g.visible) {
          g.userData.respawn -= dt;
          if (g.userData.respawn <= 0) g.visible = true;
          continue;
        }
        const dx = px - g.position.x;
        const dz = pz - g.position.z;
        if (dx * dx + dz * dz < 3.2) {
          onTake(g);
          g.visible = false;
          g.userData.respawn = 20;
        }
      }
    };
    check(this.healthPacks, () => {
      state.health = Math.min(CFG.playerHealth, state.health + 50);
      hooks.onPickup('health');
    });
    check(this.ammoCrates, () => {
      state.ammo = CFG.pistolAmmo;
      hooks.onPickup('ammo');
    });
  }

  // Fire from the camera through the crosshair. Returns a hit description.
  shoot(camera, state, targets) {
    if (this.cooldown > 0 || state.ammo <= 0) return null;
    this.cooldown = 0.28;
    state.ammo--;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const meshes = [];
    for (const t of targets) {
      t.mesh.group.traverse((o) => {
        if (o.isMesh) {
          o.userData.hitTarget = t;
          meshes.push(o);
        }
      });
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    const origin = camera.position.clone();
    let end = origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(CFG.pistolRange));
    let hit = null;
    if (hits.length > 0) {
      const first = hits[0];
      end = first.point.clone();
      hit = first.object.userData.hitTarget;
    }
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    this.tracer = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(this.tracer);
    this.tracerTimer = 0.07;
    return hit;
  }

  // A swing at whatever is closest in front of the player.
  punch(px, pz, yaw, peds, policeCars) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const tryHit = (x, z) => {
      const dx = x - px;
      const dz = z - pz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > CFG.punchRange) return false;
      const dot = (dx * fx + dz * fz) / (d || 1);
      return dot > 0.2;
    };
    for (const p of peds.list) {
      if (p.state !== 'down' && tryHit(p.x, p.z)) {
        peds.knockDown(p);
        return { type: 'ped' };
      }
    }
    for (const car of policeCars) {
      if (car.health > 0 && tryHit(car.x, car.z)) {
        car.health -= CFG.punchDamage;
        return { type: 'police', car };
      }
    }
    return null;
  }
}
