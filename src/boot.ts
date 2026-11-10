// Optional desktop emulation of a Meta Quest 3. ?emulate loads hands plus a synthetic
// home office, which is what makes passthrough, hit-testing and anchors observable here.
async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.has('emulate')) {
    const { XRDevice, metaQuest3 } = await import('iwer');
    const d = new XRDevice(metaQuest3);
    d.installRuntime({ forceInstall: true });
    d.primaryInputMode = 'hand';
    d.position.set(0, 1.15, 0);
    // ?lite keeps the hand emulator and skips the room, so long pinch scripts stay fast.
    if (!params.has('lite')) {
      const { SyntheticEnvironmentModule } = await import('@iwer/sem');
      d.installSEM(SyntheticEnvironmentModule);
      try {
        await d.sem?.loadDefaultEnvironment('home_office');
        aimAtDesk(d);
        const sem = d.sem as { render?: (time: number) => void } | undefined;
        if (sem && typeof sem.render === 'function') {
          const raw = sem.render.bind(sem);
          sem.render = (time: number) => {
            try { raw(time); } catch (err) { console.warn('Emulated room render failed', err); }
          };
        }
      } catch (err) {
        console.warn('HandFlow could not load the emulated room', err);
      }
    }
    (window as unknown as { __iwer?: unknown }).__iwer = d;
  }
  await import('./main');
}

type DeskPlane = { semanticLabel?: string; transform: { position: { x: number; y: number; z: number } } };
type AimedDevice = {
  position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  quaternion: { set: (x: number, y: number, z: number, w: number) => void; normalize: () => void };
  sem?: { trackedPlanes: Set<DeskPlane> };
};

/** Sit in front of the desk and look at a clear part of the desktop. */
function aimAtDesk(d: AimedDevice) {
  const desks = [...(d.sem?.trackedPlanes ?? [])].filter(p => p.semanticLabel === 'desk' || p.semanticLabel === 'table');
  const desk = desks.sort((a, b) => a.transform.position.z - b.transform.position.z)[0];
  if (!desk) return;
  const p = desk.transform.position;
  d.position.set(p.x, 1.15, p.z + 0.72);
  // Offset from the centre so the ray meets wood, not the monitor.
  lookAlongMinusZ(d.quaternion, d.position.x, d.position.y, d.position.z, p.x + 0.22, p.y, p.z + 0.16);
}

/** Quaternion that turns IWER's forward axis (0, 0, -1) toward a world point. */
function lookAlongMinusZ(q: AimedDevice['quaternion'], ex: number, ey: number, ez: number, tx: number, ty: number, tz: number) {
  let x = tx - ex, y = ty - ey, z = tz - ez;
  const len = Math.hypot(x, y, z) || 1;
  x /= len; y /= len; z /= len;
  const dot = -z;
  if (dot > 0.99999) { q.set(0, 0, 0, 1); return; }
  if (dot < -0.99999) { q.set(0, 1, 0, 0); return; }
  const ax = y, ay = -x;
  const s = Math.sqrt((1 + dot) * 2);
  const inv = 1 / s;
  q.set(ax * inv, ay * inv, 0, s * 0.5);
  q.normalize();
}

boot();
