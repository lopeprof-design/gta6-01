// HUD and minimap for Sunset Shores: health, cash, wanted stars, speed,
// the mission objective and the clock as DOM, plus a live 2D minimap drawn
// on a canvas — roads, beach, the player, police, traffic and the waypoint.
import { CFG, MISSIONS, formatClock, formatMoney } from './config.js';

export class Hud {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.moneyEl = document.getElementById('money');
    this.starsEl = document.getElementById('stars');
    this.speedEl = document.getElementById('speed');
    this.objectiveEl = document.getElementById('objective');
    this.clockEl = document.getElementById('clock');
    this.missionListEl = document.getElementById('mission-list');
    this.toastEl = document.getElementById('toast');
    this.ammoEl = document.getElementById('ammo');
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.crosshair = document.getElementById('crosshair');
  }

  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  update(state, missions, speedKmh) {
    this.healthFill.style.width = Math.max(0, state.health) + '%';
    this.healthText.textContent = Math.ceil(Math.max(0, state.health));
    this.moneyEl.textContent = formatMoney(state.money);
    let stars = '';
    for (let i = 0; i < CFG.maxWanted; i++) stars += i < state.wanted ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.classList.toggle('hot', state.wanted > 0);
    this.speedEl.textContent = state.inCar ? Math.round(speedKmh) + ' km/h' : 'jalan kaki';
    this.objectiveEl.textContent = missions.objectiveText();
    this.clockEl.textContent = formatClock(state.hour);
    this.ammoEl.textContent = '▸ ' + state.ammo + ' peluru';
    const list = missions.missionList();
    this.missionListEl.innerHTML = list
      .map((m) => {
        const mark = m.state === 'done' ? '✓' : m.state === 'active' ? '▶' : '·';
        return '<div class="mi ' + m.state + '">' + mark + ' ' + m.title + '</div>';
      })
      .join('');
    this.crosshair.style.display = state.mode === 'playing' && !state.inCar ? 'block' : 'none';
  }

  drawMinimap(world) {
    const ctx = this.mm;
    const S = 168;
    const scale = S / 560;
    const toX = (x) => (x + 280) * scale;
    const toY = (z) => (z + 260) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20, 24, 40, 0.85)';
    ctx.fillRect(0, 0, S, S);
    // Sea and sand.
    ctx.fillStyle = '#2a6f8f';
    ctx.fillRect(0, toY(238), S, S - toY(238));
    ctx.fillStyle = '#e8cf9e';
    ctx.fillRect(0, toY(200), S, toY(238) - toY(200));
    // Roads.
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 4;
    for (const c of world.city.streets) {
      ctx.beginPath();
      ctx.moveTo(toX(c), toY(-210));
      ctx.lineTo(toX(c), toY(200));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-210), toY(c));
      ctx.lineTo(toX(210), toY(c));
      ctx.stroke();
    }
    // Waypoint.
    const target = world.missions.activeTarget();
    if (target) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toX(target.x), toY(target.z), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(target.x), toY(target.z), 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#cfd6e4';
    for (const car of world.traffic.cars) {
      ctx.fillRect(toX(car.x) - 1.5, toY(car.z) - 1.5, 3, 3);
    }
    // Police dots.
    ctx.fillStyle = '#ff4040';
    for (const car of world.police.allCruisers()) {
      if (car.health <= 0) continue;
      ctx.beginPath();
      ctx.arc(toX(car.x), toY(car.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toX(world.player.x);
    const py = toY(world.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(world.player.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
