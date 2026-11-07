import * as THREE from 'three';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import * as S from './state';
import { BOARD_H, BOARD_W, BOARD_Z, COL_W, DOCK_Y, DOCK_Z, EYE, EYE_DROP, PLANT_X, PLANT_Y, PLANT_Z, TIMER_H, TIMER_W, TIMER_Y, TIMER_Z } from './layout';
import { Panel, button, roundRect, text, hex, ellipsize, paintLines, measuredWidth } from './ui';
import { sfx, unlockAudio, setAmbient } from './audio';
import { Plant } from './plant';
import { recognition, planWithModel, AI_KEY_STORAGE } from './voice';

const state = S.load(localStorage);
let saveT = 0;
const persist = () => { clearTimeout(saveT); saveT = window.setTimeout(() => S.save(state, localStorage), 150); };
let templateIdx = state.cards.length;
const theme = { contrast: false };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app')!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e1a);
scene.fog = new THREE.Fog(0x0b0e1a, 4, 14);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 1.2, 0.35);
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

const CARD_W = 0.142, CARD_H = 0.046, CARD_SP = 0.052, TOP_Y = 0.055;
const COL_LABEL: Record<S.Column, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };
const COL_COLOR: Record<S.Column, number> = { todo: 0x4f8cff, doing: 0xffb547, done: 0x2fc59b };
const bg = (alpha = 0.9) => theme.contrast ? '#05070f' : `rgba(16,20,38,${alpha})`;
const board = new Panel(BOARD_W, BOARD_H, 800, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 36); g.fillStyle = bg(0.92); g.fill();
  g.strokeStyle = theme.contrast ? '#ffffff' : 'rgba(160,180,255,0.55)'; g.lineWidth = theme.contrast ? 8 : 4; g.stroke();
  const mode = state.habit.mode === 'morning' ? 'Morning' : state.habit.mode === 'winddown' ? 'Wind-down' : 'Today';
  text(g, `${mode}  ·  streak ${state.habit.streak}`, W / 2, 16, 14, '#ffe1a8', 700, 'center');
  S.COLUMNS.forEach((c, i) => {
    const x = (0.015 + i * COL_W) / BOARD_W * W; const cw = COL_W / BOARD_W * W;
    roundRect(g, x + 6, 46, cw - 12, H - 58, 14); g.fillStyle = theme.contrast ? '#101426' : 'rgba(255,255,255,0.05)'; g.fill();
    g.fillStyle = hex(COL_COLOR[c]); g.fillRect(x + 12, 28, 10, 10);
    text(g, `${COL_LABEL[c]} · ${S.cardsIn(state, c).length}`, x + 26, 34, 13, '#f4f7ff', 700);
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
  g.font = `650 ${Math.round(H * 0.36)}px system-ui, sans-serif`;
  const title = ellipsize(g, (done ? '✓ ' : '') + card.title, W - 52);
  text(g, title, 36, H / 2, H * 0.36, done ? '#8fe8c8' : (theme.contrast && hover ? '#000' : '#fff'), 650);
}
const cardMeshes = new Map<string, Item>();
function layoutCards(animate = true) {
  for (const c of S.COLUMNS) S.cardsIn(state, c).forEach((card, i) => {
    let it = cardMeshes.get(card.id);
    if (!it) {
      const p = new Panel(CARD_W, CARD_H, 1100, (g, W, H, hover) => paintCard(card, g, W, H, hover));
      it = reg({ obj: p, kind: 'card', id: card.id, name: `card:${card.title}`, panel: p, grabbable: true });
      cardMeshes.set(card.id, it); boardPlane.add(p);
      p.position.set(colX(card.column), TOP_Y - i * CARD_SP, 0.004);
      p.scale.setScalar(animate ? 0.01 : 1);
    }
    it.name = `card:${card.title}`;
    if (it.obj.parent !== boardPlane) return;
    it.obj.userData.target = new THREE.Vector3(colX(card.column), TOP_Y - i * CARD_SP, 0.004);
    it.panel.redraw();
  });
  for (const [id, it] of cardMeshes) if (!state.cards.find(c => c.id === id)) { it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); cardMeshes.delete(id); }
  board.redraw();
}

