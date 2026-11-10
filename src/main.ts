import * as THREE from 'three';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import * as S from './state';
import { BOARD_H, BOARD_W, BOARD_Z, CARD_H, CARD_SP, CARD_TOP, CARD_W, COL_W, COLUMN_PAGE, DESKTOP_CAM_Z, DOCK_Y, DOCK_Z, EYE, EYE_DROP, MORE_H, MORE_W, MORE_Y, PLANT_X, PLANT_Y, PLANT_Z, TIMER_H, TIMER_W, TIMER_Y, TIMER_Z } from './layout';
import { Panel, button, roundRect, text, hex, ellipsize, paintLines, measuredWidth } from './ui';
import { sfx, unlockAudio, setAmbient } from './audio';
import { Plant } from './plant';
import { recognition, VoiceCapture, transcribeAudio, voiceConfig } from './voice';
import { mountCompanion } from './companion';

const state = S.load(localStorage);
let saveT = 0;
let companion: ReturnType<typeof mountCompanion> | undefined;
const persist = () => { companion?.refresh(); clearTimeout(saveT); saveT = window.setTimeout(() => S.save(state, localStorage), 150); };
const undos: S.BoardSnap[] = [];
function remember() {
  undos.push(S.captureBoard(state));
  if (undos.length > 30) undos.shift();
}
function undoLast() {
  const snap = undos.pop();
  if (!snap) return;
  S.restoreBoard(state, snap);
  layoutCards(); syncNotes(); refreshPlant(); refreshMode(); timerPanel.redraw(); persist(); sfx.press();
}
let templateIdx = state.cards.length;
const theme = { contrast: false };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app')!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e1a);
scene.fog = new THREE.Fog(0x0b0e1a, 4, 14);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.01, 50);
function frameDesktop() {
  // Wide windows use DESKTOP_CAM_Z. A phone is narrower than the board, so step back until the board fits.
  const aspect = Math.max(innerWidth, 1) / Math.max(innerHeight, 1);
  const vTan = Math.tan((52 * Math.PI) / 360);
  const boardZ = -0.55 + BOARD_Z;
  const dist = Math.max(DESKTOP_CAM_Z - boardZ, (BOARD_W / 2 + 0.06) / (vTan * aspect));
  camera.position.set(0, 1.2, boardZ + dist);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
frameDesktop();
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a1030, 1.2));
const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 3, 2); scene.add(dl);
const grid = new THREE.GridHelper(20, 40, 0x2a3360, 0x161c38); scene.add(grid);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 600 }, () => (Math.random() - 0.5) * 30), 3)), new THREE.PointsMaterial({ color: 0x8899ff, size: 0.03 }));
scene.add(stars);

const ws = new THREE.Group(); scene.add(ws); ws.position.set(0, 1.2 - EYE_DROP, -0.55);

type Kind = 'card' | 'note' | 'button';
interface Item { obj: THREE.Object3D; kind: Kind; id?: string; name?: string; onPress?: () => void; panel: Panel; grabbable: boolean }
const items: Item[] = [];
const reg = (it: Item) => { items.push(it); it.obj.userData.item = it; it.obj.userData.baseScale = 1; return it; };

const COL_LABEL: Record<S.Column, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };
const COL_COLOR: Record<S.Column, number> = { todo: 0x4f8cff, doing: 0xffb547, done: 0x2fc59b };
const bg = (alpha = 0.9) => theme.contrast ? '#05070f' : `rgba(16,20,38,${alpha})`;
const board = new Panel(BOARD_W, BOARD_H, 800, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 36); g.fillStyle = bg(0.92); g.fill();
  g.strokeStyle = theme.contrast ? '#ffffff' : 'rgba(160,180,255,0.55)'; g.lineWidth = theme.contrast ? 8 : 4; g.stroke();
  const mode = state.habit.mode === 'morning' ? 'Morning' : state.habit.mode === 'winddown' ? 'Wind-down' : 'Today';
  const where = state.placement?.surface === 'desk' ? ' · on your desk' : state.placement?.surface === 'wall' ? ' · on your wall' : '';
  const waiting = S.parkedCards(state).length;
  const left = waiting ? ` · ${waiting} left out` : '';
  text(g, `${mode}  ·  streak ${state.habit.streak}${where}${left}`, W / 2, 18, 16, '#ffe1a8', 700, 'center');
  S.COLUMNS.forEach((c, i) => {
    const x = (0.015 + i * COL_W) / BOARD_W * W; const cw = COL_W / BOARD_W * W;
    roundRect(g, x + 8, 58, cw - 16, H - 74, 16); g.fillStyle = theme.contrast ? '#101426' : 'rgba(255,255,255,0.05)'; g.fill();
    g.fillStyle = hex(COL_COLOR[c]); g.fillRect(x + 16, 41, 12, 12);
    text(g, `${COL_LABEL[c]} · ${S.cardsIn(state, c).length}`, x + 36, 47, 18, '#f4f7ff', 700);
  });
});
board.position.set(0, 0, BOARD_Z); board.rotation.x = 0.1; ws.add(board);
const boardPlane = new THREE.Group(); board.add(boardPlane);
const colX = (c: S.Column) => (S.COLUMNS.indexOf(c) - 1) * COL_W;

function paintCard(card: S.Card, g: CanvasRenderingContext2D, W: number, H: number, hover: boolean) {
  roundRect(g, 4, 4, W - 8, H - 8, 18);
  g.fillStyle = hover ? (theme.contrast ? '#ffffff' : '#2c3358') : (theme.contrast ? '#000000' : '#20263f'); g.fill();
  g.lineWidth = hover || theme.contrast ? 8 : 3; g.strokeStyle = hover || theme.contrast ? '#ffffff' : 'rgba(255,255,255,0.2)'; g.stroke();
  g.fillStyle = hex(card.color); roundRect(g, 4, 4, 16, H - 8, 8); g.fill();
  const done = card.column === 'done';
  const title = (done ? '✓ ' : '') + card.title;
  const size = Math.max(22, Math.round(H * (card.nextStep ? 0.25 : 0.32))); 
  g.font = `650 ${size}px system-ui, sans-serif`;
  const maxW = W - 40;
  const words = title.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measuredWidth(g, next) > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] = ellipsize(g, shown[1], maxW);
  const color = done ? '#8fe8c8' : (theme.contrast && hover ? '#000' : '#fff');
  const block = shown.length * size * 1.15;
  let y = H / 2 - block / 2 + size * 0.55;
  for (const ln of shown) { text(g, ln, 26, y - (card.nextStep ? H * 0.1 : 0), size, color, 650); y += size * 1.15; }
  if (card.nextStep) text(g, '↳ ' + card.nextStep, 26, H * 0.84, Math.max(15, H * 0.16), '#b6f1cf', 650, 'left', W - 44);
}
const cardMeshes = new Map<string, Item>();
const colPage: Record<S.Column, number> = { todo: 0, doing: 0, done: 0 };
const moreBtns = new Map<S.Column, Item>();
function cardHeld(id: string) {
  for (const p of pointers.values()) if (p.grabbed?.id === id) return true;
  return false;
}
function showCard(card: S.Card) {
  if (card.parked != null) return;
  const i = S.cardsIn(state, card.column).findIndex(c => c.id === card.id);
  if (i >= 0) colPage[card.column] = Math.floor(i / COLUMN_PAGE);
}
function cardDrawSig(card: S.Card, hover: boolean) {
  return `${card.title}|${card.column}|${card.nextStep || ''}|${card.parked ?? ''}|${hover}|${theme.contrast}`;
}
function redrawCard(it: Item, card: S.Card) {
  const sig = cardDrawSig(card, it.panel.hover);
  if (it.obj.userData.drawSig === sig) return;
  it.obj.userData.drawSig = sig;
  it.panel.redraw();
}
function layoutCards(animate = true) {
  lastFocusSignature = '';
  const shown = new Set<string>();
  for (const col of S.COLUMNS) {
    const list = S.cardsIn(state, col);
    const win = S.columnWindow(list.length, colPage[col], COLUMN_PAGE);
    colPage[col] = win.page;
    list.slice(win.start, win.start + win.visible).forEach(c => shown.add(c.id));
    const more = moreBtns.get(col);
    if (more) {
      more.obj.visible = win.hidden > 0;
      more.obj.position.set(colX(col), MORE_Y, 0.008);
      const label = `+${win.hidden} more`;
      if (more.obj.userData.moreLabel !== label) {
        more.obj.userData.moreLabel = label;
        more.name = `button:more:${col}`;
        more.panel.draw = button(label, MORE_W, MORE_H, COL_COLOR[col]).draw;
        more.panel.redraw();
      }
    }
  }
  for (const card of state.cards) {
    let it = cardMeshes.get(card.id);
    if (!it) {
      const p = new Panel(CARD_W, CARD_H, 1200, (g, W, H, hover) => paintCard(card, g, W, H, hover));
      it = reg({ obj: p, kind: 'card', id: card.id, name: `card:${card.title}`, panel: p, grabbable: true });
      cardMeshes.set(card.id, it);
      (card.parked == null ? boardPlane : ws).add(p);
      p.position.set(colX(card.column), CARD_TOP, 0.004);
      p.scale.setScalar(animate ? 0.01 : 1);
    }
    it.name = `card:${card.title}`;
    if (card.parked != null) {
      const slot = S.DESK_SLOTS[card.parked];
      if (it.obj.parent !== ws) ws.attach(it.obj);
      delete it.obj.userData.target;
      it.obj.visible = true;
      it.obj.position.set(slot.x, slot.y, slot.z);
      it.obj.rotation.set(S.DESK_TILT, 0, 0);
      redrawCard(it, card);
      continue;
    }
    const held = cardHeld(card.id);
    if (!shown.has(card.id) && !held) {
      it.obj.visible = false;
      delete it.obj.userData.target;
      redrawCard(it, card);
      continue;
    }
    it.obj.visible = true;
    if (held) { delete it.obj.userData.target; redrawCard(it, card); continue; }
    if (it.obj.parent !== boardPlane) { boardPlane.attach(it.obj); it.obj.rotation.set(0, 0, 0); }
    const list = S.cardsIn(state, card.column);
    const win = S.columnWindow(list.length, colPage[card.column], COLUMN_PAGE);
    const i = list.findIndex(c => c.id === card.id) - win.start;
    it.obj.userData.target = new THREE.Vector3(colX(card.column), CARD_TOP - Math.max(0, i) * CARD_SP, 0.004);
    redrawCard(it, card);
  }
  for (const [id, it] of cardMeshes) if (!state.cards.find(c => c.id === id)) { it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); cardMeshes.delete(id); }
  board.redraw();
  syncStandLabel();
}

