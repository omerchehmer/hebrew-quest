// sfx.js — כל הצלילים נוצרים ב-WebAudio. אין קבצים להוריד, עובד אופליין.

let ctx = null;
let enabled = true;

export function setSfxEnabled(v) {
  enabled = !!v;
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  g.gain.value = 0;
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.01);
}

function tone(freq, dur, { type = 'square', vol = 0.12, delay = 0, slide = null } = {}) {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.08, delay = 0 } = {}) {
  if (!enabled) return;
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = vol;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

export const sfx = {
  tap: () => tone(420, 0.05, { vol: 0.05 }),
  mine: () => {
    noise(0.09, { vol: 0.09 });
    tone(180, 0.07, { type: 'triangle', vol: 0.07 });
  },
  correct: () => {
    tone(660, 0.09, { vol: 0.1 });
    tone(880, 0.12, { vol: 0.1, delay: 0.08 });
  },
  wrong: () => tone(220, 0.22, { type: 'sawtooth', vol: 0.08, slide: 130 }),
  crystal: () => {
    tone(1200, 0.06, { type: 'sine', vol: 0.08 });
    tone(1600, 0.08, { type: 'sine', vol: 0.07, delay: 0.05 });
  },
  chest: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.1, delay: i * 0.1 }));
  },
  levelup: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { vol: 0.1, delay: i * 0.07 }));
  },
  hit: () => {
    noise(0.12, { vol: 0.12 });
    tone(120, 0.14, { type: 'sawtooth', vol: 0.09, slide: 70 });
  },
  bossDown: () => {
    [300, 240, 180, 120].forEach((f, i) => tone(f, 0.2, { type: 'sawtooth', vol: 0.1, delay: i * 0.12 }));
    noise(0.5, { vol: 0.1, delay: 0.4 });
  },
  heartLost: () => tone(300, 0.3, { type: 'triangle', vol: 0.09, slide: 150 }),
};