const noteMeshes = new Map<string, Item>();
function paintNote(n: S.Note, g: CanvasRenderingContext2D, W: number, H: number, hover: boolean) {
  g.fillStyle = hover ? '#fff1a8' : (theme.contrast ? '#ffe14a' : hex(n.color));
  g.fillRect(6, 6, W - 12, H - 12);
  g.strokeStyle = '#3a2f00'; g.lineWidth = theme.contrast ? 8 : 3; g.strokeRect(6, 6, W - 12, H - 12);
  if (n.pinned) { g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(W / 2, 26, 10, 0, Math.PI * 2); g.fill(); }
  const top = n.pinned ? 46 : 22;
  const fitted = S.fitWrappedText(n.text, W - 32, H - top - 14, (sample, font) => { g.font = `700 ${font}px system-ui, sans-serif`; return measuredWidth(g, sample); }, 15, 34);
  paintLines(g, fitted.lines, 18, top + fitted.font * 0.55, fitted.font, '#3a2f00', 700, 'left', fitted.font * 1.25);
}
function syncNotes() {
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

const timerPanel = new Panel(TIMER_W, TIMER_H, 900, (g, W, H) => {
  const t = state.timer, rem = S.timerRemaining(t, performance.now()), frac = t.durationMs ? rem / t.durationMs : 0;
  roundRect(g, 0, 0, W, H, 28); g.fillStyle = bg(); g.fill();
  g.strokeStyle = t.running ? '#ff6b8a' : (theme.contrast ? '#fff' : 'rgba(160,180,255,0.55)'); g.lineWidth = theme.contrast ? 8 : 5; g.stroke();
  text(g, t.mode === 'focus' ? 'FOCUS' : 'BREAK', 20, 28, 20, t.mode === 'focus' ? '#ff9db0' : '#8fe8c8', 800);
  text(g, `x${t.completed}`, W - 16, 28, 20, '#fff', 700, 'right');
  text(g, S.formatMs(rem), W / 2, H * 0.46, 42, '#fff', 800, 'center');
  g.fillStyle = theme.contrast ? '#333' : 'rgba(255,255,255,.15)'; roundRect(g, 18, H * 0.68, W - 36, 10, 5); g.fill();
  g.fillStyle = t.mode === 'focus' ? '#ff6b8a' : '#2fc59b'; roundRect(g, 18, H * 0.68, Math.max(10, (W - 36) * frac), 10, 5); g.fill();
});
timerPanel.position.set(0, TIMER_Y, TIMER_Z); timerPanel.rotation.x = 0.08; ws.add(timerPanel);

const mkBtn = (label: string, w: number, color: number, parent: THREE.Object3D, pos: [number, number, number], onPress: () => void, icon = '', name?: string) => {
  const b = button(label, w, 0.04, color, icon); b.position.set(...pos); parent.add(b);
  return reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress, name });
};
const startBtn = mkBtn('Start', 0.052, 0x2fc59b, timerPanel, [-0.058, -0.04, 0.004], () => {
  const was = state.timer.running; S.toggleTimer(state.timer, performance.now()); refreshTimerBtn(); persist();
  if (!was && state.timer.running) advanceTutorial('timer');
}, '>', 'button:start');
mkBtn('Reset', 0.05, 0x9b6bff, timerPanel, [0, -0.04, 0.004], () => { S.resetTimer(state.timer); refreshTimerBtn(); persist(); }, 'R');
mkBtn('Skip', 0.046, 0x38c6e8, timerPanel, [0.056, -0.04, 0.004], () => {
  state.timer.mode = state.timer.mode === 'focus' ? 'break' : 'focus';
  state.timer.durationMs = state.timer.mode === 'focus' ? S.FOCUS_MS : S.BREAK_MS;
  S.resetTimer(state.timer); refreshTimerBtn(); persist();
}, '>');
function refreshTimerBtn() {
  const r = state.timer.running;
  startBtn.panel.draw = button(r ? 'Pause' : 'Start', 0.052, 0.04, r ? 0xffb547 : 0x2fc59b, r ? '||' : '>').draw;
  startBtn.panel.redraw();
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
  const c = S.addCard(state, templateIdx++, 'todo'); preview.redraw(); layoutCards(); persist(); sfx.drop(); flash(cardMeshes.get(c.id)!.obj); advanceTutorial('create');
} });
mkBtn('Task', 0.068, 0x4f8cff, dock, [rowX[1], 0, 0], () => { templateIdx++; preview.redraw(); }, '', 'button:task');
mkBtn('Note', 0.068, 0xffe27a, dock, [rowX[2], 0, 0], () => {
  const n = S.addNote(state, [-(BOARD_W / 2 + 0.12), 0, 0.18]); syncNotes(); persist(); flash(noteMeshes.get(n.id)!.obj);
}, '+', 'button:note');
mkBtn('Mic', 0.068, 0xff6b8a, dock, [rowX[3], 0, 0], () => { void toggleMic(); }, '', 'button:mic');
mkBtn('Plan', 0.068, 0xffb547, dock, [rowX[4], 0, 0], () => { S.planMorning(state); layoutCards(); refreshMode(); persist(); sfx.drop(); }, '', 'button:morning');
mkBtn('Review', 0.068, 0x9b6bff, dock, [rowX[5], 0, 0], () => { S.startWindDown(state); refreshMode(); persist(); }, '', 'button:review');
const trashP = new Panel(0.16, 0.04, 900, (g, W, H, hover) => {
  roundRect(g, 4, 4, W - 8, H - 8, 20); g.setLineDash([12, 8]); g.lineWidth = 4;
  g.strokeStyle = hover ? '#ff4d6d' : 'rgba(255,77,109,.7)'; g.stroke();
  text(g, 'Drop to delete', W / 2, H / 2, H * 0.4, '#ffd0da', 650, 'center');
});
trashP.position.set(0, -0.062, 0); dock.add(trashP);

