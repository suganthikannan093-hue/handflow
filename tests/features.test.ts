import { describe, it, expect } from 'vitest';
import * as S from '../src/state';
import { fitsComfort, BOARD_H, BOARD_W, BOARD_Z, DOCK_Y, DOCK_Z, DOCK_HALF, TIMER_H, TIMER_Y, TIMER_Z, TIMER_W, PLANT_X } from '../src/layout';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);

describe('pinning', () => {
  const hw = 0.3, hh = 0.2;
  it('pins a note held in front of the board, which the old 10cm test missed', () => {
    expect(Math.abs(0.2) < 0.1).toBe(false);
    expect(S.pinToSurface(0, 0, 0.2, hw, hh)).toBe(true);
    expect(S.pinToSurface(0.05, -0.04, 0.22, hw, hh)).toBe(true);
  });
  it('pins a note that touches the surface and one just beside the edge', () => {
    expect(S.pinToSurface(0, 0, 0.02, hw, hh)).toBe(true);
    expect(S.pinToSurface(hw + 0.05, 0, 0.04, hw, hh)).toBe(true);
  });
  it('leaves a note floating when it is off to the side', () => {
    expect(S.pinToSurface(hw + 0.25, 0, 0.2, hw, hh)).toBe(false);
    expect(S.pinToSurface(0, 0, 0.45, hw, hh)).toBe(false);
  });
});

describe('note text', () => {
  const measure = (sample: string, font: number) => sample.length * font * 0.55;
  it('wraps a long note so every line fits the card', () => {
    const text = 'Remember to send the launch notes, water the plant, and write down the one thing that actually matters before the first meeting starts today';
    const fit = S.fitWrappedText(text, 180, 220, measure, 14, 32);
    expect(fit.lines.length).toBeGreaterThan(1);
    expect(fit.ellipsis).toBe(false);
    for (const line of fit.lines) expect(measure(line, fit.font)).toBeLessThanOrEqual(180);
    expect(fit.lines.length * fit.font * 1.25).toBeLessThanOrEqual(220);
  });
  it('grows the note for longer copy', () => {
    expect(S.noteSize('hi').h).toBeLessThan(S.noteSize('a'.repeat(160)).h);
  });
  it('wraps a long note when the canvas reports a zero width', () => {
    const text = 'Remember to send the launch notes, water the plant, and write down the one thing that actually matters before the first meeting starts today';
    const fit = S.fitWrappedText(text, 180, 220, () => 0, 14, 32);
    expect(fit.lines.length).toBeGreaterThan(1);
    expect(fit.lines[0].length).toBeLessThan(text.length);
    for (const line of fit.lines) expect(line.length * fit.font * 0.55).toBeLessThanOrEqual(180 + 1);
  });
});

describe('habits', () => {
  it('plans a morning with three tasks and does not duplicate them', () => {
    const s = S.createInitialState();
    const made = S.planMorning(s, day(2026, 11, 7));
    expect(made).toHaveLength(3);
    expect(s.habit.mode).toBe('morning');
    expect(S.todayRecord(s.habit, day(2026, 11, 7)).planned).toBe(3);
    expect(S.planMorning(s, day(2026, 11, 7))).toHaveLength(0);
  });
  it('grows a streak on the first finish of the day and the plant with it', () => {
    const s = S.createInitialState();
    const card = s.cards.find(c => c.column === 'todo')!;
    S.moveCard(s, card.id, 'done', Infinity, day(2026, 11, 7));
    expect(s.habit.streak).toBe(1);
    expect(S.plantStage(S.todayRecord(s.habit, day(2026, 11, 7)).completed)).toBe(1);
    const other = s.cards.find(c => c.column !== 'done')!;
    S.moveCard(s, other.id, 'done', Infinity, day(2026, 11, 7));
    expect(s.habit.streak).toBe(1);
    expect(S.todayRecord(s.habit, day(2026, 11, 7)).completed).toBe(2);
    S.moveCard(s, s.cards.find(c => c.column !== 'done')!.id, 'done', Infinity, day(2026, 11, 8));
    expect(s.habit.streak).toBe(2);
    S.moveCard(s, S.addCard(s, 0).id, 'done', Infinity, day(2026, 11, 11));
    expect(s.habit.streak).toBe(1);
  });
  it('saves a wind-down review in the daily history', () => {
    const s = S.createInitialState();
    S.startWindDown(s, day(2026, 11, 7));
    expect(s.habit.mode).toBe('winddown');
    const rec = S.completeReview(s, day(2026, 11, 7));
    expect(rec.reviewed).toBe(true);
    expect(s.habit.streak).toBe(1);
    expect(s.habit.mode).toBe('work');
    expect(S.recentHistory(s.habit, 5).some(r => r.date === '2026-11-07' && r.reviewed)).toBe(true);
  });
});