const noteMeshes = new Map<string, Item>();
function paintNote(n: S.Note, g: CanvasRenderingContext2D, W: number, H: number, hover: boolean) {
  g.fillStyle = hover ? '#fff1a8' : (theme.contrast ? '#ffe14a' : hex(n.color));
  g.fillRect(6, 6, W - 12, H - 12);
  g.strokeStyle = '#3a2f00'; g.lineWidth = theme.contrast ? 8 : 3; g.strokeRect(6, 6, W - 12, H - 12);
  if (n.pinned) { g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(W / 2, 26, 10, 0, Math.PI * 2); g.fill(); }
  const top = n.pinned ? S.NOTE_PIN_TOP : 24;
  const fitted = S.fitWrappedText(n.text, W - S.NOTE_PAD_X * 2, H - top - S.NOTE_PAD_BOTTOM, (sample, font) => { g.font = `700 ${font}px system-ui, sans-serif`; return measuredWidth(g, sample); }, 16, 32);
  g.save();
  g.beginPath(); g.rect(10, top - 6, W - 20, H - top - 8); g.clip();
  paintLines(g, fitted.lines, S.NOTE_PAD_X, top + fitted.font * 0.55, fitted.font, '#3a2f00', 700, 'left', fitted.font * 1.28);
  g.restore();
}
function syncNotes() {
  lastFocusSignature = '';
  for (const n of state.notes) {
    const size = S.noteSize(n.text);
    let it = noteMeshes.get(n.id);
    if (it && (Math.abs(it.panel.w - size.w) > 0.004 || Math.abs(it.panel.h - size.h) > 0.004)) {
      const keep = it.obj.position.clone(); const rot = it.obj.quaternion.clone();
      it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); noteMeshes.delete(n.id); it = undefined;
      const p = new Panel(size.w, size.h, 1200, (g, W, H, hover) => paintNote(n, g, W, H, hover));
      it = reg({ obj: p, kind: 'note', id: n.id, name: 'note:latest', panel: p, grabbable: true });
      noteMeshes.set(n.id, it); ws.add(p); p.position.copy(keep); p.quaternion.copy(rot);
    }
    if (!it) {
      const p = new Panel(size.w, size.h, 1200, (g, W, H, hover) => paintNote(n, g, W, H, hover));
      it = reg({ obj: p, kind: 'note', id: n.id, name: 'note:latest', panel: p, grabbable: true });
      noteMeshes.set(n.id, it); ws.add(p); p.position.fromArray(n.pos);
      if (n.rot) p.quaternion.fromArray(n.rot);
    }
    it.name = 'note:latest';
    it.panel.redraw();
  }
  for (const [id, it] of noteMeshes) if (!state.notes.find(n => n.id === id)) { it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); noteMeshes.delete(id); }
  const latest = state.notes.at(-1)?.id;
  for (const [id, it] of noteMeshes) it.name = id === latest ? 'note:latest' : `note:${id}`;
}

const timerPanel = new Panel(TIMER_W, TIMER_H, 1200, (g, W, H) => {
  const t = state.timer, rem = S.timerRemaining(t, Date.now()), frac = t.durationMs ? rem / t.durationMs : 0;
  roundRect(g, 0, 0, W, H, 28); g.fillStyle = bg(); g.fill();
  g.strokeStyle = t.running ? '#ff6b8a' : (theme.contrast ? '#fff' : 'rgba(160,180,255,0.55)'); g.lineWidth = theme.contrast ? 8 : 5; g.stroke();
  const focus = state.timer.mode === 'focus' ? (state.cards.find(c => c.id === state.focusId) ?? S.singleParked(state)) : null;
  g.font = `800 ${focus ? 22 : 26}px system-ui, sans-serif`;
  const focusLabel = focus ? ellipsize(g, focus.title, W - 120) : (t.mode === 'focus' ? 'FOCUS' : 'BREAK');
  text(g, focusLabel, 24, 32, focus ? 22 : 26, t.mode === 'focus' ? '#ff9db0' : '#8fe8c8', 800);
  text(g, t.mode === 'focus' && t.durationMs !== S.FOCUS_MS ? `${Math.round(t.durationMs / 60000)}m focus` : `${t.completed} done`, W - 20, 32, 20, '#fff', 700, 'right');
  text(g, S.formatMs(rem), W / 2, H * 0.44, 64, '#fff', 800, 'center');
  g.fillStyle = theme.contrast ? '#333' : 'rgba(255,255,255,.15)'; roundRect(g, 18, H * 0.68, W - 36, 10, 5); g.fill();
  g.fillStyle = t.mode === 'focus' ? '#ff6b8a' : '#2fc59b'; roundRect(g, 18, H * 0.68, Math.max(10, (W - 36) * frac), 10, 5); g.fill();
});
timerPanel.position.set(0, TIMER_Y, TIMER_Z); timerPanel.rotation.x = 0.08; ws.add(timerPanel);

const mkBtn = (label: string, w: number, color: number, parent: THREE.Object3D, pos: [number, number, number], onPress: () => void, icon = '', name?: string, h = 0.04) => {
  const b = button(label, w, h, color, icon); b.position.set(...pos); parent.add(b);
  return reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress, name });
};
function popPlant() { plant.scale.setScalar(1.55); plant.userData.pop = 1.35; }
function armFocusIfStarting(wasRunning: boolean) {
  if (!wasRunning && state.timer.running && state.timer.mode === 'focus') {
    state.focusId = S.singleParked(state)?.id ?? null;
    popPlant();
  }
}
const TIMER_BTN_W = 0.11;
const DUR_W = 0.07;
const startBtn = mkBtn('Start', TIMER_BTN_W, 0x2fc59b, timerPanel, [-0.125, -0.066, 0.004], () => {
  const was = state.timer.running; S.toggleTimer(state.timer, Date.now()); armFocusIfStarting(was); refreshTimerBtn(); timerPanel.redraw(); persist();
  if (!was && state.timer.running) advanceTutorial('timer');
}, '>', 'button:start');
mkBtn('Reset', TIMER_BTN_W, 0x9b6bff, timerPanel, [0, -0.066, 0.004], () => { S.resetTimer(state.timer); state.focusId = null; refreshTimerBtn(); timerPanel.redraw(); persist(); }, '', 'button:reset');
mkBtn('Skip', TIMER_BTN_W, 0x38c6e8, timerPanel, [0.125, -0.066, 0.004], () => {
  state.timer.mode = state.timer.mode === 'focus' ? 'break' : 'focus';
  state.timer.durationMs = state.timer.mode === 'focus' ? S.FOCUS_MS : S.BREAK_MS;
  S.resetTimer(state.timer); state.focusId = null; refreshTimerBtn(); timerPanel.redraw(); persist();
}, '', 'button:skip');
function setFocusLength(minutes: number) {
  if (state.timer.running) return;
  state.timer.mode = 'focus';
  state.timer.durationMs = minutes * 60_000;
  S.resetTimer(state.timer);
  state.focusId = null;
  refreshTimerBtn();
  timerPanel.redraw();
  persist();
}
const durationBtns = S.FOCUS_LENGTHS_MIN.map((minutes, i) =>
  mkBtn(`${minutes}m`, DUR_W, 0x4f8cff, timerPanel, [(i - 1) * 0.08, -0.018, 0.004], () => setFocusLength(minutes), '', `button:duration:${minutes}`, 0.026)
);
function refreshTimerBtn() {
  const r = state.timer.running;
  startBtn.panel.draw = button(r ? 'Pause' : 'Start', TIMER_BTN_W, 0.046, r ? 0xffb547 : 0x2fc59b, r ? '||' : '>').draw;
  startBtn.panel.redraw();
  const idleFocus = !r && state.timer.mode === 'focus';
  const current = Math.round(state.timer.durationMs / 60_000);
  durationBtns.forEach((btn, i) => {
    const minutes = S.FOCUS_LENGTHS_MIN[i];
    btn.obj.visible = idleFocus;
    if (idleFocus) {
      const on = minutes === current;
      btn.panel.draw = button(`${minutes}m`, DUR_W, 0.026, on ? 0x2fc59b : 0x4f8cff).draw;
      btn.panel.redraw();
    }
  });
}
refreshTimerBtn();

const dock = new THREE.Group(); dock.position.set(0, DOCK_Y, DOCK_Z); dock.rotation.x = 0.12; ws.add(dock);
let listenHint = '';
const preview = new Panel(0.3, 0.032, 1000, (g, W, H) => {
  const label = listenHint || ('Next: ' + S.TEMPLATES[templateIdx % S.TEMPLATES.length].title);
  text(g, label, W / 2, H / 2, H * 0.42, '#d5dcff', 650, 'center', W - 16);
});
preview.position.set(0, 0.042, 0); dock.add(preview);
const plus = new Panel(0.062, 0.062, 900, (g, W, H, hover) => {
  g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = hover ? '#4f8cff' : 'rgba(79,140,255,.3)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = theme.contrast ? 10 : 6; g.stroke();
  text(g, '+', W / 2, H / 2 + 2, W * 0.55, '#fff', 800, 'center');
});
const rowX = [-0.195, -0.117, -0.039, 0.039, 0.117, 0.195];
plus.position.set(rowX[0], 0, 0); dock.add(plus);
reg({ obj: plus, kind: 'button', name: 'button:plus', panel: plus, grabbable: false, onPress: () => {
  remember();
  const c = S.addCard(state, templateIdx++, 'todo'); showCard(c); preview.redraw(); layoutCards(); persist(); sfx.drop(); flash(cardMeshes.get(c.id)!.obj); advanceTutorial('create');
} });
mkBtn('Next', 0.068, 0x4f8cff, dock, [rowX[1], 0, 0], () => { templateIdx++; preview.redraw(); }, '', 'button:next');
mkBtn('Note', 0.068, 0xffe27a, dock, [rowX[2], 0, 0], () => {
  remember();
  const n = S.addNote(state, [-(BOARD_W / 2 + 0.12), 0, 0.18]); syncNotes(); persist(); flash(noteMeshes.get(n.id)!.obj);
}, '+', 'button:note');
mkBtn('Mic', 0.068, 0xff6b8a, dock, [rowX[3], 0, 0], () => { void toggleMic(); }, '', 'button:mic');
mkBtn('Plan', 0.068, 0xffb547, dock, [rowX[4], 0, 0], () => {
  remember();
  const created = S.planMorning(state);
  if (created[0]) showCard(created[created.length - 1]);
  layoutCards(); refreshMode(); persist(); sfx.drop();
}, '', 'button:morning');
mkBtn('Review', 0.068, 0x9b6bff, dock, [rowX[5], 0, 0], () => { S.startWindDown(state); refreshMode(); persist(); }, '', 'button:review');
const trashP = new Panel(0.16, 0.04, 900, (g, W, H, hover) => {
  roundRect(g, 4, 4, W - 8, H - 8, 20); g.setLineDash([12, 8]); g.lineWidth = 4;
  g.strokeStyle = hover ? '#ff4d6d' : 'rgba(255,77,109,.7)'; g.stroke();
  text(g, 'Drop to delete', W / 2, H / 2, H * 0.4, '#ffd0da', 650, 'center');
});
trashP.position.set(-0.06, -0.062, 0); dock.add(trashP);
mkBtn('Undo', 0.08, 0x8fb4ff, dock, [0.12, -0.062, 0], () => { undoLast(); }, '', 'button:undo');
mkBtn('Menu', 0.068, 0xdfe6ff, dock, [0.205, -0.062, 0], () => toggleFallbackMenu(), '', 'button:menu');
for (const col of S.COLUMNS) {
  const item = mkBtn('+ more', MORE_W, COL_COLOR[col], boardPlane, [colX(col), MORE_Y, 0.008], () => {
    const win = S.columnWindow(S.cardsIn(state, col).length, colPage[col] + 1, COLUMN_PAGE);
    colPage[col] = win.page; layoutCards(); sfx.press();
  }, '', `button:more:${col}`);
  item.obj.visible = false;
  moreBtns.set(col, item);
}

const plant = new Plant(); plant.position.set(PLANT_X, PLANT_Y, PLANT_Z); plant.scale.setScalar(1.35); ws.add(plant);
function focusGrow() {
  return S.liveFocusProgress(state.timer, Date.now());
}
function refreshPlant() {
  const rec = state.habit.history.find(r => r.date === S.todayKey());
  plant.setGrowth(S.gardenStage(rec), focusGrow());
}

