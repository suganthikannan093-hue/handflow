import * as THREE from 'three';

/** A desk plant that grows as tasks are finished. Stages 0–5: seed, sprout, leaves, bush, bud, bloom. */
export class Plant extends THREE.Group {
  private stem: THREE.Mesh;
  private leaves: THREE.Mesh[] = [];
  private flower: THREE.Mesh;
  stage = 0;
  /** 0–1 progress through the focus block that is running now. */
  focus = 0;
  constructor() {
    super();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.028, 14), new THREE.MeshStandardMaterial({ color: 0xc47a4a, roughness: 0.7 }));
    pot.position.y = 0.014; this.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 14), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    soil.position.y = 0.028; this.add(soil);
    this.stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x2f9e5b }));
    this.add(this.stem);
    this.flower = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), new THREE.MeshStandardMaterial({ color: 0xff6b8a }));
    this.add(this.flower);
    this.setStage(0);
  }
  setStage(stage: number) { this.setGrowth(stage, this.focus); }
  /** Stage from finished tasks, plus a visible stretch and bloom while focus is running. */
  setGrowth(stage: number, focus: number) {
    this.stage = Math.max(0, Math.min(5, Math.round(stage)));
    this.focus = Math.max(0, Math.min(1, focus));
    const grown = this.stage + this.focus * 0.9;
    const h = 0.028 + grown * 0.026;
    this.stem.visible = true;
    this.stem.scale.set(1, h / 0.08, 1);
    this.stem.position.y = 0.03 + h / 2;
    const need = Math.min(5, Math.ceil(grown));
    while (this.leaves.length < need) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshStandardMaterial({ color: this.leaves.length % 2 ? 0x7dffb3 : 0x3dcc7a }));
      leaf.scale.set(1.7, 0.45, 1); this.add(leaf); this.leaves.push(leaf);
    }
    this.leaves.forEach((leaf, i) => {
      leaf.visible = i < need;
      const a = i * 1.5;
      leaf.position.set(Math.cos(a) * 0.02, 0.045 + i * 0.014, Math.sin(a) * 0.02);
      leaf.scale.set(1.7, 0.45 + (i === need - 1 && this.focus > 0 ? this.focus * 0.35 : 0), 1);
    });
    const blooming = this.focus > 0.45 || this.stage >= 4;
    this.flower.visible = blooming;
    this.flower.scale.setScalar(this.stage >= 5 ? 1 : blooming ? 0.35 + this.focus * 0.75 : 0.45);
    this.flower.position.y = 0.034 + h;
    this.rotation.z = Math.sin(Date.now() / 380) * (this.focus > 0 ? 0.14 : 0);
  }
}
