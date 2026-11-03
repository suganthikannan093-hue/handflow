import * as THREE from 'three';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import * as S from './state';
import { Panel, button, roundRect, text, hex } from './ui';
import { sfx, unlockAudio } from './audio';

// ---------- state ----------
const state = S.load(localStorage);
let saveT = 0; const persist = () => { clearTimeout(saveT); saveT = window.setTimeout(() => S.save(state, localStorage), 150); };
let templateIdx = state.cards.length;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor'); document.getElementById('app')!.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e1a); scene.fog = new THREE.Fog(0x0b0e1a, 4, 14);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50); camera.position.set(0, 1.2, 0.35);
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a1030, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 3, 2); scene.add(dl);
// ambient environment: floor grid + soft glow ring
const grid = new THREE.GridHelper(20, 40, 0x2a3360, 0x161c38); scene.add(grid);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, () => (Math.random() - 0.5) * 30), 3)), new THREE.PointsMaterial({ color: 0x8899ff, size: 0.03 }));
scene.add(stars);

// workspace root: everything is laid out ~0.55 m in front of a seated user's eyes
const ws = new THREE.Group(); scene.add(ws); ws.position.set(0, 1.05, -0.55);

// ---------- interactables ----------
type Kind = 'card' | 'note' | 'button';
interface Item { obj: THREE.Object3D; kind: Kind; id?: string; onPress?: () => void; panel: Panel; grabbable: boolean }
const items: Item[] = [];
const reg = (it: Item) => { items.push(it); it.obj.userData.item = it; return it; };

// Board
const COL_W = 0.3, BOARD_W = COL_W * 3 + 0.04, BOARD_H = 0.46, CARD_W = 0.26, CARD_H = 0.06, CARD_SP = 0.07, TOP_Y = 0.13;
const COL_LABEL: Record<S.Column, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };
const COL_COLOR: Record<S.Column, number> = { todo: 0x4f8cff, doing: 0xffb547, done: 0x2fc59b };
const board = new Panel(BOARD_W, BOARD_H, 800, (g, W, H) => {
  roundRect(g, 0, 0, W, H, 40); g.fillStyle = 'rgba(20,24,44,0.85)'; g.fill(); g.strokeStyle = 'rgba(120,140,255,0.4)'; g.lineWidth = 4; g.stroke();
  S.COLUMNS.forEach((c, i) => { const x = (0.02 + i * COL_W) / BOARD_W * W; const cw = COL_W / BOARD_W * W;
    roundRect(g, x + 8, 70, cw - 16, H - 90, 24); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fill();
    g.fillStyle = hex(COL_COLOR[c]); g.fillRect(x + 30, 44, 14, 14);
    text(g, `${COL_LABEL[c]}  ·  ${S.cardsIn(state, c).length}`, x + 56, 50, 26, '#dfe6ff', 700); });
});
board.position.set(0, 0.02, -0.12); board.rotation.x = -0.12; ws.add(board);
const boardPlane = new THREE.Group(); board.add(boardPlane); // card layer
const colX = (c: S.Column) => (S.COLUMNS.indexOf(c) - 1) * COL_W;

function cardPanel(card: S.Card) {
  return new Panel(CARD_W, CARD_H, 1100, (g, W, H, hover) => {
    roundRect(g, 4, 4, W - 8, H - 8, 22); g.fillStyle = hover ? '#2c3358' : '#20263f'; g.fill();
    g.lineWidth = hover ? 8 : 3; g.strokeStyle = hover ? '#ffffff' : 'rgba(255,255,255,0.15)'; g.stroke();
    g.fillStyle = hex(card.color); roundRect(g, 4, 4, 18, H - 8, 9); g.fill();
    const done = card.column === 'done'; text(g, (done ? '✓ ' : '') + card.title, 44, H / 2, H * 0.36, done ? '#8fe8c8' : '#fff', 650);
  });
}
const cardMeshes = new Map<string, Item>();
function layoutCards(animate = true) {
  for (const c of S.COLUMNS) S.cardsIn(state, c).forEach((card, i) => {
    let it = cardMeshes.get(card.id);
    if (!it) { const p = cardPanel(card); it = reg({ obj: p, kind: 'card', id: card.id, panel: p, grabbable: true }); cardMeshes.set(card.id, it); boardPlane.add(p);
      p.position.set(colX(card.column), TOP_Y - i * CARD_SP, 0.004); p.scale.setScalar(animate ? 0.01 : 1); }
    if (it.obj.parent !== boardPlane) return; // being dragged
    it.obj.userData.target = new THREE.Vector3(colX(card.column), TOP_Y - i * CARD_SP, 0.004); it.panel.draw = cardPanel(card).draw; it.panel.redraw();
  });
  for (const [id, it] of cardMeshes) if (!state.cards.find(c => c.id === id)) { it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); cardMeshes.delete(id); }
  board.redraw();
}

