// Records a short Quest-emulator demo with real IWER hand pinches. Writes demo/handflow-demo.webm.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';

const port = 5175;
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
  recordVideo: { dir: 'demo/raw', size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await mkdir('demo/raw', { recursive: true });
await page.goto(`http://127.0.0.1:${port}/?emulate`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__iwer?.remote && window.handflow?.state);
await page.evaluate(() => {
  const bar = document.createElement('div');
  bar.id = 'cap';
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:16px 28px;background:rgba(8,10,20,.82);color:#fff;font:600 28px system-ui,sans-serif;z-index:9';
  bar.textContent = 'HandFlow — hands only, no controllers';
  document.body.appendChild(bar);
  window.handflow.state.mrPreferred = false;
  window.handflow.state.onboarded = true;
  window.handflow.state.a11y.showFps = false;
  window.handflow.refresh();
});
const cap = (text) => page.evaluate((t) => { document.getElementById('cap').textContent = t; }, text);
const seq = (steps) => page.evaluate(async (steps) => {
  const result = await window.__iwer.remote.runSequence({ device: 'hand-right', body: 'auto', gaze: 'fixed', idleHand: 'rest', steps });
  if (!result.completed) throw new Error(result.reason || 'sequence failed');
}, steps);
await cap('Enter the workspace');
await page.click('#enter');
await page.waitForFunction(() => document.body.classList.contains('in-xr'));
await page.waitForTimeout(1200);
await cap('Pinch a task and drop it in Doing');
await seq([
  { label: 'grab', target: 'card:Reply to emails', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'carry', target: 'column:doing', anchor: 'grasp', pinch: 1 },
  { label: 'drop', duration: 0.4, pinch: 0 },
]);
await page.waitForTimeout(700);
await cap('Poke + to create a task');
await seq([{ label: 'add', target: 'button:plus', press: { depth: 0.012, hold: 0.18 } }]);
await page.waitForTimeout(700);
await cap('Create a note, then pinch it onto the board');
await seq([{ label: 'note', target: 'button:note', press: { depth: 0.012, hold: 0.18 } }]);
await seq([
  { label: 'grab-note', target: 'note:latest', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
  { label: 'onto-board', target: 'board', anchor: 'grasp', pinch: 1 },
  { label: 'release', duration: 0.4, pinch: 0 },
]);
await page.waitForTimeout(800);
await cap('Start the focus timer, then pause it');
await seq([{ label: 'start', target: 'button:start', press: { depth: 0.012, hold: 0.18 } }]);
await page.waitForTimeout(1200);
await seq([{ label: 'stop', target: 'button:start', press: { depth: 0.012, hold: 0.18 } }]);
await page.waitForTimeout(900);
await cap('HandFlow — pinch, poke, done');
await page.waitForTimeout(1000);
const video = page.video();
await context.close();
const path = await video.path();
await browser.close();
await server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(path);
