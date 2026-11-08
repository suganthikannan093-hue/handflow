import { describe, it, expect } from 'vitest';
import * as S from '../src/state';
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
describe('cards', () => {
  it('initial state has seeded cards', () => { const s = S.createInitialState(); expect(S.cardsIn(s, 'todo').length).toBe(2); expect(S.cardsIn(s, 'doing').length).toBe(1); });
  it('adds from templates with wraparound', () => { const s = S.createInitialState(); const c = S.addCard(s, S.TEMPLATES.length + 1); expect(c.title).toBe(S.TEMPLATES[1].title); expect(c.order).toBe(2); });
  it('moves between columns and renumbers', () => {
    const s = S.createInitialState(); const [a, b] = S.cardsIn(s, 'todo');
    S.moveCard(s, a.id, 'done'); expect(a.column).toBe('done'); expect(b.order).toBe(0);
    S.moveCard(s, b.id, 'done', 0); expect(S.cardsIn(s, 'done').map(c => c.id)).toEqual([b.id, a.id]);
    expect(S.moveCard(s, 'nope', 'todo')).toBe(false);
  });
  it('reorders within a column', () => { const s = S.createInitialState(); const [a, b] = S.cardsIn(s, 'todo'); S.moveCard(s, a.id, 'todo', 1); expect(S.cardsIn(s, 'todo').map(c => c.id)).toEqual([b.id, a.id]); });
  it('deletes', () => { const s = S.createInitialState(); const n = s.cards.length; expect(S.deleteCard(s, s.cards[0].id)).toBe(true); expect(s.cards.length).toBe(n - 1); });
  it('maps x/y to column/index', () => { expect(S.columnForX(-0.5, 0.45)).toBe('todo'); expect(S.columnForX(0.02, 0.45)).toBe('doing'); expect(S.columnForX(9, 0.45)).toBe('done'); expect(S.indexForY(0.1, 0.3, 0.1, 5)).toBe(2); expect(S.indexForY(-5, 0.3, 0.1, 3)).toBe(3); });
});
describe('notes', () => {
  it('add, pin, delete', () => { const s = S.createInitialState(); const n = S.addNote(s, [0, 1, -0.5]); S.setNote(s, n.id, [1, 1, 1], true); expect(s.notes[0].pinned).toBe(true); expect(S.deleteNote(s, n.id)).toBe(true); });
});
describe('timer', () => {
  it('start/stop/reset', () => {
    const t = S.createInitialState().timer; S.startTimer(t, 0); expect(S.timerRemaining(t, 60_000)).toBe(S.FOCUS_MS - 60_000);
    S.stopTimer(t, 60_000); expect(S.timerRemaining(t, 999_999)).toBe(S.FOCUS_MS - 60_000);
    S.toggleTimer(t, 0); expect(t.running).toBe(true); S.resetTimer(t); expect(t.running).toBe(false); expect(t.remainingMs).toBe(S.FOCUS_MS);
  });
  it('completes focus -> break', () => { const t = S.createInitialState().timer; S.startTimer(t, 0); expect(S.tickTimer(t, 1000)).toBe(false); expect(S.tickTimer(t, S.FOCUS_MS)).toBe(true); expect(t.mode).toBe('break'); expect(t.completed).toBe(1); expect(t.remainingMs).toBe(S.BREAK_MS); });
  it('formats', () => { expect(S.formatMs(S.FOCUS_MS)).toBe('25:00'); expect(S.formatMs(61_001)).toBe('01:02'); });
});
describe('persistence', () => {
  it('round-trips and pauses timer', () => { const kv = mem(); const s = S.createInitialState(); S.startTimer(s.timer, 0); S.save(s, kv, 5000); const l = S.load(kv); expect(l.cards.length).toBe(3); expect(l.timer.running).toBe(false); expect(l.timer.remainingMs).toBe(S.FOCUS_MS - 5000); });
  it('keeps a wall-clock focus across reload', () => {
    const kv = mem(); const s = S.createInitialState(); const start = Date.now();
    S.startTimer(s.timer, start); S.save(s, kv, start + 5000); const l = S.load(kv);
    expect(l.timer.running).toBe(true); expect(l.timer.mode).toBe('focus');
    expect(l.timer.endsAt).toBe(start + S.FOCUS_MS);
    expect(l.timer.remainingMs).toBeGreaterThan(S.FOCUS_MS - 30_000);
    expect(l.timer.remainingMs).toBeLessThanOrEqual(S.FOCUS_MS);
    expect(Math.abs(l.timer.remainingMs - (l.timer.endsAt! - Date.now()))).toBeLessThan(1000);
  });
  it('does not zero a timer when the save clock is wall time and the start clock is not', () => {
    const kv = mem(); const s = S.createInitialState();
    S.startTimer(s.timer, 1200); S.save(s, kv);
    const l = S.load(kv);
    expect(l.timer.remainingMs).toBe(S.FOCUS_MS); expect(l.timer.running).toBe(false); expect(l.timer.mode).toBe('focus');
  });
  it('starts a full focus when the remaining time is already zero', () => {
    const t = S.createInitialState().timer; t.remainingMs = 0;
    S.toggleTimer(t, 5000);
    expect(t.mode).toBe('focus'); expect(t.running).toBe(true);
    expect(S.timerRemaining(t, 5000)).toBe(S.FOCUS_MS);
    expect(S.tickTimer(t, 5000)).toBe(false);
  });
  it('falls back on corrupt data', () => { const kv = mem(); kv.setItem(S.STORAGE_KEY, '{bad'); expect(S.load(kv).cards.length).toBe(3); });
});
