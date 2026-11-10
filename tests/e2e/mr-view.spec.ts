import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOT_DIR = '/workspace/review-1110g';

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
  boardLeftNdc: Ndc;
  boardRightNdc: Ndc;
  boardSpan: number;
  horizDistance: number;
  scale: number;
  support: { height: number; front: number | null } | null;
  handleNdc: Ndc;
  carryNdc: Ndc;
  plantNdc: Ndc;
  plantBesideBoard: boolean;
  lookPitchDeg: number;
  coachNdc: Ndc;
  tutorialOpen: boolean;
  frameId: number;
  frameTime: number;
  fps: number;
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
    if ((p.horizDistance ?? p.distance) < 0.8 || (p.horizDistance ?? p.distance) > 1.05) return null;
    if (p.pendingRecenter) return null;
    if (!p.headerNdc?.inView || !p.timerNdc?.inView) return null;
    if (Math.abs(p.timerNdc?.y ?? 2) > 0.92) return null;
    if (Math.abs(p.boardNdc?.x ?? 1) >= 0.15) return null;
    if ((p.boardSpan ?? 0) < 0.4 || (p.boardSpan ?? 0) > 0.6) return null;
    if (Math.abs(p.lookPitchDeg ?? 90) > 20) return null;
    if (!p.handleNdc?.inView || !p.carryNdc?.inView) return null;
    if (!p.plantBesideBoard) return null;
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
  expect(first.horizDistance).toBeGreaterThanOrEqual(0.8);
  expect(first.horizDistance).toBeLessThanOrEqual(1.05);
  inNdc(first.headerNdc, 'header');
  inNdc(first.timerNdc, 'timer top');
  inNdc(first.timerCenterNdc, 'timer centre');
  expect(Math.abs(first.boardNdc.x), 'board centre NDC x ' + JSON.stringify(first.boardNdc)).toBeLessThan(0.15);
  expect(first.boardSpan, 'board span ' + JSON.stringify(first)).toBeGreaterThanOrEqual(0.4);
  expect(first.boardSpan, 'board span ' + JSON.stringify(first)).toBeLessThanOrEqual(0.6);
  expect(first.placing).toBe(true);
  expect(first.lookPitchDeg, 'look pitch ' + JSON.stringify(first)).toBeLessThanOrEqual(20);
  expect(Math.abs(first.timerNdc.y), 'timer top not clipped').toBeLessThanOrEqual(0.92);
  inNdc(first.handleNdc, 'grab handle');
  inNdc(first.carryNdc, 'carry to tomorrow');
  expect(first.plantBesideBoard, JSON.stringify(first.plantNdc)).toBe(true);
  expect(first.tutorialOpen).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { handflow: { tutorialOpen: () => boolean } }).handflow.tutorialOpen())).toBe(true);
  const headed = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
  expect(headed).toMatchObject({ w: 1280, h: 700 });
  expect(headed.dpr).toBeCloseTo(1);

  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-before.png` });

  const startFrame = await page.evaluate(() => (window as unknown as { handflow: { frameProof: () => { id: number; time: number; fps: number } } }).handflow.frameProof());
  // Drive rAF for 5s so a headless compositor cannot go idle and look frozen.
  await page.evaluate(() => new Promise<void>((resolve) => {
    const t0 = performance.now();
    const tick = (now: number) => { if (now - t0 >= 5000) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => resolve(), 5500);
  }));
  const laterFrame = await page.evaluate(() => (window as unknown as { handflow: { frameProof: () => { id: number; time: number; fps: number } } }).handflow.frameProof());
  expect(laterFrame.id, JSON.stringify({ startFrame, laterFrame })).toBeGreaterThan(startFrame.id + 8);
  expect(laterFrame.time - startFrame.time).toBeGreaterThan(4000);
  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-after-5s.png` });

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
  expect(after.horizDistance).toBeGreaterThanOrEqual(0.8);
  expect(after.horizDistance).toBeLessThanOrEqual(1.05);
  inNdc(after.headerNdc, 'header after R');
  inNdc(after.timerNdc, 'timer after R');
  expect(Math.abs(after.boardNdc.x), 'board centre after R ' + JSON.stringify(after.boardNdc)).toBeLessThan(0.15);
  expect(after.boardSpan).toBeGreaterThanOrEqual(0.4);
  expect(after.boardSpan).toBeLessThanOrEqual(0.6);
  expect(after.toast.toLowerCase()).toContain('recenter');
  expect(after.lookPitchDeg).toBeLessThanOrEqual(20);
  inNdc(after.handleNdc, 'handle after R');
  inNdc(after.carryNdc, 'carry after R');
  expect(after.plantBesideBoard).toBe(true);
  const moved = Math.hypot(after.board.x - beforeBoard.x, after.board.z - beforeBoard.z);
  expect(moved, `board should move in front after a turn (midOffset=${midOffset} moved=${moved}) ${JSON.stringify({ beforeBoard, after: after.board, mid })}`).toBeGreaterThan(0.35);

  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-after-recenter-r.png` });

  // Recenter from the API as the palm-menu button does, after another in-place turn.
  // A large position jump would auto-recenter, so only change yaw.
  const lookBeforeTurn = after.look;
  await page.evaluate(async () => {
    const w = window as unknown as { __iwer: { remote: Remote }; handflow: { nudgeViewer?: (d: number) => boolean } };
    const pose = await w.__iwer.remote.dispatch('get_transform', { device: 'headset' }) as { position: { x: number; y: number; z: number }; euler: { yaw: number; pitch: number; roll: number } };
    await w.__iwer.remote.dispatch('set_transform', {
      device: 'headset',
      position: pose.position,
      orientation: { yaw: pose.euler.yaw - 70, pitch: pose.euler.pitch, roll: pose.euler.roll },
    });
    w.handflow.nudgeViewer?.(-70);
  });
  await page.waitForFunction((prev) => {
    const p = (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof();
    const dot = (p.look?.x ?? 0) * prev.x + (p.look?.y ?? 0) * prev.y + (p.look?.z ?? 0) * prev.z;
    return dot < 0.9;
  }, lookBeforeTurn, { timeout: 6000 }).catch(() => null);
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
  }, after.board, { timeout: 8000 }).catch(async (err) => {
    const p = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
    throw new Error(`${String(err)}\n${JSON.stringify({ p, beforeMenu, from: after.board })}`);
  }).then((h) => h.jsonValue() as Promise<ViewProof>);

  inNdc(afterMenu.headerNdc, 'header after menu recenter');
  inNdc(afterMenu.timerNdc, 'timer after menu recenter');
  expect(Math.abs(afterMenu.boardNdc.x), 'board centre after menu ' + JSON.stringify(afterMenu.boardNdc)).toBeLessThan(0.22);
  await page.screenshot({ path: `${SHOT_DIR}/hf-mr-after-recenter-menu.png` });
  expect(errors, errors.join('\n')).toEqual([]);
});
