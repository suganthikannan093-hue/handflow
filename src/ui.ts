import * as THREE from 'three';
// Canvas-texture panels: crisp rounded UI rendered to planes.
export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export class Panel extends THREE.Mesh {
  canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; w: number; h: number;
  constructor(w: number, h: number, ppm = 900, public draw: (g: CanvasRenderingContext2D, W: number, H: number, hover: boolean) => void = () => {}) {
    const canvas = document.createElement('canvas'); canvas.width = Math.round(w * ppm); canvas.height = Math.round(h * ppm);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    super(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: 0.02 }));
    this.canvas = canvas; this.g = canvas.getContext('2d')!; this.tex = tex; this.w = w; this.h = h; this.redraw(false);
  }
  hover = false;
  redraw(hover = this.hover) { this.hover = hover; const { g, canvas: c } = this; g.clearRect(0, 0, c.width, c.height); this.draw(g, c.width, c.height, hover); this.tex.needsUpdate = true; }
}
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', weight = 600, align: CanvasTextAlign = 'left', maxW?: number) {
  g.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  if (maxW) { // simple word wrap
    const words = s.split(' '); let line = ''; let yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += size * 1.2; } else line = t; } g.fillText(line, x, yy); return;
  }
  g.fillText(s, x, y);
}
export function button(label: string, w: number, h: number, color: number, icon = '') {
  return new Panel(w, h, 900, (g, W, H, hover) => {
    roundRect(g, 4, 4, W - 8, H - 8, H * 0.3); g.fillStyle = hover ? hex(color) : 'rgba(30,34,52,0.92)'; g.fill();
    g.lineWidth = 6; g.strokeStyle = hex(color); g.stroke();
    text(g, (icon ? icon + ' ' : '') + label, W / 2, H / 2, H * 0.4, hover ? '#0b0e1a' : '#fff', 700, 'center');
  });
}
