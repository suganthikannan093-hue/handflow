import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOT_DIR = '/workspace/review-1110e';

type Ndc = { x: number; y: number; z: number; inView: boolean };
type ViewProof = {
  presenting: boolean;
  mode: string | null;
  placing: boolean;
  wsVisible: boolean;
  distance: number;
  forward: number;
  inFront: boolean;
  boardInView: boolean;
  timerInView: boolean;
  pendingRecenter: boolean;
  toast: string;
  cam: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  board: { x: number; y: number; z: number };
  headerNdc: Ndc;
  timerNdc: Ndc;
  timerCenterNdc: Ndc;
  boardNdc: Ndc;
};

type Remote = {
  dispatch: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
};

async function waitForIwer(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const w = window as unknown as { __iwer?: { remote?: unknown }; handflow?: { workspaceViewProof?: unknown } };
    return !!(w.__iwer?.remote && w.handflow?.workspaceViewProof);
  }, null, { timeout: 60000 });
}

async function enterMr(page: import('@playwright/test').Page) {
  await page.click('#enter');
  await page.waitForFunction(() => document.body.classList.contains('in-xr'));
}

function inNdc(p: Ndc, label: string) {
  expect(p, label + ' ' + JSON.stringify(p)).toMatchObject({ inView: true });
  expect(Math.abs(p.x), label + ' x ' + JSON.stringify(p)).toBeLessThanOrEqual(1);
  expect(Math.abs(p.y), label + ' y ' + JSON.stringify(p)).toBeLessThanOrEqual(1);
}

async function waitForSettledView(page: import('@playwright/test').Page) {
  const handle = await page.waitForFunction(() => {
    const p = (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof();
    if (!p.presenting || !p.wsVisible) return null;
    if (!p.inFront || !p.boardInView || !p.timerInView) return null;
    if (p.distance < 0.85 || p.distance > 1.25) return null;
    if (p.pendingRecenter) return null;
    if (!p.headerNdc?.inView || !p.timerNdc?.inView) return null;
    return p;
  }, null, { timeout: 8000 }).catch(async (err) => {
    const p = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
    throw new Error(`${String(err)}\n${JSON.stringify(p)}`);
  });
  return await handle.jsonValue() as ViewProof;
}

test('entering MR puts the board and timer in front of the camera inside the view', async ({ page }) => {
  mkdirSync(SHOT_DIR, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  await page.goto('/?emulate');
  await waitForIwer(page);

  expect(await page.evaluate(() => (window as unknown as { handflow: { tutorialOpen: () => boolean } }).handflow.tutorialOpen())).toBe(true);

  await enterMr(page);
  const first = await waitForSettledView(page);
  expect(first.mode).toBe('ar');
  expect(first.wsVisible).toBe(true);
  expect(first.inFront).toBe(true);
  expect(first.boardInView).toBe(true);
  expect(first.timerInView).toBe(true);
  expect(first.distance).toBeGreaterThanOrEqual(0.85);
  expect(first.distance).toBeLessThanOrEqual(1.25);
  inNdc(first.headerNdc, 'header');
  inNdc(first.timerNdc, 'timer top');
  inNdc(first.timerCenterNdc, 'timer centre');
  expect(first.placing).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { handflow: { tutorialOpen: () => boolean } }).handflow.tutorialOpen())).toBe(true);

  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-before-recenter.png` });

  const beforeBoard = first.board;
  // Turn in place so the board is no longer in front, then recenter with R.
  const turned = await page.evaluate(async () => {
    const remote = (window as unknown as { __iwer: { remote: Remote } }).__iwer.remote;
    const pose = await remote.dispatch('get_transform', { device: 'headset' }) as { position: { x: number; y: number; z: number }; euler: { yaw: number; pitch: number; roll: number } };
    await remote.dispatch('set_transform', {
      device: 'headset',
      position: pose.position,
      orientation: { yaw: pose.euler.yaw + 80, pitch: pose.euler.pitch, roll: pose.euler.roll },
    });
    return pose;
  });
  expect(turned).toBeTruthy();
  await page.waitForTimeout(300);
  const mid = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
  // After a yaw change the board should have moved off the new view centre.
  const midOffset = Math.hypot(mid.headerNdc?.x ?? 0, mid.boardNdc?.x ?? 0);

  await page.keyboard.press('r');
  const after = await page.waitForFunction(() => {
    const p = (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof();
    if (!p.presenting || p.pendingRecenter) return null;
    if (!p.inFront || !p.boardInView || !p.timerInView) return null;
    if (!p.headerNdc?.inView || !p.timerNdc?.inView) return null;
    if (!p.toast || !p.toast.toLowerCase().includes('recenter')) return null;
    return p;
  }, null, { timeout: 8000 }).catch(async (err) => {
    const p = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
    throw new Error(`${String(err)}\n${JSON.stringify(p)}`);
  }).then((h) => h.jsonValue() as Promise<ViewProof>);

  expect(after, JSON.stringify(after)).toMatchObject({ presenting: true, inFront: true, boardInView: true, timerInView: true, wsVisible: true });
  expect(after.distance).toBeGreaterThanOrEqual(0.85);
  expect(after.distance).toBeLessThanOrEqual(1.25);
  inNdc(after.headerNdc, 'header after R');
  inNdc(after.timerNdc, 'timer after R');
  expect(after.toast.toLowerCase()).toContain('recenter');
  const moved = Math.hypot(after.board.x - beforeBoard.x, after.board.z - beforeBoard.z);
  expect(moved, `board should move in front after a turn (midOffset=${midOffset} moved=${moved}) ${JSON.stringify({ beforeBoard, after: after.board, mid })}`).toBeGreaterThan(0.35);

  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-after-recenter-r.png` });

  // Recenter from the API as the palm-menu button does, after another in-place turn.
  // A large position jump would auto-recenter, so only change yaw.
  await page.evaluate(async () => {
    const remote = (window as unknown as { __iwer: { remote: Remote } }).__iwer.remote;
    const pose = await remote.dispatch('get_transform', { device: 'headset' }) as { position: { x: number; y: number; z: number }; euler: { yaw: number; pitch: number; roll: number } };
    await remote.dispatch('set_transform', {
      device: 'headset',
      position: pose.position,
      orientation: { yaw: pose.euler.yaw - 70, pitch: pose.euler.pitch, roll: pose.euler.roll },
    });
  });
  await page.waitForTimeout(300);
  const beforeMenu = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
  await page.evaluate(() => (window as unknown as { handflow: { recenter: () => void } }).handflow.recenter());
  const afterMenu = await page.waitForFunction((prev) => {
    const p = (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof();
    if (!p.presenting || p.pendingRecenter) return null;
    if (!p.inFront || !p.boardInView || !p.timerInView || !p.headerNdc?.inView || !p.timerNdc?.inView) return null;
    const moved = Math.hypot(p.board.x - prev.x, p.board.z - prev.z);
    if (moved < 0.2) return null;
    if (!p.toast || !p.toast.toLowerCase().includes('recenter')) return null;
    return p;
  }, beforeMenu.board, { timeout: 8000 }).catch(async (err) => {
    const p = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
    throw new Error(`${String(err)}\n${JSON.stringify({ p, beforeMenu })}`);
  }).then((h) => h.jsonValue() as Promise<ViewProof>);

  inNdc(afterMenu.headerNdc, 'header after menu recenter');
  inNdc(afterMenu.timerNdc, 'timer after menu recenter');
  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-after-recenter-menu.png` });
  expect(errors, errors.join('\n')).toEqual([]);
});
