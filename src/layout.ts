// Seated comfort: the timer, button row and desk stands stay inside about 30°
// either side of centre. The workspace origin sits EYE metres in front of the
// head. A panel at local (x, _, z) is `EYE - z` metres away, so its outer edge
// must stay inside (EYE - z) * tan(30°).
//
// The board itself is about 1.5× the old 0.48 × 0.34 m panel so titles and
// the timer words fit. At 0.50 m that was wider than the 30° cone; at EYE
// (0.9 m) the board and the raised timer both fit a typical 90° vertical FOV
// and the board spans about half of a headset-width view.

export const EYE = 0.9;
export const XR_DIST_MIN = 0.85;
export const XR_DIST_MAX = 0.95;
/** Closest horizontal hover allowed when hanging just in front of a desk. */
export const XR_PULL_MIN = 0.28;
/** Target fraction of the horizontal view the board should span. */
export const BOARD_SPAN_TARGET = 0.5;
export const BOARD_SPAN_MIN = 0.45;
export const BOARD_SPAN_MAX = 0.55;
/** Workspace origin sits this far below the eyes, so the button row stays in view. */
export const EYE_DROP = 0.02;
/** Level-look drop: board centre sits this far below eye height (0.15–0.25 m). */
export const BOARD_BELOW_EYE = 0.2;
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
 * Default XR drop when the head looks level. Looking down adds more drop so
 * the timer and board headers stay inside a 90° vertical FOV around the gaze.
 */
export const XR_DROP = BOARD_BELOW_EYE;
/** Typical headset / IWER vertical field of view. */
export const XR_FOV_V = Math.PI / 2;
/** Keep content this far inside the 90° FOV (40° from the gaze centre). */
export const XR_FOV_MARGIN = (40 * Math.PI) / 180;

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
/** Lowest workspace-local Y that must stay above a detected desk (dock underside). */
export const WORKSPACE_LOWEST = DOCK_Y - 0.08;
/** Gap to keep between that lowest point and a support surface. */
export const SUPPORT_CLEARANCE = 0.08;

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
 * Vertical drop that keeps the timer top and board headers inside a 90° FOV
 * around the current look, while a level look sits the board 0.15–0.25 m below
 * the eyes. `preferred` is the level-look drop.
 */
export function xrDropForLook(
  look: { x: number; y: number; z: number },
  dist = EYE,
  preferred = XR_DROP,
  headY?: number,
) {
  const lookLen = Math.hypot(look.x, look.y, look.z) || 1;
  const horiz = Math.hypot(look.x, look.z) / lookLen;
  const pitchY = look.y / lookLen;
  const gazeDrop = horiz > 0.12 ? dist * (-pitchY / horiz) : 0;
  const slack = dist * Math.tan(XR_FOV_MARGIN);
  let drop = Math.max(preferred, TIMER_Y + TIMER_H / 2 + gazeDrop - slack, BOARD_H / 2 + gazeDrop - slack);
  if (headY != null && headY > 0.5) drop = Math.min(drop, Math.max(0.02, headY - 0.15));
  return drop;
}

/** A detected (or assumed) seated desk / table in front of the viewer. */
export type SupportSurface = {
  /** World Y of the tabletop. */
  height: number;
  /** Horizontal distance from the head to the near edge along floor-forward. */
  front?: number;
};

/** Fraction of a horizontal FOV (`hTan = tan(hFov/2)`) spanned by the board at `dist`. */
export function boardSpanAt(dist: number, hTan: number, width = BOARD_W) {
  return width / (2 * Math.max(dist, 1e-3) * Math.max(hTan, 1e-3));
}

/**
 * Place the workspace origin `dist` metres in front of the head along the
 * yaw-only forward (no lateral offset), facing the user. Drop follows the
 * look so the timer and headers stay in a typical 90° vertical FOV. When a
 * support surface is in the way, pull the board in front of the near edge
 * or raise it so the dock and board stay above the tabletop.
 */