const plant = new Plant(); plant.position.set(PLANT_X, PLANT_Y, PLANT_Z); plant.scale.setScalar(1.05); ws.add(plant);
function refreshPlant() {
  const rec = state.habit.history.find(r => r.date === S.todayKey());
  plant.setStage(S.plantStage(rec?.completed ?? 0));
}

let payoffText = '';
let tutorialT0 = performance.now();
const tut = new Panel(0.4, 0.09, 1400, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 24); g.fillStyle = theme.contrast ? '#000' : 'rgba(79,140,255,0.22)'; g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.stroke();
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  const label = payoffText || (step ? `${state.tutorialStep + 1}/${S.TUTORIAL_STEPS.length}  ${step.coach}` : '');
  text(g, label, W / 2, H / 2, 32, '#fff', 700, 'center', W - 40);
});
const coachY = TIMER_Y + TIMER_H / 2 + 0.07;
tut.position.set(0, coachY, TIMER_Z); ws.add(tut);
tut.visible = !state.onboarded;
function advanceTutorial(id: (typeof S.TUTORIAL_STEPS)[number]['id']) {
  if (state.onboarded || payoffText) return;
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  if (!step || step.id !== id) return;
  state.tutorialStep += 1;
  if (state.tutorialStep >= S.TUTORIAL_STEPS.length) {
    const payoff = S.finishTutorial(state, performance.now() - tutorialT0);
    payoffText = `${payoff.message}. Your streak has started.`;
    sfx.done(); refreshPlant();
    window.setTimeout(() => { payoffText = ''; tut.visible = false; tut.redraw(); }, 4000);
  }
  tut.redraw(); persist();
}
function restartTutorial() {
  state.onboarded = false; state.tutorialStep = 0; payoffText = ''; tutorialT0 = performance.now(); tut.visible = true; tut.redraw(); persist();
}

const modePanel = new Panel(0.4, 0.12, 1100, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 24); g.fillStyle = bg(0.94); g.fill(); g.strokeStyle = '#ffe1a8'; g.lineWidth = 4; g.stroke();
  if (state.habit.mode === 'morning') {
    text(g, 'Morning plan', 20, 28, 22, '#ffe1a8', 800);
    S.MORNING_PLAN.forEach((t, i) => text(g, `${i + 1}. ${t.title}`, 20, 58 + i * 24, 18, '#fff', 600));
  } else {
    text(g, `Wind-down  ·  streak ${state.habit.streak}`, 20, 26, 20, '#ffe1a8', 800);
    const lines = S.recentHistory(state.habit, 4).map(r => `${r.date.slice(5)} done ${r.completed}${r.reviewed ? ' reviewed' : ''}`);
    text(g, lines.join('  ·  ') || 'Nothing saved yet', 20, 62, 16, '#fff', 600, 'left', W - 36);
  }
});
modePanel.position.set(0, coachY, TIMER_Z); modePanel.visible = false; ws.add(modePanel);
const modeFocus = mkBtn('Focus', 0.07, 0x2fc59b, modePanel, [0.12, -0.04, 0.004], () => { S.startTimer(state.timer, performance.now()); refreshTimerBtn(); persist(); }, '>');
const modeDone = mkBtn('Reviewed', 0.09, 0xffb547, modePanel, [0.12, -0.04, 0.004], () => { S.completeReview(state); refreshMode(); refreshPlant(); persist(); sfx.done(); });
function refreshMode() {
  const show = state.onboarded && state.habit.mode !== 'work';
  modePanel.visible = show; tut.visible = !state.onboarded && !payoffText ? true : tut.visible && !state.onboarded;
  if (state.onboarded) tut.visible = !!payoffText;
  modeFocus.obj.visible = state.habit.mode === 'morning';
  modeDone.obj.visible = state.habit.mode === 'winddown';
  modePanel.redraw(); board.redraw();
}

