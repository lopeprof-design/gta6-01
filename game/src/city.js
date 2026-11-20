// Port Solano: the city itself. A grid of sun-warmed streets, procedural
// buildings with lit windows, lamps, palms, a sand beach and the sea to the
// south, plus a wooden pier. Everything is built from boxes, cylinders and
// canvas textures — no loaded models, no network.
import * as THREE from 'three';
import { CFG, mulberry32, pick, range } from './config.js';

const PALETTE = [
  0xff8a66, 0xffb36b, 0xffd27d, 0x7fd1c0, 0x6fa8d8,
  0xc9a7e8, 0xf2e3c9, 0x9fd08a, 0xe86a7a, 0x8ecae6,
];

function facadeTexture(baseColor, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // Slight vertical shade so tall towers read as one volume.
  const shade = g.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 256);
  // Window grid; some windows glow warm against the sunset.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : 'rgba(30,40,60,0.85)';
      g.fillRect(10 + col * 23, 12 + row * 24, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2e2a5e');
  grad.addColorStop(0.45, '#c65d7b');
  grad.addColorStop(0.72, '#ff9e57');
  grad.addColorStop(1, '#ffd27d');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Sunset sky and haze.
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xe88a5a, 90, 520);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4a6a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 70, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(sun.target);

  // Low sun disc on the horizon over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sunDisc.position.set(-40, 26, 480);
  scene.add(sunDisc);

  // Ground: warm pavement for the city, sand for the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 470),
    new THREE.MeshLambertMaterial({ color: 0xb8a88f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 48),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9e }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 222);
  sand.receiveShadow = true;
  group.add(sand);

  // The sea, gently animated by main.js.
  const oceanGeo = new THREE.PlaneGeometry(700, 340, 48, 24);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({ color: 0x2a6f8f, shininess: 90, specular: 0xff9e57 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, 400);
  group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  // Roads: dark strips on both axes plus dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const streets = [];
  for (let i = -5; i <= 5; i++) streets.push(i * CFG.pitch);
  for (const c of streets) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(420, CFG.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.03, horizontal ? c : 0);
      road.receiveShadow = true;
      group.add(road);
      // Centre dashes.
      for (let t = -200; t <= 200; t += 12) {
        if (Math.abs(((t % 40) + 40) % 40) < 14) continue; // keep intersections clear
        const dash = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 5 : 0.5, 0.06, horizontal ? 0.5 : 5), lineMat);
        dash.position.set(horizontal ? t : c, 0.05, horizontal ? c : t);
        group.add(dash);
      }
    }
  }

  // Sidewalk strips along every road, slightly raised.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xcfc0a4 });
  for (const c of streets) {
    for (const horizontal of [true, false]) {
      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(420, 0.12, 3), walkMat);
        const off = c + side * (CFG.roadWidth / 2 + 1.5);
        strip.position.set(horizontal ? 0 : off, 0.06, horizontal ? off : 0);
        if (!horizontal) strip.rotation.y = Math.PI / 2;
        strip.receiveShadow = true;
        group.add(strip);
      }
    }
  }

  // Buildings, block by block. Reserved blocks stay open for landmarks.
  const reserved = new Set(['-20,-20', '60,60', '-60,60', '20,140']);
  const textures = PALETTE.map((c) => facadeTexture('#' + c.toString(16).padStart(6, '0'), 0.45, rng));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a3f3a });
  for (let i = -5; i < 5; i++) {
    for (let j = -5; j < 5; j++) {
      const cx = i * CFG.pitch + CFG.pitch / 2;
      const cz = j * CFG.pitch + CFG.pitch / 2;
      if (reserved.has(cx + ',' + cz)) continue;
      if (cz > 180) continue; // beach blocks stay open
      const kind = rng();
      const slots = kind < 0.55
        ? [{ dx: 0, dz: 0, w: 22, d: 22 }]
        : [
          { dx: -6, dz: -6, w: 11, d: 11 },
          { dx: 6, dz: -6, w: 11, d: 11 },
          { dx: -6, dz: 6, w: 11, d: 11 },
          { dx: 6, dz: 6, w: 11, d: 11 },
        ];
      for (const s of slots) {
        const h = range(rng, 8, kind < 0.55 ? 42 : 20);
        const tex = pick(rng, textures);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, h, s.d), mat);
        b.position.set(cx + s.dx, h / 2, cz + s.dz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.6, 0.5, s.d + 0.6), roofMat);
        roof.position.set(cx + s.dx, h + 0.25, cz + s.dz);
        group.add(roof);
        colliders.push({
          minX: cx + s.dx - s.w / 2, maxX: cx + s.dx + s.w / 2,
          minZ: cz + s.dz - s.d / 2, maxZ: cz + s.d / 2,
        });
      }
    }
  }

  // Hospital: white tower with a glowing red cross (respawn point).
  const hospital = new THREE.Mesh(
    new THREE.BoxGeometry(24, 26, 24),
    new THREE.MeshLambertMaterial({ color: 0xf2f0ea }),
  );
  hospital.position.set(60, 13, 60);
  hospital.castShadow = true;
  group.add(hospital);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 1), crossMat);
  crossV.position.set(60, 29, 47.6);
  group.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 1), crossMat);
  crossH.position.set(60, 29, 47.6);
  group.add(crossH);
  colliders.push({ minX: 48, maxX: 72, minZ: 48, maxZ: 72 });

  // Mara's home: a small house with a pitched roof (start point).
  const home = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xffd9a0 }),
  );
  home.position.set(-20, 3, -20);
  home.castShadow = true;
  group.add(home);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9.5, 4, 4),
    new THREE.MeshLambertMaterial({ color: 0xb5503c }),
  );
  roof.position.set(-20, 8, -20);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);
  colliders.push({ minX: -26, maxX: -14, minZ: -25, maxZ: -15 });

  // A little park with palms in one open block.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4f9e57 });
  for (let k = 0; k < 8; k++) {
    const px = -60 + range(rng, -10, 10);
    const pz = 60 + range(rng, -10, 10);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 6), trunkMat);
    trunk.position.set(px, 2.5, pz);
    trunk.castShadow = true;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), leafMat);
    top.position.set(px, 6, pz);
    top.scale.y = 0.7;
    top.castShadow = true;
    group.add(top);
  }

  // Street lamps and palms along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e2e34 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
  for (const c of streets) {
    for (let t = -180; t <= 180; t += 80) {
      for (const horizontal of [true, false]) {
        const x = horizontal ? t : c + 6.5;
        const z = horizontal ? c + 6.5 : t;
        if (Math.abs(x) > 205 || Math.abs(z) > 195) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
        pole.position.set(x, 3, z);
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
        head.position.set(x, 6.2, z);
        group.add(head);
      }
    }
  }
  // Palms along the beachfront.
  for (let x = -190; x <= 190; x += 24) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6, 6), trunkMat);
    trunk.position.set(x, 3, 196);
    trunk.castShadow = true;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 6), leafMat);
    top.position.set(x, 7, 196);
    top.scale.y = 0.65;
    top.castShadow = true;
    group.add(top);
  }

  // Wooden pier reaching into the sea (mission 1 target).
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 52), pierMat);
  pier.position.set(0, 0.9, 226);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  for (let z = 206; z <= 250; z += 11) {
    for (const sx of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6), pierMat);
      post.position.set(sx, 0.4, z);
      group.add(post);
    }
  }
  // Harbour warehouse at the west beach (mission 3 target).
  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(20, 10, 14),
    new THREE.MeshLambertMaterial({ color: 0x5a7d8a }),
  );
  warehouse.position.set(-156, 5, 214);
  warehouse.castShadow = true;
  group.add(warehouse);
  colliders.push({ minX: -166, maxX: -146, minZ: 207, maxZ: 221 });

  // Far skyline silhouettes for depth.
  const silMat = new THREE.MeshBasicMaterial({ color: 0x6a4a72, fog: true });
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    const r = range(rng, 330, 420);
    const h = range(rng, 30, 110);
    const w = range(rng, 18, 34);
    const sil = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), silMat);
    sil.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r + 40);
    group.add(sil);
  }

  return {
    colliders,
    ocean,
    oceanBase,
    sun,
    homePos: { x: -20, z: -8 },
    hospitalPos: { x: 60, z: 44 },
    pierEnd: { x: 0, z: 246 },
    harborPos: { x: -156, z: 222 },
    streets,
  };
}

// Keep a moving circle (player, car, pedestrian) out of building boxes.
export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const pl = x - c.minX;
        const pr = c.maxX - x;
        const pt = z - c.minZ;
        const pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z };
}