// Notes (pin to board, timer or float freely)
const NOTE = 0.11;
const noteMeshes = new Map<string, Item>();
function notePanel(n: S.Note) {
  return new Panel(NOTE, NOTE, 1000, (g, W, H, hover) => {
    g.fillStyle = hover ? '#fff1a8' : hex(n.color); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 20; g.fillRect(10, 10, W - 20, H - 20); g.shadowBlur = 0;
    if (n.pinned) { g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(W / 2, 34, 16, 0, 7); g.fill(); }
    text(g, n.text, 30, H * 0.38, 44, '#3a2f00', 700, 'left', W - 60);
  });
}
function syncNotes() {
  for (const n of state.notes) { let it = noteMeshes.get(n.id);
    if (!it) { const p = notePanel(n); it = reg({ obj: p, kind: 'note', id: n.id, panel: p, grabbable: true }); noteMeshes.set(n.id, it); ws.add(p); p.position.fromArray(n.pos); }
    it.panel.draw = notePanel(n).draw; it.panel.redraw(); }
  for (const [id, it] of noteMeshes) if (!state.notes.find(n => n.id === id)) { it.obj.removeFromParent(); items.splice(items.indexOf(it), 1); noteMeshes.delete(id); }
}

// Timer panel
const timerPanel = new Panel(0.26, 0.2, 900, (g, W, H) => {
  const t = state.timer, rem = S.timerRemaining(t, performance.now()), frac = rem / t.durationMs;
  roundRect(g, 0, 0, W, H, 36); g.fillStyle = 'rgba(20,24,44,0.9)'; g.fill(); g.strokeStyle = t.running ? '#ff6b8a' : 'rgba(120,140,255,0.4)'; g.lineWidth = 5; g.stroke();
  text(g, t.mode === 'focus' ? 'FOCUS' : 'BREAK', 30, 40, 26, t.mode === 'focus' ? '#ff9db0' : '#8fe8c8', 800);
  text(g, `🍅 ×${t.completed}`, W - 30, 40, 26, '#dfe6ff', 700, 'right');
  text(g, S.formatMs(rem), W / 2, H * 0.4, 66, '#fff', 800, 'center');
  g.fillStyle = 'rgba(255,255,255,.1)'; roundRect(g, 30, H * 0.62, W - 60, 12, 6); g.fill();
  g.fillStyle = t.mode === 'focus' ? '#ff6b8a' : '#2fc59b'; roundRect(g, 30, H * 0.62, Math.max(12, (W - 60) * frac), 12, 6); g.fill();
});
timerPanel.position.set(0.62, 0.06, 0.02); timerPanel.rotation.y = -0.5; ws.add(timerPanel);
const mkBtn = (label: string, w: number, color: number, parent: THREE.Object3D, pos: [number, number, number], onPress: () => void, icon = '') => {
  const b = button(label, w, 0.045, color, icon); b.position.set(...pos); parent.add(b); return reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress });
};
const startBtn = mkBtn('Start', 0.075, 0x2fc59b, timerPanel, [-0.08, -0.07, 0.003], () => { S.toggleTimer(state.timer, performance.now()); refreshTimerBtn(); persist(); }, '▶');
mkBtn('Reset', 0.075, 0x9b6bff, timerPanel, [0.005, -0.07, 0.003], () => { S.resetTimer(state.timer); refreshTimerBtn(); persist(); }, '↺');
mkBtn('Skip', 0.065, 0x38c6e8, timerPanel, [0.085, -0.07, 0.003], () => { state.timer.mode = state.timer.mode === 'focus' ? 'break' : 'focus'; state.timer.durationMs = state.timer.mode === 'focus' ? S.FOCUS_MS : S.BREAK_MS; S.resetTimer(state.timer); refreshTimerBtn(); persist(); }, '⏭');
function refreshTimerBtn() { const r = state.timer.running; startBtn.panel.draw = button(r ? 'Pause' : 'Start', 0.075, 0.045, r ? 0xffb547 : 0x2fc59b, r ? '⏸' : '▶').draw; startBtn.panel.redraw(); }
refreshTimerBtn();

