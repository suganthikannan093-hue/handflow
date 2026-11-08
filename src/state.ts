// Pure, framework-free workspace state (unit-tested).
export type Column = 'todo' | 'doing' | 'done';
export const COLUMNS: Column[] = ['todo', 'doing', 'done'];
export interface Card { id: string; title: string; column: Column; order: number; color: number; parked?: number | null; nextStep?: string }
export interface Note {
  id: string; text: string; pos: [number, number, number]; pinned: boolean; color: number;
  rot?: [number, number, number, number];
}
export interface Timer {
  durationMs: number; remainingMs: number; running: boolean;
  /** Clock value passed to startTimer. Same clock as endsAt. */
  startedAt: number | null;
  /** Absolute end on that same clock. Wall time when the app is running. */
  endsAt: number | null;
  mode: 'focus' | 'break'; completed: number;
}
export interface A11y {
  highContrast: boolean; largeTargets: boolean; lookHold: boolean; dwellMs: number;
  ambient: boolean; showFps: boolean; aiPlanner: boolean;
}
export type DayMode = 'morning' | 'work' | 'winddown';
export interface DayRecord { date: string; planned: number; completed: number; focusSessions: number; reviewed: boolean }
export interface Habit { mode: DayMode; streak: number; lastDate: string | null; history: DayRecord[] }
export interface Placement { position: [number, number, number]; quaternion: [number, number, number, number]; anchorId: string | null; surface?: 'desk' | 'wall' }
export interface WorkspaceState {
  version: 1; cards: Card[]; notes: Note[]; timer: Timer; onboarded: boolean;
  tutorialStep: number; a11y: A11y; habit: Habit; placement: Placement | null; mrPreferred: boolean;
  focusId: string | null;
}
/** Three stands in front of the board, inside the 30° cone. A task left here stays across sessions. */
export const DESK_SLOTS = [
  { x: -0.12, y: -0.15, z: 0.15 },
  { x: 0, y: -0.15, z: 0.15 },
  { x: 0.12, y: -0.15, z: 0.15 },
] as const;
export const DESK_SLOT_REACH = 0.07;
/** Slot rings and parked cards use this rotation.x. */
export const DESK_TILT = -0.45;
/** Workspace-local stand normal. rotation.x = DESK_TILT sends local (0, 0, 1) here. */
export function deskFaceNormal(): { x: number; y: number; z: number } {
  return { x: 0, y: -Math.sin(DESK_TILT), z: Math.cos(DESK_TILT) };
}

export const TEMPLATES = [
  { title: 'Reply to emails', color: 0x4f8cff }, { title: 'Write spec draft', color: 0x9b6bff },
  { title: 'Review pull request', color: 0x2fc59b }, { title: 'Plan sprint', color: 0xffb547 },
  { title: 'Call with team', color: 0xff6b8a }, { title: 'Deep work block', color: 0x38c6e8 },
];
export const MORNING_PLAN = [
  { title: 'Pick the one thing that matters', color: 0x4f8cff },
  { title: 'Clear overnight messages', color: 0xffb547 },
  { title: 'Block 25 minutes of deep work', color: 0x2fc59b },
];
export const NOTE_TEXTS = ['Idea: batch meetings', 'Remember: hydrate', 'Ship demo Friday', 'Ask about budget', 'Focus > busy'];
export const FOCUS_MS = 25 * 60_000, BREAK_MS = 5 * 60_000;
export const TUTORIAL_STEPS = [
  { id: 'pinch', coach: 'Pinch the glowing card' },
  { id: 'drop', coach: 'Drop it in Doing' },
  { id: 'park', coach: 'Leave a task on the glowing stand' },
  { id: 'create', coach: 'Poke + to make a task' },
  { id: 'pin', coach: 'Drop the note on the board' },
  { id: 'timer', coach: 'Poke Start on the timer' },
] as const;
/** Pinch starts under 2cm and stays held until the fingers open past 3.5cm. */
export const PINCH_START = 0.02;
export const PINCH_RELEASE = 0.035;
export function pinchHeld(distanceM: number, held: boolean) {
  return held ? distanceM < PINCH_RELEASE : distanceM < PINCH_START;
}

