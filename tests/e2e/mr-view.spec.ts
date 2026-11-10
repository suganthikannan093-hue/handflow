import { test, expect } from '@playwright/test';

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
  cam: { x: number; y: number; z: number };
  board: { x: number; y: number; z: number };
};

async function waitForIwer(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const w = window as unknown as { __iwer?: { remote?: unknown }; handflow?: { workspaceViewProof?: unknown } };
    return !!(w.__iwer?.remote && w.handflow?.workspaceViewProof);
  }, null, { timeout: 60000 });
}

test('entering MR puts the board and timer in front of the camera inside the view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/?emulate');
  await waitForIwer(page);

  await page.click('#enter');
  await page.waitForFunction(() => document.body.classList.contains('in-xr'));

  const proof = await page.waitForFunction(() => {
    const p = (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof();
    if (!p.presenting || !p.wsVisible) return null;
    if (!p.inFront || !p.boardInView || !p.timerInView) return null;
    if (p.distance < 0.5 || p.distance > 1.15) return null;
    if (p.pendingRecenter) return null;
    return p;
  }, null, { timeout: 8000 }).catch(async (err) => {
    const p = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
    throw new Error(`${String(err)}\n${JSON.stringify(p)}`);
  });

  const first = await proof.jsonValue() as ViewProof;
  expect(first.mode).toBe('ar');
  expect(first.wsVisible).toBe(true);
  expect(first.inFront).toBe(true);
  expect(first.boardInView).toBe(true);
  expect(first.timerInView).toBe(true);
  expect(first.distance).toBeGreaterThanOrEqual(0.5);
  expect(first.distance).toBeLessThanOrEqual(1.15);
  // Place mode must not hide or defer the workspace.
  expect(first.placing).toBe(true);

  await page.evaluate(() => (window as unknown as { handflow: { recenter: () => void } }).handflow.recenter());
  const after = await page.evaluate(() => (window as unknown as { handflow: { workspaceViewProof: () => ViewProof } }).handflow.workspaceViewProof());
  expect(after, JSON.stringify(after)).toMatchObject({ presenting: true, inFront: true, boardInView: true, timerInView: true, wsVisible: true });
  expect(after.distance).toBeGreaterThanOrEqual(0.5);
  expect(after.distance).toBeLessThanOrEqual(1.15);
  expect(errors, errors.join('\n')).toEqual([]);
});