// Creation dock (left): + task from template, + note
const dock = new THREE.Group(); dock.position.set(-0.62, 0.06, 0.02); dock.rotation.y = 0.5; ws.add(dock);
const preview = new Panel(0.24, 0.05, 1000, (g, W, H) => { text(g, 'Next: ' + S.TEMPLATES[templateIdx % S.TEMPLATES.length].title, W / 2, H / 2, H * 0.4, '#b9c4ff', 600, 'center'); });
preview.position.set(0, 0.11, 0); dock.add(preview);
const plus = new Panel(0.09, 0.09, 900, (g, W, H, hover) => { g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 6, 0, 7); g.fillStyle = hover ? '#4f8cff' : 'rgba(79,140,255,.25)'; g.fill(); g.strokeStyle = '#4f8cff'; g.lineWidth = 8; g.stroke(); text(g, '+', W / 2, H / 2 + 4, W * 0.6, '#fff', 800, 'center'); });
plus.position.set(-0.06, 0.03, 0); dock.add(plus);
reg({ obj: plus, kind: 'button', panel: plus, grabbable: false, onPress: () => { const c = S.addCard(state, templateIdx++, 'todo'); preview.redraw(); layoutCards(); persist(); sfx.drop(); flash(cardMeshes.get(c.id)!.obj); } });
mkBtn('Task', 0.08, 0x4f8cff, dock, [0.06, 0.05, 0], () => { templateIdx++; preview.redraw(); }, '⟳');
mkBtn('Note', 0.08, 0xffe27a, dock, [0.06, 0.0, 0], () => { const n = S.addNote(state, [-0.38, 0.22, 0.08]); syncNotes(); persist(); flash(noteMeshes.get(n.id)!.obj); }, '+');
const trashP = new Panel(0.2, 0.07, 900, (g, W, H, hover) => { roundRect(g, 4, 4, W - 8, H - 8, 30); g.setLineDash([16, 12]); g.lineWidth = 5; g.strokeStyle = hover ? '#ff4d6d' : 'rgba(255,77,109,.5)'; g.stroke(); text(g, '🗑  Drop to delete', W / 2, H / 2, H * 0.32, '#ffb3c1', 600, 'center'); });
trashP.position.set(0, -0.1, 0); dock.add(trashP);

// Onboarding tutorial
const steps = ['👋 Welcome to HandFlow! Hold your hands up — no controllers needed.', '🤏 PINCH a task card (thumb + index) and DRAG it to Doing or Done. Release to snap.', '➕ POKE the blue + on the left to create a task. ⟳ cycles templates.', '📝 POKE "+ Note", pinch it, and drop it on the board or timer to PIN it.', '🍅 POKE Start on the timer (right) for a 25-min focus sprint.', '🖐 Turn your LEFT palm up for the hand menu: Recenter, Help, Exit.'];
let step = 0;
const tut = new Panel(0.5, 0.15, 1800, (g, W, H) => { roundRect(g, 0, 0, W, H, 34); g.fillStyle = 'rgba(79,140,255,0.18)'; g.fill(); g.strokeStyle = '#4f8cff'; g.lineWidth = 4; g.stroke();
  text(g, `TUTORIAL ${step + 1}/${steps.length}`, 50, 46, 30, '#8fb0ff', 800); text(g, steps[step], 50, 110, 40, '#fff', 600, 'left', W * 0.74); });
