// The Port Solano police. Patrol cruisers roam the grid; when Mara's wanted
// level rises, chase cruisers spawn and hunt her down. Wanted stars fade
// when she stays out of sight, and a cruiser that takes enough bullets is
// wrecked and stops.
import { CFG, clamp, mulberry32, range, angleLerp, dist2d } from './config.js';
import { makeCarState } from './vehicles.js';

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed + 201);
    this.patrol = [];
    this.chase = [];
    this.nearTimer = 0; // time since any cruiser was close
    this.bustedTimer = 0; // time a cruiser has been touching the player
    for (let i = 0; i < 3; i++) {
      const street = Math.floor(range(this.rng, -4, 4)) * CFG.pitch;
      const horizontal = this.rng() < 0.5;
      const along = range(this.rng, -150, 150);
      const x = horizontal ? along : street + 2.6;
      const z = horizontal ? street - 2.6 : along;
      const car = makeCarState(scene, x, z, horizontal ? Math.PI / 2 : 0, 0xf2f2ee, 'police');
      car.axis = horizontal ? 'x' : 'z';
      car.dir = this.rng() < 0.5 ? 1 : -1;
      car.street = street;
      car.cruise = 8;
      car.speed = 8;
      car.lastBlock = Math.floor(along / CFG.pitch);
      this.patrol.push(car);
    }
  }

  wantedCount(wanted) {
    return Math.min(wanted, 4);
  }

  // Keep the right number of chase cruisers alive for the wanted level.
  syncChase(wanted, playerX, playerZ) {
    const want = this.wantedCount(wanted);
    while (this.chase.length < want) {
      const a = this.rng() * Math.PI * 2;
      const r = 55 + this.rng() * 25;
      const x = clamp(playerX + Math.cos(a) * r, -200, 200);
      const z = clamp(playerZ + Math.sin(a) * r, -200, 200);
      const car = makeCarState(this.scene, x, z, 0, 0xf2f2ee, 'police');
      car.speed = 0;
      car.smoke = 0;
      car.stuck = 0;
      this.chase.push(car);
    }
    while (this.chase.length > want) {
      const car = this.chase.pop();
      this.scene.remove(car.mesh.group);
    }
  }

  update(dt, player, colliders, audio) {
    const px = player.x;
    const pz = player.z;
    // Patrol cruisers cruise the grid like traffic.
    for (const car of this.patrol) {
      const step = car.speed * car.dir * dt;
      if (car.axis === 'x') {
        car.x += step;
        const block = Math.floor(car.x / CFG.pitch);
        if (block !== car.lastBlock) {
          car.lastBlock = block;
          if (Math.abs(car.x) > 190) car.dir *= -1;
        }
        car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.z += step;
        const block = Math.floor(car.z / CFG.pitch);
        if (block !== car.lastBlock) {
          car.lastBlock = block;
          if (Math.abs(car.z) > 190) car.dir *= -1;
        }
        car.yaw = car.dir > 0 ? 0 : Math.PI;
      }
      car.mesh.group.position.set(car.x, 0, car.z);
      car.mesh.group.rotation.y = car.yaw;
    }

    let nearest = Infinity;
    let touching = false;
    for (const car of this.chase) {
      if (car.health <= 0) {
        car.smoke += dt;
        car.speed = Math.max(0, car.speed - 20 * dt);
        car.x += Math.sin(car.yaw) * car.speed * dt;
        car.z += Math.cos(car.yaw) * car.speed * dt;
        car.mesh.group.position.set(car.x, 0, car.z);
        // Flash the light bar while it burns out, then remove it.
        if (car.mesh.lightBar) car.mesh.lightBar.visible = Math.floor(car.smoke * 6) % 2 === 0;
        if (car.smoke > 5) {
          this.scene.remove(car.mesh.group);
          const i = this.chase.indexOf(car);
          if (i >= 0) this.chase.splice(i, 1);
        }
        continue;
      }
      const dx = px - car.x;
      const dz = pz - car.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      nearest = Math.min(nearest, d);
      const targetYaw = Math.atan2(dx, dz);
      car.yaw = angleLerp(car.yaw, targetYaw, Math.min(1, dt * 2.2));
      // Ram the player; ease off when right on top of them.
      const wantSpeed = d > 6 ? CFG.policeMaxSpeed : Math.max(6, d * 1.5);
      car.speed += clamp(wantSpeed - car.speed, -30 * dt, 14 * dt);
      car.x += Math.sin(car.yaw) * car.speed * dt;
      car.z += Math.cos(car.yaw) * car.speed * dt;
      // Keep cruisers out of buildings.
      for (const c of colliders) {
        const nx = clamp(car.x, c.minX, c.maxX);
        const nz = clamp(car.z, c.minZ, c.maxZ);
        const ddx = car.x - nx;
        const ddz = car.z - nz;
        const dd = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dd < 1.7) {
          if (dd > 0.001) {
            car.x = nx + (ddx / dd) * 1.7;
            car.z = nz + (ddz / dd) * 1.7;
          }
          car.speed *= 0.4;
        }
      }
      car.x = clamp(car.x, -205, 205);
      car.z = clamp(car.z, -205, 200);
      car.mesh.group.position.set(car.x, 0, car.z);
      car.mesh.group.rotation.y = car.yaw;
      for (const w of car.mesh.wheels) w.rotation.x += car.speed * dt * 2.2;
      if (car.mesh.lightBar) {
        car.mesh.lightBar.visible = Math.floor(performance.now() / 160) % 2 === 0;
      }
      if (d < 3.2) touching = true;
      if (d < 4.5 && car.speed > 8) {
        player.hitByPolice = { speed: car.speed, at: performance.now() };
      }
    }

    // Wanted decay: out of sight for a while and the heat cools off.
    if (nearest < 70) this.nearTimer = 0;
    else this.nearTimer += dt;
    if (touching) this.bustedTimer += dt;
    else this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);

    const anyChase = this.chase.some((c) => c.health > 0);
    if (audio) audio.setSiren(anyChase);
    return { nearest, touching, bustedHold: this.bustedTimer > 2.2 };
  }

  damage(car, amount) {
    car.health -= amount;
    if (car.health <= 0) {
      car.speed = Math.max(car.speed, 4);
    }
    return car.health;
  }

  allCruisers() {
    return [...this.patrol, ...this.chase];
  }

  reset() {
    for (const car of this.chase) this.scene.remove(car.mesh.group);
    this.chase = [];
    this.bustedTimer = 0;
    this.nearTimer = 0;
  }
}
