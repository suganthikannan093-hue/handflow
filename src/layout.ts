// Seated comfort: keep the main UI inside about 30° either side of centre.
// The workspace origin sits EYE metres in front of the head. A panel at local
// (x, _, z) is `EYE - z` metres away, so its outer edge must stay inside
// (EYE - z) * tan(30°).
//
// At 0.50 m the board already spans the cone, so the timer sits above it and
// the buttons sit below it. Side-by-side panels would cover the columns.

export const EYE = 0.5;
/** Workspace origin sits this far below the eyes, so the button row stays in view. */
export const EYE_DROP = 0.02;
export const COMFORT_RAD = Math.PI / 6;

export const BOARD_Z = -0.02;
export const COL_W = 0.15;
export const BOARD_W = COL_W * 3 + 0.03;
export const BOARD_H = 0.34;

export const TIMER_W = 0.22;
export const TIMER_H = 0.13;
export const TIMER_X = 0;
export const TIMER_Y = 0.255;
export const TIMER_Z = 0.02;

export const PLANT_X = -0.205;
export const PLANT_Y = 0.19;
export const PLANT_Z = 0.02;

export const DOCK_X = 0;
export const DOCK_Y = -0.235;
export const DOCK_Z = 0.06;
/** Outer edge of the button row, including the plus button. */
export const DOCK_HALF = 0.23;

export function comfortLimit(z: number) {
  return (EYE - z) * Math.tan(COMFORT_RAD);
}

/** True when a panel centred at x with the given half-width stays inside the cone. */
export function fitsComfort(x: number, half: number, z: number) {
  return Math.abs(x) + half <= comfortLimit(z) + 1e-3;
}