const settings = new THREE.Group(); settings.position.set(0, -0.02, 0.08); settings.visible = false; ws.add(settings);
const settingsBg = new Panel(0.36, 0.16, 900, (g, W, H) => { roundRect(g, 0, 0, W, H, 24); g.fillStyle = bg(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); text(g, 'Accessibility', W / 2, 28, 22, '#fff', 800, 'center'); });
settings.add(settingsBg);
function toggleSetting(key: keyof S.A11y, label: string) {
  if (key === 'dwellMs') return;
  (state.a11y[key] as boolean) = !(state.a11y[key] as boolean);
  applyA11y(); persist(); sfx.press();
  listenHint = ''; preview.redraw();
  void label;
}
const settingButtons: { key: keyof S.A11y; item: Item; label: string }[] = [];
function addSetting(label: string, key: keyof S.A11y, x: number, y: number) {
  const item = mkBtn(label, 0.15, 0x4f8cff, settings, [x, y, 0.004], () => toggleSetting(key, label));
  settingButtons.push({ key, item, label });
}
addSetting('Contrast', 'highContrast', -0.08, 0.02);
addSetting('Large', 'largeTargets', 0.08, 0.02);
addSetting('Look hold', 'lookHold', -0.08, -0.03);
addSetting('AI planner', 'aiPlanner', 0.08, -0.03);
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
  const b = button(l, 0.08, 0.03, c); b.position.set(x, y, 0); handMenu.add(b);
  return reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress: f, name });
};
hmBtn('Recenter', -0.045, 0.05, 0x4f8cff, () => recenter());
const mrItem = hmBtn('MR', 0.045, 0.05, 0x38c6e8, () => { void toggleMode(); }, 'button:mr');
hmBtn('Help', -0.045, 0.016, 0x9b6bff, () => restartTutorial());
hmBtn('Place', 0.045, 0.016, 0xffb547, () => { placing = true; followAnchor = false; });
hmBtn('Timer', -0.045, -0.018, 0xff6b8a, () => startBtn.onPress!());
hmBtn('Sound', 0.045, -0.018, 0x2fc59b, () => { state.a11y.ambient = !state.a11y.ambient; applyA11y(); persist(); });
hmBtn('Access', -0.045, -0.052, 0xdfe6ff, () => { settings.visible = !settings.visible; refreshSettings(); });
hmBtn('Exit', 0.045, -0.052, 0xff4d6d, () => renderer.xr.getSession()?.end());

