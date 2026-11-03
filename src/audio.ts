// Tiny WebAudio synth for hover/pinch/drop feedback (no asset files).
let ctx: AudioContext | null = null;
export function unlockAudio() { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); }
export function blip(freq: number, dur = 0.06, vol = 0.08, type: OscillatorType = 'sine') {
  if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
  const t = ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}
export const sfx = {
  hover: () => blip(880, 0.03, 0.03), grab: () => blip(520, 0.07, 0.08, 'triangle'), drop: () => { blip(660, 0.06); setTimeout(() => blip(990, 0.08), 60); },
  press: () => blip(740, 0.05, 0.08, 'square'), done: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.15, 0.08), i * 110)),
};
