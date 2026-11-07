// Headless smoke test: serves dist/, loads desktop + ?emulate modes, fails on console errors, checks state & drag.
import { preview } from 'vite'; import puppeteer from 'puppeteer';
const server = await preview({ preview: { port: 4179, https: false }, plugins: [] , configFile: false, base: './' });
const url = 'http://localhost:4179/'; const browser = await puppeteer.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0;
for (const q of ['', '?emulate']) {
  const page = await browser.newPage(); const errs = [];
  page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(String(e)));
  await page.setViewport({ width: 1280, height: 800 }); await page.goto(url + q, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 1500));
  const info = await page.evaluate(() => ({ cards: window.handflow?.state.cards.length, status: document.getElementById('status').textContent, enter: !document.getElementById('enter').disabled }));
  if (!q) { // mouse fallback: pinch-drag 'Reply to emails' into Done, using live screen positions
    const from = await page.evaluate(() => window.handflow.screenOf('card:Reply to emails'));
    const to = await page.evaluate(() => window.handflow.screenOf('column:done'));
    const m = page.mouse; await m.move(from.x, from.y); await new Promise(r => setTimeout(r, 200)); await m.down();
    for (let i = 1; i <= 15; i++) { await m.move(from.x + (to.x - from.x) * i / 15, from.y + (to.y - from.y) * i / 15); await new Promise(r => setTimeout(r, 30)); }
    await m.up(); await new Promise(r => setTimeout(r, 400));
    info.dragged = await page.evaluate(() => window.handflow.state.cards.find(c => c.title === 'Reply to emails')?.column); if (info.dragged !== 'done') fail++;
    info.persisted = await page.evaluate(() => !!localStorage.getItem('handflow.v1')); }
  if (q) { await page.click('#enter'); await new Promise(r => setTimeout(r, 1500)); info.inXR = await page.evaluate(() => document.body.classList.contains('in-xr')); if (!info.inXR) fail++; }
  await page.screenshot({ path: `smoke${q ? '-emulate' : ''}.png` });
  console.log(q || '(desktop)', JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
  if (errs.length || !info.cards) fail++;
}
await browser.close(); server.httpServer.close(); process.exit(fail ? 1 : 0);
