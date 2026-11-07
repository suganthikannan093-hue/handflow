import { test, expect } from '@playwright/test';

/** Drive IWER's hand runtime so pinches and pokes go through the real joint detector. */
async function sequence(page: import('@playwright/test').Page, steps: unknown[]) {
  return page.evaluate(async (body) => {
    const remote = (window as unknown as { __iwer: { remote: { runSequence: (p: unknown) => Promise<{ completed: boolean; reason?: string; warnings: string[]; presses: unknown[] }> } } }).__iwer.remote;
    const seq = await remote.runSequence({ device: 'hand-right', body: 'auto', gaze: 'fixed', idleHand: 'rest', steps: body });
    const hf = (window as unknown as { handflow: { state: { cards: { title: string; column: string }[]; notes: { text: string; pinned: boolean }[]; timer: { running: boolean } } } }).handflow;
    return {
      completed: seq.completed, reason: seq.reason, warnings: seq.warnings, presses: seq.presses,
      cards: hf.state.cards.map(c => ({ title: c.title, column: c.column })),
      notes: hf.state.notes.map(n => ({ text: n.text, pinned: n.pinned })),
      running: hf.state.timer.running,
    };
  }, steps);
}

test('emulated pinches create a card, drag it, pin a note, and run the timer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/?emulate');
  await page.waitForFunction(() => {
    const w = window as unknown as { __iwer?: { remote?: unknown }; handflow?: { state?: { mrPreferred: boolean } } };
    return !!(w.__iwer?.remote && w.handflow?.state);
  });
  await page.evaluate(() => { (window as unknown as { handflow: { state: { mrPreferred: boolean } } }).handflow.state.mrPreferred = false; });
  await page.click('#enter');
  await page.waitForFunction(() => document.body.classList.contains('in-xr'));
  await page.waitForTimeout(900);

  const drag = await sequence(page, [
    { label: 'grab', target: 'card:Reply to emails', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
    { label: 'carry', target: 'column:doing', anchor: 'grasp', pinch: 1 },
    { label: 'drop', duration: 0.35, pinch: 0 },
  ]);
  expect(drag.cards.find(c => c.title === 'Reply to emails')?.column, JSON.stringify(drag)).toBe('doing');

  const before = drag.cards.length;
  const created = await sequence(page, [
    { label: 'add', target: 'button:plus', press: { depth: 0.012, hold: 0.18 } },
  ]);
  expect(created.cards.length, JSON.stringify(created)).toBe(before + 1);

  const made = await sequence(page, [
    { label: 'note', target: 'button:note', press: { depth: 0.012, hold: 0.18 } },
  ]);
  expect(made.notes.length, JSON.stringify(made)).toBeGreaterThan(0);
  const pinned = await sequence(page, [
    { label: 'grab-note', target: 'note:latest', anchor: 'grasp', pinch: { value: 1, at: 'arrival' } },
    { label: 'onto-board', target: 'board', anchor: 'grasp', pinch: 1 },
    { label: 'release', duration: 0.35, pinch: 0 },
  ]);
  expect(pinned.notes.at(-1)?.pinned, JSON.stringify(pinned)).toBe(true);

  const started = await sequence(page, [
    { label: 'start', target: 'button:start', press: { depth: 0.012, hold: 0.18 } },
  ]);
  expect(started.running, JSON.stringify(started)).toBe(true);
  const stopped = await sequence(page, [
    { label: 'stop', target: 'button:start', press: { depth: 0.012, hold: 0.18 } },
  ]);
  expect(stopped.running, JSON.stringify(stopped)).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
