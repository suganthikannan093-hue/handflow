// Pure, framework-free workspace state (unit-tested).
export type Column = 'todo' | 'doing' | 'done';
export const COLUMNS: Column[] = ['todo', 'doing', 'done'];
export interface Card { id: string; title: string; column: Column; order: number; color: number }
export interface Note {
  id: string; text: string; pos: [number, number, number]; pinned: boolean; color: number;
  rot?: [number, number, number, number];
}
export interface Timer { durationMs: number; remainingMs: number; running: boolean; startedAt: number | null; mode: 'focus' | 'break'; completed: number }
export interface A11y {
  highContrast: boolean; largeTargets: boolean; lookHold: boolean; dwellMs: number;
  ambient: boolean; showFps: boolean; aiPlanner: boolean;
}
export type DayMode = 'morning' | 'work' | 'winddown';
export interface DayRecord { date: string; planned: number; completed: number; focusSessions: number; reviewed: boolean }
export interface Habit { mode: DayMode; streak: number; lastDate: string | null; history: DayRecord[] }
export interface Placement { position: [number, number, number]; quaternion: [number, number, number, number]; anchorId: string | null }
export interface WorkspaceState {
  version: 1; cards: Card[]; notes: Note[]; timer: Timer; onboarded: boolean;
  tutorialStep: number; a11y: A11y; habit: Habit; placement: Placement | null; mrPreferred: boolean;
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
  { id: 'create', coach: 'Poke + to make a task' },
  { id: 'pin', coach: 'Drop the note on the board' },
  { id: 'timer', coach: 'Poke Start on the timer' },
] as const;

/** A note over a surface counts as near out to 28cm (a drag stays on a plane in front of the board). Beside the edge, 12cm still pins. */
export const PIN_FACE_REACH = 0.28;
export const PIN_EDGE_REACH = 0.12;
export const PIN_MARGIN = 0.06;

export function defaultA11y(): A11y {
  return { highContrast: false, largeTargets: false, lookHold: false, dwellMs: 800, ambient: false, showFps: true, aiPlanner: false };
}
export function defaultHabit(): Habit { return { mode: 'work', streak: 0, lastDate: null, history: [] }; }

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function createInitialState(): WorkspaceState {
  const s: WorkspaceState = {
    version: 1, cards: [], notes: [], onboarded: false, tutorialStep: 0,
    a11y: defaultA11y(), habit: defaultHabit(), placement: null, mrPreferred: true,
    timer: { durationMs: FOCUS_MS, remainingMs: FOCUS_MS, running: false, startedAt: null, mode: 'focus', completed: 0 },
  };
  addCard(s, 0, 'todo'); addCard(s, 1, 'todo'); addCard(s, 2, 'doing');
  return s;
}
export function cardsIn(s: WorkspaceState, c: Column) { return s.cards.filter(x => x.column === c).sort((a, b) => a.order - b.order); }
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
export function timerRemaining(t: Timer, now: number) { return t.running && t.startedAt != null ? Math.max(0, t.remainingMs - (now - t.startedAt)) : t.remainingMs; }
export function startTimer(t: Timer, now: number) { if (!t.running) { t.running = true; t.startedAt = now; } }
export function stopTimer(t: Timer, now: number) { if (t.running) { t.remainingMs = timerRemaining(t, now); t.running = false; t.startedAt = null; } }
export function toggleTimer(t: Timer, now: number) { t.running ? stopTimer(t, now) : startTimer(t, now); }
export function resetTimer(t: Timer) { t.running = false; t.startedAt = null; t.remainingMs = t.durationMs; }
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
/** 0 seed, 1 sprout, 2 leaves, 3 bush, 4 bud, 5 bloom. */
export function plantStage(completed: number) {
  if (completed <= 0) return 0;
  if (completed === 1) return 1;
  if (completed === 2) return 2;
  if (completed <= 4) return 3;
  if (completed <= 6) return 4;
  return 5;
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
  return { fast: elapsedMs < 60_000, seconds, message: `Ready in ${seconds}s` };
}
export function finishTutorial(s: WorkspaceState, elapsedMs: number, now = new Date()) {
  s.onboarded = true; s.tutorialStep = TUTORIAL_STEPS.length;
  if (s.habit.streak === 0) { ensureToday(s.habit, now); s.habit.streak = 1; }
  return tutorialPayoff(elapsedMs);
}

/** On-device commands. "plan my morning" uses the template planner. Other speech becomes a card, or a note when it starts with "note". */
export function applyTranscript(s: WorkspaceState, transcript: string, now = new Date()): 'plan' | 'card' | 'note' | 'empty' {
  const t = transcript.trim();
  if (!t) return 'empty';
  if (/plan\s+my\s+morning/i.test(t)) { planMorning(s, now); return 'plan'; }
  const note = t.match(/^note[:\s]+(.+)/i);
  if (note) { addNote(s, [-0.44, 0.16, 0.12], note[1]); return 'note'; }
  addCustomCard(s, t); return 'card';
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
  const copy: WorkspaceState = JSON.parse(JSON.stringify(s)); stopTimer(copy.timer, now); kv.setItem(STORAGE_KEY, JSON.stringify(copy));
}
function hydrate(s: WorkspaceState): WorkspaceState {
  s.a11y = { ...defaultA11y(), ...(s.a11y ?? {}) };
  s.habit = { ...defaultHabit(), ...(s.habit ?? {}) };
  s.habit.history ??= [];
  s.placement = s.placement ?? null;
  if (typeof s.mrPreferred !== 'boolean') s.mrPreferred = true;
  if (typeof s.tutorialStep !== 'number') s.tutorialStep = s.onboarded ? TUTORIAL_STEPS.length : 0;
  if (!s.a11y.dwellMs) s.a11y.dwellMs = 800;
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