const reticle = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0x4f8cff, side: THREE.DoubleSide }));
reticle.visible = false; scene.add(reticle);
const glow = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.053, 32), new THREE.MeshBasicMaterial({ color: 0xffe27a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
glow.visible = false; scene.add(glow);
const dwellRing = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
dwellRing.visible = false; scene.add(dwellRing);

function flash(o: THREE.Object3D) { o.scale.setScalar(0.01); o.userData.pop = o.userData.baseScale ?? 1; }
function rememberPose() {
  state.placement = {
    position: [ws.position.x, ws.position.y, ws.position.z],
    quaternion: [ws.quaternion.x, ws.quaternion.y, ws.quaternion.z, ws.quaternion.w],
    anchorId: null,
  };
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
  placing = false; reticle.visible = false; rememberPose(); sfx.drop();
}

function applyA11y() {
  theme.contrast = state.a11y.highContrast;
  const scale = state.a11y.largeTargets ? 1.16 : 1;
  dock.scale.setScalar(scale); timerPanel.scale.setScalar(scale);
  setAmbient(state.a11y.ambient);
  fpsPanel.visible = state.a11y.showFps;
  scene.background = renderer.xr.isPresenting && currentMode === 'ar' ? null : new THREE.Color(theme.contrast ? 0x000000 : 0x0b0e1a);
  refreshSettings(); redrawAll();
}
function redrawAll() {
  board.redraw(); timerPanel.redraw(); preview.redraw(); tut.redraw(); modePanel.redraw(); fpsPanel.redraw(); trashP.redraw(); settingsBg.redraw();
  for (const it of items) it.panel.redraw();
}

let rec: ReturnType<typeof recognition> | null = null;
async function toggleMic() {
  unlockAudio();
  if (listenHint.startsWith('Listening')) { rec?.stop(); listenHint = ''; preview.redraw(); return; }
  rec = recognition();
  if (!rec) { listenHint = 'No speech here'; preview.redraw(); return; }
  listenHint = 'Listening…'; preview.redraw(); sfx.press();
  rec.onresult = async (ev) => {
    const said = ev.results[0]?.[0]?.transcript ?? '';
    listenHint = said.slice(0, 42); preview.redraw();
    if (state.a11y.aiPlanner && /plan\s+my\s+morning/i.test(said)) {
      try {
        const tasks = await planWithModel(said, localStorage.getItem(AI_KEY_STORAGE) ?? '');
        if (tasks?.length) {
          for (const title of tasks) S.addCustomCard(state, title);
          state.habit.mode = 'morning'; layoutCards(); refreshMode(); persist(); sfx.drop(); return;
        }
      } catch { /* the template planner still runs */ }
    }
    const kind = S.applyTranscript(state, said);
    if (kind === 'card' || kind === 'plan') layoutCards();
    if (kind === 'note') syncNotes();
    refreshMode(); refreshPlant(); persist(); sfx.drop();
    if (kind === 'card' || kind === 'plan') advanceTutorial('create');
  };
  rec.onerror = () => { listenHint = 'Mic blocked'; preview.redraw(); };
  rec.onend = () => { if (listenHint === 'Listening…') listenHint = ''; preview.redraw(); };
  try { rec.start(); } catch { listenHint = 'Mic blocked'; preview.redraw(); }
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
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let mouseDown = false, mouseIn = false;
addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); mouseIn = true; });
renderer.domElement.addEventListener('pointerdown', () => { unlockAudio(); mouseDown = true; });
addEventListener('pointerup', () => (mouseDown = false));
const keys = new Set<string>();
addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const v = new THREE.Vector3(), q = new THREE.Quaternion(), ja = new THREE.Vector3(), jb = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const hitPoint = new THREE.Vector3(), hitNormal = new THREE.Vector3();
let hitValid = false;
function boxHit(it: Item, p: THREE.Vector3, slack = state.a11y.largeTargets ? 0.03 : 0.015, depth = 0.03) {
  if (!it.obj.visible || !isVisible(it.obj)) return Infinity;
  const l = it.obj.worldToLocal(v.copy(p));
  const hw = it.panel.w / 2 * it.obj.scale.x + slack, hh = it.panel.h / 2 * it.obj.scale.y + slack;
  return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh && Math.abs(l.z) <= depth ? Math.abs(l.z) : Infinity;
}
const isVisible = (o: THREE.Object3D | null): boolean => !o || (o.visible && isVisible(o.parent));
function pickAt(p: Pointer): Item | null {
  if (p.ray) {
    raycaster.ray.copy(p.ray);
    const hits = raycaster.intersectObjects(items.filter(i => isVisible(i.obj) && i !== p.grabbed).map(i => i.obj), false);
    return hits.length ? hits[0].object.userData.item as Item : null;
  }
  let best: Item | null = null, bd = Infinity;
  for (const it of items) { if (it === p.grabbed) continue; const d = boxHit(it, p.pinchPos, state.a11y.largeTargets ? 0.035 : 0.02, 0.05); if (d < bd) { bd = d; best = it; } }
  return best;
}
function updatePointers(frame?: XRFrame) {
  const seen = new Set<string>(); const session = renderer.xr.getSession();
  if (session && frame) {
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
        p.pinching = p.pinching ? d < 0.035 : d < 0.02;
        if (src.handedness === 'left') updateHandMenu(frame, src.hand, ref);
      } else if (src.gripSpace || src.targetRaySpace) {
        const i = [...session.inputSources].indexOf(src); const ctrl = renderer.xr.getController(i);
        const p = ptr('ctrl-' + src.handedness); seen.add(p.key);
        ctrl.getWorldPosition(p.pinchPos); ctrl.getWorldQuaternion(q);
        p.ray = new THREE.Ray(p.pinchPos.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(q));
        p.tip = null; p.pinching = !!ctrl.userData.sel;
      }
    }
  } else if (mouseIn) {
    const p = ptr('mouse'); seen.add(p.key); raycaster.setFromCamera(mouse, camera); p.ray = raycaster.ray.clone(); p.tip = null; p.pinching = mouseDown;
    const hit = p.grabbed ? null : pickAt(p);
    if (p.grabbed && dragPlane) p.ray.intersectPlane(dragPlane, p.pinchPos);
    else {
      const target = hit?.obj;
      if (target) {
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(target.getWorldQuaternion(q));
        const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, target.getWorldPosition(v));
        p.ray.intersectPlane(pl, p.pinchPos);
      } else p.ray.at(0.6, p.pinchPos);
    }
  }
  for (const [k, p] of pointers) if (!seen.has(k)) { if (p.grabbed) release(p); pointers.delete(k); cursors.get(k)?.removeFromParent(); cursors.delete(k); }
  for (const p of pointers.values()) {
    const h = p.grabbed ? p.grabbed : pickAt(p);
    if (h !== p.hovered) { p.hovered?.panel.redraw(false); h?.panel.redraw(true); if (h && h !== p.grabbed) sfx.hover(); p.hovered = h; }
    if (p.tip) {
      let poked: Item | null = null;
      for (const it of items) if (it.kind === 'button' && boxHit(it, p.tip, state.a11y.largeTargets ? 0.014 : 0.008, 0.02) < Infinity) poked = it;
      if (poked && p.pokeLatch !== poked) { p.pokeLatch = poked; press(poked); } else if (!poked) p.pokeLatch = null;
    }
    if (p.pinching && !p.wasPinching) {
      unlockAudio();
      if (h?.grabbable) { grab(p, h); if (h.kind === 'card') advanceTutorial('pinch'); }
      else if (h?.kind === 'button') press(h);
      else if (placing && hitValid) placeWorkspace(hitPoint, hitNormal);
    }
    if (!p.pinching && p.wasPinching && p.grabbed) release(p);
    if (p.grabbed) {
      const o = p.grabbed.obj;
      o.position.copy(o.parent!.worldToLocal(v.copy(p.pinchPos).add(p.offset)));
      trashP.redraw(overTrash(o));
    }
    p.wasPinching = p.pinching;
    let c = cursors.get(p.key);
    if (!c) { c = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(c); cursors.set(p.key, c); }
    c.position.copy(p.pinchPos); (c.material as THREE.MeshBasicMaterial).color.set(p.pinching ? 0xff6b8a : 0xffffff); c.visible = !!p.ray || !!h;
  }
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
  const l = board.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  return Math.abs(l.x) < BOARD_W / 2 + 0.04 && Math.abs(l.y) < BOARD_H / 2 + 0.04 && Math.abs(l.z) < 0.2 ? l : null;
}
function overTrash(o: THREE.Object3D) {
  const l = trashP.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  return Math.abs(l.x) < 0.1 && Math.abs(l.y) < 0.05 && Math.abs(l.z) < 0.12;
}
function release(p: Pointer) {
  const it = p.grabbed!; p.grabbed = null; it.obj.scale.setScalar(it.obj.userData.baseScale ?? 1); trashP.redraw(false);
  if (overTrash(it.obj)) {
    it.kind === 'card' ? S.deleteCard(state, it.id!) : S.deleteNote(state, it.id!);
    sfx.grab(); layoutCards(); syncNotes(); refreshPlant(); persist(); return;
  }
  if (it.kind === 'card') {
    const l = overBoard(it.obj); const card = state.cards.find(c => c.id === it.id)!;
    boardPlane.attach(it.obj); it.obj.quaternion.identity();
    if (l) {
      const col = S.columnForX(l.x, COL_W);
      const idx = S.indexForY(l.y, TOP_Y, CARD_SP, S.cardsIn(state, col).filter(c => c.id !== card.id).length);
      const wasDone = card.column === 'done';
      S.moveCard(state, card.id, col, idx);
      if (col === 'done' && !wasDone) { sfx.done(); refreshPlant(); } else sfx.drop();
      if (col === 'doing' || col === 'done') advanceTutorial('drop');
    } else sfx.drop();
    layoutCards(); refreshMode(); persist();
  } else if (it.kind === 'note') {
    let pinned = false; let rot: [number, number, number, number] | undefined;
    for (const surf of [board, timerPanel]) {
      surf.updateWorldMatrix(true, false); it.obj.updateWorldMatrix(true, false);
      const l = surf.worldToLocal(it.obj.getWorldPosition(new THREE.Vector3()));
      const panel = surf as Panel;
      if (S.pinToSurface(l.x, l.y, l.z, panel.w / 2, panel.h / 2)) {
        const x = THREE.MathUtils.clamp(l.x, -panel.w / 2 + 0.02, panel.w / 2 - 0.02);
        const y = THREE.MathUtils.clamp(l.y, -panel.h / 2 + 0.02, panel.h / 2 - 0.02);
        const wp = surf.localToWorld(new THREE.Vector3(x, y, 0.012));
        it.obj.position.copy(ws.worldToLocal(wp));
        const localQ = ws.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(surf.getWorldQuaternion(new THREE.Quaternion()));
        it.obj.quaternion.copy(localQ);
        rot = [localQ.x, localQ.y, localQ.z, localQ.w];
        pinned = true; break;
      }
    }
    S.setNote(state, it.id!, [it.obj.position.x, it.obj.position.y, it.obj.position.z], pinned, rot);
    syncNotes(); persist();
    if (pinned) { sfx.drop(); advanceTutorial('pin'); } else sfx.grab();
  }
}
function updateHandMenu(frame: XRFrame, hand: XRHand, ref: XRReferenceSpace) {
  const get = frame.getJointPose?.bind(frame);
  const wrist = hand.get('wrist'), index = hand.get('index-finger-metacarpal'), pinky = hand.get('pinky-finger-metacarpal');
  if (!get || !wrist || !index || !pinky) { handMenu.visible = false; return; }
  const w = get(wrist, ref), i = get(index, ref), k = get(pinky, ref);
  if (!w || !i || !k) { handMenu.visible = false; return; }
  const W = ja.set(w.transform.position.x, w.transform.position.y, w.transform.position.z);
  const I = jb.set(i.transform.position.x, i.transform.position.y, i.transform.position.z).sub(W);
  const K = v.set(k.transform.position.x, k.transform.position.y, k.transform.position.z).sub(W);
  const n = new THREE.Vector3().crossVectors(I, K).normalize();
  const head = camera.getWorldPosition(new THREE.Vector3());
  const show = n.dot(head.clone().sub(W).normalize()) > 0.55;
  handMenu.visible = show;
  if (show) { handMenu.position.copy(W).addScaledVector(n, 0.05).add(new THREE.Vector3(0, 0.02, 0)); handMenu.lookAt(head); }
}