/** A note over a surface counts as near out to 28cm (a drag stays on a plane in front of the board). Beside the edge, 12cm still pins. */
export const PIN_FACE_REACH = 0.28;
export const PIN_EDGE_REACH = 0.12;
export const PIN_MARGIN = 0.06;

export function defaultA11y(): A11y {
  return { highContrast: false, largeTargets: false, lookHold: false, dwellMs: 800, ambient: false, showFps: false, aiPlanner: false };
}
export function defaultHabit(): Habit { return { mode: 'work', streak: 0, lastDate: null, history: [] }; }

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function createInitialState(): WorkspaceState {
  const s: WorkspaceState = {
    version: 1, cards: [], notes: [], onboarded: false, tutorialStep: 0,
    a11y: defaultA11y(), habit: defaultHabit(), placement: null, mrPreferred: true, focusId: null,
    timer: { durationMs: FOCUS_MS, remainingMs: FOCUS_MS, running: false, startedAt: null, endsAt: null, mode: 'focus', completed: 0 },
  };
  addCard(s, 0, 'todo'); addCard(s, 1, 'todo'); addCard(s, 2, 'doing');
  return s;
}
export function cardsIn(s: WorkspaceState, c: Column) { return s.cards.filter(x => x.column === c && x.parked == null).sort((a, b) => a.order - b.order); }
export function parkedCards(s: WorkspaceState) { return s.cards.filter(c => c.parked != null).sort((a, b) => (a.parked ?? 0) - (b.parked ?? 0)); }
/** The focus timer binds to a task only when exactly one is waiting on the desk. */
export function singleParked(s: WorkspaceState): Card | null {
  const open = parkedCards(s).filter(c => c.column !== 'done');
  return open.length === 1 ? open[0] : null;
}
/** Leave a concrete restart cue on the task itself, so it travels with the desk. */
export function leaveNextStep(s: WorkspaceState, id: string, text: string): boolean {
  const card = s.cards.find(c => c.id === id && c.column !== 'done');
  if (!card || !text.trim()) return false;
  card.nextStep = text.trim().slice(0, 180);
  return true;
}
/** Nearest stand within reach, or -1. Coordinates are workspace-local metres. */
export function nearestDeskSlot(x: number, y: number, z: number): number {
  let best = -1, bestD = DESK_SLOT_REACH;
  DESK_SLOTS.forEach((slot, i) => {
    const d = Math.hypot(x - slot.x, y - slot.y, z - slot.z);
    if (d <= bestD) { best = i; bestD = d; }
  });
  return best;
}
/** Park on a free stand. Returns the stand index, or -1 if that stand is taken or unknown. */
export function parkCard(s: WorkspaceState, id: string, slot: number): number {
  const card = s.cards.find(c => c.id === id);
  if (!card || !Number.isInteger(slot) || slot < 0 || slot >= DESK_SLOTS.length) return -1;
  if (s.cards.some(c => c.parked === slot && c.id !== id)) return -1;
  card.parked = slot;
  renumber(s, card.column);
  return slot;
}
function renumber(s: WorkspaceState, c: Column) { cardsIn(s, c).forEach((x, i) => (x.order = i)); }
export function addCard(s: WorkspaceState, templateIdx: number, column: Column = 'todo'): Card {
  const t = TEMPLATES[((templateIdx % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length];
  return addCustomCard(s, t.title, t.color, column);
}
export function addCustomCard(s: WorkspaceState, title: string, color = 0x4f8cff, column: Column = 'todo'): Card {
  const card: Card = { id: uid('card'), title: title.trim().slice(0, 160) || 'Untitled', color, column, order: cardsIn(s, column).length };
  s.cards.push(card); return card;
}
export function moveCard(s: WorkspaceState, id: string, column: Column, index = Infinity, now = new Date()) {
  const card = s.cards.find(c => c.id === id); if (!card) return false;
  card.parked = null;
  const from = card.column;
  const others = cardsIn(s, column).filter(c => c.id !== id);
  const i = Math.max(0, Math.min(index, others.length));
  others.splice(i, 0, card); card.column = column;
  others.forEach((c, k) => (c.order = k)); if (from !== column) renumber(s, from);
  if (from !== 'done' && column === 'done') onCardCompleted(s, now);
  return true;
}
export function deleteCard(s: WorkspaceState, id: string) {
  const c = s.cards.find(x => x.id === id); if (!c) return false;
  s.cards = s.cards.filter(x => x.id !== id); renumber(s, c.column); return true;
}
/** Map an x position on the board (metres, board-local, centred) to a column. */
export function columnForX(x: number, colWidth: number): Column {
  const i = Math.round(x / colWidth) + 1; return COLUMNS[Math.max(0, Math.min(2, i))];
}
export function indexForY(y: number, topY: number, spacing: number, count: number) {
  return Math.max(0, Math.min(count, Math.round((topY - y) / spacing)));
}

/** True when a point in a surface's local space should pin to that surface. */
export function pinToSurface(x: number, y: number, z: number, halfW: number, halfH: number) {
  const over = Math.abs(x) <= halfW + PIN_MARGIN && Math.abs(y) <= halfH + PIN_MARGIN;
  if (over && Math.abs(z) <= PIN_FACE_REACH) return true;
  const cx = Math.max(-halfW, Math.min(halfW, x));
  const cy = Math.max(-halfH, Math.min(halfH, y));
  return Math.hypot(x - cx, y - cy, z) <= PIN_EDGE_REACH;
}

export function noteSize(text: string) {
  const w = 0.13;
  const lines = Math.min(8, Math.max(2, Math.ceil(text.trim().length / 18)));
  const h = Math.min(0.24, 0.04 + lines * 0.025);
  return { w, h: Math.max(0.12, h) };
}
export function addNote(s: WorkspaceState, pos: [number, number, number], text?: string): Note {
  const n: Note = {
    id: uid('note'), text: (text?.trim() || NOTE_TEXTS[s.notes.length % NOTE_TEXTS.length]).slice(0, 400),
    pos, pinned: false, color: 0xffe27a,
  };
  s.notes.push(n); return n;
}
export function setNote(s: WorkspaceState, id: string, pos: [number, number, number], pinned: boolean, rot?: [number, number, number, number]) {
  const n = s.notes.find(x => x.id === id); if (n) { n.pos = pos; n.pinned = pinned; if (rot) n.rot = rot; } return !!n;
}
export function deleteNote(s: WorkspaceState, id: string) { const l = s.notes.length; s.notes = s.notes.filter(n => n.id !== id); return s.notes.length < l; }

export function wrapToWidth(text: string, maxWidth: number, measure: (sample: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  const pushWord = (word: string) => {
    if (measure(word) <= maxWidth) { line = word; return; }
    let chunk = '';
    for (const ch of word) {
      if (chunk && measure(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    line = chunk;
  };
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (measure(trial) <= maxWidth) line = trial;
    else { if (line) lines.push(line); pushWord(word); }
  }
  if (line) lines.push(line);
  return lines;
}
/** Shrink the font until the wrapped lines fit. The last line ends with … only when even the smallest font overflows. */
function widthAt(measure: (sample: string, font: number) => number, sample: string, font: number) {
  const w = measure(sample, font);
  // A zero result (headless measureText) would otherwise treat every line as fitting.
  return w > 0 ? w : Math.max(1, sample.length) * font * 0.55;
}
export function fitWrappedText(text: string, maxWidth: number, maxHeight: number, measure: (sample: string, font: number) => number, minFont = 14, maxFont = 32) {
  const at = (font: number) => (sample: string) => widthAt(measure, sample, font);
  let font = maxFont;
  while (font >= minFont) {
    const lines = wrapToWidth(text, maxWidth, at(font));
    if (lines.length * font * 1.25 <= maxHeight) return { font, lines, ellipsis: false };
    font -= 1;
  }
  const all = wrapToWidth(text, maxWidth, at(minFont));
  const maxLines = Math.max(1, Math.floor(maxHeight / (minFont * 1.25)));
  if (all.length <= maxLines) return { font: minFont, lines: all, ellipsis: false };
  const lines = all.slice(0, maxLines);
  let last = lines[maxLines - 1];
  while (last.length > 1 && at(minFont)(last + '…') > maxWidth) last = last.slice(0, -1);
  lines[maxLines - 1] = last.replace(/…$/, '') + '…';
  return { font: minFont, lines, ellipsis: true };
}

// ---- Timer (time injected for testability) ----
/** performance.now() stays under this. Date.now() is past it. Mixing the two clamped the timer to 0. */
const CLOCK_EPOCH = 1e11;
function sameClock(a: number, b: number) { return a > CLOCK_EPOCH === b > CLOCK_EPOCH; }
export function timerRemaining(t: Timer, now: number) {
  if (!t.running) return t.remainingMs;
  if (t.endsAt != null && sameClock(t.endsAt, now)) return Math.max(0, t.endsAt - now);
  if (t.startedAt != null && sameClock(t.startedAt, now)) return Math.max(0, t.remainingMs - (now - t.startedAt));
  return t.remainingMs;
}
export function startTimer(t: Timer, now: number) {
  if (t.running) return;
  if (t.remainingMs <= 0) t.remainingMs = t.durationMs;
  t.running = true;
  t.startedAt = now;
  t.endsAt = now + t.remainingMs;
}
export function stopTimer(t: Timer, now: number) {
  if (t.running) { t.remainingMs = timerRemaining(t, now); t.running = false; t.startedAt = null; t.endsAt = null; }
}
export function toggleTimer(t: Timer, now: number) { t.running ? stopTimer(t, now) : startTimer(t, now); }
export function resetTimer(t: Timer) { t.running = false; t.startedAt = null; t.endsAt = null; t.remainingMs = t.durationMs; }
/** Returns true when a phase completed on this tick (switches focus<->break). */
export function tickTimer(t: Timer, now: number) {
  if (!t.running || timerRemaining(t, now) > 0) return false;
  if (t.mode === 'focus') t.completed++;
  t.mode = t.mode === 'focus' ? 'break' : 'focus';
  t.durationMs = t.mode === 'focus' ? FOCUS_MS : BREAK_MS; resetTimer(t); return true;
}
export function formatMs(ms: number) { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

// ---- Habits ----
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
}
export function ensureToday(h: Habit, now = new Date()) {
  const date = todayKey(now);
  if (!h.history.some(r => r.date === date)) {
    h.history.push({ date, planned: 0, completed: 0, focusSessions: 0, reviewed: false });
    if (h.history.length > 60) h.history.splice(0, h.history.length - 60);
  }
  if (h.lastDate && h.lastDate !== date && daysBetween(h.lastDate, date) > 1) h.streak = 0;
  h.lastDate = date;
  return h;
}
export function todayRecord(h: Habit, now = new Date()) { ensureToday(h, now); return h.history.find(r => r.date === todayKey(now))!; }
export function onCardCompleted(s: WorkspaceState, now = new Date()) {
  const rec = todayRecord(s.habit, now);
  const first = rec.completed === 0;
  rec.completed += 1;
  if (!first) return;
  const prev = s.habit.history.find(r => r.date === shiftDate(todayKey(now), -1));
  s.habit.streak = prev && (prev.completed > 0 || prev.reviewed) ? s.habit.streak + 1 : 1;
}
function shiftDate(key: string, days: number) {
  const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + days); return todayKey(d);
}
export function noteFocusComplete(s: WorkspaceState, now = new Date()) { todayRecord(s.habit, now).focusSessions += 1; }
/** When a focus block ends, the one task left on the desk is done. Clears focusId either way. */
export function takeParkedFocus(s: WorkspaceState, now = new Date()): boolean {
  const id = s.focusId;
  s.focusId = null;
  if (!id) return false;
  const card = s.cards.find(c => c.id === id);
  if (!card || card.parked == null || card.column === 'done') return false;
  return moveCard(s, id, 'done', Infinity, now);
}
/** Settle a block once, including when it ended while the page was closed. */
export function advanceWorkspaceTimer(s: WorkspaceState, now = Date.now(), day = new Date(now)): boolean {
  if (!tickTimer(s.timer, now)) return false;
  if (s.timer.mode === 'break') { noteFocusComplete(s, day); takeParkedFocus(s, day); }
  else s.focusId = null;
  return true;
}
/** 0 seed, 1 sprout, 2 leaves, 3 bush, 4 bud, 5 bloom. */
export function plantStage(completed: number) {
  if (completed <= 0) return 0;
  if (completed === 1) return 1;
  if (completed === 2) return 2;
  if (completed <= 4) return 3;
  if (completed <= 6) return 4;
  return 5;
}
/** A completed focus block earns a lasting bud; focused effort survives the timer reset. */
export function gardenStage(record?: Pick<DayRecord, 'completed' | 'focusSessions'>) {
  return Math.max(plantStage(record?.completed ?? 0), record?.focusSessions ? Math.min(5, 4 + Math.floor(record.focusSessions / 3)) : 0);
}
export function planMorning(s: WorkspaceState, now = new Date()) {
  ensureToday(s.habit, now);
  s.habit.mode = 'morning';
  const created: Card[] = [];
  for (const t of MORNING_PLAN) {
    if (s.cards.some(c => c.title === t.title && c.column !== 'done')) continue;
    created.push(addCustomCard(s, t.title, t.color, 'todo'));
  }
  todayRecord(s.habit, now).planned = MORNING_PLAN.length;
  return created;
}
export function startWindDown(s: WorkspaceState, now = new Date()) { ensureToday(s.habit, now); s.habit.mode = 'winddown'; }
export function completeReview(s: WorkspaceState, now = new Date()) {
  const rec = todayRecord(s.habit, now);
  rec.reviewed = true;
  if (s.habit.streak === 0) s.habit.streak = 1;
  s.habit.mode = 'work';
  return rec;
}
export function recentHistory(h: Habit, n = 5) { return h.history.slice(-n); }

export function tutorialPayoff(elapsedMs: number) {
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  const fast = elapsedMs < 60_000;
  // "in 15s" read as a countdown next to the 25:00 timer. Say the lesson is done.
  return { fast, seconds, message: fast ? "You're set up" : 'Lesson complete' };
}

export interface Rect { x: number; y: number; w: number; h: number }
export function rectsOverlap(a: Rect, b: Rect, gap = 0.012) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap;
}
/** First candidate that sits inside the board and misses every blocker. */
export function firstFreeSpot(boardW: number, boardH: number, size: { w: number; h: number }, blockers: Rect[], candidates: { x: number; y: number }[]) {
  for (const c of candidates) {
    const rect: Rect = { x: c.x, y: c.y, w: size.w, h: size.h };
    if (Math.abs(c.x) + size.w / 2 > boardW / 2 - 0.012) continue;
    if (Math.abs(c.y) + size.h / 2 > boardH / 2 - 0.012) continue;
    if (blockers.some(b => rectsOverlap(rect, b))) continue;
    return c;
  }
  return null;
}
/** Spots along the bottom of the board, then one row higher. Null when the note cannot sit clear of blockers. */
export function noteSpot(boardW: number, boardH: number, size: { w: number; h: number }, blockers: Rect[], indexHint = 0) {
  const xs = [-boardW * 0.3, 0, boardW * 0.3];
  const baseY = -boardH / 2 + size.h / 2 + 0.02;
  const candidates: { x: number; y: number }[] = [];
  for (let row = 0; row < 2; row++) for (const x of xs) candidates.push({ x, y: baseY + row * (size.h + 0.016) });
  const shift = ((indexHint % candidates.length) + candidates.length) % candidates.length;
  return firstFreeSpot(boardW, boardH, size, blockers, candidates.slice(shift).concat(candidates.slice(0, shift)));
}
/** Page a column so only `pageSize` cards are on the board. `hidden` is the "+N more" count. */
export function columnWindow(count: number, page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(Math.max(count, 0) / pageSize));
  const p = ((page % pages) + pages) % pages;
  const start = p * pageSize;
  const visible = Math.min(pageSize, Math.max(0, count - start));
  return { page: p, pages, start, visible, hidden: Math.max(0, count - visible) };
}
/** Palm normal (out of the palm) and how squarely it faces the viewer. Null when the joints are degenerate. */
export function palmAim(
  wrist: { x: number; y: number; z: number },
  indexMeta: { x: number; y: number; z: number },
  pinkyMeta: { x: number; y: number; z: number },
  viewer: { x: number; y: number; z: number },
) {
  const ix = indexMeta.x - wrist.x, iy = indexMeta.y - wrist.y, iz = indexMeta.z - wrist.z;
  const px = pinkyMeta.x - wrist.x, py = pinkyMeta.y - wrist.y, pz = pinkyMeta.z - wrist.z;
  // index × pinky points out of the back of the hand (+Y in the WebXR wrist frame). Flip it so the normal leaves the palm.
  let nx = iz * py - iy * pz, ny = ix * pz - iz * px, nz = iy * px - ix * py;
  const vx = viewer.x - wrist.x, vy = viewer.y - wrist.y, vz = viewer.z - wrist.z;
  const nlen = Math.hypot(nx, ny, nz), vlen = Math.hypot(vx, vy, vz);
  if (nlen < 1e-6 || vlen < 1e-6) return null;
  nx /= nlen; ny /= nlen; nz /= nlen;
  return { x: nx, y: ny, z: nz, dot: (nx * vx + ny * vy + nz * vz) / vlen };
}
/** True when the palm normal faces the viewer. index × pinky points out of the back of the hand; palmAim flips it. */
export function palmFacesViewer(
  wrist: { x: number; y: number; z: number },
  indexMeta: { x: number; y: number; z: number },
  pinkyMeta: { x: number; y: number; z: number },
  viewer: { x: number; y: number; z: number },
  minDot = 0.55,
) {
  const aim = palmAim(wrist, indexMeta, pinkyMeta, viewer);
  return !!aim && aim.dot > minDot;
}
export interface BoardSnap { cards: Card[]; notes: Note[]; focusId: string | null; habit: Habit }
export function captureBoard(s: WorkspaceState): BoardSnap {
  return JSON.parse(JSON.stringify({ cards: s.cards, notes: s.notes, focusId: s.focusId, habit: s.habit }));
}
export function restoreBoard(s: WorkspaceState, snap: BoardSnap) {
  s.cards = snap.cards; s.notes = snap.notes; s.focusId = snap.focusId; s.habit = snap.habit;
}
export function finishTutorial(s: WorkspaceState, elapsedMs: number, now = new Date()) {
  s.onboarded = true; s.tutorialStep = TUTORIAL_STEPS.length;
  if (s.habit.streak === 0) { ensureToday(s.habit, now); s.habit.streak = 1; }
  return tutorialPayoff(elapsedMs);
}

export type AgentKind = 'plan' | 'card' | 'note' | 'empty' | 'focus' | 'park' | 'done' | 'winddown' | 'reviewed' | 'status';
export interface AgentResult { kind: AgentKind; reply: string }

function spoken(q: string) { return q.replace(/[?.!]+$/g, '').replace(/^(the|a|my)\s+/i, '').trim(); }
function matchOpenCard(s: WorkspaceState, query: string): Card | undefined {
  const q = spoken(query).toLowerCase();
  if (!q) return undefined;
  const open = s.cards.filter(c => c.column !== 'done');
  const exact = open.find(c => c.title.toLowerCase() === q);
  if (exact) return exact;
  const hits = open.filter(c => {
    const title = c.title.toLowerCase();
    return title.includes(q) || q.includes(title);
  });
  hits.sort((a, b) => b.title.length - a.title.length);
  return hits[0];
}
function firstFreeStand(s: WorkspaceState) {
  for (let i = 0; i < DESK_SLOTS.length; i++) if (!s.cards.some(c => c.parked === i)) return i;
  return -1;
}

/**
 * On-device desk agent. It plans, parks, starts focus, finishes a named task,
 * and winds the day down without a network call. Unrecognised speech becomes a card.
 */
export function runAgent(s: WorkspaceState, transcript: string, now = new Date(), timerNow = Date.now()): AgentResult {
  const t = transcript.trim();
  if (!t) return { kind: 'empty', reply: '' };
  if (/plan\s+my\s+morning/i.test(t)) { planMorning(s, now); return { kind: 'plan', reply: 'Morning plan is on the board' }; }
  const note = t.match(/^note[:\s]+(.+)/i);
  if (note) { addNote(s, [-0.44, 0.16, 0.12], note[1]); return { kind: 'note', reply: 'Note added' }; }
  if (/\b(what'?s left|what is left|what'?s on my desk|what is on my desk|what'?s still out)\b/i.test(t)) {
    const waiting = parkedCards(s);
    const reply = waiting.length ? `On the desk: ${waiting.map(c => c.title).join(', ')}` : 'Nothing is on the desk';
    return { kind: 'status', reply };
  }
  if (/\b(mark(ed)? (the day|it) reviewed|i reviewed|day reviewed)\b/i.test(t)) {
    completeReview(s, now);
    return { kind: 'reviewed', reply: 'Day reviewed' };
  }
  if (/\b(wind[\s-]?down|review my day|start (the )?review)\b/i.test(t)) {
    startWindDown(s, now);
    return { kind: 'winddown', reply: 'Wind-down is open' };
  }
  if (/^(please\s+)?(start|begin)( my)? focus\b|^(please\s+)?start the timer\b/i.test(t)) {
    if (s.timer.mode !== 'focus') return { kind: 'focus', reply: 'Finish the break first' };
    if (!s.timer.running) {
      startTimer(s.timer, timerNow);
      s.focusId = singleParked(s)?.id ?? null;
    }
    const name = s.cards.find(c => c.id === s.focusId)?.title;
    return { kind: 'focus', reply: name ? `Focus: ${name}` : 'Focus started' };
  }
  const park = t.match(/^(?:please\s+)?park\s+(.+)$/i)
    || t.match(/^(?:please\s+)?(?:leave|put)\s+(.+?)\s+on\s+(?:the\s+|my\s+)?(?:desk|stand)s?$/i);
  if (park) {
    const card = matchOpenCard(s, park[1]);
    if (!card) return { kind: 'park', reply: 'I can’t see that task' };
    if (card.parked != null) return { kind: 'park', reply: `${card.title} is already on the desk` };
    const slot = firstFreeStand(s);
    if (slot < 0 || parkCard(s, card.id, slot) < 0) return { kind: 'park', reply: 'The stands are full' };
    return { kind: 'park', reply: `Left ${card.title} on the desk` };
  }
  const done = t.match(/^(?:please\s+)?(?:finish|complete)\s+(.+)$/i)
    || t.match(/^(?:please\s+)?mark\s+(.+?)\s+done$/i)
    || t.match(/^(?:please\s+)?move\s+(.+?)\s+to\s+done$/i);
  if (done) {
    const card = matchOpenCard(s, done[1]);
    if (!card) return { kind: 'done', reply: 'I can’t see that task' };
    moveCard(s, card.id, 'done', Infinity, now);
    if (s.focusId === card.id) s.focusId = null;
    return { kind: 'done', reply: `Finished ${card.title}` };
  }
  const card = addCustomCard(s, t);
  return { kind: 'card', reply: card.title };
}

/** On-device commands. "plan my morning" uses the template planner. Other speech becomes a card, or a note when it starts with "note". */
export function applyTranscript(s: WorkspaceState, transcript: string, now = new Date()): AgentKind {
  return runAgent(s, transcript, now).kind;
}

export function dwellStep(current: string | null, next: string | null, elapsed: number, dt: number, need: number) {
  if (!next) return { id: null as string | null, elapsed: 0, fire: false };
  const e = next === current ? elapsed + dt : dt;
  if (e >= need) return { id: next, elapsed: 0, fire: true };
  return { id: next, elapsed: e, fire: false };
}
export function surfaceKind(normalY: number): 'desk' | 'wall' { return normalY > 0.65 ? 'desk' : 'wall'; }

// ---- Persistence ----
export const STORAGE_KEY = 'handflow.v1';
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function save(s: WorkspaceState, kv: KV, now = Date.now()) {
  const copy: WorkspaceState = JSON.parse(JSON.stringify(s));
  const t = copy.timer;
  if (t.running) {
    t.remainingMs = timerRemaining(t, now);
    const anchor = t.endsAt ?? t.startedAt;
    // A performance.now() start saved against Date.now() used to clamp to 0.
    // Pause at the snapshot when the clocks disagree. A wall-clock endsAt keeps running.
    if (anchor == null || !sameClock(anchor, now)) {
      t.running = false; t.startedAt = null; t.endsAt = null;
    }
  }
  kv.setItem(STORAGE_KEY, JSON.stringify(copy));
}
function hydrate(s: WorkspaceState): WorkspaceState {
  s.a11y = { ...defaultA11y(), ...(s.a11y ?? {}) };
  s.habit = { ...defaultHabit(), ...(s.habit ?? {}) };
  s.habit.history ??= [];
  s.placement = s.placement ?? null;
  if (typeof s.mrPreferred !== 'boolean') s.mrPreferred = true;
  if (typeof s.tutorialStep !== 'number') s.tutorialStep = s.onboarded ? TUTORIAL_STEPS.length : 0;
  if (!s.a11y.dwellMs) s.a11y.dwellMs = 800;
  s.focusId = typeof s.focusId === 'string' ? s.focusId : null;
  s.timer.endsAt = typeof s.timer.endsAt === 'number' ? s.timer.endsAt : null;
  if (s.timer.running) {
    const anchor = s.timer.endsAt ?? s.timer.startedAt;
    if (anchor == null || !sameClock(anchor, Date.now())) {
      s.timer.running = false; s.timer.startedAt = null; s.timer.endsAt = null;
    } else {
      s.timer.remainingMs = timerRemaining(s.timer, Date.now());
      if (s.timer.remainingMs <= 0) advanceWorkspaceTimer(s, Date.now());
    }
  }
  const used = new Set<number>();
  for (const c of s.cards) {
    const slot = c.parked;
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= DESK_SLOTS.length || used.has(slot)) c.parked = null;
    else used.add(slot);
  }
  return s;
}
export function load(kv: KV): WorkspaceState {
  try {
    const raw = kv.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as WorkspaceState;
      if (s?.version === 1 && Array.isArray(s.cards) && Array.isArray(s.notes) && s.timer) return hydrate(s);
    }
  } catch { /* fallthrough */ }
  return createInitialState();
}
