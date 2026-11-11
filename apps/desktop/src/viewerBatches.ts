import * as THREE from "three";
import type { MotionRange } from "./viewerMotion.worker";

type Surface = {
  source: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  start: number;
  count: number;
};

type Entry = MotionRange & {
  source: THREE.Mesh;
  included: boolean;
  motion?: Pick<MotionRange, "start" | "count">;
};

type IndexGeometry = {
  geometry: THREE.BufferGeometry;
  indices: Uint32Array;
  drawIndex: THREE.BufferAttribute;
};

type Batch = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  entries: Set<Entry>;
  full: IndexGeometry;
  motion?: IndexGeometry;
  motionRequested?: boolean;
};

export function disposeViewerMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material.dispose();
}

export class ViewerBatches {
  private readonly pickGroup = new THREE.Group();
  private readonly batches = new Set<Batch>();
  private readonly dirty = new Set<Batch>();
  private readonly sources = new Map<THREE.Mesh, { batch: Batch; entry: Entry }[]>();
  private readonly transparentParts = new Map<THREE.Mesh, THREE.Mesh>();
  private readonly maskedMaterial = new THREE.MeshBasicMaterial({ visible: false });
  private readonly motionQueue: Batch[] = [];
  private motionWorker?: Worker;
  private motionJob?: { batch: Batch; entries: Entry[] };
  private motionTimer?: ReturnType<typeof setTimeout>;
  private motionUnavailable = false;
  private moving = false;

  constructor(private readonly group: THREE.Group, private readonly invalidate: () => void) {
    // Picking and bounds still use the original meshes, outside scene traversal.
    this.pickGroup.quaternion.copy(group.quaternion);
    this.pickGroup.updateMatrixWorld();
  }

  add(meshes: THREE.Mesh[]) {
    const grouped = new Map<string, Surface[]>();
    const mixed = new Map<THREE.Mesh, THREE.Material[]>();
    const eligible = new Set<THREE.Mesh>();
    for (const source of meshes) {
      const materials = (Array.isArray(source.material) ? source.material : [source.material]) as THREE.MeshStandardMaterial[];
      const index = source.geometry.index;
      const slab = source.userData.ifcClass === "IfcSlab";
      if (!index?.count) continue;
      const isOpaque = (m: THREE.MeshStandardMaterial) => (m.userData.surfaceOpacity ?? (slab ? 0.78 : 1)) >= 1;
      const groups = source.geometry.groups.length
        ? source.geometry.groups
        : [{ start: 0, count: index.count, materialIndex: 0 }];
      for (const { start, count, materialIndex } of groups) {
        const material = materials[materialIndex ?? 0];
        if (!isOpaque(material)) continue;
        eligible.add(source);
        const key = JSON.stringify([
          source.userData.modelId, source.userData.storey,
          source.userData.relativeGeometry, slab, material.userData.surfaceColor,
        ]);
        const surface = { source, material, start, count };
        const bucket = grouped.get(key);
        if (bucket) bucket.push(surface);
        else grouped.set(key, [surface]);
      }
      if (eligible.has(source) && materials.some((material) => !isOpaque(material))) {
        mixed.set(source, materials.map((material) => isOpaque(material) ? this.maskedMaterial : material));
      }
    }
    const opaqueSurfaces = [...grouped.values()].reduce((sum, surfaces) => sum + surfaces.length, 0);
    if (grouped.size >= opaqueSurfaces) return;
    for (const surfaces of grouped.values()) this.merge(surfaces);
    for (const [source, materials] of mixed) {
      // Draw just the remaining transparent groups per object. The mesh shares
      // the original buffers and material instances used for picking and fades.
      const mesh = new THREE.Mesh(source.geometry, materials);
      mesh.receiveShadow = source.receiveShadow;
      this.transparentParts.set(source, mesh);
      this.group.add(mesh);
    }
    for (const source of eligible) this.sync(source);
  }

