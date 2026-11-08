import { describe, it, expect } from 'vitest';
import * as S from '../src/state';
describe('desk continuity', () => {
  it('keeps a next step attached to its task through moving, saving, and undo', () => {
    const state = S.createInitialState(); const task = state.cards[0];
    S.parkCard(state, task.id, 1);
    expect(S.leaveNextStep(state, task.id, '  Open with the customer problem  ')).toBe(true);
    const snap = S.captureBoard(state);
    S.leaveNextStep(state, task.id, 'A different cue'); S.restoreBoard(state, snap);
    S.moveCard(state, task.id, 'doing');
    let saved = ''; const kv = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
    S.save(state, kv); const loaded = S.load(kv);
    expect(loaded.cards[0].nextStep).toBe('Open with the customer problem');
    expect(loaded.cards[0].column).toBe('doing');
    expect(S.leaveNextStep(loaded, task.id, ' ')).toBe(false);
  });
  it('settles an expired focus after a closed-page reload exactly once', () => {
    const state = S.createInitialState(); const now = Date.now();
    S.parkCard(state, state.cards[0].id, 1); state.focusId = state.cards[0].id;
    state.timer.durationMs = 100; state.timer.remainingMs = 100; S.startTimer(state.timer, now - 200);
    let saved = ''; const kv = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
    S.save(state, kv, now - 150); const loaded = S.load(kv);
    expect(loaded.cards[0].column).toBe('done'); expect(loaded.focusId).toBeNull();
    expect(loaded.habit.history.at(-1)?.focusSessions).toBe(1);
    S.save(loaded, kv); const again = S.load(kv);
    expect(again.habit.history.at(-1)?.focusSessions).toBe(1);
  });
  it('a finished focus block earns lasting growth after the live timer resets', () => {
    expect(S.gardenStage()).toBe(0);
    expect(S.gardenStage({ completed: 0, focusSessions: 1 })).toBe(4);
    expect(S.gardenStage({ completed: 0, focusSessions: 3 })).toBe(5);
    expect(S.gardenStage({ completed: 7, focusSessions: 0 })).toBe(5);
  });
});