export function workspacePoseFromHead(
  head: { x: number; y: number; z: number },
  look: { x: number; y: number; z: number },
  dist = EYE,
  drop = XR_DROP,
  surface?: SupportSurface,
) {
  const dir = flattenForward(look.x, look.y, look.z);
  let usedDist = Math.min(XR_DIST_MAX, Math.max(XR_DIST_MIN, dist));
  let usedDrop = xrDropForLook(look, usedDist, drop, head.y);
  let support = surface;
  if (support?.front != null && usedDist > support.front - 0.08) {
    // Prefer hanging just in front of the near edge so a downward look can
    // keep its FOV-aware drop without going through the tabletop (or the
    // plant / monitor on it). A nearer grazing edge (often a side plane
    // after a turn) is ignored so we do not raise the timer out of view.
    const ahead = support.front - 0.1;
    if (ahead >= XR_PULL_MIN) {
      usedDist = Math.min(usedDist, ahead);
      usedDrop = xrDropForLook(look, usedDist, drop, head.y);
    } else {
      support = undefined;
    }
  }
  if (support) {
    const minY = support.height + SUPPORT_CLEARANCE;
    const overDesk = support.front == null || usedDist > support.front - 0.04;
    const dockFits = head.y + WORKSPACE_LOWEST - minY >= 0.05;
    const lowest = overDesk && !dockFits ? -BOARD_H / 2 : WORKSPACE_LOWEST;
    const plannedLowest = head.y - usedDrop + lowest;
    if (overDesk && plannedLowest < minY) {
      const maxDrop = head.y + lowest - minY;
      if (maxDrop >= 0.05) usedDrop = Math.min(usedDrop, maxDrop);
    }
  }
  const position = {
    x: head.x + dir.x * usedDist,
    y: head.y - usedDrop,
    z: head.z + dir.z * usedDist,
  };
  const facing = flattenForward(head.x - position.x, 0, head.z - position.z);
  return { position, facing, dist: usedDist, drop: usedDrop };
}

/** Map a workspace-local point into world space for a yaw-only workspace pose. */
export function workspaceLocalToWorld(
  pose: { position: { x: number; y: number; z: number }; facing: { x: number; y: number; z: number } },
  local: { x: number; y: number; z: number },
) {
  const fx = pose.facing.x, fz = pose.facing.z;
  return {
    x: pose.position.x + local.x * fz + local.z * fx,
    y: pose.position.y + local.y,
    z: pose.position.z + local.x * -fx + local.z * fz,
  };
}

/**
 * Project a world point into NDC of a symmetric vertical FOV around `look`.
 * `ndcY` / `ndcX` are in [-1, 1] when the point is inside the FOV and in front.
 */
export function projectFromHead(
  head: { x: number; y: number; z: number },
  look: { x: number; y: number; z: number },
  point: { x: number; y: number; z: number },
  fovV = XR_FOV_V,
  aspect = 1,
) {
  const fl = Math.hypot(look.x, look.y, look.z) || 1;
  const fx = look.x / fl, fy = look.y / fl, fz = look.z / fl;
  // right = worldUp × forward, then viewUp = forward × right.
  let rx = fz, ry = 0, rz = -fx;
  let rlen = Math.hypot(rx, ry, rz);
  if (rlen < 1e-6) {
    rx = 1; ry = 0; rz = 0;
    rlen = 1;
  }
  rx /= rlen; ry /= rlen; rz /= rlen;
  const ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
  const vx = point.x - head.x, vy = point.y - head.y, vz = point.z - head.z;
  const depth = vx * fx + vy * fy + vz * fz;
  const camX = vx * rx + vy * ry + vz * rz;
  const camY = vx * ux + vy * uy + vz * uz;
  const vTan = Math.tan(fovV / 2);
  const ndcY = depth > 1e-6 ? camY / (depth * vTan) : 0;
  const ndcX = depth > 1e-6 ? camX / (depth * vTan * aspect) : 0;
  return { ndcX, ndcY, depth, inView: depth > 0.05 && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1 };
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
