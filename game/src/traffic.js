// Street traffic for Port Solano. AI cars drive the road grid in their lane,
// turn at intersections, and slow down for the car ahead — enough life to
// make the streets feel busy without any pathfinding.
import { CFG, clamp, mulberry32, range } from './config.js';
import { CAR_COLORS, makeCarState } from './vehicles.js';

export class Traffic {
  constructor(scene, seed, count = 22) {
    this.scene = scene;
    this.rng = mulberry32(seed + 77);
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const horizontal = this.rng() < 0.5;
      const street = Math.floor(range(this.rng, -5, 5)) * CFG.pitch;
      const along = range(this.rng, -195, 195);
      const dir = this.rng() < 0.5 ? 1 : -1;
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const lane = 2.6; // right-hand lane
      const x = horizontal ? along : street + lane * dir;
      const z = horizontal ? street - lane * dir : along;
      const yaw = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const car = makeCarState(scene, x, z, yaw, color, 'sedan');
      car.axis = horizontal ? 'x' : 'z';
      car.dir = dir;
      car.street = street;
      car.cruise = range(this.rng, 7, 11);
      car.speed = car.cruise;
      car.lastBlock = Math.floor(along / CFG.pitch);
      this.cars.push(car);
    }
  }

  // Turn at an intersection or keep going straight.
  _maybeTurn(car, along) {
    const block = Math.floor(along / CFG.pitch);
    if (block === car.lastBlock) return;
    car.lastBlock = block;
    const atEdge = Math.abs(along) > 190;
    if (!atEdge && this.rng() < 0.62) return; // usually straight on
    // Turn onto the crossing street.
    const newStreet = Math.round(along / CFG.pitch) * CFG.pitch;
    const newDir = this.rng() < 0.5 ? 1 : -1;
    const oldStreet = car.street;
    car.axis = car.axis === 'x' ? 'z' : 'x';
    car.street = newStreet;
    car.dir = newDir;
    car.lastBlock = Math.floor(oldStreet / CFG.pitch);
    const lane = 2.6;
    if (car.axis === 'x') {
      car.z = newStreet - lane * newDir;
      car.x = oldStreet;
    } else {
      car.x = newStreet + lane * newDir;
      car.z = oldStreet;
    }
  }

  update(dt, obstacles) {
    for (const car of this.cars) {
      if (!car.alive) continue;
      // Slow for the car ahead in the same lane.
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car || !other.alive) continue;
        if (other.axis !== car.axis || other.street !== car.street || other.dir !== car.dir) continue;
        const ahead = car.axis === 'x'
          ? (other.x - car.x) * car.dir
          : (other.z - car.z) * car.dir;
        if (ahead > 0 && ahead < 9) {
          target = 0;
          break;
        }
      }
      // And for a nearby obstacle (the player's car counts).
      for (const ob of obstacles) {
        const dx = ob.x - car.x;
        const dz = ob.z - car.z;
        const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (ahead > 0 && ahead < 8 && side < 3) {
          target = 0;
          break;
        }
      }
      car.speed += clamp(target - car.speed, -14 * dt, 6 * dt);
      const step = car.speed * car.dir * dt;
      if (car.axis === 'x') {
        car.x += step;
        this._maybeTurn(car, car.x);
        car.yaw = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.z += step;
        this._maybeTurn(car, car.z);
        car.yaw = car.dir > 0 ? 0 : Math.PI;
      }
      car.x = clamp(car.x, -205, 205);
      car.z = clamp(car.z, -205, 205);
      car.mesh.group.position.set(car.x, 0, car.z);
      car.mesh.group.rotation.y = car.yaw;
      for (const w of car.mesh.wheels) w.rotation.x += car.speed * dt * 2.2;
    }
  }

  // Remove a car from the world (used when the player steals a traffic car).
  remove(car) {
    car.alive = false;
    this.scene.remove(car.mesh.group);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
}