let dwellId: string | null = null, dwellElapsed = 0;
function updateDwell(dt: number) {
  if (!state.a11y.lookHold) { dwellRing.visible = false; dwellId = null; dwellElapsed = 0; return; }
  raycaster.ray.origin.copy(camera.getWorldPosition(ja));
  raycaster.ray.direction.copy(camera.getWorldDirection(jb));
  const hits = raycaster.intersectObjects(items.filter(i => i.kind === 'button' && isVisible(i.obj)).map(i => i.obj), false);
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
  if (state.onboarded || payoffText) { glow.visible = false; return; }
  const step = S.TUTORIAL_STEPS[state.tutorialStep];
  let obj: THREE.Object3D | null = null;
  if (step?.id === 'pinch' || step?.id === 'drop') obj = cardMeshes.get(state.cards.find(c => c.title === 'Reply to emails')?.id ?? '')?.obj ?? board;
  else if (step?.id === 'create') obj = plus;
  else if (step?.id === 'pin') obj = noteMeshes.get(state.notes.at(-1)?.id ?? '')?.obj ?? board;
  else if (step?.id === 'timer') obj = startBtn.obj;
  if (!obj) { glow.visible = false; return; }
  glow.visible = true;
  obj.getWorldPosition(glow.position);
  obj.getWorldQuaternion(glow.quaternion);
  glow.position.add(new THREE.Vector3(0, 0, 0.01).applyQuaternion(glow.quaternion));
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

function applyEnvironment(mode: 'ar' | 'vr' | 'desktop') {
  const ar = mode === 'ar';
  scene.background = ar ? null : new THREE.Color(theme.contrast ? 0x000000 : 0x0b0e1a);
  scene.fog = ar ? null : new THREE.Fog(theme.contrast ? 0x000000 : 0x0b0e1a, 4, 14);
  grid.visible = !ar; stars.visible = !ar; ring.visible = !ar;
}
function parkDesktop() {
  camera.position.set(0, 1.2, 0.35); camera.rotation.set(0, 0, 0);
  ws.position.set(0, 1.2 - EYE_DROP, -0.55); ws.quaternion.identity();
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
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hand-tracking', 'hit-test', 'plane-detection', 'anchors', 'dom-overlay', 'light-estimation'],
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
  (renderer.xr as THREE.WebXRManager & { setFoveation?: (n: number) => void }).setFoveation?.(1);
  await renderer.xr.setSession(session);
  try { await (session as XRSession & { updateTargetFrameRate?: (n: number) => Promise<void> }).updateTargetFrameRate?.(72); } catch { /* device picks the rate */ }
  document.body.classList.add('in-xr');
  mrItem.panel.draw = button(mode === 'ar' ? 'VR' : 'MR', 0.08, 0.03, 0x38c6e8).draw; mrItem.panel.redraw();
  await setupHitTest(session);
  const restored = await tryRestoreAnchor(session);
  if (!restored && state.placement) applyPlacement(state.placement);
  else if (!restored && mode === 'ar') placing = true;
  else if (!restored) setTimeout(recenter, 300);
  session.addEventListener('end', onSessionEnd);
}
function applyPlacement(p: S.Placement) {
  ws.position.fromArray(p.position); ws.quaternion.fromArray(p.quaternion);
}
function onSessionEnd() {
  document.body.classList.remove('in-xr');
  hitSource = null; liveAnchor = null; followAnchor = false; placing = false; reticle.visible = false; handMenu.visible = false;
  currentMode = null; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
  let pose: XRPose | undefined;
  if (hitSource) { const hits = frame.getHitTestResults(hitSource); if (hits.length) pose = hits[0].getPose(ref); }
  if (frame.detectedPlanes && frame.detectedPlanes.size) {
    const cam = camera.getWorldPosition(ja); let best: XRPose | undefined; let bestD = pose ? 0.35 : 1.6;
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
  reticle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hitNormal);
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
    .catch(() => { /* saved pose is the fallback */ })
    .finally(() => { anchorJob = false; });
}

const frameTimer = new THREE.Timer(); let lastSec = -1;
renderer.setAnimationLoop((time, frame) => {
  frameTimer.update(time);
  const dt = Math.min(frameTimer.getDelta(), 0.05);
  if (!renderer.xr.isPresenting) { if (keys.has('a')) camera.rotation.y += dt; if (keys.has('d')) camera.rotation.y -= dt; }
  updatePlacement(frame); updateAnchor(frame); updatePointers(frame); updateDwell(dt); updateGlow();
  for (const it of cardMeshes.values()) {
    const tg = it.obj.userData.target as THREE.Vector3 | undefined;
    if (tg && it.obj.parent === boardPlane) it.obj.position.lerp(tg, 1 - Math.pow(0.0005, dt));
  }
  for (const it of items) if (it.obj.userData.pop != null) {
    const base = it.obj.userData.baseScale ?? 1;
    const s = THREE.MathUtils.lerp(it.obj.scale.x, base, 1 - Math.pow(0.001, dt));
    it.obj.scale.setScalar(s);
    if (Math.abs(s - base) < 0.002) { it.obj.scale.setScalar(base); delete it.obj.userData.pop; }
  }
  for (const it of cardMeshes.values()) if (it.obj.scale.x < 1 && it.obj.userData.pop == null && !pointersGrab(it)) it.obj.userData.pop = it.obj.userData.baseScale ?? 1;
  const now = performance.now();
  if (S.tickTimer(state.timer, now)) {
    if (state.timer.mode === 'break') S.noteFocusComplete(state);
    sfx.done(); refreshTimerBtn(); refreshMode(); persist();
  }
  const sec = Math.floor(S.timerRemaining(state.timer, now) / 1000);
  if (sec !== lastSec) { lastSec = sec; timerPanel.redraw(); }
  fpsFrames += 1; fpsAccum += dt;
  if (fpsAccum >= 0.5) { fpsValue = Math.round(fpsFrames / fpsAccum); fpsFrames = 0; fpsAccum = 0; if (fpsValue !== fpsShown) { fpsShown = fpsValue; fpsPanel.redraw(); } }
  if (ring.visible) ring.rotation.z += dt * 0.1;
  if (stars.visible) stars.rotation.y += dt * 0.005;
  renderer.render(scene, camera);
});
const pointersGrab = (it: Item) => [...pointers.values()].some(p => p.grabbed === it);

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
      const names = ['board', 'timer', 'column:todo', 'column:doing', 'column:done', ...items.map(i => i.name).filter((n): n is string => !!n)];
      return names.map(name => { const hit = targetHit(name); return hit ? { name, position: hit.position, size: hit.size } : null; }).filter(Boolean);
    },
  });
}