// Focus has a spatial consequence: the backlog fades while the desk stays within reach.
const focusCue = new Panel(0.56, 0.04, 1400, (g, W, H) => {
  const task = state.cards.find(c => c.id === state.focusId) ?? S.singleParked(state);
  const running = state.timer.running && state.timer.mode === 'focus';
  const cue = task?.nextStep ? `Next: ${task.nextStep}` : running ? 'One thing. Right here. Let the rest wait.' : task ? 'Ready when you are · Start focus' : 'Leave one task on your desk';
  roundRect(g, 0, 0, W, H, 18); g.fillStyle = '#102a29'; g.fill();
  g.font = `650 ${H * 0.36}px system-ui`;
  text(g, ellipsize(g, cue, W - 32), W / 2, H / 2, H * 0.36, '#b6f1cf', 650, 'center');
});
const TOAST_Y = TIMER_Y - TIMER_H / 2 - 0.032;
const TOAST_Z = TIMER_Z + 0.03;
focusCue.position.set(0, TOAST_Y, TOAST_Z); ws.add(focusCue); focusCue.visible = false;
focusCue.scale.set(TIMER_W / 0.56, 1, 1);
let lastFocusSignature = '';
function updateQuietFocus() {
  const teaching = S.needsOnboarding(state);
  const quiet = !teaching && state.onboarded && state.timer.running && state.timer.mode === 'focus' && state.cards.some(c => c.id === state.focusId && c.column !== 'done');
  const signature = `${quiet}:${teaching}:${state.onboarded}:${state.habit.mode}:${voicePanel.visible}:${state.focusId}:${state.cards.find(c => c.id === state.focusId)?.nextStep || ''}`;
  if (signature === lastFocusSignature) return;
  lastFocusSignature = signature;
  focusCue.visible = !teaching && state.onboarded && state.habit.mode === 'work' && !voicePanel.visible && !payoffText;
  board.material.opacity = quiet ? 0.22 : 1;
  for (const it of cardMeshes.values()) it.panel.material.opacity = quiet && it.obj.parent === boardPlane ? 0.22 : 1;
  for (const it of noteMeshes.values()) it.panel.material.opacity = quiet ? 0.28 : 1;
  focusCue.redraw(); timerPanel.redraw();
}

let payoffText = '';
let tutorialT0 = 0;
const coachY = 0.125;
const tut = new Panel(0.42, 0.07, 1400, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 24); g.fillStyle = theme.contrast ? '#000' : 'rgba(79,140,255,0.22)'; g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  const stepLabel = step ? `${state.tutorialStep + 1}/${S.TUTORIAL_STEPS.length}  ${step.coach}` : '';
  if (payoffText) text(g, payoffText, W / 2, H / 2, 22, '#fff', 700, 'center', W - 48);
  else {
    text(g, S.TUTORIAL_INTRO, W / 2, H * 0.32, 15, '#ffe1a8', 700, 'center', W - 110);
    text(g, stepLabel, W / 2, H * 0.68, 18, '#fff', 700, 'center', W - 110);
  }
});
tut.position.set(0, TOAST_Y, TOAST_Z); ws.add(tut);
function syncTutorialChrome() {
  const teaching = S.needsOnboarding(state) && !payoffText;
  tut.visible = S.needsOnboarding(state) || !!payoffText;
  skipTut.obj.visible = teaching;
  lastFocusSignature = '';
  updateQuietFocus();
}
function advanceTutorial(id: (typeof S.TUTORIAL_STEPS)[number]['id']) {
  if (!S.needsOnboarding(state) || payoffText) return;
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  if (!step || step.id !== id) return;
  if (!tutorialT0) tutorialT0 = performance.now();
  state.tutorialStep += 1;
  if (state.tutorialStep >= S.TUTORIAL_STEPS.length) {
    const payoff = S.finishTutorial(state, performance.now() - tutorialT0);
    payoffText = `${payoff.message}. Your streak has started.`;
    sfx.done(); refreshPlant(); board.redraw();
    window.setTimeout(() => { if (!payoffText) return; payoffText = ''; syncTutorialChrome(); tut.redraw(); }, 4000);
  }
  syncStandLabel();
  syncTutorialChrome();
  tut.redraw(); persist();
}
function dismissTutorial() {
  S.skipTutorial(state);
  payoffText = '';
  syncTutorialChrome();
  tut.redraw();
  syncStandLabel();
  persist();
}
function restartTutorial() {
  S.replayTutorial(state); payoffText = ''; tutorialT0 = 0; syncTutorialChrome(); tut.redraw(); syncStandLabel(); persist();
}
const skipTut = mkBtn('Skip', 0.06, 0x38c6e8, tut, [0.17, -0.02, 0.004], () => dismissTutorial(), '', 'button:skip-tutorial', 0.026);
tut.visible = S.needsOnboarding(state);
skipTut.obj.visible = S.needsOnboarding(state);

const modePanel = new Panel(0.4, 0.12, 1100, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 24); g.fillStyle = bg(0.94); g.fill(); g.strokeStyle = '#ffe1a8'; g.lineWidth = 4; g.stroke();
  if (state.habit.mode === 'morning') {
    text(g, 'Morning plan', 20, 28, 22, '#ffe1a8', 800);
    S.MORNING_PLAN.forEach((t, i) => text(g, `${i + 1}. ${t.title}`, 20, 58 + i * 24, 18, '#fff', 600));
  } else {
    text(g, `Wind-down  ·  streak ${state.habit.streak}`, 20, 26, 20, '#ffe1a8', 800);
    const lines = S.recentHistory(state.habit, 4).map(r => `${r.date.slice(5)} done ${r.completed}${r.reviewed ? ' reviewed' : ''}`);
    g.font = '600 16px system-ui, sans-serif';
    const left = S.parkedCards(state).map(c => c.title);
    const line = left.length ? ellipsize(g, `Still out: ${left.join(', ')}`, W - 36) : (lines.join('  ·  ') || 'Nothing saved yet');
    text(g, line, 20, 62, 16, '#fff', 600, 'left', W - 36);
  }
});
modePanel.position.set(0, coachY, TIMER_Z); modePanel.visible = false; ws.add(modePanel);
const modeFocus = mkBtn('Focus', 0.07, 0x2fc59b, modePanel, [0.12, -0.04, 0.004], () => { const was = state.timer.running; S.startTimer(state.timer, Date.now()); armFocusIfStarting(was); refreshTimerBtn(); timerPanel.redraw(); persist(); }, '>');
const modeDone = mkBtn('Reviewed', 0.09, 0xffb547, modePanel, [0.12, -0.04, 0.004], () => { S.completeReview(state); refreshMode(); refreshPlant(); persist(); sfx.done(); }, '', 'button:reviewed');
function refreshMode() {
  const show = state.onboarded && state.habit.mode !== 'work';
  modePanel.visible = show;
  syncTutorialChrome();
  modeFocus.obj.visible = state.habit.mode === 'morning';
  modeDone.obj.visible = state.habit.mode === 'winddown';
  modePanel.redraw(); board.redraw();
}

const settings = new THREE.Group(); settings.position.set(0, -0.02, 0.08); settings.visible = false; ws.add(settings);
const settingsBg = new Panel(0.36, 0.2, 900, (g, W, H) => { roundRect(g, 0, 0, W, H, 24); g.fillStyle = bg(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); text(g, 'Accessibility', W / 2, 28, 22, '#fff', 800, 'center'); });
settings.add(settingsBg);
function toggleSetting(key: keyof S.A11y, label: string) {
  if (key === 'dwellMs') return;
  (state.a11y[key] as boolean) = !(state.a11y[key] as boolean);
  applyA11y(); persist(); sfx.press();
  listenHint = ''; preview.redraw();
  void label;
}
const settingButtons: { key: keyof S.A11y; item: Item; label: string }[] = [];
function addSetting(label: string, key: keyof S.A11y, x: number, y: number, name?: string) {
  const item = mkBtn(label, 0.15, 0x4f8cff, settings, [x, y, 0.004], () => toggleSetting(key, label), '', name);
  settingButtons.push({ key, item, label });
}
addSetting('Contrast', 'highContrast', -0.08, 0.02, 'button:contrast');
addSetting('Large', 'largeTargets', 0.08, 0.02, 'button:large');
addSetting('Look hold', 'lookHold', -0.08, -0.03, 'button:hold');
addSetting('Ambient', 'ambient', 0.08, -0.03, 'button:ambient');
addSetting('FPS', 'showFps', 0, -0.07, 'button:fps');
function refreshSettings() {
  for (const s of settingButtons) {
    const on = !!state.a11y[s.key];
    s.item.panel.draw = button(`${s.label} ${on ? 'on' : 'off'}`, 0.15, 0.04, on ? 0x2fc59b : 0x4f8cff).draw;
    s.item.panel.redraw();
  }
}

let fpsFrames = 0, fpsAccum = 0, fpsValue = 0, fpsShown = -1;
const fpsPanel = new Panel(0.12, 0.035, 900, (g, W, H) => {
  g.fillStyle = theme.contrast ? '#000' : 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
  text(g, `${fpsValue} fps`, W / 2, H / 2, H * 0.55, '#d5ffe8', 700, 'center');
});
fpsPanel.position.set(0, DOCK_Y - 0.13, DOCK_Z); ws.add(fpsPanel);

const handMenu = new THREE.Group(); scene.add(handMenu); handMenu.visible = false;
const hmBtn = (l: string, x: number, y: number, c: number, f: () => void, name?: string) => {
  const b = button(l, 0.055, 0.024, c); b.position.set(x, y, 0); handMenu.add(b);
  return reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress: f, name });
};
hmBtn('Recenter', -0.032, 0.038, 0x4f8cff, () => recenter());
const mrItem = hmBtn('MR', 0.032, 0.038, 0x38c6e8, () => { void toggleMode(); }, 'button:mr');
hmBtn('Help', -0.032, 0.012, 0x9b6bff, () => restartTutorial());
hmBtn('Place', 0.032, 0.012, 0xffb547, () => { placing = true; followAnchor = false; });
hmBtn('Timer', -0.032, -0.014, 0xff6b8a, () => startBtn.onPress!());
hmBtn('Sound', 0.032, -0.014, 0x2fc59b, () => { state.a11y.ambient = !state.a11y.ambient; applyA11y(); persist(); });
hmBtn('Access', -0.032, -0.04, 0xdfe6ff, () => { settings.visible = !settings.visible; refreshSettings(); });
hmBtn('Exit', 0.032, -0.04, 0xff4d6d, () => renderer.xr.getSession()?.end());
handMenu.scale.setScalar(0.82);

