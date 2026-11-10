import { describe, it, expect } from 'vitest';
import * as S from '../src/state';
import { fitsComfort, BOARD_H, BOARD_W, BOARD_Z, CARD_H, CARD_SP, CARD_TOP, CARD_W, COACH_H, COACH_Y, COL_W, COLUMN_PAGE, DESKTOP_CAM_Y, DESKTOP_FOV, DESKTOP_WS_Z, DOCK_X, DOCK_Y, DOCK_Z, DOCK_HALF, DUR_GAP, DUR_H, DUR_W, DUR_Y, EYE, EYE_DROP, MORE_H, MORE_Y, SKIP_TUT_H, SKIP_TUT_W, SUPPORT_CLEARANCE, TIMER_BTN_H, TIMER_BTN_Y, TIMER_H, TIMER_Y, TIMER_Z, TIMER_W, TOAST_H, TOAST_Y, PLANT_X, WORKSPACE_LOWEST, XR_DROP, boardSpanAt, desktopCameraDistance, panelYFromCanvas, poseLooksUntracked, projectFromHead, workspaceLocalToWorld, workspacePoseFromHead } from '../src/layout';

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
  it('acts on the desk from speech and leaves ordinary speech as a card', () => {
    const s = S.createInitialState();
    const spec = s.cards.find(c => c.title === 'Write spec draft')!;
    const review = s.cards.find(c => c.title === 'Review pull request')!;
    const parked = S.runAgent(s, 'leave Write spec draft on the desk');
    expect(parked.kind).toBe('park');
    expect(spec.parked).toBe(0);
    const focus = S.runAgent(s, 'start focus', day(2026, 11, 7), 5000);
    expect(focus.kind).toBe('focus');
    expect(focus.reply).toContain('Write spec draft');
    expect(s.timer.running).toBe(true);
    expect(s.focusId).toBe(spec.id);
    const finished = S.runAgent(s, 'finish Review pull request', day(2026, 11, 7));
    expect(finished.kind).toBe('done');
    expect(review.column).toBe('done');
    expect(S.todayRecord(s.habit, day(2026, 11, 7)).completed).toBe(1);
    S.parkCard(s, s.cards.find(c => c.title === 'Reply to emails')!.id, 1);
    const status = S.runAgent(s, "what's on my desk");
    expect(status.kind).toBe('status');
    expect(status.reply).toContain('Reply to emails');
    expect(status.reply).toContain('Write spec draft');
    const before = s.cards.length;
    expect(S.runAgent(s, 'park the budget review').reply).toBe('I can’t see that task');
    expect(s.cards).toHaveLength(before);
    expect(S.runAgent(s, 'wind down', day(2026, 11, 7)).kind).toBe('winddown');
    expect(S.runAgent(s, 'mark the day reviewed', day(2026, 11, 7)).kind).toBe('reviewed');
    expect(s.habit.mode).toBe('work');
  });
  it('dictates other speech into a card and note-prefixed speech into a note', () => {
    const s = S.createInitialState();
    expect(S.applyTranscript(s, 'Email the venue about chairs')).toBe('card');
    expect(s.cards.some(c => c.title === 'Email the venue about chairs')).toBe(true);
    expect(S.applyTranscript(s, 'note: remember the long caption about the plant on the desk')).toBe('note');
    expect(s.notes.at(-1)?.text.startsWith('remember the long caption')).toBe(true);
  });
});