tut.position.set(0, 0.37, -0.1); ws.add(tut);
const nextBtn = mkBtn('Next', 0.08, 0x4f8cff, tut, [0.19, -0.045, 0.003], () => { if (step < steps.length - 1) { step++; tut.redraw(); } else { tut.visible = false; state.onboarded = true; persist(); } }, '→');
tut.visible = !state.onboarded;

// Hand menu (attached to left wrist, shown palm-up)
const handMenu = new THREE.Group(); scene.add(handMenu); handMenu.visible = false;
const hmBtn = (l: string, i: string, y: number, c: number, f: () => void) => { const b = button(l, 0.09, 0.032, c, i); b.position.set(0, y, 0); handMenu.add(b); reg({ obj: b, kind: 'button', panel: b, grabbable: false, onPress: f }); };
hmBtn('Recenter', '◎', 0.08, 0x4f8cff, () => recenter());
hmBtn('Help', '?', 0.045, 0x9b6bff, () => { step = 0; tut.visible = true; tut.redraw(); });
hmBtn('Timer', '🍅', 0.01, 0xff6b8a, () => startBtn.onPress!());
hmBtn('Exit', '⏏', -0.025, 0xff4d6d, () => renderer.xr.getSession()?.end());

function flash(o: THREE.Object3D) { o.scale.setScalar(0.01); o.userData.pop = 1; }
function recenter() {
  const head = new THREE.Vector3(); camera.getWorldPosition(head); const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  ws.position.copy(head).addScaledVector(dir, 0.55); ws.position.y = head.y - 0.15; ws.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0); sfx.press();
}

// ---------- input: hands (pinch + poke), controllers (optional), mouse ----------
interface Pointer { key: string; pinchPos: THREE.Vector3; tip: THREE.Vector3 | null; pinching: boolean; wasPinching: boolean; ray: THREE.Ray | null; grabbed: Item | null; hovered: Item | null; offset: THREE.Vector3; pokeLatch: Item | null }
const pointers = new Map<string, Pointer>(); let dragPlane: THREE.Plane | null = null;
const ptr = (key: string): Pointer => { let p = pointers.get(key); if (!p) { p = { key, pinchPos: new THREE.Vector3(), tip: null, pinching: false, wasPinching: false, ray: null, grabbed: null, hovered: null, offset: new THREE.Vector3(), pokeLatch: null }; pointers.set(key, p); } return p; };
const handFactory = new XRHandModelFactory();
for (let i = 0; i < 2; i++) { const h = renderer.xr.getHand(i); h.add(handFactory.createHandModel(h, 'mesh')); scene.add(h);
  const ctrl = renderer.xr.getController(i); scene.add(ctrl); ctrl.addEventListener('selectstart', () => (ctrl.userData.sel = true)); ctrl.addEventListener('selectend', () => (ctrl.userData.sel = false));
  ctrl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x8fb0ff })));
  ctrl.addEventListener('connected', (e: any) => (ctrl.userData.src = e.data)); ctrl.addEventListener('disconnected', () => (ctrl.userData.src = null)); }
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const cursors = new Map<string, THREE.Mesh>();

const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let mouseDown = false, mouseIn = false;
addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); mouseIn = true; });
renderer.domElement.addEventListener('pointerdown', () => { unlockAudio(); mouseDown = true; });
addEventListener('pointerup', () => (mouseDown = false));
// desktop: keyboard look (A/D) for testing
const keys = new Set<string>(); addEventListener('keydown', e => keys.add(e.key.toLowerCase())); addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const v = new THREE.Vector3(), q = new THREE.Quaternion();
function boxHit(it: Item, p: THREE.Vector3, slack = 0.015, depth = 0.03) {
  if (!it.obj.visible || !isVisible(it.obj)) return Infinity; const l = it.obj.worldToLocal(v.copy(p));
  const hw = it.panel.w / 2 * it.obj.scale.x + slack, hh = it.panel.h / 2 * it.obj.scale.y + slack;
  return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh && Math.abs(l.z) <= depth ? Math.abs(l.z) : Infinity;
}
const isVisible = (o: THREE.Object3D | null): boolean => !o || (o.visible && isVisible(o.parent));
function pickAt(p: Pointer): Item | null {
  if (p.ray) { raycaster.ray.copy(p.ray); const hits = raycaster.intersectObjects(items.filter(i => isVisible(i.obj) && i !== p.grabbed).map(i => i.obj), false); return hits.length ? hits[0].object.userData.item : null; }
  let best: Item | null = null, bd = Infinity; for (const it of items) { if (it === p.grabbed) continue; const d = boxHit(it, p.pinchPos, 0.02, 0.05); if (d < bd) { bd = d; best = it; } } return best;
}