const deskMat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.006, 28), new THREE.MeshStandardMaterial({ color: 0x243049, roughness: 0.9 }));
deskMat.position.y = -0.22; deskMat.visible = false; ws.add(deskMat);
const slotRings = S.DESK_SLOTS.map(slot => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.set(slot.x, slot.y - 0.02, slot.z);
  ring.rotation.x = S.DESK_TILT;
  ws.add(ring);
  return ring;
});
function paintSlots(hover: number) {
  const teach = S.needsOnboarding(state) && !payoffText && S.TUTORIAL_STEPS[state.tutorialStep]?.id === 'park';
  slotRings.forEach((ring, i) => {
    const mat = ring.material as THREE.MeshBasicMaterial;
    const taken = state.cards.some(c => c.parked === i);
    const guide = teach && i === 1;
    const hot = hover === i || guide;
    mat.color.setHex(hot ? 0xffe27a : taken ? 0x2fc59b : 0x8fb4ff);
    mat.opacity = hot ? 0.95 : 0.5;
    ring.scale.setScalar(guide ? 1 + Math.sin(performance.now() / 180) * 0.12 : 1);
  });
}
const standLabel = new Panel(0.16, 0.028, 512, (g, W, H) => {
  text(g, 'On the desk', W / 2, H / 2, H * 0.55, '#d5ffe8', 700, 'center');
});
standLabel.position.set(0, -0.205, 0.15);
standLabel.rotation.x = S.DESK_TILT;
ws.add(standLabel);
function syncStandLabel() {
  standLabel.visible = false;
}
let dragWord = '';
const dragHint = new Panel(0.1, 0.026, 256, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 12);
  g.fillStyle = dragWord === 'Delete' ? 'rgba(80,16,32,0.92)' : dragWord === 'Stand' ? 'rgba(70,58,16,0.92)' : 'rgba(16,20,38,0.92)';
  g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  text(g, dragWord, W / 2, H / 2, H * 0.52, '#fff', 700, 'center');
});
dragHint.visible = false; ws.add(dragHint);
function updateDragHint() {
  let word = '';
  let card: THREE.Object3D | null = null;
  for (const p of pointers.values()) {
    if (p.grabbed?.kind !== 'card') continue;
    card = p.grabbed.obj;
    const x = card.position.x, y = card.position.y, z = card.position.z;
    const onTrash = overTrash(card);
    const slot = S.nearestDeskSlot(x, y, z);
    const onBoard = overBoard(card) != null;
    word = onTrash ? 'Delete' : slot >= 0 ? 'Stand' : onBoard ? 'Column' : 'Hold';
    break;
  }
  if (!card) { dragHint.visible = false; return; }
  dragHint.position.set(card.position.x, card.position.y + 0.05, card.position.z);
  dragHint.rotation.set(S.DESK_TILT, 0, 0);
  dragHint.visible = true;
  if (word !== dragWord) { dragWord = word; dragHint.redraw(); }
}
function syncPlaceChrome() {
  const desk = state.placement?.surface === 'desk';
  deskMat.visible = desk;
  // Keep controls above the detected tabletop. Trash/undo flank the main row.
  dock.position.y = desk ? -0.127 : DOCK_Y;
  trashP.position.set(desk ? -0.37 : -0.06, desk ? 0 : -0.062, 0);
  items.find(it => it.name === 'button:undo')?.obj.position.set(desk ? 0.33 : 0.12, desk ? 0 : -0.062, 0);
  items.find(it => it.name === 'button:menu')?.obj.position.set(desk ? 0.45 : 0.205, desk ? 0 : -0.062, 0);
  board.redraw();
}
const gazeDot = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0065, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
gazeDot.visible = false; gazeDot.renderOrder = 20; scene.add(gazeDot);
const gazeDir = new THREE.Vector3();
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0x4f8cff, side: THREE.DoubleSide }));
reticle.visible = false; scene.add(reticle);
const glow = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.053, 32), new THREE.MeshBasicMaterial({ color: 0xffe27a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
glow.visible = false; scene.add(glow);
const dwellRing = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
dwellRing.visible = false; scene.add(dwellRing);

function flash(o: THREE.Object3D) { o.scale.setScalar(0.01); o.userData.pop = o.userData.baseScale ?? 1; }
function rememberPose(surface?: 'desk' | 'wall') {
  state.placement = {
    position: [ws.position.x, ws.position.y, ws.position.z],
    quaternion: [ws.quaternion.x, ws.quaternion.y, ws.quaternion.z, ws.quaternion.w],
    anchorId: null,
    surface,
  };
  syncPlaceChrome();
  wantAnchor = renderer.xr.isPresenting; persist();
}
function recenter() {
  followAnchor = false; liveAnchor = null;
  const head = new THREE.Vector3(); camera.getWorldPosition(head);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
  ws.position.copy(head).addScaledVector(dir, EYE); ws.position.y = head.y - EYE_DROP;
  ws.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
  // Board front (+Z) faces the user, who is behind the workspace along -dir.
  const toUser = head.clone().sub(ws.position); toUser.y = 0; toUser.normalize();
  if (toUser.lengthSq() > 0) ws.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toUser);
  rememberPose(); sfx.press();
}
function placeWorkspace(point: THREE.Vector3, normal: THREE.Vector3) {
  followAnchor = false; liveAnchor = null;
  const kind = S.surfaceKind(normal.y);
  const face = new THREE.Vector3();
  if (kind === 'desk') {
    camera.getWorldPosition(face); face.sub(point); face.y = 0;
    if (face.lengthSq() < 1e-6) { camera.getWorldDirection(face); face.y = 0; face.multiplyScalar(-1); }
  } else face.copy(normal); face.y = 0;
  if (face.lengthSq() < 1e-6) face.set(0, 0, 1);
  face.normalize();
  ws.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
  ws.position.copy(point);
  if (kind === 'desk') ws.position.y += 0.22; else ws.position.addScaledVector(normal, 0.03);
  placing = false; reticle.visible = false; rememberPose(kind); sfx.drop();
  if (kind === 'desk' && state.onboarded && !S.needsOnboarding(state) && state.habit.mode === 'work') {
    payoffText = 'The stands are on your desk.';
    syncTutorialChrome(); tut.redraw();
    window.setTimeout(() => {
      if (payoffText !== 'The stands are on your desk.') return;
      payoffText = ''; syncTutorialChrome(); tut.redraw();
    }, 3500);
  }
}

function applyA11y() {
  theme.contrast = state.a11y.highContrast;
  const scale = state.a11y.largeTargets ? 1.16 : 1;
  dock.scale.setScalar(scale); timerPanel.scale.setScalar(scale);
  setAmbient(state.a11y.ambient);
  fpsPanel.visible = state.a11y.showFps;
  applyEnvironment(renderer.xr.isPresenting && currentMode === 'ar' ? 'ar' : 'desktop');
  refreshSettings(); redrawAll();
}
function redrawAll() {
  board.redraw(); timerPanel.redraw(); preview.redraw(); tut.redraw(); modePanel.redraw(); fpsPanel.redraw(); trashP.redraw(); settingsBg.redraw();
  standLabel.redraw(); if (dragHint.visible) dragHint.redraw();
  for (const it of items) { delete it.obj.userData.drawSig; it.panel.redraw(); }
}

let rec: ReturnType<typeof recognition> | null = null;
const capture = new VoiceCapture();
let micBusy = false;
let pendingVoice = '';
let discardRecording = false;
let voiceMessage = '';
let cloudEndpoint = '';
void voiceConfig().then(c => { cloudEndpoint = c.endpoint; });
function voiceStatus(message: string) {
  voiceMessage = message; listenHint = message; preview.redraw();
  companion?.voice(message, !!pendingVoice);
}
const voicePanel = new Panel(0.58, 0.16, 1400, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 24); g.fillStyle = '#12253a'; g.fill();
  g.strokeStyle = '#a8e6c4'; g.lineWidth = 4; g.stroke();
  text(g, pendingVoice ? 'Heard you · review before applying' : 'Voice capture', 26, 28, 24, '#a8e6c4', 800);
  const fitted = S.fitWrappedText(pendingVoice || voiceMessage, W - 52, H * 0.46, (sample, font) => { g.font = `600 ${font}px system-ui`; return measuredWidth(g, sample); }, 20, 30);
  paintLines(g, fitted.lines, 26, 62, fitted.font, '#fff', 600, 'left', fitted.font * 1.2);
});
voicePanel.position.set(0, coachY + 0.015, TIMER_Z + 0.015); voicePanel.visible = false; ws.add(voicePanel);
const acceptVoice = mkBtn('Use words', 0.13, 0x2fc59b, voicePanel, [-0.15, -0.055, 0.008], () => usePendingVoice(), '', 'button:voice-accept');
mkBtn('Cancel', 0.12, 0x9b6bff, voicePanel, [0, -0.055, 0.008], () => { discardRecording = true; capture.stop(); rec?.stop(); pendingVoice = ''; voicePanel.visible = false; voiceStatus('Voice cancelled'); refreshMode(); }, '', 'button:voice-cancel');
mkBtn('Mic / Stop', 0.13, 0xff6b8a, voicePanel, [0.15, -0.055, 0.008], () => { void toggleMic(); }, '', 'button:voice-stop');
function showVoicePanel() { voicePanel.visible = true; tut.visible = false; skipTut.obj.visible = false; modePanel.visible = false; acceptVoice.obj.visible = !!pendingVoice; voicePanel.redraw(); }
function gotTranscript(text: string) {
  if (discardRecording) return;
  pendingVoice = text.trim();
  voiceStatus(pendingVoice ? `Heard: ${pendingVoice}` : 'No words heard. Try again or type your thought.');
  showVoicePanel();
}
function usePendingVoice() {
  if (!pendingVoice) return;
  const words = pendingVoice; pendingVoice = ''; voicePanel.visible = false;
  applySaid(words); companion?.voice('Added to your workspace.'); refreshMode();
}
async function toggleMic() {
  unlockAudio();
  if (capture.active) { capture.stop(); voiceStatus('Transcribing with OpenAI…'); showVoicePanel(); return; }
  if (rec && listenHint.startsWith('Listening')) { rec.stop(); return; }
  if (micBusy) return;
  micBusy = true; pendingVoice = ''; discardRecording = false;
  try {
    if (cloudEndpoint) {
      voiceStatus('Opening microphone…'); showVoicePanel();
      await capture.start(async audio => {
        if (discardRecording) { micBusy = false; return; }
        voiceStatus('Transcribing with OpenAI…'); showVoicePanel();
        try { gotTranscript(await transcribeAudio(audio, cloudEndpoint)); }
        catch (error) { voiceStatus(error instanceof Error ? error.message : 'Voice failed. Use Capture & desk to type.'); showVoicePanel(); }
        finally { micBusy = false; }
      }, error => { micBusy = false; voiceStatus(error.message); showVoicePanel(); });
      if (discardRecording) { capture.stop(); return; }
      voiceStatus('Listening · OpenAI · tap Mic to stop'); showVoicePanel();
      // Busy prevents a second permission request; active recording can still be stopped.
      return;
    }
    rec = recognition();
    if (!rec) throw new Error('Voice unavailable here. Open Capture & desk to type.');
    voiceStatus('Listening · browser speech · tap Mic to stop'); showVoicePanel();
    rec.onresult = ev => gotTranscript(ev.results[0]?.[0]?.transcript ?? '');
    rec.onerror = ev => { voiceStatus(ev.error === 'not-allowed' ? 'Microphone permission denied. Open Capture & desk to type.' : 'Could not hear you. Try again or type.'); showVoicePanel(); };
    rec.onend = () => { micBusy = false; if (listenHint.startsWith('Listening')) { voiceStatus('No words heard. Try again or type.'); showVoicePanel(); } };
    rec.start();
  } catch (error) {
    micBusy = false;
    voiceStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone permission denied. Open Capture & desk to type.' : error instanceof Error ? error.message : 'Microphone unavailable. Type your thought.');
    showVoicePanel();
  }
}