describe('dependability', () => {
  it('runs focus into a break and the break back into focus', () => {
    const s = S.createInitialState();
    const card = s.cards[0];
    S.parkCard(s, card.id, 1);
    s.focusId = card.id;
    S.startTimer(s.timer, 0);
    expect(S.tickTimer(s.timer, S.FOCUS_MS)).toBe(true);
    expect(s.timer.mode).toBe('break');
    expect(s.timer.completed).toBe(1);
    expect(S.takeParkedFocus(s, day(2026, 11, 7))).toBe(true);
    expect(card.column).toBe('done');
    expect(card.parked).toBeNull();
    S.startTimer(s.timer, S.FOCUS_MS);
    expect(S.tickTimer(s.timer, S.FOCUS_MS + S.BREAK_MS)).toBe(true);
    expect(s.timer.mode).toBe('focus');
    expect(s.timer.running).toBe(false);
  });
  it('restores a deleted card and a pinned note after undo', () => {
    const s = S.createInitialState();
    const before = S.captureBoard(s);
    const card = s.cards[0];
    S.deleteCard(s, card.id);
    const note = S.addNote(s, [0.3, 0.05, 0.02], 'beside the board');
    S.setNote(s, note.id, [0.3, 0.05, 0.02], true);
    S.restoreBoard(s, before);
    expect(s.cards.some(c => c.id === card.id)).toBe(true);
    expect(s.notes.some(n => n.text === 'beside the board')).toBe(false);
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const again = S.createInitialState();
    const kept = S.addNote(again, [0.3, 0.05, 0.02], 'still here');
    S.setNote(again, kept.id, [0.3, 0.05, 0.02], true);
    S.save(again, kv, 0);
    const loaded = S.load(kv);
    expect(loaded.notes[0].pinned).toBe(true);
    expect(loaded.notes[0].text).toBe('still here');
    expect(loaded.notes[0].pos[0]).toBeCloseTo(0.3);
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
    expect(payoff.message).toBe("You're set up");
    expect(s.onboarded).toBe(true);
    expect(s.habit.streak).toBe(1);
    expect(S.tutorialPayoff(75_000).fast).toBe(false);
    expect(S.tutorialPayoff(75_000).message).toBe('Lesson complete');
  });
  it('keeps the timer, dock and stands inside the 30 degree cone and round-trips new settings', () => {
    expect(BOARD_W).toBeCloseTo(0.72, 2);
    expect(BOARD_H).toBeCloseTo(0.51, 2);
    expect(fitsComfort(0, DOCK_HALF, DOCK_Z)).toBe(true);
    const vTan = Math.tan((DESKTOP_FOV * Math.PI) / 360);
    const aspect = 1280 / 800;
    const camZ = (DESKTOP_WS_Z + BOARD_Z) + desktopCameraDistance(aspect);
    const ndcY = (worldY: number, worldZ: number) => ((worldY - DESKTOP_CAM_Y) / (camZ - worldZ)) / vTan;
    const wsY = DESKTOP_CAM_Y - EYE_DROP, wsZ = DESKTOP_WS_Z;
    expect(ndcY(wsY + TIMER_Y + TIMER_H / 2, wsZ + TIMER_Z)).toBeLessThan(0.92);
    expect(ndcY(wsY + DOCK_Y - 0.082, wsZ + DOCK_Z)).toBeGreaterThan(-0.92);
    expect(ndcY(wsY + COACH_Y + COACH_H / 2, wsZ + TIMER_Z)).toBeLessThan(0.92);
    expect(fitsComfort(0, TIMER_W / 2, TIMER_Z)).toBe(true);
    expect(fitsComfort(PLANT_X, 0.03, TIMER_Z)).toBe(true);
    expect(TIMER_Y - TIMER_H / 2).toBeGreaterThan(BOARD_H / 2);
    expect(DOCK_Y + 0.04).toBeLessThan(-BOARD_H / 2);
    expect(Math.abs(PLANT_X) - 0.03).toBeGreaterThan(TIMER_W / 2);
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    s.a11y.highContrast = true; s.a11y.largeTargets = true; s.a11y.lookHold = true; s.mrPreferred = false;
    s.placement = { position: [1, 2, 3], quaternion: [0, 0, 0, 1], anchorId: 'anchor-1', surface: 'desk' };
    S.save(s, kv, 0);
    const loaded = S.load(kv);
    expect(loaded.a11y.highContrast).toBe(true);
    expect(loaded.a11y.lookHold).toBe(true);
    expect(loaded.placement?.anchorId).toBe('anchor-1');
    expect(loaded.placement?.surface).toBe('desk');
    expect(loaded.mrPreferred).toBe(false);
    expect(S.surfaceKind(0.9)).toBe('desk');
    expect(S.surfaceKind(0.1)).toBe('wall');
  });
  it('parks one task on a free desk stand and leaves the column', () => {
    const s = S.createInitialState();
    const card = S.cardsIn(s, 'todo')[0];
    expect(S.nearestDeskSlot(0, -0.15, 0.15)).toBe(1);
    expect(S.nearestDeskSlot(0, 0.2, -0.02)).toBe(-1);
    expect(S.parkCard(s, card.id, 1)).toBe(1);
    expect(S.cardsIn(s, 'todo').some(c => c.id === card.id)).toBe(false);
    expect(S.singleParked(s)?.id).toBe(card.id);
    const other = S.cardsIn(s, 'todo')[0];
    expect(S.parkCard(s, other.id, 1)).toBe(-1);
    expect(S.parkCard(s, other.id, 0)).toBe(0);
    expect(S.singleParked(s)).toBeNull();
    for (const slot of S.DESK_SLOTS) expect(fitsComfort(slot.x, 0.071, slot.z)).toBe(true);
  });
  it('finishes the one task left on the desk when focus ends', () => {
    const s = S.createInitialState();
    const card = s.cards[0];
    S.parkCard(s, card.id, 0);
    s.focusId = card.id;
    expect(S.takeParkedFocus(s, day(2026, 11, 7))).toBe(true);
    expect(card.column).toBe('done');
    expect(card.parked).toBeNull();
    expect(s.focusId).toBeNull();
    expect(S.todayRecord(s.habit, day(2026, 11, 7)).completed).toBe(1);
    expect(S.takeParkedFocus(s, day(2026, 11, 7))).toBe(false);
  });
  it('remembers a parked task and drops a bad stand index', () => {
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    const card = s.cards[0];
    S.parkCard(s, card.id, 2);
    s.focusId = card.id;
    S.save(s, kv, 0);
    const raw = JSON.parse(kv.getItem(S.STORAGE_KEY)!);
    raw.cards[1].parked = 9;
    kv.setItem(S.STORAGE_KEY, JSON.stringify(raw));
    const loaded = S.load(kv);
    expect(loaded.cards.find(c => c.id === card.id)?.parked).toBe(2);
    expect(loaded.cards[1].parked).toBeNull();
    expect(loaded.focusId).toBe(card.id);
    expect(S.cardsIn(loaded, 'todo').some(c => c.id === card.id)).toBe(false);
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
    expect(loaded.a11y.showFps).toBe(false);
    expect(loaded.a11y.aiPlanner).toBe(false);
    expect(loaded.habit.history).toEqual([]);
    expect(loaded.mrPreferred).toBe(true);
  });
  it('holds a pinch across the gap between start and release', () => {
    expect(S.PINCH_START).toBeLessThan(S.PINCH_RELEASE);
    expect(S.pinchHeld(0.03, false)).toBe(false);
    expect(S.pinchHeld(0.03, true)).toBe(true);
    expect(S.pinchHeld(0.015, false)).toBe(true);
    expect(S.pinchHeld(0.04, true)).toBe(false);
  });
  it('points the stand normal along the same tilt as the ring', () => {
    const n = S.deskFaceNormal();
    expect(n.x).toBe(0);
    expect(n.y).toBeCloseTo(-Math.sin(S.DESK_TILT));
    expect(n.z).toBeCloseTo(Math.cos(S.DESK_TILT));
    expect(n.y * n.y + n.z * n.z).toBeCloseTo(1);
  });
  it('pages a full column instead of drawing every card', () => {
    const win = S.columnWindow(10, 0, COLUMN_PAGE);
    expect(win.visible).toBe(COLUMN_PAGE);
    expect(win.hidden).toBe(7);
    for (let i = 0; i < win.visible; i++) {
      const bottom = CARD_TOP - i * CARD_SP - CARD_H / 2;
      expect(bottom).toBeGreaterThan(-BOARD_H / 2);
    }
    const blockers = S.COLUMNS.flatMap((_, col) => Array.from({ length: COLUMN_PAGE }, (__, i) => ({
      x: (col - 1) * COL_W, y: CARD_TOP - i * CARD_SP, w: CARD_W, h: CARD_H,
    })));
    const spot = S.noteSpot(BOARD_W, BOARD_H, { w: 0.13, h: 0.12 }, blockers, 0);
    expect(spot).not.toBeNull();
    const note = { x: spot!.x, y: spot!.y, w: 0.13, h: 0.12 };
    for (const card of blockers) expect(S.rectsOverlap(note, card)).toBe(false);
    expect(Math.abs(note.y) + note.h / 2).toBeLessThan(BOARD_H / 2);
  });
  it('opens the palm test when the palm faces the viewer', () => {
    const wrist = { x: 0, y: 0, z: 0 };
    const indexMeta = { x: 0.04, y: 0, z: -0.06 };
    const pinkyMeta = { x: -0.04, y: 0, z: -0.06 };
    expect(S.palmFacesViewer(wrist, indexMeta, pinkyMeta, { x: 0, y: -1, z: 0 })).toBe(true);
    expect(S.palmFacesViewer(wrist, indexMeta, pinkyMeta, { x: 0, y: 1, z: 0 })).toBe(false);
  });
});

