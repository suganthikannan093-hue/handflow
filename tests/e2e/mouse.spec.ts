import { test, expect } from '@playwright/test';

test('quick mouse clicks and drags hit, and a reload keeps the board', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { handflow?: { screenOf?: unknown } }).handflow?.screenOf);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { handflow: { tutorialOpen: () => boolean } }).handflow.tutorialOpen())).toBe(true);

  const before = await page.evaluate(() => (window as unknown as { handflow: { state: { cards: unknown[] } } }).handflow.state.cards.length);
  const plus = await page.evaluate(() => (window as unknown as { handflow: { screenOf: (n: string) => { x: number; y: number } | null } }).handflow.screenOf('button:plus'));
  expect(plus, JSON.stringify(plus)).toBeTruthy();
  expect(plus!.x).toBeGreaterThan(0);
  expect(plus!.x).toBeLessThan(1280);
  expect(plus!.y).toBeGreaterThan(0);
  expect(plus!.y).toBeLessThan(800);
  await page.mouse.click(plus!.x, plus!.y);
  await page.waitForFunction((n) => (window as unknown as { handflow: { state: { cards: unknown[] } } }).handflow.state.cards.length === n, before + 1, { timeout: 4000 });

  const from = await page.evaluate(() => (window as unknown as { handflow: { screenOf: (n: string) => { x: number; y: number } | null } }).handflow.screenOf('card:Reply to emails'));
  const to = await page.evaluate(() => (window as unknown as { handflow: { screenOf: (n: string) => { x: number; y: number } | null } }).handflow.screenOf('column:doing'));
  expect(from && to).toBeTruthy();
  await page.mouse.move(from!.x, from!.y);
  await page.mouse.down();
  await page.mouse.move(to!.x, to!.y, { steps: 3 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const card = (window as unknown as { handflow: { state: { cards: { title: string; column: string }[] } } }).handflow.state.cards.find(c => c.title === 'Reply to emails');
    return card?.column === 'doing';
  });

  const undo = await page.evaluate(() => (window as unknown as { handflow: { screenOf: (n: string) => { x: number; y: number } | null } }).handflow.screenOf('button:undo'));
  expect(undo, JSON.stringify(undo)).toBeTruthy();
  expect(undo!.x).toBeGreaterThan(0);
  expect(undo!.x).toBeLessThan(1280);
  expect(undo!.y).toBeGreaterThan(0);
  expect(undo!.y).toBeLessThan(800);
  await page.mouse.click(undo!.x, undo!.y);
  await page.waitForFunction(() => {
    const card = (window as unknown as { handflow: { state: { cards: { title: string; column: string }[] } } }).handflow.state.cards.find(c => c.title === 'Reply to emails');
    return card?.column === 'todo';
  }, null, { timeout: 8000 });

  const start = await page.evaluate(() => (window as unknown as { handflow: { screenOf: (n: string) => { x: number; y: number } | null } }).handflow.screenOf('button:start'));
  expect(start).toBeTruthy();
  await page.mouse.click(start!.x, start!.y);
  await page.waitForFunction(() => {
    const t = (window as unknown as { handflow: { state: { timer: { running: boolean; mode: string; remainingMs: number } } } }).handflow.state.timer;
    return t.running && t.mode === 'focus' && t.remainingMs > 20 * 60_000;
  });
  await page.evaluate(() => {
    const hf = (window as unknown as { handflow: { dictate: (s: string) => void } }).handflow;
    for (let i = 0; i < 8; i++) hf.dictate(`extra task ${i}`);
  });
  const columns = await page.evaluate(() => (window as unknown as { handflow: { columnView: () => { col: string; count: number; shown: number; bottom: number }[] } }).handflow.columnView());
  const todo = columns.find(c => c.col === 'todo');
  expect(todo && todo.count).toBeGreaterThan(3);
  expect(todo!.shown).toBeLessThanOrEqual(3);
  expect(todo!.bottom).toBeGreaterThan(-0.26);
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(() => {
    const t = (window as unknown as { handflow?: { state?: { timer: { running: boolean; mode: string; remainingMs: number } } } }).handflow?.state?.timer;
    return !!t && t.running && t.mode === 'focus' && t.remainingMs > 20 * 60_000;
  });
  await page.waitForFunction((n) => {
    const hf = (window as unknown as { handflow?: { state?: { cards: unknown[] } } }).handflow;
    return (hf?.state?.cards.length ?? 0) === n;
  }, before + 9);
  expect(errors, errors.join('\n')).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('the intro bar stays above the timer and the toolbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { handflow?: { screenOf?: unknown } }).handflow?.screenOf);
    const copy = (await page.locator('#hud-input').innerText()).toLowerCase();
    expect(copy).toContain('drag');
    expect(copy).toContain('two fingers');
    expect(copy).not.toContain('a/d');
    const hud = await page.locator('#hud').boundingBox();
    const at = (name: string) => page.evaluate((n) => (window as unknown as { handflow: { screenOf: (s: string) => { x: number; y: number } | null } }).handflow.screenOf(n), name);
    const start = await at('button:start');
    const plus = await at('button:plus');
    const undo = await at('button:undo');
    expect(hud && start && plus && undo).toBeTruthy();
    expect(hud!.y + hud!.height).toBeLessThan(start!.y - 4);
    expect(plus!.y).toBeGreaterThan(hud!.y + hud!.height);
    expect(undo!.y).toBeGreaterThan(hud!.y + hud!.height);
    expect(undo!.y).toBeLessThan(820);
    expect(plus!.x).toBeGreaterThan(8);
    expect(plus!.x).toBeLessThan(382);
  });
});
