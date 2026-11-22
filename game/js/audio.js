let ctx = null;
let master = null;
let noiseBuf = null;

function makeNoise(ac) {
  const len = ac.sampleRate;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const sfx = {
  unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = makeNoise(ctx);
  },
  tone(freq, dur, type, vol, slideTo = null, when = 0) {
    if (ctx === null) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },
  noise(dur, vol, freq, when = 0) {
    if (ctx === null || noiseBuf === null) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },
  step(sneak, side) {
    this.tone(sneak ? 82 : 118, 0.07, 'triangle', sneak ? 0.05 : 0.11, sneak ? 55 : 70);
    this.noise(0.05, sneak ? 0.018 : 0.045, sneak ? 380 : 520);
    if (side !== 0) this.tone(side > 0 ? 96 : 108, 0.06, 'triangle', sneak ? 0.035 : 0.08, 60);
  },
  tick(level) {
    this.tone(460 + level * 540, 0.055, 'square', 0.05 + level * 0.06);
  },
  chime() {
    this.tone(660, 0.14, 'sine', 0.22);
    this.tone(990, 0.22, 'sine', 0.2, null, 0.09);
  },
  open() {
    this.tone(180, 0.3, 'triangle', 0.22, 90);
    this.tone(720, 0.18, 'sine', 0.14, null, 0.12);
  },
  zap() {
    this.tone(1500, 0.22, 'square', 0.18, 160);
    this.noise(0.18, 0.12, 2400);
  },
  sting() {
    this.tone(220, 0.65, 'sawtooth', 0.3, 55);
    this.tone(233, 0.6, 'square', 0.18, 50, 0.02);
    this.noise(0.4, 0.16, 260);
  },
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.16, 'sine', 0.18, null, i * 0.09));
  },
};