layoutCards(false); syncNotes(); refreshPlant(); refreshMode(); applyA11y(); registerEmulator();

const enterBtn = document.getElementById('enter') as HTMLButtonElement, status = document.getElementById('status')!;
async function setupXR() {
  if (!navigator.xr) { status.textContent = 'WebXR not available. Desktop mode is on (mouse = pinch). Add ?emulate for the Quest emulator.'; enterBtn.disabled = true; return; }
  const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vr = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  enterBtn.disabled = !ar && !vr;
  status.textContent = ar ? 'Ready for mixed reality. If passthrough is unavailable, HandFlow opens in VR.' : vr ? 'immersive-ar is unavailable. Enter opens VR.' : 'No immersive session here. Desktop mode is on.';
  enterBtn.textContent = ar || state.mrPreferred ? 'Enter MR' : 'Enter VR';
}
enterBtn.onclick = async () => { unlockAudio(); await beginSession(state.mrPreferred ? 'ar' : 'vr'); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
setupXR();

(window as unknown as { handflow?: unknown }).handflow = {
  state, recenter, screenOf, fps: () => fpsValue, refresh: () => { refreshMode(); applyA11y(); },
  placeTest: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => placeWorkspace(new THREE.Vector3(x, y, z), new THREE.Vector3(nx, ny, nz)),
};