// ---------- input ----------
interface Pointer { key: string; pinchPos: THREE.Vector3; tip: THREE.Vector3 | null; pinching: boolean; wasPinching: boolean; ray: THREE.Ray | null; grabbed: Item | null; hovered: Item | null; offset: THREE.Vector3; pokeLatch: Item | null }
const pointers = new Map<string, Pointer>();
let dragPlane: THREE.Plane | null = null;
const ptr = (key: string): Pointer => {
  let p = pointers.get(key);
  if (!p) { p = { key, pinchPos: new THREE.Vector3(), tip: null, pinching: false, wasPinching: false, ray: null, grabbed: null, hovered: null, offset: new THREE.Vector3(), pokeLatch: null }; pointers.set(key, p); }
  return p;
};
const handFactory = new XRHandModelFactory();
for (let i = 0; i < 2; i++) {
  const h = renderer.xr.getHand(i); h.add(handFactory.createHandModel(h, 'mesh')); scene.add(h);
  const ctrl = renderer.xr.getController(i); scene.add(ctrl);
  ctrl.addEventListener('selectstart', () => (ctrl.userData.sel = true));
  ctrl.addEventListener('selectend', () => (ctrl.userData.sel = false));
  ctrl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x8fb0ff })));
  ctrl.addEventListener('connected', (e: { data?: unknown }) => (ctrl.userData.src = e.data));
  ctrl.addEventListener('disconnected', () => (ctrl.userData.src = null));
}
const cursors = new Map<string, THREE.Mesh>();
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); const mouseDownNDC = new THREE.Vector2();
let mouseHold = false, mouseLatch = false, mouseIn = false, mouseTravel = 0;
const touchPoints = new Map<number, number>();
let lookAnchor: number | null = null;
function trackLook(e: PointerEvent) {
  if (e.pointerType === 'mouse') return;
  touchPoints.set(e.pointerId, e.clientX);
  if (renderer.xr.isPresenting || touchPoints.size < 2) { lookAnchor = null; return; }
  const mid = [...touchPoints.values()].reduce((sum, x) => sum + x, 0) / touchPoints.size;
  // Positive camera yaw looks left, so a rightward two-finger drag looks right.
  if (lookAnchor != null) camera.rotation.y -= (mid - lookAnchor) * 0.005;
  lookAnchor = mid;
}
function setMouse(e: PointerEvent) {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  mouseIn = true;
}
addEventListener('pointermove', e => {
  trackLook(e);
  if (touchPoints.size >= 2) return;
  setMouse(e);
  if (mouseHold) mouseTravel = Math.max(mouseTravel, mouse.distanceTo(mouseDownNDC));
});
renderer.domElement.addEventListener('pointerdown', e => {
  trackLook(e);
  unlockAudio(); setMouse(e); mouseHold = true; mouseLatch = true; mouseTravel = 0; mouseDownNDC.copy(mouse);
});
addEventListener('pointerup', e => {
  touchPoints.delete(e.pointerId);
  if (touchPoints.size < 2) lookAnchor = null;
  if (touchPoints.size >= 2) return;
  if (!mouseHold) return;
  setMouse(e);
  mouseTravel = Math.max(mouseTravel, mouse.distanceTo(mouseDownNDC));
  mouseHold = false; mouseLatch = true;
});
addEventListener('pointercancel', e => { touchPoints.delete(e.pointerId); if (touchPoints.size < 2) lookAnchor = null; });
const keys = new Set<string>();
addEventListener('keydown', e => {
  if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return;
  keys.add(e.key.toLowerCase());
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoLast(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const v = new THREE.Vector3(), q = new THREE.Quaternion(), ja = new THREE.Vector3(), jb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const deskPoint = new THREE.Vector3(), deskNormal = new THREE.Vector3(), deskPlane = new THREE.Plane();
const scratchA = new THREE.Vector3(), scratchB = new THREE.Vector3();
const menuHead = new THREE.Vector3(), menuDir = new THREE.Vector3(), menuN = new THREE.Vector3(), menuTo = new THREE.Vector3();
const ctrlDir = new THREE.Vector3(), ctrlRayL = new THREE.Ray(), ctrlRayR = new THREE.Ray();
const glowNudge = new THREE.Vector3();
const mouseN = new THREE.Vector3(), mousePlane = new THREE.Plane(), zFace = new THREE.Vector3(0, 0, 1);
const aimPos = new THREE.Vector3(), aimN = new THREE.Vector3();
const STAND_FACE = S.deskFaceNormal();
const hitPoint = new THREE.Vector3(), hitNormal = new THREE.Vector3();
let hitValid = false;
function boxHit(it: Item, p: THREE.Vector3, slack = state.a11y.largeTargets ? 0.03 : 0.015, depth = 0.03) {
  if (!it.obj.visible || !isVisible(it.obj)) return Infinity;
  const l = it.obj.worldToLocal(v.copy(p));
  const hw = it.panel.w / 2 * it.obj.scale.x + slack, hh = it.panel.h / 2 * it.obj.scale.y + slack;
  return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh && Math.abs(l.z) <= depth ? Math.abs(l.z) : Infinity;
}
const isVisible = (o: THREE.Object3D | null): boolean => !o || (o.visible && isVisible(o.parent));
const pickObjs: THREE.Object3D[] = [];
function fillPick(pred: (it: Item) => boolean) {
  pickObjs.length = 0;
  for (const it of items) if (pred(it)) pickObjs.push(it.obj);
  return pickObjs;
}
function pickAt(p: Pointer): Item | null {
  if (p.ray) {
    raycaster.ray.copy(p.ray);
    const hits = raycaster.intersectObjects(fillPick(i => isVisible(i.obj) && i !== p.grabbed), false);
    return hits.length ? hits[0].object.userData.item as Item : null;
  }
  let best: Item | null = null, bd = Infinity;
  for (const it of items) { if (it === p.grabbed) continue; const d = boxHit(it, p.pinchPos, state.a11y.largeTargets ? 0.035 : 0.02, 0.05); if (d < bd) { bd = d; best = it; } }
  return best;
}
function updatePointers(frame?: XRFrame) {
  const seen = new Set<string>(); const session = renderer.xr.getSession();
  let sawPalm = false;
  if (session && frame) {
    mouseLatch = false;
    if (menuHold) { poseHeldMenu(); sawPalm = true; }
    const ref = renderer.xr.getReferenceSpace();
    if (ref) for (const src of session.inputSources) {
      if (src.hand) {
        const get = frame.getJointPose?.bind(frame);
        const thumb = src.hand.get('thumb-tip'), index = src.hand.get('index-finger-tip');
        if (!get || !thumb || !index) continue;
        const th = get(thumb, ref), ix = get(index, ref); if (!th || !ix) continue;
        const p = ptr('hand-' + src.handedness); seen.add(p.key);
        ja.set(th.transform.position.x, th.transform.position.y, th.transform.position.z);
        jb.set(ix.transform.position.x, ix.transform.position.y, ix.transform.position.z);
        const d = ja.distanceTo(jb);
        p.pinchPos.copy(ja).add(jb).multiplyScalar(0.5);
        p.tip = (p.tip ?? new THREE.Vector3()).copy(jb); p.ray = null;
        p.pinching = S.pinchHeld(d, p.pinching);
        if (updateHandMenu(frame, src.hand, ref)) sawPalm = true;
      } else if (src.gripSpace || src.targetRaySpace) {
        const i = [...session.inputSources].indexOf(src); const ctrl = renderer.xr.getController(i);
        const p = ptr('ctrl-' + src.handedness); seen.add(p.key);
        ctrl.getWorldPosition(p.pinchPos); ctrl.getWorldQuaternion(q);
        const ray = src.handedness === 'left' ? ctrlRayL : ctrlRayR;
        ctrlDir.set(0, 0, -1).applyQuaternion(q);
        p.ray = ray.set(p.pinchPos, ctrlDir);
        p.tip = null; p.pinching = !!ctrl.userData.sel;
      }
    }
  } else if (mouseIn && touchPoints.size < 2) {
    const p = ptr('mouse'); seen.add(p.key); raycaster.setFromCamera(mouse, camera); p.ray = raycaster.ray; p.tip = null; p.pinching = mouseHold || mouseLatch;
    const hit = p.grabbed ? null : pickAt(p);
    if (p.grabbed?.kind === 'card' && mouse.y < -0.08) {
      ws.updateWorldMatrix(true, false);
      deskPoint.set(0, S.DESK_SLOTS[1].y, S.DESK_SLOTS[1].z);
      ws.localToWorld(deskPoint);
      deskNormal.set(STAND_FACE.x, STAND_FACE.y, STAND_FACE.z);
      deskNormal.transformDirection(ws.matrixWorld);
      p.ray.intersectPlane(deskPlane.setFromNormalAndCoplanarPoint(deskNormal, deskPoint), p.pinchPos);
    } else if (p.grabbed && dragPlane) p.ray.intersectPlane(dragPlane, p.pinchPos);
    else {
      const target = hit?.obj;
      if (target) {
        mouseN.copy(zFace).applyQuaternion(target.getWorldQuaternion(q));
        mousePlane.setFromNormalAndCoplanarPoint(mouseN, target.getWorldPosition(v));
        p.ray.intersectPlane(mousePlane, p.pinchPos);
      } else p.ray.at(0.6, p.pinchPos);
    }
  }
  if (session && frame && !menuHold && !sawPalm) { handMenu.visible = false; palmOpen = false; palmDot = -2; }
  else if (!session && menuHold) poseHeldMenu();
  for (const [k, p] of pointers) if (!seen.has(k)) { if (p.grabbed) release(p); pointers.delete(k); cursors.get(k)?.removeFromParent(); cursors.delete(k); }
  for (const p of pointers.values()) {
    const h = p.grabbed ? p.grabbed : pickAt(p);
    if (h !== p.hovered) { p.hovered?.panel.redraw(false); h?.panel.redraw(true); if (h && h !== p.grabbed) sfx.hover(); p.hovered = h; }
    if (p.tip) {
      let poked: Item | null = null;
      for (const it of items) if (it.kind === 'button' && boxHit(it, p.tip, state.a11y.largeTargets ? 0.014 : 0.008, 0.02) < Infinity) poked = it;
      if (poked && p.pokeLatch !== poked) { p.pokeLatch = poked; press(poked); } else if (!poked) p.pokeLatch = null;
    }
    const quickClick = p.key === 'mouse' && mouseLatch && !mouseHold && mouseTravel < 0.04;
    if (p.pinching && !p.wasPinching) {
      unlockAudio();
      if (h?.grabbable && !quickClick) { grab(p, h); if (h.kind === 'card') advanceTutorial('pinch'); }
      else if (h?.kind === 'button') press(h);
      else if (placing && hitValid && !quickClick) placeWorkspace(hitPoint, hitNormal);
    }
    if (!p.pinching && p.wasPinching && p.grabbed) release(p);
    if (p.grabbed) {
      const o = p.grabbed.obj;
      o.position.copy(o.parent!.worldToLocal(v.copy(p.pinchPos).add(p.offset)));
      trashP.redraw(overTrash(o));
    }
    if (p.key === 'mouse' && mouseLatch && !mouseHold && p.grabbed) release(p);
    if (p.key === 'mouse' && mouseLatch) { mouseLatch = false; if (!mouseHold) p.pinching = false; }
    p.wasPinching = p.pinching;
    let c = cursors.get(p.key);
    if (!c) { c = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(c); cursors.set(p.key, c); }
    c.position.copy(p.pinchPos); (c.material as THREE.MeshBasicMaterial).color.set(p.pinching ? 0xff6b8a : 0xffffff); c.visible = !!p.ray || !!h;
  }
  let hoverSlot = -1;
  for (const p of pointers.values()) {
    if (p.grabbed?.kind !== 'card') continue;
    const o = p.grabbed.obj;
    hoverSlot = S.nearestDeskSlot(o.position.x, o.position.y, o.position.z);
  }
  paintSlots(hoverSlot);
  updateDragHint();
}
function press(it: Item) { sfx.press(); it.obj.userData.pop = it.obj.userData.baseScale ?? 1; it.obj.scale.setScalar((it.obj.userData.baseScale ?? 1) * 0.9); it.onPress?.(); }
function grab(p: Pointer, it: Item) {
  p.grabbed = it; sfx.grab();
  const wp = it.obj.getWorldPosition(new THREE.Vector3()); const wq = it.obj.getWorldQuaternion(new THREE.Quaternion());
  ws.attach(it.obj);
  it.obj.quaternion.copy(ws.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
  it.obj.position.copy(ws.worldToLocal(wp.clone())); it.obj.position.z += 0.02; it.obj.scale.setScalar(1.06);
  if (p.key === 'mouse') {
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion()));
    dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, it.obj.getWorldPosition(new THREE.Vector3()));
    p.ray!.intersectPlane(dragPlane, p.pinchPos);
  }
  p.offset.copy(it.obj.getWorldPosition(new THREE.Vector3())).sub(p.pinchPos);
}
function overBoard(o: THREE.Object3D) {
  board.worldToLocal(o.getWorldPosition(scratchA));
  return Math.abs(scratchA.x) < BOARD_W / 2 + 0.04 && Math.abs(scratchA.y) < BOARD_H / 2 + 0.04 && Math.abs(scratchA.z) < 0.2 ? scratchA : null;
}
function overTrash(o: THREE.Object3D) {
  trashP.worldToLocal(o.getWorldPosition(scratchB));
  return Math.abs(scratchB.x) < 0.1 && Math.abs(scratchB.y) < 0.05 && Math.abs(scratchB.z) < 0.12;
}
function noteShelf(index: number) {
  const row = index % 2;
  const layer = Math.floor(index / 2);
  return { x: BOARD_W / 2 + 0.1, y: 0.05 - row * 0.14, z: 0.02 + layer * 0.025 };
}
function pinnedBlockers(exceptId: string) {
  const blockers: S.Rect[] = [];
  for (const card of state.cards) {
    if (card.parked != null) continue;
    const it = cardMeshes.get(card.id);
    if (!it?.obj.visible || it.obj.parent !== boardPlane) continue;
    blockers.push({ x: it.obj.position.x, y: it.obj.position.y, w: CARD_W, h: CARD_H });
  }
  for (const n of state.notes) {
    if (!n.pinned || n.id === exceptId) continue;
    const size = S.noteSize(n.text);
    const local = board.worldToLocal(ws.localToWorld(scratchA.set(n.pos[0], n.pos[1], n.pos[2])));
    blockers.push({ x: local.x, y: local.y, w: size.w, h: size.h });
  }
  return blockers;
}
function release(p: Pointer) {
  const it = p.grabbed!; p.grabbed = null; it.obj.scale.setScalar(it.obj.userData.baseScale ?? 1); trashP.redraw(false);
  remember();
  if (overTrash(it.obj)) {
    it.kind === 'card' ? S.deleteCard(state, it.id!) : S.deleteNote(state, it.id!);
    sfx.grab(); layoutCards(); syncNotes(); refreshPlant(); persist(); return;
  }
  if (it.kind === 'card') {
    const card = state.cards.find(c => c.id === it.id)!;
    const x = it.obj.position.x, y = it.obj.position.y, z = it.obj.position.z;
    const slot = S.nearestDeskSlot(x, y, z);
    const l = overBoard(it.obj);
    // A stand sits inside the board's front volume, so a hand on a stand parks before the column test.
    if (slot >= 0 && S.parkCard(state, card.id, slot) >= 0) { sfx.pin(); advanceTutorial('park'); syncStandLabel(); }
    else if (l) {
      boardPlane.attach(it.obj); it.obj.rotation.set(0, 0, 0);
      const col = S.columnForX(l.x, COL_W);
      const local = S.indexForY(l.y, CARD_TOP, CARD_SP, COLUMN_PAGE);
      const idx = colPage[col] * COLUMN_PAGE + local;
      const wasDone = card.column === 'done';
      S.moveCard(state, card.id, col, idx);
      showCard(card);
      if (col === 'done' && !wasDone) { sfx.done(); refreshPlant(); } else sfx.drop();
      if (col === 'doing' || col === 'done') advanceTutorial('drop');
    } else sfx.drop();
    layoutCards(); refreshMode(); timerPanel.redraw(); persist();
  } else if (it.kind === 'note') {
    let pinned = false; let rot: [number, number, number, number] | undefined;
    for (const surf of [board, timerPanel]) {
      surf.updateWorldMatrix(true, false); it.obj.updateWorldMatrix(true, false);
      const l = surf.worldToLocal(it.obj.getWorldPosition(new THREE.Vector3()));
      const panel = surf as Panel;
      if (S.pinToSurface(l.x, l.y, l.z, panel.w / 2, panel.h / 2)) {
        let x = THREE.MathUtils.clamp(l.x, -panel.w / 2 + 0.02, panel.w / 2 - 0.02);
        let y = THREE.MathUtils.clamp(l.y, -panel.h / 2 + 0.02, panel.h / 2 - 0.02);
        let z = 0.012;
        if (surf === board) {
          const size = S.noteSize(state.notes.find(n => n.id === it.id)?.text ?? '');
          const pinnedCount = state.notes.filter(n => n.pinned && n.id !== it.id).length;
          const free = S.pinNotePosition(BOARD_W, BOARD_H, size, pinnedBlockers(it.id!), { x, y }, pinnedCount);
          if (free) { x = free.x; y = free.y; z = 0.012; }
          else { const spot = noteShelf(pinnedCount); x = spot.x; y = spot.y; z = spot.z; }
        }
        const wp = surf.localToWorld(new THREE.Vector3(x, y, z));
        it.obj.position.copy(ws.worldToLocal(wp));
        const localQ = ws.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(surf.getWorldQuaternion(new THREE.Quaternion()));
        it.obj.quaternion.copy(localQ);
        rot = [localQ.x, localQ.y, localQ.z, localQ.w];
        pinned = true; break;
      }
    }
    S.setNote(state, it.id!, [it.obj.position.x, it.obj.position.y, it.obj.position.z], pinned, rot);
    syncNotes(); persist();
    if (pinned) { sfx.pin(); advanceTutorial('pin'); } else sfx.grab();
  }
}
let menuHold = false;
let palmDot = -2;
let palmOpen = false;
const menuRight = new THREE.Vector3();
function poseHeldMenu() {
  camera.getWorldPosition(menuHead);
  camera.getWorldDirection(menuDir);
  menuRight.crossVectors(menuDir, up);
  if (menuRight.lengthSq() < 1e-6) menuRight.set(1, 0, 0); else menuRight.normalize();
  handMenu.visible = true;
  // Keep the board readable: sit the compact menu down and to the left of centre, not over the workspace.
  handMenu.position.copy(menuHead).addScaledVector(menuDir, 0.38).addScaledVector(menuRight, -0.18).addScaledVector(up, -0.1);
  handMenu.lookAt(menuHead);
}
function toggleFallbackMenu() {
  menuHold = !menuHold;
  if (menuHold) poseHeldMenu();
  else { handMenu.visible = false; palmOpen = false; }
  sfx.press();
}
function updateHandMenu(frame: XRFrame, hand: XRHand, ref: XRReferenceSpace) {
  if (menuHold) { poseHeldMenu(); return true; }
  const get = frame.getJointPose?.bind(frame);
  const wrist = hand.get('wrist'), index = hand.get('index-finger-metacarpal'), pinky = hand.get('pinky-finger-metacarpal');
  if (!get || !wrist || !index || !pinky) return false;
  const w = get(wrist, ref), i = get(index, ref), k = get(pinky, ref);
  if (!w || !i || !k) return false;
  const wristP = w.transform.position, indexP = i.transform.position, pinkyP = k.transform.position;
  camera.getWorldPosition(menuHead);
  const aim = S.palmAim(
    { x: wristP.x, y: wristP.y, z: wristP.z },
    { x: indexP.x, y: indexP.y, z: indexP.z },
    { x: pinkyP.x, y: pinkyP.y, z: pinkyP.z },
    { x: menuHead.x, y: menuHead.y, z: menuHead.z },
  );
  if (aim) palmDot = Math.max(palmDot, aim.dot);
  if (!S.palmMenuShouldShow(aim, palmOpen)) return false;
  palmOpen = true;
  handMenu.visible = true;
  if (aim) {
    menuN.set(aim.x, aim.y, aim.z);
    menuHead.set(wristP.x, wristP.y, wristP.z);
    handMenu.position.copy(menuHead).addScaledVector(menuN, 0.08);
    handMenu.position.y += 0.04;
    camera.getWorldPosition(menuDir);
    handMenu.lookAt(menuDir);
  }
  return true;
}

let dwellId: string | null = null, dwellElapsed = 0;
function updateDwell(dt: number) {
  if (!state.a11y.lookHold) { dwellRing.visible = false; dwellId = null; dwellElapsed = 0; return; }
  raycaster.ray.origin.copy(camera.getWorldPosition(ja));
  raycaster.ray.direction.copy(camera.getWorldDirection(jb));
  const hits = raycaster.intersectObjects(fillPick(i => i.kind === 'button' && isVisible(i.obj)), false);
  const item = hits[0]?.object.userData.item as Item | undefined;
  const step = S.dwellStep(dwellId, item ? (item.name || item.obj.uuid) : null, dwellElapsed, dt * 1000, state.a11y.dwellMs);
  dwellId = step.id; dwellElapsed = step.elapsed;
  if (item && hits[0]) {
    dwellRing.visible = true; dwellRing.position.copy(hits[0].point); dwellRing.quaternion.copy(item.obj.getWorldQuaternion(q));
    const base = item.obj.userData.baseScale ?? 1;
    dwellRing.scale.setScalar(base * (0.35 + 0.65 * Math.min(1, dwellElapsed / state.a11y.dwellMs)));
    if (step.fire) press(item);
  } else dwellRing.visible = false;
}
function updateGlow() {
  if (!S.needsOnboarding(state) || payoffText) { glow.visible = false; return; }
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  let obj: THREE.Object3D | null = null;
  if (step?.id === 'pinch' || step?.id === 'drop') obj = cardMeshes.get(state.cards.find(c => c.title === 'Reply to emails')?.id ?? '')?.obj ?? board;
  else if (step?.id === 'park') obj = cardMeshes.get(S.cardsIn(state, 'todo')[0]?.id ?? '')?.obj ?? slotRings[1];
  else if (step?.id === 'create') obj = plus;
  else if (step?.id === 'pin') obj = noteMeshes.get(state.notes.at(-1)?.id ?? '')?.obj ?? board;
  else if (step?.id === 'timer') obj = startBtn.obj;
  if (!obj) { glow.visible = false; return; }
  glow.visible = true;
  obj.getWorldPosition(glow.position);
  obj.getWorldQuaternion(glow.quaternion);
  glow.position.add(glowNudge.set(0, 0, 0.01).applyQuaternion(glow.quaternion));
  glow.scale.setScalar(1 + Math.sin(performance.now() / 180) * 0.08);
}

// ---------- XR session, hit-testing, anchors ----------
let currentMode: 'ar' | 'vr' | null = null;
let pendingMode: 'ar' | 'vr' | null = null;
let placing = false;
let hitSource: XRHitTestSource | null = null;
let liveAnchor: XRAnchor | null = null;
let followAnchor = false;
let wantAnchor = false;
let anchorJob = false;
let anchorError = '';

function applyEnvironment(mode: 'ar' | 'vr' | 'desktop') {
  const ar = mode === 'ar';
  scene.background = ar ? null : new THREE.Color(theme.contrast ? 0x000000 : 0x0b0e1a);
  scene.fog = ar ? null : new THREE.Fog(theme.contrast ? 0x000000 : 0x0b0e1a, 4, 14);
  grid.visible = !ar; stars.visible = !ar; ring.visible = !ar;
  renderer.setClearColor(0x000000, ar ? 0 : 1);
  renderer.setClearAlpha(ar ? 0 : 1);
}
function parkDesktop() {
  camera.rotation.set(0, 0, 0);
  ws.position.set(0, 1.2 - EYE_DROP, -0.55); ws.quaternion.identity();
  frameDesktop();
}
async function setupHitTest(session: XRSession) {
  hitSource = null;
  if (!session.requestHitTestSource) return;
  try {
    const viewer = await session.requestReferenceSpace('viewer');
    const source = await session.requestHitTestSource({ space: viewer, entityTypes: ['plane', 'point'] });
    hitSource = source ?? null;
  } catch { hitSource = null; }
}
async function tryRestoreAnchor(session: XRSession) {
  const id = state.placement?.anchorId;
  if (!id || !session.restorePersistentAnchor) return false;
  try { liveAnchor = await session.restorePersistentAnchor(id); followAnchor = true; placing = false; return true; }
  catch { return false; }
}
async function beginSession(prefer: 'ar' | 'vr') {
  if (!navigator.xr) return;
  let session: XRSession | null = null;
  let mode: 'ar' | 'vr' = 'vr';
  if (prefer === 'ar') {
    try {
      if (await navigator.xr.isSessionSupported('immersive-ar')) {
        session = await navigator.xr.requestSession('immersive-ar', {
          // local-floor is optional so a missing feature does not fall back to VR (and a starfield).
          // depth-sensing is omitted on purpose. The emulator implements it by
          // calling readPixels on a depth target every frame, which stalls the GPU.
          optionalFeatures: ['local-floor', 'hand-tracking', 'hit-test', 'plane-detection', 'anchors', 'dom-overlay', 'light-estimation'],
        });
        mode = 'ar';
      }
    } catch { session = null; }
  }
  if (!session) {
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking', 'hit-test', 'anchors'] });
    mode = 'vr';
  }
  currentMode = mode;
  applyEnvironment(mode);
  renderer.setPixelRatio(1);
  renderer.xr.setFramebufferScaleFactor(1);
  (renderer.xr as THREE.WebXRManager & { setFoveation?: (n: number) => void }).setFoveation?.(1);
  await renderer.xr.setSession(session);
  applyEnvironment(mode);
  if (prefer === 'ar' && mode !== 'ar') {
    status.textContent = 'Mixed reality was unavailable, so this session opened in VR. On a Quest or with ?emulate, Enter MR should show passthrough instead of the starfield.';
  }
  try { await (session as XRSession & { updateTargetFrameRate?: (n: number) => Promise<void> }).updateTargetFrameRate?.(72); } catch { /* device picks the rate */ }
  document.body.classList.add('in-xr');
  mrItem.panel.draw = button(mode === 'ar' ? 'VR' : 'MR', 0.055, 0.024, 0x38c6e8).draw; mrItem.panel.redraw();
  await setupHitTest(session);
  const restored = await tryRestoreAnchor(session);
  if (restored) followAnchor = true;
  // Always put the workspace in front of the viewer on the first XR frame.
  // A saved placement from an older session is often off-screen in the emulator.
  pendingRecenter = true;
  if (mode === 'ar') placing = !restored;
  session.addEventListener('end', onSessionEnd);
}
let pendingRecenter = false;
function applyPlacement(p: S.Placement) {
  ws.position.fromArray(p.position); ws.quaternion.fromArray(p.quaternion);
  syncPlaceChrome();
}
function onSessionEnd() {
  document.body.classList.remove('in-xr');
  hitSource = null; liveAnchor = null; followAnchor = false; placing = false; reticle.visible = false; handMenu.visible = false;
  pendingRecenter = false;
  currentMode = null; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  parkDesktop(); applyEnvironment('desktop');
  const next = pendingMode; pendingMode = null;
  if (next) void beginSession(next);
}
async function toggleMode() {
  const next = currentMode === 'ar' ? 'vr' : 'ar';
  state.mrPreferred = next === 'ar'; persist();
  pendingMode = next;
  const session = renderer.xr.getSession();
  if (session) await session.end(); else await beginSession(next);
}
function updatePlacement(frame?: XRFrame) {
  if (!placing || !frame) { if (!placing) reticle.visible = false; return; }
  const ref = renderer.xr.getReferenceSpace(); if (!ref) return;
  // The ray you are looking along wins. A nearer plane must not steal a desk hit.
  let pose: XRPose | undefined;
  if (hitSource) { const hits = frame.getHitTestResults(hitSource); if (hits.length) pose = hits[0].getPose(ref); }
  if (!pose && frame.detectedPlanes && frame.detectedPlanes.size) {
    const cam = camera.getWorldPosition(ja); let best: XRPose | undefined; let bestD = 1.6;
    for (const plane of frame.detectedPlanes) {
      const p = frame.getPose(plane.planeSpace, ref); if (!p) continue;
      const d = jb.set(p.transform.position.x, p.transform.position.y, p.transform.position.z).distanceTo(cam);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) pose = best;
  }
  if (!pose) { reticle.visible = false; hitValid = false; return; }
  hitValid = true;
  hitPoint.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
  q.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
  hitNormal.copy(up).applyQuaternion(q);
  reticle.visible = true; reticle.position.copy(hitPoint);
  reticle.quaternion.setFromUnitVectors(zFace, hitNormal);
}
function updateAnchor(frame?: XRFrame) {
  const ref = renderer.xr.getReferenceSpace(); if (!frame || !ref) return;
  if (followAnchor && liveAnchor) {
    const pose = frame.getPose(liveAnchor.anchorSpace, ref);
    if (pose) {
      ws.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      ws.quaternion.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
    }
  }
  if (!wantAnchor || anchorJob || !frame.createAnchor || !state.placement) return;
  wantAnchor = false; anchorJob = true;
  const here = state.placement;
  frame.createAnchor(new XRRigidTransform({ x: here.position[0], y: here.position[1], z: here.position[2] }, { x: here.quaternion[0], y: here.quaternion[1], z: here.quaternion[2], w: here.quaternion[3] }), ref)
    .then(async anchor => {
      liveAnchor = anchor; followAnchor = true;
      if (anchor.requestPersistentHandle) {
        try { const id = await anchor.requestPersistentHandle(); if (state.placement) { state.placement.anchorId = id; persist(); } }
        catch { /* saved pose is the fallback */ }
      }
    })
    .catch((err) => { anchorError = err instanceof Error ? err.message : String(err); })
    .finally(() => { anchorJob = false; });
}

const frameTimer = new THREE.Timer(); let lastSec = -1;
renderer.setAnimationLoop((time, frame) => {
  frameTimer.update(time);
  const dt = Math.min(frameTimer.getDelta(), 0.05);
  if (currentMode === 'ar' && (scene.background || stars.visible || grid.visible || ring.visible)) applyEnvironment('ar');
  if (pendingRecenter && renderer.xr.isPresenting) { pendingRecenter = false; recenter(); }
  if (!renderer.xr.isPresenting) { if (keys.has('a')) camera.rotation.y += dt; if (keys.has('d')) camera.rotation.y -= dt; gazeDot.visible = false; }
  else {
    camera.getWorldPosition(gazeDot.position);
    camera.getWorldDirection(gazeDir);
    gazeDot.position.addScaledVector(gazeDir, 0.42);
    gazeDot.quaternion.copy(camera.quaternion);
    gazeDot.visible = true;
  }
  updatePlacement(frame); updateAnchor(frame); updatePointers(frame); updateDwell(dt); updateGlow();
  const cardLerp = 1 - Math.pow(0.0005, dt);
  const popLerp = 1 - Math.pow(0.001, dt);
  for (const it of cardMeshes.values()) {
    const tg = it.obj.userData.target as THREE.Vector3 | undefined;
    if (tg && it.obj.parent === boardPlane) it.obj.position.lerp(tg, cardLerp);
  }
  for (const it of items) if (it.obj.userData.pop != null) {
    const base = it.obj.userData.baseScale ?? 1;
    const s = THREE.MathUtils.lerp(it.obj.scale.x, base, popLerp);
    it.obj.scale.setScalar(s);
    if (Math.abs(s - base) < 0.002) { it.obj.scale.setScalar(base); delete it.obj.userData.pop; }
  }
  if (plant.userData.pop != null) {
    const base = 1.35;
    const s = THREE.MathUtils.lerp(plant.scale.x, base, popLerp);
    plant.scale.setScalar(s);
    if (Math.abs(s - base) < 0.002) { plant.scale.setScalar(base); delete plant.userData.pop; }
  }
  for (const it of cardMeshes.values()) if (it.obj.scale.x < 1 && it.obj.userData.pop == null && !pointersGrab(it)) it.obj.userData.pop = it.obj.userData.baseScale ?? 1;
  const now = Date.now();
  updateQuietFocus();
  plant.setGrowth(S.gardenStage(state.habit.history.find(r => r.date === S.todayKey())), focusGrow());
  if (S.advanceWorkspaceTimer(state, now)) {
    layoutCards(); refreshPlant(); sfx.done(); refreshTimerBtn(); timerPanel.redraw(); refreshMode(); persist();
    companion?.announce('Focus block finished. Your garden has grown.');
  }
  const sec = Math.floor(S.timerRemaining(state.timer, now) / 1000);
  if (sec !== lastSec) { lastSec = sec; timerPanel.redraw(); focusCue.redraw(); }
  fpsFrames += 1; fpsAccum += dt;
  if (fpsAccum >= 0.5) { fpsValue = Math.round(fpsFrames / fpsAccum); fpsFrames = 0; fpsAccum = 0; if (fpsValue !== fpsShown) { fpsShown = fpsValue; fpsPanel.redraw(); } }
  if (ring.visible) ring.rotation.z += dt * 0.1;
  if (stars.visible) stars.rotation.y += dt * 0.005;
  renderer.render(scene, camera);
});
const pointersGrab = (it: Item) => {
  for (const p of pointers.values()) if (p.grabbed === it) return true;
  return false;
};

type TargetHit = { position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; name: string };
function targetHit(name: string): TargetHit | null {
  const put = (obj: THREE.Object3D, w: number, h: number, label: string): TargetHit => {
    const p = obj.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { position: { x: p.x, y: p.y, z: p.z }, normal: { x: n.x, y: n.y, z: n.z }, size: { x: w, y: h, z: 0.01 }, name: label };
  };
  if (name === 'board') return put(board, BOARD_W, BOARD_H, name);
  if (name === 'timer') return put(timerPanel, TIMER_W, TIMER_H, name);
  if (name.startsWith('column:')) {
    const col = name.slice(7) as S.Column;
    const local = board.localToWorld(new THREE.Vector3(colX(col), 0.02, 0.02));
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { position: { x: local.x, y: local.y, z: local.z }, normal: { x: n.x, y: n.y, z: n.z }, size: { x: COL_W * 0.8, y: 0.12, z: 0.01 }, name };
  }
  if (name.startsWith('desk:')) {
    const slot = S.DESK_SLOTS[Number(name.slice(5))];
    if (!slot) return null;
    ws.updateWorldMatrix(true, false);
    const p = ws.localToWorld(aimPos.set(slot.x, slot.y, slot.z));
    aimN.set(STAND_FACE.x, STAND_FACE.y, STAND_FACE.z).transformDirection(ws.matrixWorld);
    return { position: { x: p.x, y: p.y, z: p.z }, normal: { x: aimN.x, y: aimN.y, z: aimN.z }, size: { x: 0.1, y: 0.06, z: 0.02 }, name };
  }
  const item = items.find(i => i.name === name) ?? items.find(i => i.kind === 'card' && i.name === name);
  if (!item) return null;
  return put(item.obj, item.panel.w, item.panel.h, name);
}
function screenOf(name: string) {
  const hit = targetHit(name); if (!hit) return null;
  const p = new THREE.Vector3(hit.position.x, hit.position.y, hit.position.z).project(camera);
  return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
}
function registerEmulator() {
  const device = (window as unknown as { __iwer?: { remote?: { setTargetResolver?: (r: unknown) => void } } }).__iwer;
  device?.remote?.setTargetResolver?.({
    resolve(target: string | { name: string }) {
      const name = typeof target === 'string' ? target : target.name;
      const hit = targetHit(name); if (!hit) return null;
      return hit;
    },
    list() {
      const names = ['board', 'timer', 'column:todo', 'column:doing', 'column:done', 'desk:0', 'desk:1', 'desk:2', ...items.map(i => i.name).filter((n): n is string => !!n)];
      return names.map(name => { const hit = targetHit(name); return hit ? { name, position: hit.position, size: hit.size } : null; }).filter(Boolean);
    },
  });
}

function boardLocalToWs(x: number, y: number, z: number) {
  board.updateWorldMatrix(true, false); ws.updateWorldMatrix(true, false);
  return ws.worldToLocal(board.localToWorld(new THREE.Vector3(x, y, z)));
}
function applyPinnedPose(n: S.Note) {
  const p = boardLocalToWs(n.pos[0], n.pos[1], 0.012);
  const q = ws.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(board.getWorldQuaternion(new THREE.Quaternion()));
  n.pos = [p.x, p.y, p.z];
  n.rot = [q.x, q.y, q.z, q.w];
}
function seedOrRepairNotes() {
  const blockers = S.visibleCardRects(state, COL_W, CARD_W, CARD_H, CARD_TOP, CARD_SP, COLUMN_PAGE, colPage);
  if (!state.onboarded) {
    for (const n of S.seedStarterNotes(state, BOARD_W, BOARD_H, blockers)) applyPinnedPose(n);
  }
  for (const n of state.notes) {
    if (!n.pinned) continue;
    const local = board.worldToLocal(ws.localToWorld(new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2])));
    n.pos = [local.x, local.y, local.z];
  }
  S.resolveBoardNotes(state, BOARD_W, BOARD_H, blockers);
  for (const n of state.notes) if (n.pinned) applyPinnedPose(n);
}
seedOrRepairNotes();
layoutCards(false); syncNotes(); refreshPlant(); refreshMode(); applyA11y(); registerEmulator(); paintSlots(-1); syncPlaceChrome();
syncTutorialChrome();
function greetDesk() {
  const waiting = S.parkedCards(state);
  if (S.needsOnboarding(state) || !waiting.length || state.habit.mode !== 'work') return;
  payoffText = waiting.length === 1 ? '1 task is still on your desk' : `${waiting.length} tasks are still on your desk`;
  syncTutorialChrome(); tut.redraw();
  window.setTimeout(() => {
    if (!payoffText.includes('still on your desk')) return;
    payoffText = ''; syncTutorialChrome(); tut.redraw();
  }, 4000);
}
greetDesk();

