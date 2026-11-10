import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/workspace/review-1110g';
mkdirSync(OUT, { recursive: true });
const url = process.argv[2] || 'https://suganthikannan093-hue.github.io/handflow/?emulate';
const tag = process.argv[3] || 'live';

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1280,800',
    '--window-position=40,40',
    '--disable-gpu-sandbox',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 700 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => {
  const t = m.text();
  if (/error|Error|stall|warn/i.test(t)) console.log('CONSOLE', m.type(), t);
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
  const w = window;
  return !!(w.__iwer && w.handflow && w.handflow.workspaceViewProof);
}, null, { timeout: 60000 });
await page.waitForTimeout(500);
const pre = await page.evaluate(() => {
  const w = window;
  const d = w.__iwer || {};
  return {
    dpr: devicePixelRatio,
    inner: { w: innerWidth, h: innerHeight },
    outer: { w: outerWidth, h: outerHeight },
    tut: w.handflow.tutorialOpen?.(),
    fovy: d.fovy,
    stereo: d.stereoEnabled,
    pos: d.position && { x: d.position.x, y: d.position.y, z: d.position.z },
  };
});
console.log('PRE', JSON.stringify(pre));
await page.screenshot({ path: `${OUT}/hf-repro-${tag}-desktop.png` });

await page.click('#enter');
await page.waitForFunction(() => document.body.classList.contains('in-xr'), { timeout: 20000 });
await page.waitForTimeout(2000);
const p1 = await page.evaluate(() => window.handflow.workspaceViewProof());
const f1 = await page.evaluate(() => window.handflow.frameProof());
console.log('ENTRY', JSON.stringify({ f1, p1 }));
await page.screenshot({ path: `${OUT}/hf-repro-${tag}-entry.png` });

await page.waitForTimeout(5000);
const p2 = await page.evaluate(() => window.handflow.workspaceViewProof());
const f2 = await page.evaluate(() => window.handflow.frameProof());
console.log('AFTER5S', JSON.stringify({ f1, f2, deltaId: f2.id - f1.id, deltaT: f2.time - f1.time, toast: p2.toast }));
await page.screenshot({ path: `${OUT}/hf-repro-${tag}-5s.png` });

await page.keyboard.press('r');
await page.waitForTimeout(900);
const p3 = await page.evaluate(() => window.handflow.workspaceViewProof());
console.log('AFTERR', JSON.stringify({ toast: p3.toast, pending: p3.pendingRecenter, board: p3.board, look: p3.look, timerNdc: p3.timerNdc, headerNdc: p3.headerNdc, boardNdc: p3.boardNdc, horiz: p3.horizDistance, scale: p3.scale, frameId: p3.frameId }));
await page.screenshot({ path: `${OUT}/hf-repro-${tag}-r.png` });

await browser.close();
console.log('DONE', tag, url);
