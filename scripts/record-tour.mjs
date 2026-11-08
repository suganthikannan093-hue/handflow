// Feature tour: emulated hand pinches, captions, and a US English voiceover.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ff = fileURLToPath(new URL('../node_modules/ffmpeg-static/ffmpeg', import.meta.url));
const voiceDir = fileURLToPath(new URL('../demo/raw/voice/', import.meta.url));
const port = 5176;

const lines = {
  intro: "Okay, this is HandFlow. It's a desk for your tasks, and you just use your hands. No controller.",
  coach: "That coach up top walks you through it. No long instructions. Six moves, and if you're quick, you're done in under a minute.",
  move: 'Pinch a card between your thumb and finger, and drop it in Doing.',
  park: 'Leave one task on a stand. It stays on the desk, and the timer clears it when focus ends.',
  create: 'Poke the plus button. A new task lands in To Do.',
  note: "Poke Note, and a yellow note pops out. Pinch it onto the board. It sticks, even if your hand is still a little in front.",
  long: 'If the note is long, the words wrap and the note gets taller. Nothing gets cut off.',
  timer: "Poke Start. That's a twenty-five minute focus timer. Poke it again to pause. The coach shows your time, and your streak starts.",
  plan: "Poke Plan for the morning. It adds three tasks, and they're saved on this device.",
  plant: 'Drag a finished card to Done. The plant grows, and the streak is still there tomorrow.',
  review: "Poke Review when you're winding down, then mark the day reviewed. That history stays on the device.",
  voice: 'Poke the mic and just say a task. If you say plan my morning, it builds the list right here. The AI planner stays off until you turn it on.',
  menu: 'Turn your left palm toward your face and this menu shows up. Recenter, mixed reality, place the board, sound, or exit.',
  mr: "Mixed reality uses your actual room. It asks for passthrough, and if that's not available it opens in VR. You can put the board on a desk or a wall, and it remembers the spot.",
  access: 'Accessibility covers high contrast, bigger buttons, and look and hold. Look at a button and it selects itself. Those settings are saved.',
  polish: "There's a soft background sound you can switch on. This little counter is the frame rate. On a headset it asks for seventy-two frames. This recording is the desktop emulator, so the number is lower.",
  end: "That's HandFlow. Your hands, your board, your day.",
};

