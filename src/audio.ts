// Tiny WebAudio synth for hover/pinch/drop feedback, plus a soft ambient pad. No asset files.
let ctx: AudioContext | null = null;
export function unlockAudio() { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); }
export function blip(freq: number, dur = 0.06, vol = 0.08, type: OscillatorType = 'sine') {
  if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
  const t = ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}
export const sfx = {
  hover: () => blip(880, 0.03, 0.04), grab: () => blip(520, 0.07, 0.14, 'triangle'), drop: () => { blip(660, 0.06, 0.12); setTimeout(() => blip(990, 0.08, 0.12), 60); },
  press: () => blip(740, 0.05, 0.14, 'square'),
  pin: () => { blip(494, 0.05, 0.12, 'triangle'); setTimeout(() => blip(740, 0.1, 0.12), 55); },
  done: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.15, 0.14), i * 110)),
};

let pad: { stop: () => void } | null = null;
export function ambientOn() { return !!pad; }
/** Two quiet detuned sines. Safe to call again. */
export function setAmbient(on: boolean) {
  if (!on) { pad?.stop(); pad = null; return; }
  if (pad) return;
  unlockAudio(); if (!ctx) return;
  const master = ctx.createGain(); master.gain.value = 0.018; master.connect(ctx.destination);
  const nodes: OscillatorNode[] = [];
  for (const [freq, type] of [[196, 'sine'], [198.5, 'sine'], [392, 'triangle']] as [number, OscillatorType][]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(master); o.start(); nodes.push(o);
  }
  pad = { stop: () => { for (const o of nodes) { try { o.stop(); } catch { /* already stopped */ } } master.disconnect(); pad = null; } };
}
