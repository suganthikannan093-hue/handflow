// Seated comfort: the timer, button row and desk stands stay inside about 30°
// either side of centre. The workspace origin sits EYE metres in front of the
// head. A panel at local (x, _, z) is `EYE - z` metres away, so its outer edge
// must stay inside (EYE - z) * tan(30°).
//
// The board itself is about 1.5× the old 0.48 × 0.34 m panel so titles and
// the timer words fit. At 0.50 m that was wider than the 30° cone; at EYE
// (0.7 m) the board and the raised timer both fit comfortably.

export const EYE = 0.7;
/** Workspace origin sits this far below the eyes, so the button row stays in view. */
export const EYE_DROP = 0.02;
export const COMFORT_RAD = Math.PI / 6;

export const BOARD_Z = -0.02;
export const COL_W = 0.225;
export const BOARD_W = COL_W * 3 + 0.045;
export const BOARD_H = 0.51;

export const TIMER_W = 0.38;
export const TIMER_H = 0.20;
export const TIMER_X = 0;
export const TIMER_Y = 0.52;
export const TIMER_Z = 0.02;
/**
 * XR origin drop from the eyes. Keeps the timer just under eye height and the
 * board in a seated downward view (IWER looks at the desk at about 35°).
 */
export const XR_DROP = TIMER_Y + TIMER_H / 2 - 0.13;

/** 25m / 5m / 1m chips on the idle Focus timer, below the digits. */
export const DUR_W = 0.092;
export const DUR_H = 0.036;
export const DUR_GAP = 0.112;
export const DUR_Y = -0.036;

export const TIMER_BTN_W = 0.11;
export const TIMER_BTN_H = 0.04;
export const TIMER_BTN_Y = -0.082;

/** Focus cue sits in its own slot between the timer and the first-run coach. */
export const TOAST_W = 0.56;
export const TOAST_H = 0.042;
export const TOAST_Y = 0.395;
export const TOAST_Z = TIMER_Z + 0.03;

/** First-run coach sits above the board header, below the toast slot. */
export const COACH_W = 0.52;
export const COACH_H = 0.088;
export const COACH_Y = 0.322;
export const COACH_Z = TOAST_Z;
export const SKIP_TUT_W = 0.10;
export const SKIP_TUT_H = 0.042;
export const SKIP_TUT_X = 0.185;
export const SKIP_TUT_Y = -0.022;

export const PLANT_X = -0.24;
export const PLANT_Y = 0.3;
export const PLANT_Z = 0.04;

export const DOCK_X = 0;
/** High enough that the Undo row stays inside a 52° desktop view. */
export const DOCK_Y = -0.30;
export const DOCK_Z = 0.06;
/** Desktop camera sits here on +Z, looking down −Z, so the timer and Undo both fit. */
export const DESKTOP_CAM_Z = 0.46;
export const DESKTOP_CAM_Y = 1.2;
export const DESKTOP_FOV = 52;
export const DESKTOP_WS_Z = -0.55;
/** Outer edge of the button row, including the plus button. */
export const DOCK_HALF = 0.23;

/** Cards in one column before the rest sit behind “+N more”. */
export const COLUMN_PAGE = 3;
export const CARD_W = 0.2;
export const CARD_H = 0.06;
export const CARD_SP = 0.068;
export const CARD_TOP = 0.07;
/** “+N more” sits clearly below the column header and above the first card. */
export const MORE_Y = 0.125;
export const MORE_H = 0.026;
export const MORE_W = 0.12;

export function comfortLimit(z: number) {
  return (EYE - z) * Math.tan(COMFORT_RAD);
}

/** True when a panel centred at x with the given half-width stays inside the cone. */
export function fitsComfort(x: number, half: number, z: number) {
  return Math.abs(x) + half <= comfortLimit(z) + 1e-3;
}

/** Flatten a look direction onto the floor plane; fall back to -Z when looking straight up or down. */
export function flattenForward(x: number, _y: number, z: number) {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, y: 0, z: -1 };
  return { x: x / len, y: 0, z: z / len };
}

/**
 * Place the workspace origin `dist` metres in front of the head at seated eye
 * height, facing the user. The board's local +Z points back at the head.
 */
export function workspacePoseFromHead(
  head: { x: number; y: number; z: number },
  look: { x: number; y: number; z: number },
  dist = EYE,
  drop = XR_DROP,
) {
  const dir = flattenForward(look.x, look.y, look.z);
  const position = {
    x: head.x + dir.x * dist,
    y: head.y - drop,
    z: head.z + dir.z * dist,
  };
  const facing = flattenForward(head.x - position.x, 0, head.z - position.z);
  return { position, facing, dist };
}

/**
 * The first XR frame often reports an identity pose at the origin before
 * tracking (or local-floor) is ready. Do not place the workspace from that.
 */
export function poseLooksUntracked(
  position: { x: number; y: number; z: number },
  orientation: { x: number; y: number; z: number; w: number },
) {
  const ident =
    Math.abs(orientation.x) < 1e-3 &&
    Math.abs(orientation.y) < 1e-3 &&
    Math.abs(orientation.z) < 1e-3 &&
    Math.abs(Math.abs(orientation.w) - 1) < 1e-3;
  const atOrigin = Math.hypot(position.x, position.y, position.z) < 0.08;
  return ident && atOrigin;
}

/** Desktop camera distance so the raised timer and the dock stay in a 52° view. */
export function desktopCameraDistance(aspect: number) {
  const vTan = Math.tan((DESKTOP_FOV * Math.PI) / 360);
  const boardZ = DESKTOP_WS_Z + BOARD_Z;
  const widthDist = (BOARD_W / 2 + 0.06) / (vTan * Math.max(aspect, 0.01));
  const top = EYE_DROP + TIMER_Y + TIMER_H / 2 + 0.02;
  const bot = EYE_DROP - (DOCK_Y - 0.082);
  const heightDist = Math.max(top, bot) / (vTan * 0.9);
  return Math.max(DESKTOP_CAM_Z - boardZ, widthDist, heightDist);
}

export function panelYFromCanvas(canvasY: number, panelH: number, ppm: number) {
  return panelH / 2 - canvasY / ppm;
}
