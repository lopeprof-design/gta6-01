// All sound in Sunset Shores is synthesised with WebAudio — no audio files.
// A low engine drone, a two-tone police siren, gunshots, pickup chimes and a
// small synthwave bass loop that keeps the sunset drive moving.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.muted = false;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call from Start/Continue.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this._startEngine();
    this._startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // speed01: 0 parked, 1 flat out. On foot the drone fades away.
  setEngine(speed01, driving) {
    if (!this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(
      50 + speed01 * 110 + (driving ? 12 : 0),
      this.ctx.currentTime,
      0.08,
    );
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.setTargetAtTime(high ? 720 : 540, this.ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      const osc = this.sirenOsc;
      const gain = this.sirenGain;
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 200);
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shot() {
    this._noise(0.16, 0.5, 1800);
    this._blip(160, 0.1, 'square', 0.18, 60);
  }

  punch() {
    this._noise(0.09, 0.35, 700);
  }

  pickup() {
    this._blip(660, 0.12, 'sine', 0.22);
    setTimeout(() => this._blip(990, 0.18, 'sine', 0.22), 90);
  }

  crash() {
    this._noise(0.25, 0.4, 500);
  }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.22, 'triangle', 0.22), i * 110);
    });
  }

  busted() {
    [392, 330, 262].forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.3, 'sawtooth', 0.15), i * 160);
    });
  }

  // A slow synthwave bassline: A minor, one note per eighth at ~100 BPM.
  _startMusic() {
    const bass = [110, 0, 110, 130.8, 0, 110, 98, 0, 110, 0, 110, 164.8, 0, 146.8, 130.8, 0];
    const pad = [220, 261.6, 329.6];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) {
        this.musicStep++;
        return;
      }
      const step = this.musicStep % 16;
      const note = bass[step];
      if (note) this._blip(note, 0.24, 'sawtooth', 0.05);
      if (step === 0) {
        pad.forEach((f) => this._blip(f, 1.8, 'sine', 0.018));
      }
      this.musicStep++;
    }, 300);
  }
}
