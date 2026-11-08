import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const LONG = 'Remember to send the launch notes, water the plant, and write the one thing that matters before the first meeting today';

test('passthrough places the board on a desk, anchors it, and a long note fits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/?emulate');
  await page.waitForFunction(() => {
    const w = window as unknown as { __iwer?: { remote?: { dispatch?: unknown } }; handflow?: { xr?: unknown } };
    return !!(w.__iwer?.remote && w.handflow?.xr);
  }, null, { timeout: 60000 });

  const world = await page.evaluate(() => (window as unknown as { __iwer: { remote: { dispatch: (m: string) => { planeCount: number; objects: { type: string; semanticLabel: string | null }[] } } } }).__iwer.remote.dispatch('get_world_state'));
  const labels = world.objects.filter(o => o.type === 'plane').map(o => o.semanticLabel);
  expect(labels, JSON.stringify(labels)).toContain('desk');

  await page.click('#enter');
  await page.waitForFunction(() => document.body.classList.contains('in-xr'));
  const hit = await page.waitForFunction(() => {
    const xr = (window as unknown as { handflow: { xr: () => { mode: string; blend: string; hit: boolean; normalY: number; clear: boolean } } }).handflow.xr();
    return xr.mode === 'ar' && xr.blend === 'alpha-blend' && xr.clear && xr.hit && xr.normalY > 0.65 ? xr : undefined;
  }, null, { timeout: 20000 }).catch(async (err) => {
    const xr = await page.evaluate(() => (window as unknown as { handflow: { xr: () => unknown } }).handflow.xr());
    throw new Error(`${String(err)}\n${JSON.stringify(xr)}`);
  });
  expect(await hit.jsonValue()).toMatchObject({ mode: 'ar', blend: 'alpha-blend' });

  const placed = await page.evaluate(async () => {
    const seq = await (window as unknown as { __iwer: { remote: { runSequence: (p: unknown) => Promise<{ completed: boolean; reason?: string }> } } }).__iwer.remote.runSequence({
      device: 'hand-right', body: 'auto', gaze: 'fixed', idleHand: 'rest',
      steps: [
        { label: 'pinch', duration: 0.2, pinch: 1 },
        { label: 'open', duration: 0.15, pinch: 0 },
      ],
    });
    const xr = (window as unknown as { handflow: { xr: () => unknown } }).handflow.xr();
    return { seq, xr };
  });
  expect(placed.xr, JSON.stringify(placed)).toMatchObject({ surface: 'desk', placing: false });
  try {
    await page.waitForFunction(() => {
      const xr = (window as unknown as { handflow: { xr: () => { surface: string | null; anchorId: string | null; placing: boolean; clear: boolean } } }).handflow.xr();
      return xr.surface === 'desk' && !!xr.anchorId && !xr.placing && xr.clear;
    }, null, { timeout: 8000 });
  } catch (err) {
    const xr = await page.evaluate(() => (window as unknown as { handflow: { xr: () => unknown } }).handflow.xr());
    throw new Error(`${String(err)}\n${JSON.stringify(xr)}`);
  }

  await page.screenshot({ path: '/tmp/handflow-passthrough.png' });

  const shot = await page.evaluate((text) => {
    const hf = (window as unknown as {
      handflow: {
        dictate: (s: string) => void;
        state: { notes: { pinned: boolean }[] };
        noteShot: () => { url: string; marginBottom: number; dark: number; pinned: boolean; h: number; text: string; maxY: number; canvasH: number } | null;
      };
    }).handflow;
    hf.dictate('note: ' + text);
    const open = hf.noteShot();
    const note = hf.state.notes.at(-1);
    if (note) note.pinned = true;
    const pinned = hf.noteShot();
    return { open, pinned };
  }, LONG);
  expect(shot.pinned, 'long note was not drawn').toBeTruthy();
  writeFileSync('/tmp/handflow-long-note.png', Buffer.from(shot.pinned!.url.split(',')[1], 'base64'));
  if (shot.open) writeFileSync('/tmp/handflow-long-note-open.png', Buffer.from(shot.open.url.split(',')[1], 'base64'));
  const pinned = { ...shot.pinned!, url: undefined };
  expect(shot.pinned!.pinned, JSON.stringify(pinned)).toBe(true);
  expect(shot.pinned!.text).toBe(LONG);
  expect(shot.pinned!.dark).toBeGreaterThan(30);
  expect(shot.pinned!.marginBottom, JSON.stringify(pinned)).toBeGreaterThan(8);

  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as { handflow: { endSession: () => void } }).handflow.endSession());
  await page.waitForFunction(() => !document.body.classList.contains('in-xr'));
  await page.click('#enter');
  await page.waitForFunction(() => {
    const xr = (window as unknown as { handflow: { xr: () => { presenting: boolean; mode: string; surface: string | null; following: boolean } } }).handflow.xr();
    return xr.presenting && xr.mode === 'ar' && xr.surface === 'desk' && xr.following;
  }, null, { timeout: 15000 });
  expect(errors, errors.join('\n')).toEqual([]);
});