const enterBtn = document.getElementById('enter') as HTMLButtonElement, status = document.getElementById('status')!;
async function setupXR() {
  if (!navigator.xr) { status.textContent = 'WebXR not available. Desktop mode is on (mouse = pinch). Add ?emulate for the Quest emulator.'; enterBtn.disabled = true; return; }
  const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vr = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  enterBtn.disabled = !ar && !vr;
  const room = !!(window as unknown as { __iwer?: unknown }).__iwer;
  status.textContent = ar
    ? (room
      ? 'Ready for mixed reality. This emulator shows a room behind the board. On a Quest, that is your passthrough.'
      : 'Ready for mixed reality. If passthrough is unavailable, HandFlow opens in VR.')
    : vr ? 'immersive-ar is unavailable. Enter opens VR.' : 'No immersive session here. Desktop mode is on.';
  enterBtn.textContent = ar || state.mrPreferred ? 'Enter MR' : 'Enter VR';
}
enterBtn.onclick = async () => { unlockAudio(); await beginSession(state.mrPreferred ? 'ar' : 'vr'); };
document.getElementById('open-menu')?.addEventListener('click', () => { unlockAudio(); toggleFallbackMenu(); });
addEventListener('resize', () => {
  if (!renderer.xr.isPresenting) frameDesktop();
  renderer.setSize(innerWidth, innerHeight);
});
setupXR();

