import { test, expect } from '@playwright/test';

test('custom capture, next step, quiet focus and reload are one usable workflow', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).handflow);
  await page.getByRole('button', { name: 'Capture & desk' }).click();
  await page.getByLabel('Your words').fill('Draft the opening slide');
  await page.getByRole('button', { name: 'Add to my workspace' }).click();
  const card = page.locator('#task-list article').filter({ hasText: 'Draft the opening slide' });
  await card.getByRole('button', { name: 'Place on desk' }).click();
  await page.getByLabel('What are you leaving here?').selectOption('next');
  await page.getByLabel('Your words').fill('Open with the customer problem');
  await page.getByRole('button', { name: 'Add to my workspace' }).click();
  await expect(page.locator('#desk-summary')).toContainText('Open with the customer problem');
  await page.getByLabel('Focus length').selectOption('1');
  // Quiet mode is for someone who has already seen this onboarding version.
  await page.evaluate(() => { (window as any).handflow.skipTutorial(); });
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await page.getByRole('button', { name: 'Close desk' }).click();
  await page.waitForFunction(() => (window as any).handflow.focusProof().quiet);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => (window as any).handflow?.focusProof().quiet);
  const saved = await page.evaluate(() => {
    const s = (window as any).handflow.state;
    return { task: s.cards.find((c: any) => c.id === s.focusId), timer: s.timer, proof: (window as any).handflow.focusProof() };
  });
  expect(saved.task.title).toBe('Draft the opening slide');
  expect(saved.task.nextStep).toBe('Open with the customer problem');
  expect(saved.timer.running).toBe(true); expect(saved.timer.remainingMs).toBeGreaterThan(40000);
  expect(saved.proof.plantProgress).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('recorded voice is reviewed before creating a task; service errors have a text path', async ({ page }) => {
  await page.addInitScript(() => {
    const stream = new MediaStream();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } });
    class FakeRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: any; onstop: any;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['x'.repeat(200)], { type: this.mimeType }) }); this.onstop(); }
    }
    (window as any).MediaRecorder = FakeRecorder;
  });
  await page.route('**/voice-config.json', route => route.fulfill({ json: { endpoint: 'http://127.0.0.1:5174' } }));
  await page.route('**/api/transcribe', route => route.fulfill({ json: { text: 'Draft the opening slide' } }));
  await page.goto('/'); await page.waitForFunction(() => (window as any).handflow?.voiceProof().endpoint);
  await page.getByRole('button', { name: 'Capture & desk' }).click();
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await expect(page.locator('#voice-status')).toContainText('Listening');
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await expect(page.locator('#voice-status')).toContainText('Draft the opening slide');
  await expect(page.locator('#task-list')).not.toContainText('Draft the opening slide');
  await page.getByRole('button', { name: 'Use transcript' }).click();
  await expect(page.locator('#task-list')).toContainText('Draft the opening slide');
  await page.locator('#task-list article').filter({ hasText: 'Draft the opening slide' }).getByRole('button', { name: 'Place on desk' }).click();
  await page.route('**/api/transcribe', route => route.fulfill({ json: { text: 'Next step, open with the customer problem.' } }));
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await expect(page.locator('#voice-status')).toContainText('Next step,');
  await page.getByRole('button', { name: 'Use transcript' }).click();
  await expect(page.locator('#desk-summary')).toContainText('Next step: open with the customer problem.');
  await page.route('**/api/transcribe', route => route.fulfill({ status: 502, json: { error: 'Voice service unavailable. Type your thought instead.' } }));
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await page.getByRole('button', { name: 'Record a thought' }).click();
  await expect(page.locator('#voice-status')).toContainText(/Capture & desk|Type your thought|hands/i);
  await page.getByLabel('Your words').fill('A typed fallback task');
  await page.getByRole('button', { name: 'Add to my workspace' }).click();
  await expect(page.locator('#task-list')).toContainText('A typed fallback task');
});