  private merge(surfaces: Surface[]) {
    const vertices = surfaces.reduce((sum, { source }) => sum + source.geometry.attributes.position.count, 0);
    const indexCount = surfaces.reduce((sum, { count }) => sum + count, 0);
    const positions = new Float32Array(vertices * 3);
    const normals = new Float32Array(vertices * 3);
    const indices = new Uint32Array(indexCount);
    const entries = new Set<Entry>();
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const { source, start, count } of surfaces) {
      const { attributes, index } = source.geometry;
      positions.set(attributes.position.array, vertexOffset * 3);
      normals.set(attributes.normal.array, vertexOffset * 3);
      for (let i = 0; i < count; i++) {
        indices[indexOffset + i] = index!.array[start + i] + vertexOffset;
      }
      entries.add({
        source, start: indexOffset, count, included: false,
        vertexStart: vertexOffset, vertexCount: attributes.position.count,
      });
      vertexOffset += attributes.position.count;
      indexOffset += count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    const drawIndex = new THREE.BufferAttribute(new Uint32Array(indexCount), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(drawIndex);
    geometry.setDrawRange(0, 0);
    geometry.computeBoundingSphere();
    const first = surfaces[0];
    const material = first.material.clone();
    material.clippingPlanes = first.material.clippingPlanes;
    material.color.set(first.material.userData.surfaceColor);
    material.emissive.set(0);
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    material.wireframe = false;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = first.source.userData.ifcClass !== "IfcSlab";
    mesh.receiveShadow = true;
    mesh.visible = false;
    this.group.add(mesh);
    const batch = { mesh, entries, full: { geometry, indices, drawIndex } };
    this.batches.add(batch);
    for (const entry of entries) {
      const list = this.sources.get(entry.source);
      const link = { batch, entry };
      if (list) list.push(link);
      else this.sources.set(entry.source, [link]);
    }
  }

  prepareMotionGeometry() {
    if (this.motionUnavailable || typeof Worker === "undefined") return;
    const pending = [...this.batches].filter((batch) =>
      !batch.motionRequested && batch.full.indices.length >= 3_000 &&
      [...batch.entries].some((entry) => entry.included),
    ).sort((a, b) => b.full.indices.length - a.full.indices.length);
    for (const batch of pending) batch.motionRequested = true;
    this.motionQueue.push(...pending);
    this.scheduleMotionJob();
  }

  setMoving(moving: boolean) {
    if (this.moving === moving) return;
    this.moving = moving;
    for (const batch of this.batches) this.useMotionGeometry(batch);
    this.invalidate();
  }

  private useMotionGeometry(batch: Batch) {
    batch.mesh.geometry = (this.moving && batch.motion ? batch.motion : batch.full).geometry;
  }

  private scheduleMotionJob() {
    if (this.motionTimer !== undefined || this.motionJob || !this.motionQueue.length) return;
    this.motionTimer = setTimeout(() => {
      this.motionTimer = undefined;
      this.startMotionJob();
    }, 4);
  }

  private startMotionJob() {
    while (this.motionQueue.length) {
      const batch = this.motionQueue.shift()!;
      if (!this.batches.has(batch)) continue;
      const entries = [...batch.entries];
      try {
        if (!this.motionWorker) {
          this.motionWorker = new Worker(new URL("./viewerMotion.worker.ts", import.meta.url), { type: "module" });
          this.motionWorker.onmessage = ({ data }) => this.finishMotionJob(data);
          this.motionWorker.onerror = () => this.stopMotionWorker();
        }
        const positions = new Float32Array(batch.full.geometry.attributes.position.array);
        const indices = batch.full.indices.slice();
        const ranges = entries.map(({ start, count, vertexStart, vertexCount }) => ({
          start, count, vertexStart, vertexCount,
        }));
        this.motionJob = { batch, entries };
        this.motionWorker.postMessage({ positions, indices, ranges }, [positions.buffer, indices.buffer]);
      } catch {
        this.stopMotionWorker();
      }
      return;
    }
  }

  private finishMotionJob(data: { indices: Uint32Array; counts: number[] } | null) {
    const job = this.motionJob;
    this.motionJob = undefined;
    if (data && job && this.batches.has(job.batch)) {
      const { batch, entries } = job;
      let start = 0;
      for (const [i, entry] of entries.entries()) {
        const count = data.counts[i];
        entry.motion = { start, count };
        start += count;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", batch.full.geometry.attributes.position);
      geometry.setAttribute("normal", batch.full.geometry.attributes.normal);
      geometry.boundingSphere = batch.full.geometry.boundingSphere;
      const drawIndex = new THREE.BufferAttribute(new Uint32Array(data.indices.length), 1).setUsage(THREE.DynamicDrawUsage);
      geometry.setIndex(drawIndex);
      geometry.setDrawRange(0, 0);
      batch.motion = { geometry, indices: data.indices, drawIndex };
      this.pack(batch.entries, batch.motion, true);
      this.useMotionGeometry(batch);
      if (this.moving) this.invalidate();
    }
    this.scheduleMotionJob();
  }

  private stopMotionWorker() {
    clearTimeout(this.motionTimer);
    this.motionTimer = undefined;
    this.motionWorker?.terminate();
    this.motionWorker = undefined;
    this.motionQueue.length = 0;
    this.motionJob = undefined;
    this.motionUnavailable = true;
  }

  sync(source: THREE.Mesh) {
    const links = this.sources.get(source);
    if (!links) return;
    const individual = source.visible && (source.userData.batchFallback || source.userData.scopeFading);
    const included = source.visible && !individual;
    const parent = individual ? this.group : this.pickGroup;
    if (source.parent !== parent) parent.add(source);
    source.updateWorldMatrix(true, false);
    const transparent = this.transparentParts.get(source);
    if (transparent) {
      transparent.position.copy(source.position);
      transparent.quaternion.copy(source.quaternion);
      transparent.castShadow = source.castShadow;
      transparent.visible = included;
    }
    for (const { batch, entry } of links) {
      batch.mesh.position.copy(source.position);
      batch.mesh.quaternion.copy(source.quaternion);
      if (entry.included !== included) {
        entry.included = included;
        this.dirty.add(batch);
      }
    }
  }

  flush() {
    for (const batch of this.dirty) {
      const fullCount = this.pack(batch.entries, batch.full, false);
      batch.mesh.visible = fullCount > 0;
      if (batch.motion) this.pack(batch.entries, batch.motion, true);
    }
    this.dirty.clear();
  }

  private pack(entries: Set<Entry>, view: IndexGeometry, motion: boolean) {
    let offset = 0;
    for (const entry of entries) {
      if (!entry.included) continue;
      const range = motion ? entry.motion : entry;
      if (!range) continue;
      view.drawIndex.array.set(view.indices.subarray(range.start, range.start + range.count), offset);
      offset += range.count;
    }
    view.geometry.setDrawRange(0, offset);
    if (offset) {
      view.drawIndex.clearUpdateRanges();
      view.drawIndex.addUpdateRange(0, offset);
      view.drawIndex.needsUpdate = true;
    }
    return offset;
  }

  private disposeBatch(batch: Batch) {
    batch.mesh.removeFromParent();
    batch.full.geometry.dispose();
    batch.motion?.geometry.dispose();
    batch.mesh.material.dispose();
  }

  remove(source: THREE.Mesh) {
    const links = this.sources.get(source);
    if (!links) return;
    this.transparentParts.get(source)?.removeFromParent();
    this.transparentParts.delete(source);
    for (const { batch, entry } of links) {
      batch.entries.delete(entry);
      if (batch.entries.size === 0) {
        this.disposeBatch(batch);
        this.batches.delete(batch);
        this.dirty.delete(batch);
      } else if (entry.included) this.dirty.add(batch);
    }
    this.sources.delete(source);
  }

  dispose() {
    this.stopMotionWorker();
    for (const mesh of this.transparentParts.values()) mesh.removeFromParent();
    for (const batch of this.batches) {
      this.disposeBatch(batch);
    }
    for (const source of this.sources.keys()) {
      if (source.parent === this.pickGroup) disposeViewerMesh(source);
    }
    this.batches.clear();
    this.sources.clear();
    this.dirty.clear();
    this.transparentParts.clear();
    this.maskedMaterial.dispose();
  }
}