describe('review fixes', () => {
  const cardsOf = (s: S.WorkspaceState) => S.visibleCardRects(s, COL_W, CARD_W, CARD_H, CARD_TOP, CARD_SP, COLUMN_PAGE);

  it('wraps Remember: hydrate only at spaces at the real pinned note size', () => {
    const text = 'Remember: hydrate';
    const box = S.noteTextBox(true, S.noteSize(text));
    // 700-weight system-ui is wider than the 0.55em headless fallback; this is the case that used to split "Remembe / r:".
    const measure = (sample: string, font: number) => sample.length * font * 0.72;
    const fit = S.fitWrappedText(text, box.maxWidth, box.maxHeight, measure, 16, 32);
    expect(fit.ellipsis).toBe(false);
    expect(fit.lines.join(' ')).toBe(text);
    expect(fit.lines.some(line => /Remembe$/.test(line) || /^r:/.test(line) || line.includes('Remembe r'))).toBe(false);
    for (const line of fit.lines) {
      expect(['Remember:', 'hydrate', 'Remember: hydrate']).toContain(line);
      expect(measure(line, fit.font)).toBeLessThanOrEqual(box.maxWidth + 1);
    }
    expect(measure('Remember:', 32)).toBeGreaterThan(box.maxWidth);
  });

  it('seeds starter notes in free space so they do not cover the Doing cards', () => {
    const s = S.createInitialState();
    const blockers = cardsOf(s);
    const seeded = S.seedStarterNotes(s, BOARD_W, BOARD_H, blockers);
    expect(seeded.map(n => n.text)).toEqual([...S.STARTER_NOTES]);
    expect(S.seedStarterNotes(s, BOARD_W, BOARD_H, blockers)).toHaveLength(0);
    for (const n of seeded) {
      const size = S.noteSize(n.text);
      const rect = { x: n.pos[0], y: n.pos[1], w: size.w, h: size.h };
      expect(S.noteFits(rect, BOARD_W, BOARD_H, blockers)).toBe(true);
    }
    const [a, b] = seeded.map(n => {
      const size = S.noteSize(n.text);
      return { x: n.pos[0], y: n.pos[1], w: size.w, h: size.h };
    });
    expect(S.rectsOverlap(a, b)).toBe(false);
  });

  it('moves a note that was saved on top of a Doing card into free space', () => {
    const s = S.createInitialState();
    const doing = S.cardsIn(s, 'doing')[0];
    const n = S.addNote(s, [0, CARD_TOP, 0.012], 'Remember: hydrate');
    n.pinned = true;
    const blockers = cardsOf(s);
    expect(S.rectsOverlap({ x: 0, y: CARD_TOP, w: S.noteSize(n.text).w, h: S.noteSize(n.text).h }, blockers.find(b => Math.abs(b.x) < 0.01)!)).toBe(true);
    S.resolveBoardNotes(s, BOARD_W, BOARD_H, blockers);
    const size = S.noteSize(n.text);
    expect(S.noteFits({ x: n.pos[0], y: n.pos[1], w: size.w, h: size.h }, BOARD_W, BOARD_H, blockers)).toBe(true);
    expect(doing.column).toBe('doing');
  });

  it('keeps a clear drop and relocates a drop that covers a card', () => {
    const s = S.createInitialState();
    const blockers = cardsOf(s);
    const size = { w: 0.15, h: 0.13 };
    const clear = S.pinNotePosition(BOARD_W, BOARD_H, size, blockers, { x: 0, y: -BOARD_H / 2 + 0.08 });
    expect(clear).not.toBeNull();
    expect(S.noteFits({ x: clear!.x, y: clear!.y, w: size.w, h: size.h }, BOARD_W, BOARD_H, blockers)).toBe(true);
    const moved = S.pinNotePosition(BOARD_W, BOARD_H, size, blockers, { x: 0, y: CARD_TOP }, 0);
    expect(moved).not.toBeNull();
    expect(moved!.y).not.toBeCloseTo(CARD_TOP, 3);
    expect(S.noteFits({ x: moved!.x, y: moved!.y, w: size.w, h: size.h }, BOARD_W, BOARD_H, blockers)).toBe(true);
  });

  it('sits the +N more chip below the column header and above the first card, clear of the toast slot', () => {
    const headerY = panelYFromCanvas(47, BOARD_H, 800);
    const headerHalf = 18 / (2 * 800);
    const todayY = panelYFromCanvas(18, BOARD_H, 800);
    const todayHalf = 16 / (2 * 800);
    expect(Math.abs(MORE_Y - headerY)).toBeGreaterThan((MORE_H + headerHalf * 2) / 2);
    expect(MORE_Y - MORE_H / 2).toBeGreaterThan(CARD_TOP + CARD_H / 2);
    expect(TOAST_Y - TOAST_H / 2).toBeGreaterThan(headerY + headerHalf);
    expect(TOAST_Y - TOAST_H / 2).toBeGreaterThan(MORE_Y + MORE_H / 2);
    expect(COACH_Y - COACH_H / 2).toBeGreaterThan(BOARD_H / 2 + 0.015);
    expect(COACH_Y - COACH_H / 2).toBeGreaterThan(todayY + todayHalf);
    expect(TOAST_Y - TOAST_H / 2).toBeGreaterThan(todayY + todayHalf);
    expect(TOAST_Y - TOAST_H / 2).toBeGreaterThan(COACH_Y + COACH_H / 2);
    expect(TIMER_Y - TIMER_H / 2).toBeGreaterThan(TOAST_Y + TOAST_H / 2);
    expect(SKIP_TUT_W).toBeGreaterThanOrEqual(0.09);
    expect(SKIP_TUT_H).toBeGreaterThanOrEqual(0.036);
  });

  it('spaces the 25m/5m/1m chips below the timer digits', () => {
    const digitY = panelYFromCanvas(0.36 * (TIMER_H * 1200), TIMER_H, 1200);
    const digitHalf = 58 / (2 * 1200);
    expect(digitY - digitHalf).toBeGreaterThan(DUR_Y + DUR_H / 2 + 0.008);
    expect(DUR_Y - DUR_H / 2).toBeGreaterThan(TIMER_BTN_Y + TIMER_BTN_H / 2);
    expect(DUR_W).toBeGreaterThanOrEqual(0.09);
    expect(DUR_H).toBeGreaterThanOrEqual(0.034);
    expect(DUR_GAP).toBeGreaterThan(DUR_W);
  });

  it('places the workspace 0.85-0.95 m in front of a seated head and rejects an untracked identity pose', () => {
    const pose = workspacePoseFromHead({ x: 0, y: 1.35, z: 0 }, { x: 0, y: 0, z: -1 });
    expect(pose.dist).toBeGreaterThanOrEqual(0.85);
    expect(pose.dist).toBeLessThanOrEqual(0.95);
    expect(pose.position.z).toBeCloseTo(-EYE);
    expect(pose.position.y).toBeCloseTo(1.35 - XR_DROP);
    expect(1.35 - pose.position.y).toBeGreaterThanOrEqual(0.15);
    expect(1.35 - pose.position.y).toBeLessThanOrEqual(0.25);
    expect(pose.facing.z).toBeCloseTo(1);
    expect(pose.position.x).toBeCloseTo(0);
    expect(poseLooksUntracked({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 })).toBe(true);
    expect(poseLooksUntracked({ x: 0, y: 1.35, z: 0 }, { x: 0, y: 0, z: 0, w: 1 })).toBe(false);
    const turned = workspacePoseFromHead({ x: 1, y: 1.2, z: 2 }, { x: 0.8, y: -0.2, z: 0.2 });
    const dx = turned.position.x - 1, dz = turned.position.z - 2;
    expect(Math.hypot(dx, dz)).toBeCloseTo(turned.dist);
    expect(dx * 0.8 + dz * 0.2).toBeGreaterThan(0);
    expect(boardSpanAt(EYE, Math.tan(Math.PI / 4))).toBeGreaterThanOrEqual(0.4);
    const content = (head: { x: number; y: number; z: number }, look: { x: number; y: number; z: number }) => {
      const seated = workspacePoseFromHead(head, look);
      const header = workspaceLocalToWorld(seated, { x: 0, y: BOARD_H / 2, z: BOARD_Z });
      const timerTop = workspaceLocalToWorld(seated, { x: 0, y: TIMER_Y + TIMER_H / 2, z: TIMER_Z });
      const board = workspaceLocalToWorld(seated, { x: 0, y: 0, z: BOARD_Z });
      return {
        seated,
        header: projectFromHead(head, look, header),
        timerTop: projectFromHead(head, look, timerTop),
        board: projectFromHead(head, look, board),
      };
    };
    const head = { x: 0, y: 1.15, z: 0 };
    const down = { x: 0.30, y: -0.58, z: -0.76 };
    const seated = content(head, down);
    expect(seated.header.inView, JSON.stringify(seated.header)).toBe(true);
    expect(seated.timerTop.inView, JSON.stringify(seated.timerTop)).toBe(true);
    expect(Math.abs(seated.header.ndcY)).toBeLessThanOrEqual(1);
    expect(Math.abs(seated.timerTop.ndcY)).toBeLessThanOrEqual(1);
    const ahead = { x: 0, y: 0, z: -1 };
    const flat = content(head, ahead);
    expect(flat.seated.drop).toBeCloseTo(XR_DROP);
    expect(flat.header.inView).toBe(true);
    expect(flat.timerTop.inView).toBe(true);
    expect(Math.abs(flat.timerTop.ndcY)).toBeLessThan(1);
    // A steeper desk look, like IWER sitting over a lower table, must still keep both in a 90° FOV.
    const steep = content(head, { x: 0.2, y: -0.75, z: -0.63 });
    expect(steep.header.inView, JSON.stringify(steep.header)).toBe(true);
    expect(steep.timerTop.inView, JSON.stringify(steep.timerTop)).toBe(true);
    // Yaw-only placement keeps the board centred even when the user looks down and to the side.
    expect(Math.abs(seated.board.ndcX)).toBeLessThan(0.05);
    expect(Math.abs(steep.board.ndcX)).toBeLessThan(0.05);
    expect(Math.abs(flat.board.ndcX)).toBeLessThan(0.05);
    // A desk in front of a seated user: sit just in front of the near edge, or above the tabletop.
    const desk = workspacePoseFromHead(head, ahead, EYE, XR_DROP, { height: 0.73, front: 0.62 });
    const inFront = desk.dist <= 0.62 - 0.04;
    const above = desk.position.y + WORKSPACE_LOWEST >= 0.73 + SUPPORT_CLEARANCE - 1e-6;
    expect(inFront || above, JSON.stringify(desk)).toBe(true);
    if (inFront) expect(desk.dist).toBeLessThan(0.85);
    expect(desk.position.x).toBeCloseTo(0);
    // IWER home-office desk sits ~0.38 m ahead. Hang in front of the edge so a
    // downward look can keep the timer in view without cutting through the top.
    const close = workspacePoseFromHead(head, down, EYE, XR_DROP, { height: 0.74, front: 0.38 });
    expect(close.dist, JSON.stringify(close)).toBeLessThanOrEqual(0.38 - 0.04);
    expect(close.dist).toBeGreaterThanOrEqual(0.28);
    expect(close.position.x).toBeCloseTo(head.x + close.dist * (down.x / Math.hypot(down.x, down.z)));
    const closeHeader = workspaceLocalToWorld(close, { x: 0, y: BOARD_H / 2, z: BOARD_Z });
    const closeTimer = workspaceLocalToWorld(close, { x: 0, y: TIMER_Y + TIMER_H / 2, z: TIMER_Z });
    const closeBoard = workspaceLocalToWorld(close, { x: 0, y: 0, z: BOARD_Z });
    expect(projectFromHead(head, down, closeHeader).inView).toBe(true);
    expect(projectFromHead(head, down, closeTimer).inView).toBe(true);
    expect(Math.abs(projectFromHead(head, down, closeBoard).ndcX)).toBeLessThan(0.05);
    const glance = workspacePoseFromHead(head, down, EYE, XR_DROP, { height: 0.74, front: 0.15 });
    const glanceTimer = workspaceLocalToWorld(glance, { x: 0, y: TIMER_Y + TIMER_H / 2, z: TIMER_Z });
    expect(projectFromHead(head, down, glanceTimer).inView, JSON.stringify(glance)).toBe(true);
    expect(glance.dist).toBeGreaterThanOrEqual(0.85);
  });

  it('does not restore a stale running break, but keeps a live focus and settles an expired one first', () => {
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const stale = S.createInitialState();
    stale.timer.mode = 'break'; stale.timer.durationMs = S.BREAK_MS; stale.timer.remainingMs = 223_000;
    stale.timer.running = true; stale.timer.startedAt = Date.now() - 77_000; stale.timer.endsAt = Date.now() + 223_000;
    S.save(stale, kv, Date.now());
    const loaded = S.load(kv);
    expect(loaded.timer.mode).toBe('focus');
    expect(loaded.timer.running).toBe(false);
    expect(loaded.timer.remainingMs).toBe(S.FOCUS_MS);
    expect(loaded.timer.durationMs).toBe(S.FOCUS_MS);

    const live = S.createInitialState();
    const start = Date.now();
    S.startTimer(live.timer, start);
    S.save(live, kv, start + 1000);
    const kept = S.load(kv);
    expect(kept.timer.running).toBe(true);
    expect(kept.timer.mode).toBe('focus');

    const done = S.createInitialState();
    S.parkCard(done, done.cards[0].id, 1); done.focusId = done.cards[0].id;
    done.timer.durationMs = 100; done.timer.remainingMs = 100; S.startTimer(done.timer, Date.now() - 200);
    S.save(done, kv, Date.now() - 150);
    const settled = S.load(kv);
    expect(settled.cards[0].column).toBe('done');
    expect(settled.habit.history.at(-1)?.focusSessions).toBe(1);
    expect(settled.timer.mode).toBe('focus');
    expect(settled.timer.running).toBe(false);
    expect(settled.timer.remainingMs).toBe(S.FOCUS_MS);
  });

  it('shows plant growth as soon as a 1-minute focus starts, and a finished session grows the garden', () => {
    const t = S.createInitialState().timer;
    t.durationMs = 60_000; t.remainingMs = 60_000;
    expect(S.liveFocusProgress(t, 0)).toBe(0);
    S.startTimer(t, 0);
    expect(S.liveFocusProgress(t, 0)).toBe(S.FOCUS_GROWTH_BOOST);
    expect(S.liveFocusProgress(t, 30_000)).toBeGreaterThanOrEqual(0.5);
    expect(S.liveFocusProgress(t, 60_000)).toBe(1);
    const s = S.createInitialState();
    s.timer.durationMs = 60_000; s.timer.remainingMs = 60_000;
    S.startTimer(s.timer, 0);
    expect(S.advanceWorkspaceTimer(s, 60_000, day(2026, 11, 10))).toBe(true);
    expect(S.todayRecord(s.habit, day(2026, 11, 10)).focusSessions).toBe(1);
    expect(S.gardenStage(S.todayRecord(s.habit, day(2026, 11, 10)))).toBeGreaterThanOrEqual(4);
  });

  it('skips the first-run tutorial without awarding a lesson streak', () => {
    const s = S.createInitialState();
    expect(s.onboarded).toBe(false);
    expect(S.needsOnboarding(s)).toBe(true);
    S.skipTutorial(s);
    expect(s.onboarded).toBe(true);
    expect(s.tutorialStep).toBe(S.TUTORIAL_STEPS.length);
    expect(s.onboardingVersion).toBe(S.ONBOARDING_VERSION);
    expect(S.needsOnboarding(s)).toBe(false);
    expect(s.habit.streak).toBe(0);
    expect(S.TUTORIAL_INTRO.toLowerCase()).toContain('pinch');
    expect(S.TUTORIAL_INTRO.toLowerCase()).toContain('poke');
    expect(S.TUTORIAL_INTRO.toLowerCase()).toContain('palm');
  });

  it('shows this onboarding version once to a returning visitor from an older save', () => {
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    s.onboarded = true; s.tutorialStep = S.TUTORIAL_STEPS.length; s.habit.streak = 1;
    S.save(s, kv, 0);
    const raw = JSON.parse(kv.getItem(S.STORAGE_KEY)!);
    delete raw.onboardingVersion;
    kv.setItem(S.STORAGE_KEY, JSON.stringify(raw));
    const loaded = S.load(kv);
    expect(loaded.onboarded).toBe(true);
    expect(loaded.habit.streak).toBe(1);
    expect(S.needsOnboarding(loaded)).toBe(true);
    S.skipTutorial(loaded);
    expect(S.needsOnboarding(loaded)).toBe(false);
    S.save(loaded, kv, 0);
    expect(S.needsOnboarding(S.load(kv))).toBe(false);
    S.replayTutorial(loaded);
    expect(S.needsOnboarding(loaded)).toBe(true);
    expect(loaded.onboarded).toBe(true);
    expect(loaded.habit.streak).toBe(1);
  });

  it('opens the palm menu when the palm faces the viewer or is turned up', () => {
    const wrist = { x: 0, y: 0, z: 0 };
    const indexMeta = { x: 0.04, y: 0, z: -0.06 };
    const pinkyMeta = { x: -0.04, y: 0, z: -0.06 };
    const towardFace = S.palmAim(wrist, indexMeta, pinkyMeta, { x: 0, y: -1, z: 0 });
    const away = S.palmAim(wrist, indexMeta, pinkyMeta, { x: 0, y: 1, z: 0 });
    expect(S.palmMenuShouldShow(towardFace)).toBe(true);
    expect(S.palmMenuShouldShow(away)).toBe(false);
    expect(S.palmMenuShouldShow({ x: 0, y: 1, z: 0, dot: 0 })).toBe(true);
    expect(S.palmMenuShouldShow({ x: 0, y: 0.2, z: 1, dot: 0.2 })).toBe(false);
    expect(S.palmMenuShouldShow({ x: 0, y: 0.4, z: 1, dot: 0.33 }, true)).toBe(true);
  });
});

