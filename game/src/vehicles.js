// Cars for Sunset Shores. Every vehicle is assembled from boxes and
// cylinders in code — body, cabin, wheels, lights — so the game needs no
// model files. Sedans, taxis and police cruisers share one builder.
import * as THREE from 'three';
import { range } from './config.js';

export const CAR_COLORS = [
  0xd94f3d, 0x3d7dd9, 0xe8c832, 0x2fae8f, 0xe8e4da,
  0xe87a2a, 0x8a5fd0, 0x5fae3d, 0x9aa5b1, 0x22242e,
];

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });

export function makeCar(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(sx, 0.65, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(sx, 0.65, -2.22);
    group.add(tail);
  }

  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  let lightBar = null;
  if (kind === 'police') {
    // Black-and-white cruiser with a red/blue light bar.
    body.material = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.4), new THREE.MeshLambertMaterial({ color: 0x1c1e26 }));
    hood.position.set(0, 0.75, -1.4);
    group.add(hood);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.32;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.72, -0.2);
    group.add(lightBar);
  } else if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    sign.position.set(0, 1.75, -0.2);
    group.add(sign);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    stripe.position.y = 0.72;
    group.add(stripe);
  }

  group.userData.kind = kind;
  return { group, wheels, lightBar, bodyMat };
}

// A simple car state object: position, heading, speed and its mesh.
export function makeCarState(scene, x, z, yaw, color, kind = 'sedan') {
  const mesh = makeCar(color, kind);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = yaw;
  scene.add(mesh.group);
  return {
    mesh,
    x,
    z,
    yaw,
    speed: 0,
    steer: 0,
    health: 100,
    kind,
    alive: true,
  };
}

// Parked cars along the kerbs, ready to be stolen with E.
export function spawnParkedCars(scene, rng, count) {
  const cars = [];
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * 40);
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 400) {
    guard++;
    const horizontal = rng() < 0.5;
    const street = streets[Math.floor(rng() * streets.length)];
    const along = Math.floor(range(rng, -190, 190) / 40) * 40 + range(rng, -14, 14);
    const x = horizontal ? along : street + (rng() < 0.5 ? 3.4 : -3.4);
    const z = horizontal ? street + (rng() < 0.5 ? 3.4 : -3.4) : along;
    if (Math.abs(x) > 200 || Math.abs(z) > 195) continue;
    // Keep the spawn area in front of Mara's home clear.
    if (Math.abs(x + 20) < 10 && Math.abs(z + 8) < 10) continue;
    const yaw = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const kind = rng() < 0.12 ? 'taxi' : 'sedan';
    const color = kind === 'taxi' ? 0xf5c518 : CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    cars.push(makeCarState(scene, x, z, yaw, color, kind));
    placed++;
  }
  return cars;
}

// Arcade driving: accelerate, brake/reverse, steer. Returns the new state.
export function driveCar(car, input, dt, maxSpeed) {
  const forward = input.y;
  const steerInput = input.x;
  if (forward > 0) car.speed += 16 * dt * forward;
  else if (forward < 0) {
    car.speed += car.speed > 0.5 ? -30 * dt : -9 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-10, Math.min(maxSpeed, car.speed));
  const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turnRate = car.steer * Math.min(1, Math.abs(car.speed) / 8) * 1.9;
  car.yaw += turnRate * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  car.mesh.group.position.set(car.x, 0, car.z);
  car.mesh.group.rotation.y = car.yaw;
  for (const w of car.mesh.wheels) w.rotation.x += car.speed * dt * 2.2;
  return car;
}