describe('voice commands', () => {
  it('turns plan my morning into the on-device plan', () => {
    const s = S.createInitialState();
    expect(S.applyTranscript(s, 'Please plan my morning', day(2026, 11, 7))).toBe('plan');
    expect(s.habit.mode).toBe('morning');
    expect(s.cards.some(c => c.title === 'Pick the one thing that matters')).toBe(true);
  });
  it('dictates other speech into a card and note-prefixed speech into a note', () => {
    const s = S.createInitialState();
    expect(S.applyTranscript(s, 'Email the venue about chairs')).toBe('card');
    expect(s.cards.some(c => c.title === 'Email the venue about chairs')).toBe(true);
    expect(S.applyTranscript(s, 'note: remember the long caption about the plant on the desk')).toBe('note');
    expect(s.notes.at(-1)?.text.startsWith('remember the long caption')).toBe(true);
  });
});

describe('accessibility and tutorial', () => {
  it('fires look-and-hold once the dwell time is reached', () => {
    const first = S.dwellStep(null, 'button:start', 0, 400, 800);
    expect(first.fire).toBe(false);
    const second = S.dwellStep(first.id, 'button:start', first.elapsed, 400, 800);
    expect(second.fire).toBe(true);
    expect(S.dwellStep(second.id, null, 0, 100, 800).fire).toBe(false);
  });
  it('pays off the tutorial inside a minute and remembers the streak', () => {
    const s = S.createInitialState();
    const payoff = S.finishTutorial(s, 42_000, day(2026, 11, 7));
    expect(payoff.fast).toBe(true);
    expect(payoff.message).toBe('Ready in 42s');
    expect(s.onboarded).toBe(true);
    expect(s.habit.streak).toBe(1);
    expect(S.tutorialPayoff(75_000).fast).toBe(false);
  });
  it('keeps the main panels inside the 30 degree cone and round-trips new settings', () => {
    expect(fitsComfort(0, BOARD_W / 2, BOARD_Z)).toBe(true);
    expect(fitsComfort(0, DOCK_HALF, DOCK_Z)).toBe(true);
    expect(fitsComfort(0, TIMER_W / 2, TIMER_Z)).toBe(true);
    expect(fitsComfort(PLANT_X, 0.03, TIMER_Z)).toBe(true);
    expect(TIMER_Y - TIMER_H / 2).toBeGreaterThan(BOARD_H / 2);
    expect(DOCK_Y + 0.04).toBeLessThan(-BOARD_H / 2);
    expect(Math.abs(PLANT_X) - 0.03).toBeGreaterThan(TIMER_W / 2);
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    s.a11y.highContrast = true; s.a11y.largeTargets = true; s.a11y.lookHold = true; s.mrPreferred = false;
    s.placement = { position: [1, 2, 3], quaternion: [0, 0, 0, 1], anchorId: 'anchor-1' };
    S.save(s, kv, 0);
    const loaded = S.load(kv);
    expect(loaded.a11y.highContrast).toBe(true);
    expect(loaded.a11y.lookHold).toBe(true);
    expect(loaded.placement?.anchorId).toBe('anchor-1');
    expect(loaded.mrPreferred).toBe(false);
    expect(S.surfaceKind(0.9)).toBe('desk');
    expect(S.surfaceKind(0.1)).toBe('wall');
  });
  it('fills defaults when an older save has no habit or accessibility fields', () => {
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    S.save(s, kv, 0);
    const raw = JSON.parse(kv.getItem(S.STORAGE_KEY)!);
    delete raw.habit; delete raw.a11y; delete raw.tutorialStep; delete raw.mrPreferred;
    kv.setItem(S.STORAGE_KEY, JSON.stringify(raw));
    const loaded = S.load(kv);
    expect(loaded.cards).toHaveLength(3);
    expect(loaded.a11y.highContrast).toBe(false);
    expect(loaded.a11y.aiPlanner).toBe(false);
    expect(loaded.habit.history).toEqual([]);
    expect(loaded.mrPreferred).toBe(true);
  });
});
