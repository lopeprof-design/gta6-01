// Mara's story: three jobs across Port Solano. Each mission drops a glowing
// waypoint beacon on the map; reaching it (or collecting every package)
// pays out and opens the next job. Finishing all three ends the story.
import * as THREE from 'three';
import { CFG, MISSIONS, dist2d } from './config.js';

export class Missions {
  constructor(scene, cityInfo, hooks) {
    this.scene = scene;
    this.hooks = hooks; // { onReward, onPackage, onWanted, onStoryDone }
    this.index = 0;
    this.done = false;
    this.collected = 0;
    this.beacon = null;
    this.packageMeshes = [];
    this.arrow = null;
    this.cityInfo = cityInfo;
    this._makeBeacon();
    this.startMission(0);
  }

  _makeBeacon() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 30, 20, 1, true), mat);
    this.beacon.position.y = 15;
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
  }

  _clearPackages() {
    for (const m of this.packageMeshes) this.scene.remove(m);
    this.packageMeshes = [];
  }

  startMission(i) {
    this.index = i;
    this.collected = 0;
    this._clearPackages();
    const m = MISSIONS[i];
    if (!m) {
      this.done = true;
      this.beacon.visible = false;
      return;
    }
    if (m.packages) {
      const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      for (const p of m.packages) {
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: 0xffd23e }),
        );
        mesh.position.set(p.x, 1.2, p.z);
        mesh.userData.package = true;
        this.scene.add(mesh);
        this.packageMeshes.push(mesh);
      }
      this.beacon.position.set(m.packages[0].x, 15, m.packages[0].z);
    } else {
      this.beacon.position.set(m.target.x, 15, m.target.z);
    }
    this.beacon.visible = true;
    if (m.wanted) this.hooks.onWanted(m.wanted);
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  // Where the HUD arrow and minimap should point right now.
  activeTarget() {
    const m = this.current();
    if (!m) return null;
    if (m.packages) {
      const remaining = m.packages.filter((_, i) => !this.packageMeshes[i] || this.packageMeshes[i].visible);
      return remaining[0] || null;
    }
    return m.target;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return 'Semua misi selesai — Port Solano milikmu, Mara.';
    if (m.packages) return m.objective + ' (' + this.collected + '/' + m.packages.length + ')';
    return m.objective;
  }

  missionList() {
    return MISSIONS.map((m, i) => ({
      title: m.title,
      state: this.done || i < this.index ? 'done' : i === this.index ? 'active' : 'todo',
    }));
  }

  update(dt, px, pz) {
    const m = this.current();
    if (!m || this.done) return;
    // Beacon pulse.
    const s = 1 + Math.sin(performance.now() / 300) * 0.12;
    this.beacon.scale.set(s, 1, s);
    for (const pm of this.packageMeshes) {
      pm.rotation.y += dt * 1.5;
      pm.position.y = 1.2 + Math.sin(performance.now() / 300 + pm.position.x) * 0.25;
    }
    if (m.packages) {
      let remaining = 0;
      m.packages.forEach((p, i) => {
        const mesh = this.packageMeshes[i];
        if (!mesh.visible) return;
        remaining++;
        if (dist2d(px, pz, p.x, p.z) < m.radius) {
          mesh.visible = false;
          this.collected++;
          this.hooks.onPackage(this.collected, m.packages.length);
          if (this.collected >= m.packages.length) this._complete();
        }
      });
      const next = m.packages.find((_, i) => this.packageMeshes[i].visible);
      if (next) this.beacon.position.set(next.x, 15, next.z);
    } else if (dist2d(px, pz, m.target.x, m.target.z) < m.radius) {
      this._complete();
    }
  }

  _complete() {
    const m = this.current();
    const reward = CFG.missionRewards[this.index] || 0;
    this.hooks.onReward(reward, m.title);
    const next = this.index + 1;
    if (next >= MISSIONS.length) {
      this.done = true;
      this.beacon.visible = false;
      this._clearPackages();
      this.hooks.onStoryDone();
    } else {
      this.startMission(next);
    }
  }

  // Continue a save file at a later mission.
  jumpTo(i) {
    if (i >= 0 && i < MISSIONS.length) this.startMission(i);
  }
}