function updatePointers(frame?: XRFrame) {
  const seen = new Set<string>(); const session = renderer.xr.getSession();
  if (session && frame) { const ref = renderer.xr.getReferenceSpace()!;
    for (const src of session.inputSources) {
      if (src.hand) { const th = frame.getJointPose?.(src.hand.get('thumb-tip')!, ref), ix = frame.getJointPose?.(src.hand.get('index-finger-tip')!, ref); if (!th || !ix) continue;
        const p = ptr('hand-' + src.handedness); seen.add(p.key); const a = new THREE.Vector3().copy(th.transform.position as any), b = new THREE.Vector3().copy(ix.transform.position as any);
        const d = a.distanceTo(b); p.pinchPos.copy(a).add(b).multiplyScalar(0.5); p.tip = b; p.ray = null; p.pinching = p.pinching ? d < 0.035 : d < 0.02; // hysteresis
        if (src.handedness === 'left') updateHandMenu(frame, src.hand, ref);
      } else if (src.gripSpace || src.targetRaySpace) { const i = [...session.inputSources].indexOf(src); const ctrl = renderer.xr.getController(i);
        const p = ptr('ctrl-' + src.handedness); seen.add(p.key); ctrl.getWorldPosition(p.pinchPos); ctrl.getWorldQuaternion(q); p.ray = new THREE.Ray(p.pinchPos.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(q)); p.tip = null; p.pinching = !!ctrl.userData.sel; }
    }
  } else if (mouseIn) { const p = ptr('mouse'); seen.add(p.key); raycaster.setFromCamera(mouse, camera); p.ray = raycaster.ray.clone(); p.tip = null; p.pinching = mouseDown;
    const hit = p.grabbed ? null : pickAt(p); if (p.grabbed && dragPlane) { p.ray.intersectPlane(dragPlane, p.pinchPos); } else { const target = hit?.obj; if (target) { const n = new THREE.Vector3(0, 0, 1).applyQuaternion(target.getWorldQuaternion(q)); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, target.getWorldPosition(v)); p.ray.intersectPlane(pl, p.pinchPos); } else p.ray.at(0.6, p.pinchPos); } }
  for (const [k, p] of pointers) if (!seen.has(k)) { if (p.grabbed) release(p); pointers.delete(k); cursors.get(k)?.removeFromParent(); cursors.delete(k); }

  for (const p of pointers.values()) {
    // hover
    const h = p.grabbed ? p.grabbed : pickAt(p);
    if (h !== p.hovered) { p.hovered?.panel.redraw(false); h?.panel.redraw(true); if (h) sfx.hover(); p.hovered = h; }
    // poke with index tip (buttons)
    if (p.tip) { let poked: Item | null = null; for (const it of items) if (it.kind === 'button' && boxHit(it, p.tip, 0.004, 0.012) < Infinity) poked = it;
      if (poked && p.pokeLatch !== poked) { p.pokeLatch = poked; press(poked); } else if (!poked) p.pokeLatch = null; }
    // pinch start / end
    if (p.pinching && !p.wasPinching) { unlockAudio(); if (h?.grabbable) grab(p, h); else if (h?.kind === 'button') press(h); }
    if (!p.pinching && p.wasPinching && p.grabbed) release(p);
    if (p.grabbed) { const o = p.grabbed.obj; o.position.copy(o.parent!.worldToLocal(v.copy(p.pinchPos).add(p.offset))); dragFeedback(p.grabbed); }
    p.wasPinching = p.pinching;
    // cursor dot
    let c = cursors.get(p.key); if (!c) { c = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 12), cursorMat.clone()); scene.add(c); cursors.set(p.key, c); }
    c.position.copy(p.pinchPos); (c.material as THREE.MeshBasicMaterial).color.set(p.pinching ? 0xff6b8a : 0xffffff); c.visible = !!p.ray || !!h;
  }
}
function press(it: Item) { sfx.press(); it.obj.userData.pop = 0.85; it.obj.scale.setScalar(0.85); it.onPress?.(); }
function grab(p: Pointer, it: Item) { p.grabbed = it; sfx.grab(); const wp = it.obj.getWorldPosition(new THREE.Vector3()); const wq = it.obj.getWorldQuaternion(new THREE.Quaternion());
  ws.attach(it.obj); it.obj.quaternion.copy(ws.quaternion.clone().invert().multiply(wq)); it.obj.position.copy(ws.worldToLocal(wp.clone())); it.obj.position.z += 0.03; it.obj.scale.setScalar(1.08);
  if (p.key === 'mouse') { const n = new THREE.Vector3(0, 0, 1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())); dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, it.obj.getWorldPosition(new THREE.Vector3())); p.ray!.intersectPlane(dragPlane, p.pinchPos); }
  p.offset.copy(it.obj.getWorldPosition(new THREE.Vector3())).sub(p.pinchPos); }
