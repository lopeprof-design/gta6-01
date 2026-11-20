// Sunset Shores — the game itself. Mara Voss, courier-for-hire in Port
// Solano, a sun-soaked fictional city. Walk it, steal a car, outrun the
// police, run three jobs, and watch the sun go down over the sea.
//
// This file owns the loop: input, the player on foot and behind the wheel,
// the camera, wanted stars, health and busted, saving, and the screens
// around the game. The city, traffic, police, missions and combat live in
// their own modules and are driven from here.
import * as THREE from 'three';
import { CFG, MISSIONS, clamp, lerp, angleLerp, mulberry32, dist2d, formatMoney } from './config.js';
import { buildCity, collideCircle } from './city.js';
import { makeCarState, driveCar, spawnParkedCars, CAR_COLORS } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { applyShotMode } from './shots.js';

const SAVE_KEY = 'sunset-shores-save-v1';

class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.seed = Number(this.params.get('seed') || 1);
    this.rng = mulberry32(this.seed * 1000 + 7);
    this.state = {
      mode: 'menu', // menu | playing | paused | busted | complete
      inCar: false,
      money: CFG.startMoney,
      health: CFG.playerHealth,
      ammo: CFG.pistolAmmo,
      wanted: 0,
      hour: CFG.startHour,
      shot: null,
    };
    this.player = { x: -20, z: -8, yaw: 0, speed: 0, mesh: null };
    this.currentCar = null;
    this.camYaw = Math.PI;
    this.camPitch = 0.35;
    this.camDist = 9;
    this.camMode = 0; // 0 close chase, 1 far chase, 2 high
    this.shotAutoDrive = false;
    this.saveTimer = 0;
    this.hurtCooldown = 0;
    this.bustedTimer = 0;
    this.hitFlash = 0;
    this.clock = new THREE.Clock();
  }

  init() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.city = buildCity(this.scene, this.seed);
    this.parkedCars = spawnParkedCars(this.scene, this.rng, 16);
    this.traffic = new Traffic(this.scene, this.seed, 22);
    this.peds = new Pedestrians(this.scene, this.seed, 26);
    this.police = new Police(this.scene, this.seed);
    this.combat = new Combat(this.scene);
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.hud = new Hud();
    this.missions = new Missions(this.scene, this.city, {
      onReward: (amount, title) => {
        this.state.money += amount;
        this.audio.missionDone();
        this.hud.toast('Misi selesai: ' + title + '  +' + formatMoney(amount));
        this.save();
      },
      onPackage: (n, total) => {
        this.state.money += 50;
        this.audio.pickup();
        this.hud.toast('Paket ' + n + '/' + total + ' diamankan  +$50');
      },
      onWanted: (level) => {
        this.state.wanted = Math.max(this.state.wanted, level);
        this.hud.toast('Polisi mengendusmu! Wanted naik ke ' + level + ' bintang.');
      },
      onStoryDone: () => {
        this.state.mode = 'complete';
        this.audio.missionDone();
        document.getElementById('complete-screen').classList.add('show');
        document.getElementById('complete-stats').textContent =
          'Uang: ' + formatMoney(this.state.money) + '  ·  Semua misi selesai.';
        this.save();
      },
    });

    this.player.mesh = this._makePlayerMesh();
    this.scene.add(this.player.mesh);
    this.player.mesh.position.set(this.player.x, 0, this.player.z);

    this._wireButtons();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.audio.setMuted(!this.audio.muted);
    });

    if (this.params.has('shot')) {
      applyShotMode(this, this.params);
    } else {
      this._showStart();
    }

    // Exposed for automated checks: window.__game.state.mode etc.
    window.__game = { state: this.state, player: this.player, missions: this.missions, game: this, version: 'sunset-shores-1' };
    this.renderer.setAnimationLoop(() => this.tick());
  }

  _makePlayerMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2fae8f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), jacket);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.66;
    head.castShadow = true;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x3a2a1e }));
    hair.position.y = 1.7;
    g.add(hair);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.32), dark);
    legs.position.y = 0.35;
    g.add(legs);
    // A courier satchel on the shoulder.
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.4), new THREE.MeshLambertMaterial({ color: 0xe8c832 }));
    bag.position.set(0.36, 1.05, 0);
    g.add(bag);
    return g;
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _wireButtons() {
    document.getElementById('btn-start').addEventListener('click', () => this.startGame({}));
    document.getElementById('btn-continue').addEventListener('click', () => this.startGame({ fromSave: true }));
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause(false));
    document.getElementById('btn-restart').addEventListener('click', () => {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    });
    document.getElementById('btn-busted').addEventListener('click', () => this.respawn());
    document.getElementById('btn-roam').addEventListener('click', () => {
      document.getElementById('complete-screen').classList.remove('show');
      this.state.mode = 'playing';
    });
    document.getElementById('btn-mute').addEventListener('click', (e) => {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      e.target.textContent = this.audio.muted ? 'Suara: Mati (M)' : 'Suara: Hidup (M)';
    });
  }

  _showStart() {
    const save = this._readSave();
    document.getElementById('btn-continue').style.display = save ? 'inline-block' : 'none';
    document.getElementById('start-screen').classList.add('show');
  }

  _readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.state.money,
        mission: this.missions.index,
        health: this.state.health,
        ammo: this.state.ammo,
        x: this.player.x,
        z: this.player.z,
        hour: this.state.hour,
      }));
    } catch { /* storage full or blocked — the game still plays */ }
  }

  startGame(opts) {
    this.audio.ensure();
    if (opts.fromSave) {
      const save = this._readSave();
      if (save) {
        this.state.money = save.money ?? CFG.startMoney;
        this.state.health = save.health ?? CFG.playerHealth;
        this.state.ammo = save.ammo ?? CFG.pistolAmmo;
        this.state.hour = save.hour ?? CFG.startHour;
        this.player.x = save.x ?? this.city.homePos.x;
        this.player.z = save.z ?? this.city.homePos.z;
        this.missions.jumpTo(save.mission ?? 0);
        this.hud.toast('Save dimuat — lanjutkan pekerjaanmu, Mara.');
      }
    }
    document.getElementById('start-screen').classList.remove('show');
    document.getElementById('pause-screen').classList.remove('show');
    this.state.mode = 'playing';
  }

  // ---- shot-mode helpers (used by shots.js) ----
  spawnPlayerCar(x, z, yaw) {
    const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
    const car = makeCarState(this.scene, x, z, yaw, color, 'sedan');
    this.parkedCars.push(car);
    return car;
  }

  forceEnterCar(car) {
    this.currentCar = car;
    this.state.inCar = true;
    this.player.mesh.visible = false;
    const i = this.parkedCars.indexOf(car);
    if (i >= 0) this.parkedCars.splice(i, 1);
  }

  teleportPlayer(x, z, yaw) {
    this.player.x = x;
    this.player.z = z;
    this.player.yaw = yaw;
    this.player.mesh.position.set(x, 0, z);
    this.player.mesh.rotation.y = yaw;
  }

  setWanted(level) {
    this.state.wanted = level;
  }

  setCameraOrbit(yaw, pitch, dist) {
    this.camYaw = yaw;
    this.camPitch = pitch;
    this.camDist = dist;
  }

  // ---- entering / leaving cars ----
  _nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    const all = [...this.parkedCars, ...this.traffic.cars];
    for (const car of all) {
      const d = dist2d(this.player.x, this.player.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar() {
    const car = this._nearestCar(4.5);
    if (!car) return;
    if (this.traffic.cars.includes(car)) {
      this.traffic.remove(car);
      this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 1);
      this.hud.toast('Mobil dicuri! Polisi waspada. ★');
    } else {
      this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 1);
      this.hud.toast('Mobil dicuri! Polisi waspada. ★');
      const i = this.parkedCars.indexOf(car);
      if (i >= 0) this.parkedCars.splice(i, 1);
    }
    this.currentCar = car;
    this.state.inCar = true;
    this.player.mesh.visible = false;
    this.audio.pickup();
  }

  exitCar() {
    const car = this.currentCar;
    if (!car) return;
    this.player.x = car.x - Math.sin(car.yaw + Math.PI / 2) * 2.2;
    this.player.z = car.z - Math.cos(car.yaw + Math.PI / 2) * 2.2;
    this.player.yaw = car.yaw;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.parkedCars.push(car);
    this.currentCar = null;
    this.state.inCar = false;
  }

  togglePause(force) {
    if (this.state.mode !== 'playing' && this.state.mode !== 'paused') return;
    const pause = force !== undefined ? force : this.state.mode === 'playing';
    this.state.mode = pause ? 'paused' : 'playing';
    document.getElementById('pause-screen').classList.toggle('show', pause);
  }

  respawn() {
    document.getElementById('busted-screen').classList.remove('show');
    if (this.currentCar) {
      this.parkedCars.push(this.currentCar);
      this.currentCar = null;
      this.state.inCar = false;
    }
    this.player.mesh.visible = true;
    this.teleportPlayer(this.city.hospitalPos.x, this.city.hospitalPos.z, 0);
    this.state.health = CFG.playerHealth;
    this.state.money = Math.max(0, this.state.money - CFG.bustedFine);
    this.state.wanted = 0;
    this.state.ammo = CFG.pistolAmmo;
    this.police.reset();
    this.state.mode = 'playing';
    this.hud.toast('Dibebaskan dari rumah sakit. Denda $' + CFG.bustedFine + ' dipotong.');
  }

  _busted(reason) {
    if (this.state.mode !== 'playing') return;
    this.state.mode = 'busted';
    this.audio.busted();
    this.audio.setSiren(false);
    document.getElementById('busted-reason').textContent = reason;
    document.getElementById('busted-screen').classList.add('show');
    this.save();
  }

  // ---- per-frame updates ----
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const input = this.input;

    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      if (this.state.mode === 'playing' || this.state.mode === 'paused') this.togglePause();
    }
    if (this.state.mode === 'playing') {
      if (input.wasPressed('KeyC')) this.camMode = (this.camMode + 1) % 3;
      if (input.wasPressed('KeyE')) {
        if (this.state.inCar) this.exitCar();
        else this.enterCar();
      }
      if (input.wasPressed('KeyF') && !this.state.inCar) {
        const hit = this.combat.punch(this.player.x, this.player.z, this.player.yaw, this.peds, this.police.allCruisers());
        if (hit) {
          this.audio.punch();
          if (hit.type === 'ped') {
            this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 1);
            this.hud.toast('Kamu memukul pejalan kaki! Wanted naik.');
          }
        }
      }
      if (input.takeClick() && !this.state.inCar) this._shoot();
      this._updatePlayer(dt);
      this._updateCar(dt);
      this._updateWorld(dt);
      this.hud.update(this.state, this.missions, Math.abs((this.currentCar?.speed || 0)) * 3.6);
      this.hud.drawMinimap(this);
      this.saveTimer += dt;
      if (this.saveTimer > 8) {
        this.saveTimer = 0;
        this.save();
      }
    }

    this._updateCamera(dt);
    this._updateOcean();
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  _shoot() {
    const targets = [];
    for (const car of this.police.allCruisers()) targets.push({ mesh: car.mesh, kind: 'police', car });
    for (const car of this.traffic.cars) targets.push({ mesh: car.mesh, kind: 'car', car });
    for (const car of this.parkedCars) targets.push({ mesh: car.mesh, kind: 'car', car });
    for (const p of this.peds.list) {
      if (p.state !== 'down') targets.push({ mesh: { group: p.mesh }, kind: 'ped', ped: p });
    }
    const hit = this.combat.shoot(this.camera, this.state, targets);
    if (this.state.ammo < 0) this.state.ammo = 0;
    this.audio.shot();
    if (!hit) return;
    if (hit.kind === 'police') {
      const hp = this.police.damage(hit.car, CFG.pistolDamage);
      this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 1);
      if (hp <= 0) this.hud.toast('Mobil polisi hancur!');
    } else if (hit.kind === 'ped') {
      this.peds.knockDown(hit.ped);
      this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 2);
      this.hud.toast('Kamu menembak pejalan kaki! Wanted naik 2 bintang.');
    }
  }

  // The playable land: the city square plus the pier (a narrow strip out to
  // sea, |x| under half the pier width). Everywhere else the water stops you.
  _clampWorld(x, z, radius) {
    x = clamp(x, -208, 208);
    const pierHalf = 4.5 - radius;
    z = Math.abs(x) <= pierHalf ? clamp(z, -208, 250) : clamp(z, -208, 236);
    return { x, z };
  }

  _updatePlayer(dt) {
    if (this.state.inCar) return;
    const mouse = this.input.takeMouse();
    this.camYaw -= mouse.dx * 0.005;
    this.camPitch = clamp(this.camPitch + mouse.dy * 0.004, 0.08, 1.15);
    this.camDist = clamp(this.camDist + this.input.takeWheel() * 0.01, 4, 14);

    const axes = this.input.moveAxes();
    const running = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const speed = running ? CFG.runSpeed : CFG.walkSpeed;
    // Forward is away from the camera.
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const rx = -fz;
    const rz = fx;
    let mx = fx * axes.y + rx * axes.x;
    let mz = fz * axes.y + rz * axes.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.player.x += mx * speed * dt;
      this.player.z += mz * speed * dt;
      const targetYaw = Math.atan2(mx, mz);
      this.player.yaw = angleLerp(this.player.yaw, targetYaw, Math.min(1, dt * 12));
      this.player.speed = speed;
    } else {
      this.player.speed = 0;
    }
    const hit = collideCircle(this.city.colliders, this.player.x, this.player.z, CFG.playerRadius);
    const clamped = this._clampWorld(hit.x, hit.z, CFG.playerRadius);
    this.player.x = clamped.x;
    this.player.z = clamped.z;
    // Walking bob.
    const bob = this.player.speed > 0 ? Math.abs(Math.sin(performance.now() / 140)) * 0.06 : 0;
    this.player.mesh.position.set(this.player.x, bob, this.player.z);
    this.player.mesh.rotation.y = this.player.yaw;
    // Sun shadow follows the player.
    this.city.sun.position.set(this.player.x - 120, 70, this.player.z + 180);
    this.city.sun.target.position.set(this.player.x, 0, this.player.z);
  }

  _updateCar(dt) {
    if (!this.state.inCar || !this.currentCar) return;
    const car = this.currentCar;
    let axes = this.input.moveAxes();
    if (this.shotAutoDrive) {
      // Gentle autopilot for screenshots: cruise the avenue, brake for cars.
      let clear = true;
      for (const other of [...this.traffic.cars, ...this.parkedCars]) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw);
        const side = Math.abs(dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw));
        if (ahead > 0 && ahead < 14 && side < 3) {
          clear = false;
          break;
        }
      }
      axes = { x: 0, y: clear ? 1 : 0 };
      if (!clear && car.speed > 6) axes.y = -1;
    }
    driveCar(car, axes, dt, CFG.carMaxSpeed);
    // Buildings stop the car.
    const before = { x: car.x, z: car.z };
    const hit = collideCircle(this.city.colliders, car.x, car.z, CFG.carRadius);
    if (hit.x !== before.x || hit.z !== before.z) {
      if (Math.abs(car.speed) > 10) this.audio.crash();
      car.speed *= 0.45;
      car.x = hit.x;
      car.z = hit.z;
      car.mesh.group.position.set(car.x, 0, car.z);
    }
    const cc = this._clampWorld(car.x, car.z, CFG.carRadius);
    car.x = cc.x;
    car.z = cc.z;
    this.player.x = car.x;
    this.player.z = car.z;
    // Bump into other cars and pedestrians.
    const others = [...this.traffic.cars, ...this.parkedCars, ...this.police.allCruisers()];
    for (const other of others) {
      if (other === car) continue;
      const d = dist2d(car.x, car.z, other.x, other.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (car.x - other.x) / d;
        const nz = (car.z - other.z) / d;
        car.x += nx * push;
        car.z += nz * push;
        if (Math.abs(car.speed) > 12) {
          this.state.health -= 4;
          this.audio.crash();
          this.hurtCooldown = 0.5;
        }
        car.speed *= 0.7;
      }
    }
    for (const p of this.peds.list) {
      if (p.state === 'down') continue;
      const d = dist2d(car.x, car.z, p.x, p.z);
      if (d < 2.3 && Math.abs(car.speed) > 4) {
        this.peds.knockDown(p);
        this.state.wanted = Math.min(CFG.maxWanted, this.state.wanted + 1);
        this.audio.crash();
        this.hud.toast('Kamu menabrak pejalan kaki! Wanted naik.');
        car.speed *= 0.6;
      }
    }
    this.city.sun.position.set(car.x - 120, 70, car.z + 180);
    this.city.sun.target.position.set(car.x, 0, car.z);
    this.audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
  }

  _updateWorld(dt) {
    const px = this.player.x;
    const pz = this.player.z;
    const playerSpeed = this.state.inCar ? Math.abs(this.currentCar?.speed || 0) : this.player.speed;
    const obstacles = this.state.inCar && this.currentCar ? [this.currentCar] : [];
    this.traffic.update(dt, obstacles);
    this.peds.update(dt, { x: px, z: pz }, playerSpeed);
    this.police.syncChase(this.state.wanted, px, pz);
    const res = this.police.update(dt, this.player, this.city.colliders, this.audio);
    // Wanted cools off when no cruiser has been near for a while.
    if (this.state.wanted > 0 && this.police.nearTimer > CFG.wantedDecaySeconds) {
      this.state.wanted--;
      this.police.nearTimer = 0;
      this.hud.toast('Panas mereda — wanted turun ke ' + this.state.wanted + ' bintang.');
    }
    // A cruiser ramming the player hurts.
    this.hurtCooldown -= dt;
    if (this.player.hitByPolice && this.hurtCooldown <= 0) {
      const hit = this.player.hitByPolice;
      if (performance.now() - hit.at < 400) {
        this.state.health -= Math.round(hit.speed * 0.5);
        this.hurtCooldown = 0.6;
        this.audio.crash();
      }
      this.player.hitByPolice = null;
    }
    this.missions.update(dt, px, pz);
    this.combat.update(dt, px, pz, this.state, {
      onPickup: (kind) => {
        this.audio.pickup();
        this.hud.toast(kind === 'health' ? 'Health +50' : 'Amunisi penuh!');
      },
    });
    this.state.hour = (this.state.hour + dt * 0.008) % 24;
    if (this.state.health <= 0) {
      this._busted('Kesehatanmu habis di tangan polisi Port Solano.');
    } else if (res.bustedHold && !this.state.inCar) {
      this._busted('Polisi menangkapmu di jalan.');
    }
    if (!this.state.inCar) this.audio.setEngine(0, false);
  }

  _updateCamera(dt) {
    const target = this.state.inCar && this.currentCar
      ? { x: this.currentCar.x, z: this.currentCar.z, y: 1.6 }
      : { x: this.player.x, z: this.player.z, y: 1.7 };
    let dist = this.camDist;
    let height = 0;
    if (this.state.inCar) {
      const car = this.currentCar;
      const wantYaw = car.yaw + Math.PI;
      this.camYaw = angleLerp(this.camYaw, wantYaw, Math.min(1, dt * 3.2));
      this.camPitch = lerp(this.camPitch, 0.28, Math.min(1, dt * 3));
      dist = this.camMode === 0 ? 9 : this.camMode === 1 ? 14 : 24;
      height = this.camMode === 2 ? 12 : 0;
    } else {
      height = 0;
    }
    const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = target.y + Math.sin(this.camPitch) * dist + height;
    const k = 1 - Math.exp(-dt * 10);
    this.camera.position.x = lerp(this.camera.position.x, cx, k);
    this.camera.position.y = lerp(this.camera.position.y, Math.max(cy, 1.2), k);
    this.camera.position.z = lerp(this.camera.position.z, cz, k);
    this.camera.lookAt(target.x, target.y, target.z);
  }

  _updateOcean() {
    const t = performance.now() / 1000;
    const pos = this.city.ocean.geometry.attributes.position;
    const base = this.city.oceanBase;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      pos.setZ(i, Math.sin(bx * 0.08 + t * 0.9) * 0.5 + Math.cos(by * 0.06 + t * 0.7) * 0.4);
    }
    pos.needsUpdate = true;
    this.city.ocean.geometry.computeVertexNormals();
  }
}

const game = new Game();
game.init();
