import * as THREE from "three";
import type { CadWindow } from "@qabim/cad-viewer/overlay";

export class CadPlanCamera {
  readonly camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.01, 1000);
  private readonly right = new THREE.Vector3(1, 0, 0);
  private readonly target = new THREE.Vector3();
  private aspect = 1;

  setRotation(degrees: number) {
    const radians = THREE.MathUtils.degToRad(degrees);
    const cos = Math.cos(radians), sin = Math.sin(radians);
    this.right.set(cos, 0, -sin);
    this.camera.up.set(-sin, 0, -cos);
    const { x, y, z } = this.camera.position;
    this.camera.lookAt(this.target.set(x, y - 1, z));
  }

  resize(width: number, height: number) {
    this.aspect = width / height;
    this.camera.right = this.camera.top * this.aspect;
    this.camera.left = -this.camera.right;
    this.camera.updateProjectionMatrix();
  }

  fit(bounds: THREE.Box3) {
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const cos = Math.abs(this.right.x), sin = Math.abs(this.right.z);
    const height = Math.max(size.x * sin + size.z * cos, (size.x * cos + size.z * sin) / this.aspect, 1);
    this.camera.position.set(center.x, bounds.max.y + Math.max(10, size.y), center.z);
    this.camera.far = this.camera.position.y - bounds.min.y + 1;
    this.camera.top = height * 0.57;
    this.camera.bottom = -this.camera.top;
    this.camera.zoom = 1;
    this.resize(this.aspect, 1);
  }

  pan(dx: number, dy: number, height: number) {
    const metresPerPixel = this.viewport().height / height;
    this.camera.position
      .addScaledVector(this.right, -dx * metresPerPixel)
      .addScaledVector(this.camera.up, dy * metresPerPixel);
  }

  zoom(factor: number, x: number, y: number, height: number) {
    const oldSpan = this.viewport().height;
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, 0.001, 1000);
    this.camera.updateProjectionMatrix();
    const shift = (oldSpan - this.viewport().height) / height;
    this.camera.position.addScaledVector(this.right, x * shift).addScaledVector(this.camera.up, -y * shift);
  }

  viewport(): CadWindow {
    return {
      centerX: this.camera.position.x,
      centerY: -this.camera.position.z,
      width: (this.camera.right - this.camera.left) / this.camera.zoom,
      height: (this.camera.top - this.camera.bottom) / this.camera.zoom,
    };
  }
}