const local = (o: THREE.Object3D, target: THREE.Object3D) => target.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
function overBoard(o: THREE.Object3D) { const l = local(o, board); return Math.abs(l.x) < BOARD_W / 2 + 0.03 && Math.abs(l.y) < BOARD_H / 2 + 0.03 && Math.abs(l.z) < 0.12 ? l : null; }
function overTrash(o: THREE.Object3D) { const l = local(o, trashP); return Math.abs(l.x) < 0.12 && Math.abs(l.y) < 0.06 && Math.abs(l.z) < 0.1; }
function dragFeedback(it: Item) { trashP.redraw(overTrash(it.obj)); }
function release(p: Pointer) {
  const it = p.grabbed!; p.grabbed = null; it.obj.scale.setScalar(1); trashP.redraw(false);
  if (overTrash(it.obj)) { it.kind === 'card' ? S.deleteCard(state, it.id!) : S.deleteNote(state, it.id!); sfx.grab(); layoutCards(); syncNotes(); persist(); return; }
  if (it.kind === 'card') { const l = overBoard(it.obj); const card = state.cards.find(c => c.id === it.id)!; boardPlane.attach(it.obj); it.obj.quaternion.identity();
    if (l) { const col = S.columnForX(l.x, COL_W); const idx = S.indexForY(l.y, TOP_Y, CARD_SP, S.cardsIn(state, col).filter(c => c.id !== card.id).length); const wasDone = card.column === 'done'; S.moveCard(state, card.id, col, idx); if (col === 'done' && !wasDone) sfx.done(); else sfx.drop(); }
    else sfx.drop(); // snaps back to its slot
    layoutCards(); persist();
  } else if (it.kind === 'note') { // pin to board or timer if near; otherwise float where dropped
    let pinned = false; for (const surf of [board, timerPanel]) { const l = local(it.obj, surf); if (Math.abs(l.x) < (surf as Panel).w / 2 + 0.03 && Math.abs(l.y) < (surf as Panel).h / 2 + 0.05 && Math.abs(l.z) < 0.1) {
      l.z = 0.012; const wp = surf.localToWorld(l.clone()); it.obj.position.copy(ws.worldToLocal(wp)); it.obj.quaternion.copy(ws.quaternion.clone().invert().multiply(surf.getWorldQuaternion(new THREE.Quaternion()))); pinned = true; break; } }
    S.setNote(state, it.id!, it.obj.position.toArray() as any, pinned); syncNotes(); persist(); pinned ? sfx.drop() : sfx.grab();
  }
}
// palm-up detection: palm normal (wrist->index & wrist->pinky cross) pointing up-ish toward the user
function updateHandMenu(frame: XRFrame, hand: XRHand, ref: XRReferenceSpace) {
  const w = frame.getJointPose?.(hand.get('wrist')!, ref), i = frame.getJointPose?.(hand.get('index-finger-metacarpal')!, ref), k = frame.getJointPose?.(hand.get('pinky-finger-metacarpal')!, ref);
  if (!w || !i || !k) { handMenu.visible = false; return; }
  const W = new THREE.Vector3().copy(w.transform.position as any), I = new THREE.Vector3().copy(i.transform.position as any).sub(W), K = new THREE.Vector3().copy(k.transform.position as any).sub(W);
  const n = new THREE.Vector3().crossVectors(I, K).normalize(); // left hand: points out of palm
  const toHead = camera.getWorldPosition(new THREE.Vector3()).sub(W).normalize();
  const show = n.dot(toHead) > 0.55; handMenu.visible = show;
  if (show) { handMenu.position.copy(W).addScaledVector(n, 0.04).add(new THREE.Vector3(0, 0.03, 0)); handMenu.lookAt(camera.getWorldPosition(new THREE.Vector3())); }
}

