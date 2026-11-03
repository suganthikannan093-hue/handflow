// Pure, framework-free workspace state (unit-tested).
export type Column = 'todo' | 'doing' | 'done';
export const COLUMNS: Column[] = ['todo', 'doing', 'done'];
export interface Card { id: string; title: string; column: Column; order: number; color: number }
export interface Note { id: string; text: string; pos: [number, number, number]; pinned: boolean; color: number }
export interface Timer { durationMs: number; remainingMs: number; running: boolean; startedAt: number | null; mode: 'focus' | 'break'; completed: number }
export interface WorkspaceState { version: 1; cards: Card[]; notes: Note[]; timer: Timer; onboarded: boolean }

export const TEMPLATES = [
  { title: 'Reply to emails', color: 0x4f8cff }, { title: 'Write spec draft', color: 0x9b6bff },
  { title: 'Review pull request', color: 0x2fc59b }, { title: 'Plan sprint', color: 0xffb547 },
  { title: 'Call with team', color: 0xff6b8a }, { title: 'Deep work block', color: 0x38c6e8 },
];
export const NOTE_TEXTS = ['Idea: batch meetings', 'Remember: hydrate', 'Ship demo Friday', 'Ask about budget', 'Focus > busy'];
export const FOCUS_MS = 25 * 60_000, BREAK_MS = 5 * 60_000;

let seq = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function createInitialState(): WorkspaceState {
  const s: WorkspaceState = { version: 1, cards: [], notes: [], onboarded: false,
    timer: { durationMs: FOCUS_MS, remainingMs: FOCUS_MS, running: false, startedAt: null, mode: 'focus', completed: 0 } };
  addCard(s, 0, 'todo'); addCard(s, 1, 'todo'); addCard(s, 2, 'doing');
  return s;
}
export function cardsIn(s: WorkspaceState, c: Column) { return s.cards.filter(x => x.column === c).sort((a, b) => a.order - b.order); }
function renumber(s: WorkspaceState, c: Column) { cardsIn(s, c).forEach((x, i) => (x.order = i)); }
export function addCard(s: WorkspaceState, templateIdx: number, column: Column = 'todo'): Card {
  const t = TEMPLATES[((templateIdx % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length];
  const card: Card = { id: uid('card'), title: t.title, color: t.color, column, order: cardsIn(s, column).length };
  s.cards.push(card); return card;
}
export function moveCard(s: WorkspaceState, id: string, column: Column, index = Infinity) {
  const card = s.cards.find(c => c.id === id); if (!card) return false;
  const from = card.column;
  const others = cardsIn(s, column).filter(c => c.id !== id);
  const i = Math.max(0, Math.min(index, others.length));
  others.splice(i, 0, card); card.column = column;
  others.forEach((c, k) => (c.order = k)); if (from !== column) renumber(s, from);
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
export function addNote(s: WorkspaceState, pos: [number, number, number]): Note {
  const n: Note = { id: uid('note'), text: NOTE_TEXTS[s.notes.length % NOTE_TEXTS.length], pos, pinned: false, color: 0xffe27a };
  s.notes.push(n); return n;
}
export function setNote(s: WorkspaceState, id: string, pos: [number, number, number], pinned: boolean) {
  const n = s.notes.find(x => x.id === id); if (n) { n.pos = pos; n.pinned = pinned; } return !!n;
}
export function deleteNote(s: WorkspaceState, id: string) { const l = s.notes.length; s.notes = s.notes.filter(n => n.id !== id); return s.notes.length < l; }

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

// ---- Persistence ----
export const STORAGE_KEY = 'handflow.v1';
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
export function save(s: WorkspaceState, kv: KV, now = Date.now()) {
  const copy: WorkspaceState = JSON.parse(JSON.stringify(s)); stopTimer(copy.timer, now); kv.setItem(STORAGE_KEY, JSON.stringify(copy));
}
export function load(kv: KV): WorkspaceState {
  try { const raw = kv.getItem(STORAGE_KEY); if (raw) { const s = JSON.parse(raw); if (s?.version === 1 && Array.isArray(s.cards) && Array.isArray(s.notes) && s.timer) return s; } } catch { /* fallthrough */ }
  return createInitialState();
}
