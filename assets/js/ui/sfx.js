// Linkmery's sounds: quiet, and made from the textures of real things rather
// than tones. Every sound starts from noise (air, paper, wood) shaped by
// filters and resonances, then sits in a small room so it has somewhere to
// ring. No files, no network. Nothing plays before the visitor taps
// something, and the footer mutes it all.

let ctx = null, out = null;
const KEY = 'lm.sound';
const isOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const LEVEL = 1;
const GRAIN = 3.2;   // filtered noise keeps little of its energy; this brings it back up

/** A small wooden room: a short, dark, decaying stereo tail. */
function room(c) {
  const len = Math.floor(c.sampleRate * 0.42), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += 0.22 * ((Math.random() * 2 - 1) - lp);                 // darken it: wood, not tile
      d[i] = lp * Math.pow(1 - i / len, 3.2) * (i < 40 ? i / 40 : 1);
    }
  }
  const conv = c.createConvolver(); conv.buffer = ir;
  return conv;
}
/** Output chain: dry plus a little room, then a soft limiter. */
function chain(c, dest, level) {
  const input = c.createGain(); input.gain.value = level;
  const wet = c.createGain(); wet.gain.value = 0.32;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.ratio.value = 6; limiter.attack.value = 0.002; limiter.release.value = 0.15;
  input.connect(limiter); input.connect(room(c)).connect(wet).connect(limiter);
  limiter.connect(dest);
  return input;
}
function live() {
  if (!isOn()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = chain(ctx, ctx.destination, LEVEL);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---- building blocks: each takes (context, output, start time, options) ----
const noiseBufs = new WeakMap();
function noise(c) {
  let buf = noiseBufs.get(c);
  if (!buf) {
    buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(c, buf);
  }
  const src = c.createBufferSource(); src.buffer = buf;
  return src;
}
const begin = (src, t, dur) => src.start(t, Math.random() * 1.2, dur + 0.05);
function env(g, t, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
const filt = (c, type, f, q = 0.7) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };

/** A burst of filtered noise: a tick, a rustle, a breath. */
function grain(c, o, t, { f = 2000, q = 1, dur = 0.02, peak = 0.2, attack = 0.002, type = 'bandpass', to } = {}) {
  const n = noise(c); const bp = filt(c, type, f, q);
  if (to) { bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(to, t + attack + dur); }
  const g = c.createGain(); env(g, t, attack, peak * GRAIN, dur);
  n.connect(bp).connect(g).connect(o); begin(n, t, attack + dur);
}
/** A struck body: a tiny impulse ringing through a narrow resonance (wood, glass). */
function body(c, o, t, { f = 300, q = 12, peak = 0.4, ring = 0.08 } = {}) {
  const n = noise(c); const bp = filt(c, 'bandpass', f, q);
  const g = c.createGain(); env(g, t, 0.001, peak * q * 3.5, 0.006);   // narrow filters pass little energy; make up for it
  const tail = c.createGain(); tail.gain.setValueAtTime(1, t); tail.gain.exponentialRampToValueAtTime(0.001, t + ring);
  n.connect(g).connect(bp).connect(tail).connect(o); begin(n, t, 0.012);
}
/** Paper drawn across wood: a soft rustle that rises or falls. */
const rustle = (c, o, t, { dur = 0.26, up = true, peak = 0.16 } = {}) =>
  grain(c, o, t, { f: up ? 900 : 2400, to: up ? 2600 : 800, q: 0.6, dur, attack: dur * 0.35, peak });
/** Pages fanning past: a few faint, quick flutters. */
function flutter(c, o, t, { count = 5, span = 0.3, peak = 0.07 } = {}) {
  for (let i = 0; i < count; i++) grain(c, o, t + (span * i) / count + Math.random() * 0.015,
    { f: 3200 + Math.random() * 2500, q: 0.9, dur: 0.035, attack: 0.004, peak: peak * (1 - i / (count * 1.6)) });
}
/** A book settling onto a surface: a low, soft thud. */
function settle(c, o, t, peak = 0.22) {
  grain(c, o, t, { f: 420, q: 0.5, dur: 0.09, attack: 0.004, peak, type: 'lowpass' });
  body(c, o, t, { f: 150, q: 6, peak: peak * 0.8, ring: 0.09 });
}
/** Air moving as a glass door swings. */
const swish = (c, o, t, dur = 0.5, peak = 0.2) => grain(c, o, t, { f: 280, to: 900, q: 0.5, dur, attack: dur * 0.45, peak, type: 'lowpass' });
/** A latch or magnetic catch: a small tick with a woody body and a glassy edge. */
function latch(c, o, t, peak = 0.22) {
  grain(c, o, t, { f: 2600, q: 1.4, dur: 0.006, peak });
  body(c, o, t, { f: 820, q: 14, peak: peak * 0.7, ring: 0.06 });
  body(c, o, t + 0.004, { f: 2300, q: 18, peak: peak * 0.25, ring: 0.05 });
}
/** A knock on wood. */
function knock(c, o, t, peak = 0.4) {
  body(c, o, t, { f: 210, q: 10, peak, ring: 0.12 });
  body(c, o, t, { f: 560, q: 9, peak: peak * 0.6, ring: 0.07 });
  grain(c, o, t, { f: 1500, q: 1, dur: 0.004, peak: peak * 0.3 });
}
/** A drop of water landing in soil: a tiny rising bubble and a soft pat. */
function drop(c, o, t) {
  const osc = c.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(700, t); osc.frequency.exponentialRampToValueAtTime(1500, t + 0.05);
  const g = c.createGain(); env(g, t, 0.002, 0.22, 0.06);
  osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.1);
  grain(c, o, t + 0.01, { f: 600, q: 0.6, dur: 0.05, peak: 0.12, type: 'lowpass' });
}

// Each sound: a list of [voice, delay, options].
const SOUNDS = {
  open: [[latch, 0, 0.38], [swish, 0.05, 0.55], [settle, 0.62, 0.2]],
  close: [[swish, 0, 0.35], [latch, 0.36, 0.22]],
  pull: [[rustle, 0, { dur: 0.24, up: true, peak: 0.14 }]],
  flip: [[rustle, 0, { dur: 0.3, up: true, peak: 0.13 }], [flutter, 0.32, { count: 5, span: 0.3, peak: 0.07 }], [settle, 0.86, 0.12]],
  unflip: [[flutter, 0, { count: 4, span: 0.24, peak: 0.06 }], [rustle, 0.26, { dur: 0.26, up: false, peak: 0.12 }], [settle, 0.62, 0.1]],
  slide: [[rustle, 0, { dur: 0.22, up: true, peak: 0.1 }]],
  tap: [[grain, 0, { f: 1900, q: 1.6, dur: 0.01, peak: 0.3 }], [body, 0, { f: 1300, q: 10, peak: 0.2, ring: 0.035 }]],
  knock: [[knock, 0], [knock, 0.14, 0.32], [knock, 0.24, 0.26]],
  drop: [[drop, 0]],
  light: [[grain, 0, { f: 3000, q: 1.2, dur: 0.006, peak: 0.22 }], [body, 0, { f: 950, q: 12, peak: 0.16, ring: 0.04 }], [grain, 0.05, { f: 2400, q: 1.2, dur: 0.005, peak: 0.12 }]],
  settleRow: [[rustle, 0, { dur: 0.18, up: false, peak: 0.06 }], [settle, 0.12, 0.06], [settle, 0.2, 0.045]],
  // A globe spun by hand: a dry whirr of air that slows, and the faint tick of the axis.
  spin: [[grain, 0, { f: 700, to: 300, q: 0.7, dur: 0.9, attack: 0.05, peak: 0.12 }], ...[0.06, 0.16, 0.3, 0.48, 0.7].map(t => [grain, t, { f: 2600, q: 2, dur: 0.004, peak: 0.07 }])],
};
function play(name) {
  const c = live(); if (!c) return;
  const t = c.currentTime + 0.01;
  for (const [voice, at, opt] of SOUNDS[name]) voice(c, out, t + at, opt);
}

/** A short haptic nudge on phones that support it. */
const buzz = ms => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

export const sfx = {
  open() { play('open'); buzz(8); },
  close() { play('close'); buzz(6); },
  pull: () => play('pull'),
  flip() { play('flip'); buzz(5); },
  unflip: () => play('unflip'),
  slide: () => play('slide'),
  spin: () => play('spin'),
  // Small switches stay silent: sound is kept for the moments that matter.
  tap: () => {},
  click: () => play('tap'),
  knock: () => play('knock'),
  drop() { play('drop'); buzz(4); },
  light: () => play('light'),
  settleRow: () => play('settleRow'),
  isOn,
  set(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
    if (!on && ctx) ctx.suspend();
    if (on) play('tap');
  },
  /** Renders a sound offline through the same chain and returns its peak (0..1), for tests. */
  async measure(name) {
    const c = new OfflineAudioContext(2, 44100 * 1.8, 44100);
    const o = chain(c, c.destination, LEVEL);
    for (const [voice, at, opt] of SOUNDS[name]) voice(c, o, 0.01 + at, opt);
    const r = await c.startRendering();
    let peak = 0; for (let ch = 0; ch < 2; ch++) for (const v of r.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    return peak;
  },
};
