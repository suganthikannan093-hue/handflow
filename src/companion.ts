import * as S from './state';
export interface CompanionActions {
  duration: (minutes: number) => void;
  submit: (kind: string, text: string) => void;
  move: (id: string, column: S.Column) => void;
  park: (id: string) => void;
  remove: (id: string) => void;
  timer: () => void; undo: () => void; mic: () => void; acceptVoice: () => void;
  setting: (key: 'highContrast' | 'largeTargets' | 'lookHold') => void;
}
export function mountCompanion(state: S.WorkspaceState, actions: CompanionActions) {
  const drawer = document.getElementById('companion') as HTMLDialogElement;
  const open = document.getElementById('open-companion') as HTMLButtonElement;
  const form = document.getElementById('capture-form') as HTMLFormElement;
  const input = document.getElementById('thought') as HTMLTextAreaElement;
  const kind = document.getElementById('capture-kind') as HTMLSelectElement;
  const announce = document.getElementById('announcement')!;
  const voice = document.getElementById('voice-status')!;
  const pending = document.getElementById('use-voice') as HTMLButtonElement;
  const list = document.getElementById('task-list')!;
  const summary = document.getElementById('desk-summary')!;
  open.onclick = () => { drawer.showModal(); render(); input.focus(); };
  document.getElementById('close-companion')!.onclick = () => drawer.close();
  form.onsubmit = e => { e.preventDefault(); if (!input.value.trim()) return; actions.submit(kind.value, input.value.trim()); input.value = ''; render(); input.focus(); };
  document.getElementById('voice-capture')!.onclick = actions.mic;
  pending.onclick = actions.acceptVoice;
  (document.getElementById('focus-duration') as HTMLSelectElement).onchange = e => actions.duration(Number((e.target as HTMLSelectElement).value));
  document.getElementById('desk-timer')!.onclick = actions.timer;
  document.getElementById('desk-undo')!.onclick = actions.undo;
  for (const key of ['highContrast', 'largeTargets', 'lookHold'] as const) {
    document.getElementById(`setting-${key}`)!.addEventListener('change', () => actions.setting(key));
  }
  const makeButton = (label: string, action: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { action(); render(); }; return b;
  };
  function render() {
    const task = state.cards.find(c => c.id === state.focusId) ?? S.singleParked(state);
    summary.textContent = task ? `On your desk: ${task.title}${task.nextStep ? `. Next step: ${task.nextStep}` : ''}` : 'Place one open task on a stand to focus on it.';
    const duration = document.getElementById('focus-duration') as HTMLSelectElement;
    duration.disabled = state.timer.running;
    if (state.timer.mode === 'focus') duration.value = String(state.timer.durationMs / 60000);
    document.getElementById('desk-timer')!.textContent = state.timer.running ? 'Pause focus' : 'Start focus';
    for (const key of ['highContrast', 'largeTargets', 'lookHold'] as const) (document.getElementById(`setting-${key}`) as HTMLInputElement).checked = state.a11y[key];
    if (!drawer.open) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusKey = focused?.dataset.focusKey;
    list.replaceChildren();
    for (const col of S.COLUMNS) {
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = `${col === 'todo' ? 'To do' : col === 'doing' ? 'Doing' : 'Done'}`; section.append(heading);
      for (const card of state.cards.filter(c => c.column === col)) {
        const item = document.createElement('article');
        const title = document.createElement('p'); title.textContent = `${card.title}${card.parked != null ? ' · on desk' : ''}`; item.append(title);
        if (card.nextStep) { const cue = document.createElement('small'); cue.textContent = `Next: ${card.nextStep}`; item.append(cue); }
        const controls = document.createElement('div'); controls.className = 'task-actions';
        const select = document.createElement('select'); select.setAttribute('aria-label', `Move ${card.title}`); select.dataset.focusKey = `move-${card.id}`;
        for (const c of S.COLUMNS) { const option = document.createElement('option'); option.value = c; option.textContent = c === 'todo' ? 'To do' : c === 'doing' ? 'Doing' : 'Done'; select.append(option); }
        select.value = col; select.onchange = () => { actions.move(card.id, select.value as S.Column); render(); };
        controls.append(select);
        if (col !== 'done') controls.append(makeButton('Place on desk', () => actions.park(card.id)));
        controls.append(makeButton('Delete', () => actions.remove(card.id)));
        item.append(controls); section.append(item);
      }
      list.append(section);
    }
    const notes = document.getElementById('note-list')!; notes.replaceChildren();
    for (const n of state.notes) { const p = document.createElement('p'); p.textContent = n.text; notes.append(p); }
    if (focusKey) list.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
  }
  return {
    refresh: render,
    announce(message: string) { announce.textContent = message; render(); },
    voice(message: string, hasPending = false) { voice.textContent = message; pending.hidden = !hasPending; },
  };
}