describe('ritual, reach and hands-only fallback', () => {
  it('carries one task and a short note into the next launch as Where you left off', () => {
    const kv = { m: new Map<string, string>(), getItem: (k: string) => kv.m.get(k) ?? null, setItem: (k: string, v: string) => void kv.m.set(k, v) };
    const s = S.createInitialState();
    const later = s.cards.find(c => c.title === 'Write spec draft')!;
    const first = s.cards.find(c => c.title === 'Reply to emails')!;
    expect(S.cardsIn(s, 'todo')[0].id).toBe(first.id);
    const saved = S.saveCarryOver(s, 'Open with the customer problem', later.id, 1_700_000_000_000);
    expect(saved?.taskId).toBe(later.id);
    expect(saved?.note).toBe('Open with the customer problem');
    expect(later.nextStep).toBe('Open with the customer problem');
    expect(S.cardsIn(s, 'todo')[0].id).toBe(later.id);
    expect(S.leftOffGreeting(s)).toMatch(/Where you left off/);
    expect(S.leftOffGreeting(s)).toMatch(/Write spec draft/);
    S.save(s, kv, 0);
    const loaded = S.load(kv);
    expect(loaded.carryOver?.taskId).toBe(later.id);
    expect(loaded.carryOver?.note).toBe('Open with the customer problem');
    expect(S.cardsIn(loaded, 'todo')[0].id).toBe(later.id);
    expect(S.leftOffGreeting(loaded)).toContain('Where you left off');
    S.markCarryOverGreeted(loaded);
    expect(S.leftOffGreeting(loaded)).toBeNull();
    S.save(loaded, kv, 0);
    expect(S.leftOffGreeting(S.load(kv))).toBeNull();
    expect(S.cardsIn(S.load(kv), 'todo')[0].title).toBe('Write spec draft');
  });

  it('dims the backlog to the focus task plus the next three during quiet focus', () => {
    const s = S.createInitialState();
    const focus = S.addCustomCard(s, 'The one thing', 0x4f8cff, 'doing');
    S.parkCard(s, focus.id, 1);
    s.focusId = focus.id;
    S.startTimer(s.timer, 0);
    for (let i = 0; i < 5; i++) S.addCustomCard(s, `Backlog ${i}`, 0x4f8cff, 'todo');
    expect(S.isQuietFocus(s)).toBe(true);
    const ids = S.compactVisibleIds(s);
    expect(ids).toBeTruthy();
    expect(ids!.has(focus.id)).toBe(true);
    expect(ids!.size).toBe(1 + S.COMPACT_NEXT);
    const backlog = s.cards.filter(c => c.title.startsWith('Backlog'));
    expect(backlog.some(c => !ids!.has(c.id))).toBe(true);
    s.timer.running = false;
    s.compactBoard = false;
    expect(S.compactVisibleIds(s)).toBeNull();
    s.compactBoard = true;
    expect(S.compactVisibleIds(s)!.size).toBeGreaterThan(0);
  });

  it('keeps desk stands, the dock and a compact board inside a 0.6 m hand reach', () => {
    expect(S.HAND_REACH).toBeCloseTo(0.6);
    expect(BOARD_W).toBeLessThanOrEqual(0.75);
    const hand = { x: 0, y: -0.22, z: 0.22 };
    for (const slot of S.DESK_SLOTS) {
      expect(S.targetWithinReach(hand, slot), JSON.stringify(slot)).toBe(true);
    }
    expect(S.targetWithinReach(hand, { x: DOCK_X, y: DOCK_Y, z: DOCK_Z })).toBe(true);
    expect(S.targetWithinReach(hand, { x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('gives a hands-only path when the microphone or network is missing', () => {
    expect(S.voiceFallbackHint('mic')).toMatch(/permission denied/i);
    expect(S.voiceFallbackHint('mic')).toMatch(/Pinch a task|Capture & desk/i);
    expect(S.voiceFallbackHint('network')).toMatch(/network/i);
    expect(S.voiceFallbackHint('network')).toMatch(/Pinch a task|Capture & desk/i);
    expect(S.voiceFallbackHint('unavailable')).toMatch(/hands/i);
    expect(S.voiceFallbackHint('unavailable')).not.toMatch(/only.*voice|voice is required/i);
  });
});
