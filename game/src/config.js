// Sunset Shores — shared tuning numbers, world layout and small helpers.
// The whole game reads its sizes, speeds and money values from here so one
// file is the place to rebalance anything.
export const CFG = {
  // World: a square city grid, a sand strip, then the sea to the south (+z).
  cityHalf: 200,
  beachStart: 200,
  waterStart: 238,
  worldLimit: 262,
  roadWidth: 10,
  blockSize: 30,
  pitch: 40, // road centre to road centre
  streetCount: 11, // streets at -200, -160, ... 200
  // Player on foot.
  walkSpeed: 6,
  runSpeed: 10,
  playerRadius: 0.7,
  playerHealth: 100,
  // Cars.
  carAccel: 16,
  carBrake: 30,
  carReverse: 9,
  carMaxSpeed: 34,
  policeMaxSpeed: 38,
  trafficSpeed: 9,
  carRadius: 1.6,
  // Combat.
  pistolDamage: 34,
  pistolAmmo: 30,
  pistolRange: 90,
  punchDamage: 25,
  punchRange: 2.6,
  // Wanted.
  wantedDecaySeconds: 8,
  maxWanted: 5,
  // Money.
  startMoney: 120,
  missionRewards: [150, 250, 500],
  packageBonus: 50,
  bustedFine: 100,
  // Day cycle (sunset game: the clock starts late afternoon).
  startHour: 17.4,
};

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    brief: 'Mara, antar paket ini ke ujung Dermaga Solano sebelum matahari tenggelam.',
    objective: 'Antar paket ke Dermaga Solano',
    target: { x: 0, z: 246 },
    radius: 9,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    brief: 'Tiga paket menunggu di penjuru kota. Ambil semuanya, jangan sampai ketahuan.',
    objective: 'Kumpulkan 3 paket di kota',
    packages: [
      { x: -76, z: -76 },
      { x: 84, z: 36 },
      { x: -36, z: 124 },
    ],
    radius: 5,
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    brief: 'Polisi sudah mengendusmu. Kabur ke Pelabuhan Barat dan hilang dari radar mereka.',
    objective: 'Kabur ke Pelabuhan Barat dengan wanted 3',
    target: { x: -156, z: 222 },
    radius: 10,
    wanted: 3,
  },
];

// Deterministic random numbers: the same seed builds the same city, which
// keeps the ?shot= screenshots repeatable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference, for smooth turning.
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDelta(a, b) * t;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