function applySaid(said: string) {
  remember();
  const act = S.runAgent(state, said, new Date(), Date.now());
  if (act.kind === 'empty' || act.kind === 'status') undos.pop();
  listenHint = act.reply.slice(0, 64); preview.redraw(); companion?.announce(act.reply);
  if (act.kind === 'card' || act.kind === 'plan') {
    const added = state.cards.at(-1);
    if (added) showCard(added);
  }
  if (act.kind === 'card' || act.kind === 'plan' || act.kind === 'park' || act.kind === 'done' || act.kind === 'cue') layoutCards();
  if (act.kind === 'note') syncNotes();
  if (act.kind === 'focus' || act.kind === 'done') { refreshTimerBtn(); timerPanel.redraw(); }
  if (act.kind === 'done' || act.kind === 'reviewed') refreshPlant();
  refreshMode(); persist();
  if (act.kind === 'done' || act.kind === 'reviewed') sfx.done();
  else if (act.kind === 'park') sfx.pin();
  else if (act.kind !== 'empty') sfx.drop();
  if (act.kind === 'card' || act.kind === 'plan') advanceTutorial('create');
  if (act.kind === 'park') advanceTutorial('park');
}
(window as unknown as { handflow?: unknown }).handflow = {
  state, recenter, screenOf, deskLayoutProof: () => ({ surface: state.placement?.surface, toolbarY: dock.position.y, tabletopY: -0.22, trashY: dock.position.y + trashP.position.y, standsY: S.DESK_SLOTS.map(s => s.y) }), focusProof: () => ({ quiet: board.material.opacity < 1, plantProgress: plant.focus, plantStage: plant.stage }), voiceProof: () => ({ endpoint: cloudEndpoint, pending: pendingVoice, message: voiceMessage }), fps: () => fpsValue, refresh: () => { refreshMode(); applyA11y(); },
  dictate: (text: string) => applySaid(text),
  holdMenu: (on: boolean) => { menuHold = on; if (on) poseHeldMenu(); else { handMenu.visible = false; palmOpen = false; } },
  menuOpen: () => handMenu.visible,
  palmDot: () => palmDot,
  tutorialOpen: () => tut.visible && S.needsOnboarding(state),
  skipTutorial: () => dismissTutorial(),
  columnView: () => S.COLUMNS.map(col => ({
    col,
    count: S.cardsIn(state, col).length,
    shown: S.cardsIn(state, col).filter(c => cardMeshes.get(c.id)?.obj.visible).length,
    bottom: Math.min(...S.cardsIn(state, col).filter(c => cardMeshes.get(c.id)?.obj.visible).map(c => cardMeshes.get(c.id)!.obj.position.y - CARD_H / 2), 1),
  })),
  showAccess: (on: boolean) => { settings.visible = on; refreshSettings(); },
  placeTest: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => placeWorkspace(new THREE.Vector3(x, y, z), new THREE.Vector3(nx, ny, nz)),
  endSession: () => renderer.xr.getSession()?.end(),
  xr: () => {
    const session = renderer.xr.getSession();
    return {
      presenting: renderer.xr.isPresenting,
      mode: currentMode,
      blend: session?.environmentBlendMode ?? null,
      placing,
      hit: hitValid,
      normalY: hitNormal.y,
      surface: state.placement?.surface ?? null,
      anchorId: state.placement?.anchorId ?? null,
      following: followAnchor,
      clear: scene.background == null,
      anchorError,
    };
  },
  noteShot: () => {
    const note = state.notes.at(-1);
    const it = note ? noteMeshes.get(note.id) : undefined;
    if (!note || !it) return null;
    it.panel.redraw();
    const c = it.panel.canvas;
    const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const inset = 12;
    let minY = c.height, maxY = -1, dark = 0;
    for (let y = inset; y < c.height - inset; y++) {
      for (let x = inset; x < c.width - inset; x++) {
        const i = (y * c.width + x) * 4;
        if (pixels[i + 3] > 200 && pixels[i] < 90 && pixels[i + 1] < 80 && pixels[i + 2] < 40) {
          dark++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return {
      text: note.text, pinned: note.pinned, pos: note.pos.slice() as [number, number, number],
      w: it.panel.w, h: it.panel.h, canvasW: c.width, canvasH: c.height,
      dark, minY, maxY, marginBottom: maxY < 0 ? 0 : c.height - inset - maxY,
      url: c.toDataURL('image/png'),
    };
  },
};

function submitThought(kind: string, words: string) {
  if (kind === 'command') { applySaid(words); return; }
  remember();
  if (kind === 'note') { S.addNote(state, [-(BOARD_W / 2 + 0.12), 0.02, 0.18], words); syncNotes(); }
  else if (kind === 'next') {
    const task = state.cards.find(c => c.id === state.focusId && c.column !== 'done') ?? S.singleParked(state);
    if (!task || !S.leaveNextStep(state, task.id, words)) { undos.pop(); companion?.announce('Place one open task on your desk first.'); return; }
    layoutCards(); focusCue.redraw();
  } else { const card = S.addCustomCard(state, words); showCard(card); layoutCards(); advanceTutorial('create'); }
  persist(); sfx.drop(); companion?.announce(kind === 'next' ? 'Next step saved with your desk task.' : kind === 'note' ? 'Your note is in the workspace.' : 'Your task is on the board.');
}
companion = mountCompanion(state, {
  submit: submitThought,
  move: (id, column) => { remember(); S.moveCard(state, id, column); layoutCards(); refreshPlant(); refreshMode(); persist(); companion?.announce('Task moved.'); },
  park: id => { const slot = S.DESK_SLOTS.findIndex((_, i) => !state.cards.some(c => c.parked === i)); if (slot < 0) { companion?.announce('Your desk is full. Move a task back to the board first.'); return; } remember(); S.parkCard(state, id, slot); layoutCards(); timerPanel.redraw(); persist(); companion?.announce('Task placed on your desk.'); },
  remove: id => { remember(); S.deleteCard(state, id); layoutCards(); persist(); companion?.announce('Task deleted. Undo is available.'); },
  timer: () => { startBtn.onPress?.(); companion?.refresh(); },
  undo: undoLast, mic: () => { void toggleMic(); }, acceptVoice: usePendingVoice,
  setting: key => toggleSetting(key, key),
  duration: minutes => { if (state.timer.running) { companion?.announce('Pause the timer before changing its length.'); return; } setFocusLength(minutes); companion?.announce(`${minutes}-minute focus selected.`); },
});
companion.refresh();
addEventListener('blur', () => keys.clear());
