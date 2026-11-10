// Seated comfort: the timer, button row and desk stands stay inside about 30°
// either side of centre. The workspace origin sits EYE metres in front of the
// head. A panel at local (x, _, z) is `EYE - z` metres away, so its outer edge
// must stay inside (EYE - z) * tan(30°).
//
// The board itself is about 1.5× the old 0.48 × 0.34 m panel so titles and
// the timer words fit. That makes it wider than the 30° cone at 0.50 m.
// The timer still sits above it and the buttons still sit below it.

export const EYE = 0.5;
/** Workspace origin sits this far below the eyes, so the button row stays in view. */
export const EYE_DROP = 0.02;
export const COMFORT_RAD = Math.PI / 6;

export const BOARD_Z = -0.02;
export const COL_W = 0.225;
export const BOARD_W = COL_W * 3 + 0.045;
export const BOARD_H = 0.51;

export const TIMER_W = 0.38;
export const TIMER_H = 0.15;
export const TIMER_X = 0;
export const TIMER_Y = 0.355;
export const TIMER_Z = 0.02;

export const PLANT_X = -0.24;
export const PLANT_Y = 0.3;
export const PLANT_Z = 0.04;

export const DOCK_X = 0;
/** High enough that the Undo row stays inside a 52° desktop view. */
export const DOCK_Y = -0.30;
export const DOCK_Z = 0.06;
/** Desktop camera sits here on +Z, looking down −Z, so the timer and Undo both fit. */
export const DESKTOP_CAM_Z = 0.46;
/** Outer edge of the button row, including the plus button. */
export const DOCK_HALF = 0.23;

/** Cards in one column before the rest sit behind “+N more”. */
export const COLUMN_PAGE = 3;
export const CARD_W = 0.2;
export const CARD_H = 0.06;
export const CARD_SP = 0.068;
export const CARD_TOP = 0.07;
/** “+N more” sits below the column header and above the first card. */
export const MORE_Y = 0.14;
export const MORE_H = 0.04;
export const MORE_W = 0.14;

export function comfortLimit(z: number) {
  return (EYE - z) * Math.tan(COMFORT_RAD);
}

/** True when a panel centred at x with the given half-width stays inside the cone. */
export function fitsComfort(x: number, half: number, z: number) {
  return Math.abs(x) + half <= comfortLimit(z) + 1e-3;
}