// ---------- loop ----------
const clock = new THREE.Clock(); let lastSec = -1;
renderer.setAnimationLoop((_t, frame) => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!renderer.xr.isPresenting) { if (keys.has('a')) camera.rotation.y += dt; if (keys.has('d')) camera.rotation.y -= dt; }
  updatePointers(frame);
  for (const it of cardMeshes.values()) { const tg = it.obj.userData.target as THREE.Vector3 | undefined; if (tg && it.obj.parent === boardPlane) it.obj.position.lerp(tg, 1 - Math.pow(0.0005, dt)); }
  for (const it of items) if (it.obj.userData.pop != null) { const s = THREE.MathUtils.lerp(it.obj.scale.x, 1, 1 - Math.pow(0.001, dt)); it.obj.scale.setScalar(s); if (Math.abs(s - 1) < 0.002) { it.obj.scale.setScalar(1); delete it.obj.userData.pop; } }
  for (const it of cardMeshes.values()) if (it.obj.scale.x < 1 && it.obj.userData.pop == null && !pointersGrab(it)) it.obj.userData.pop = 1;
  const now = performance.now(); if (S.tickTimer(state.timer, now)) { sfx.done(); refreshTimerBtn(); persist(); }
  const sec = Math.floor(S.timerRemaining(state.timer, now) / 1000); if (sec !== lastSec) { lastSec = sec; timerPanel.redraw(); }
  ring.rotation.z += dt * 0.1; stars.rotation.y += dt * 0.005;
  renderer.render(scene, camera);
});
const pointersGrab = (it: Item) => [...pointers.values()].some(p => p.grabbed === it);
layoutCards(false); syncNotes();

// ---------- enter / exit ----------
const enterBtn = document.getElementById('enter') as HTMLButtonElement, status = document.getElementById('status')!;
async function setupXR() {
  if (!navigator.xr) { status.textContent = 'WebXR not available — desktop mode (mouse = pinch). Add ?emulate to load the Quest emulator.'; enterBtn.disabled = true; return; }
  const ok = await navigator.xr.isSessionSupported('immersive-vr'); enterBtn.disabled = !ok; status.textContent = ok ? 'Ready. Headset: hands-only, no controllers needed.' : 'immersive-vr not supported here — desktop mode active.';
}
enterBtn.onclick = async () => { unlockAudio(); const s = await navigator.xr!.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
  await renderer.xr.setSession(s); document.body.classList.add('in-xr'); setTimeout(recenter, 400); s.addEventListener('end', () => { document.body.classList.remove('in-xr'); camera.position.set(0, 1.2, 0.35); camera.rotation.set(0, 0, 0); ws.position.set(0, 1.05, -0.55); ws.rotation.set(0, 0, 0); handMenu.visible = false; }); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
setupXR();
(window as any).handflow = { state, recenter, dbg: () => [...pointers.values()].map(p => ({ g: p.grabbed?.id, pos: p.grabbed?.obj.getWorldPosition(new THREE.Vector3()).toArray(), pin: p.pinchPos.toArray(), off: p.offset.toArray() })) };