const piperHome = `${process.env.HOME}/Library/Caches/handflow-piper`;
const piper = `${piperHome}/piper/piper`;
const piperModel = `${piperHome}/en_US-lessac-medium.onnx`;
await mkdir(voiceDir, { recursive: true });
const durations = {};
for (const [id, text] of Object.entries(lines)) {
  const raw = `${voiceDir}${id}.raw.wav`;
  const wav = `${voiceDir}${id}.wav`;
  const said = spawnSync(piper, [
    '--model', piperModel,
    '--output_file', raw,
    '--length_scale', '1.07',
    '--noise_scale', '0.42',
    '--noise_w', '0.55',
    '--sentence_silence', '0.22',
  ], { input: text, encoding: 'utf8' });
  if (said.status !== 0) throw new Error(said.stderr || said.stdout || `piper failed for ${id}`);
  // Soften the bright TTS edge and keep peaks under clipping. Mux does not boost again.
  const conv = spawnSync(ff, ['-y', '-i', raw, '-af', 'highpass=f=85,equalizer=f=2800:t=q:w=1.1:g=-2.5,volume=0.72,alimiter=limit=0.89,afade=t=in:d=0.02', '-ar', '44100', '-ac', '1', wav], { encoding: 'utf8' });
  if (conv.status !== 0) throw new Error(conv.stderr || `ffmpeg failed for ${id}`);
  const probe = spawnSync(ff, ['-i', wav], { encoding: 'utf8' });
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(probe.stderr);
  if (!match) throw new Error(`no duration for ${id}`);
  durations[id] = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

process.env.HTTP_ONLY = '1';
const server = await createServer({
  configFile: new URL('../vite.config.ts', import.meta.url).pathname,
  server: { port, host: '127.0.0.1', strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: `${root}demo/raw`, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const origin = Date.now();
await page.goto(`http://127.0.0.1:${port}/?emulate`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__iwer?.remote && window.handflow?.state);
await page.evaluate(() => {
  const bar = document.createElement('div');
  bar.id = 'cap';
  bar.style.cssText = 'position:fixed;left:24px;right:24px;top:16px;padding:12px 18px;background:rgba(8,10,20,.88);color:#fff;font:600 24px/1.35 system-ui,sans-serif;z-index:9;text-align:center;border-radius:12px';
  bar.textContent = 'HandFlow';
  document.body.appendChild(bar);
  window.handflow.state.mrPreferred = false;
  window.handflow.state.a11y.showFps = false;
  window.handflow.refresh();
});
const cap = (text) => page.evaluate((t) => { document.getElementById('cap').textContent = t; }, text);
const seq = (steps) => page.evaluate(async (steps) => {
  const result = await window.__iwer.remote.runSequence({ device: 'hand-right', body: 'auto', gaze: 'fixed', idleHand: 'rest', steps });
  if (!result.completed) throw new Error(result.reason || 'sequence failed');
}, steps);
const press = (target) => seq([{ label: target, target, press: { depth: 0.012, hold: 0.18 } }]);
const cues = [];
async function beat(id, action) {
  await cap(lines[id]);
  const start = (Date.now() - origin) / 1000;
  const began = Date.now();
  if (action) await action();
  const elapsed = (Date.now() - began) / 1000;
  const extra = Math.max(0.4, durations[id] + 0.45 - elapsed);
  await page.waitForTimeout(extra * 1000);
  cues.push({ id, start, audio: durations[id] });
}

await page.click('#enter');
await page.waitForFunction(() => document.body.classList.contains('in-xr'));
await page.waitForTimeout(900);

await beat('intro');
await beat('coach');
await beat('move', () => seq([
  { label: 'grab', target: 'card:Reply to emails', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'carry', target: 'column:doing', anchor: 'grasp', pinch: 1 },
  { label: 'drop', duration: 0.4, pinch: 0 },
]));
await beat('park', () => seq([
  { label: 'grab-stand', target: 'card:Write spec draft', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'to-stand', target: 'desk:1', anchor: 'grasp', pinch: 1 },
  { label: 'drop-stand', duration: 0.4, pinch: 0 },
]));
await beat('create', () => press('button:plus'));
await beat('note', () => seq([
  { label: 'note', target: 'button:note', press: { depth: 0.012, hold: 0.18 } },
]).then(() => seq([
  { label: 'grab-note', target: 'note:latest', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'onto-board', target: 'board', anchor: 'grasp', pinch: 1 },
  { label: 'release', duration: 0.4, pinch: 0 },
])));
await beat('long', async () => {
  await page.evaluate(() => window.handflow.dictate('note: Remember to send the launch notes, water the plant, and write the one thing that matters before the first meeting today'));
  await seq([
    { label: 'grab-long', target: 'note:latest', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
    { label: 'pin-long', target: 'board', anchor: 'grasp', pinch: 1 },
    { label: 'release-long', duration: 0.4, pinch: 0 },
  ]);
});
await beat('timer', async () => {
  await press('button:start');
  await page.waitForTimeout(1600);
  await press('button:start');
});
await beat('plan', () => press('button:morning'));
await beat('plant', () => seq([
  { label: 'grab-done', target: 'card:Review pull request', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'to-done', target: 'column:done', anchor: 'grasp', pinch: 1 },
  { label: 'drop-done', duration: 0.4, pinch: 0 },
]));
await beat('review', async () => {
  await press('button:review');
  await page.waitForTimeout(700);
  try { await press('button:reviewed'); } catch (err) { console.warn(String(err)); }
});
await beat('voice', async () => {
  try { await press('button:mic'); } catch (err) { console.warn(String(err)); }
  await page.evaluate(() => window.handflow.dictate('Buy milk on the way home'));
});
await beat('menu', () => page.evaluate(() => { window.handflow.recenter(); window.handflow.holdMenu(true); }));
await beat('mr');
await beat('access', async () => {
  await page.evaluate(() => { window.handflow.holdMenu(false); window.handflow.recenter(); window.handflow.showAccess(true); });
  try { await press('button:contrast'); } catch (err) { console.warn(String(err)); }
  await page.waitForTimeout(500);
  try { await press('button:large'); } catch (err) { console.warn(String(err)); }
});
await beat('polish', () => page.evaluate(() => {
  window.handflow.recenter();
  window.handflow.showAccess(false);
  window.handflow.state.a11y.highContrast = false;
  window.handflow.state.a11y.largeTargets = false;
  window.handflow.state.a11y.lookHold = false;
  window.handflow.state.a11y.ambient = true;
  window.handflow.state.a11y.showFps = true;
  window.handflow.refresh();
}));
await beat('end', () => page.evaluate(() => {
  window.handflow.recenter();
  window.handflow.state.a11y.showFps = false;
  window.handflow.state.a11y.ambient = false;
  window.handflow.refresh();
}));

const endAt = (Date.now() - origin) / 1000;
const video = page.video();
await context.close();
const webm = await video.path();
await browser.close();
await server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const trim = Math.max(0, cues[0].start - 0.35);
const length = Math.max(1, endAt - trim + 0.3);
const shifted = cues.map((c) => ({ ...c, start: +(c.start - trim).toFixed(3) }));
await writeFile(`${voiceDir}cues.json`, JSON.stringify({ trim, endAt, length, cues: shifted }, null, 2));
const silent = `${voiceDir}video.mp4`;
const cut = spawnSync(ff, ['-y', '-ss', String(trim), '-t', String(length), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', silent], { encoding: 'utf8' });
if (cut.status !== 0) { console.error(cut.stderr); process.exit(1); }

const filter = [];
const inputs = ['-i', silent];
shifted.forEach((c, i) => {
  inputs.push('-i', `${voiceDir}${c.id}.wav`);
  const ms = Math.max(0, Math.round(c.start * 1000));
  filter.push(`[${i + 1}:a]adelay=${ms}|${ms},apad=pad_dur=2,volume=1[a${i}]`);
});
const mix = shifted.map((_, i) => `[a${i}]`).join('');
filter.push(`${mix}amix=inputs=${shifted.length}:duration=longest:dropout_transition=0:normalize=0[aout]`);
const out = `${root}demo/handflow-feature-tour.mp4`;
const mux = spawnSync(ff, [
  '-y', ...inputs,
  '-filter_complex', filter.join(';'),
  '-map', '0:v:0', '-map', '[aout]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
  '-shortest',
  out,
], { encoding: 'utf8' });
if (mux.status !== 0) {
  console.error(mux.stderr);
  process.exit(1);
}
console.log(out);
