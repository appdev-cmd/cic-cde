import * as THREE from "three";

type Surface = {
  source: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  start: number;
  count: number;
};

type Entry = { source: THREE.Mesh; start: number; count: number; included: boolean };

type Batch = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  entries: Set<Entry>;
  indices: Uint32Array;
  drawIndex: THREE.BufferAttribute;
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

  constructor(private readonly group: THREE.Group) {
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
      const isOpaque = (m: THREE.MeshStandardMaterial) => (m.userData.surfaceOpacity ?? 1) >= 1;
      const groups = source.geometry.groups.length
        ? source.geometry.groups
        : [{ start: 0, count: index.count, materialIndex: 0 }];
      for (const { start, count, materialIndex } of groups) {
        const material = materials[materialIndex ?? 0];
        if (!isOpaque(material)) continue;
        eligible.add(source);
        const key = JSON.stringify([
          source.userData.modelId, source.userData.storey,
          source.userData.relativeGeometry, slab, material.flatShading, material.userData.surfaceColor,
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
      entries.add({ source, start: indexOffset, count, included: false });
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
    const batch = { mesh, entries, indices, drawIndex };
    this.batches.add(batch);
    for (const entry of entries) {
      const list = this.sources.get(entry.source);
      const link = { batch, entry };
      if (list) list.push(link);
      else this.sources.set(entry.source, [link]);
    }
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
      let offset = 0;
      for (const entry of batch.entries) {
        if (!entry.included) continue;
        batch.drawIndex.array.set(batch.indices.subarray(entry.start, entry.start + entry.count), offset);
        offset += entry.count;
      }
      batch.mesh.geometry.setDrawRange(0, offset);
      batch.mesh.visible = offset > 0;
      if (offset) {
        batch.drawIndex.clearUpdateRanges();
        batch.drawIndex.addUpdateRange(0, offset);
        batch.drawIndex.needsUpdate = true;
      }
    }
    this.dirty.clear();
  }

  remove(source: THREE.Mesh) {
    const links = this.sources.get(source);
    if (!links) return;
    this.transparentParts.get(source)?.removeFromParent();
    this.transparentParts.delete(source);
    for (const { batch, entry } of links) {
      batch.entries.delete(entry);
      if (batch.entries.size === 0) {
        batch.mesh.removeFromParent();
        disposeViewerMesh(batch.mesh);
        this.batches.delete(batch);
        this.dirty.delete(batch);
      } else if (entry.included) this.dirty.add(batch);
    }
    this.sources.delete(source);
  }

  dispose() {
    for (const mesh of this.transparentParts.values()) mesh.removeFromParent();
    for (const batch of this.batches) {
      batch.mesh.removeFromParent();
      disposeViewerMesh(batch.mesh);
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
