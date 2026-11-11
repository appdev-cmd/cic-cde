import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { geometryBuffer, geometryViews } from "./geometry";
import { spaceKey } from "./spatial";
import type { BimModel, BimElement, ViewerApi, ViewMode } from "./types";

interface Props {
  loadAttempt: number;
  onGeometryProgress: (progress: { done: number; total: number }) => void;
  elements: BimElement[];
  models: BimModel[];
  onGeometryLoading: (loading: boolean) => void;
  onGeometryError: (message: string) => void;
  onGeometryReady: (stats: { durationMs: number; added: number }) => void;
  hidden: Set<string>;
  floor: string;
  room: string | null;
  fitRequest: number;
  selected: string | null;
  focusIds: string[];
  focusPoint: [number, number, number] | null;
  mode: ViewMode;
  section: boolean;
  measure: boolean;
  onSelect: (id: string | null) => void;
  onMeasure: (distance: number) => void;
}
type SelectionFade = {
  includesFullModel: boolean;
  startOpacity: Map<THREE.Mesh, number>;
  meshes: Set<THREE.Mesh>;
  startedAt: number | null;
  progress: number;
};

interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  group: THREE.Group;
  marker: THREE.Mesh;
  meshes: Map<string, THREE.Mesh>;
  selectionFade: SelectionFade | null;
  prepareSelectionFade: (props: Props) => void;
  fit: (mode?: "selection") => void;
  cancelFit: () => void;
  invalidate: () => void;
}

function applyAppearance(r: Runtime, props: Props) {
  r.prepareSelectionFade(props);
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 17.8);
  const models = new Map(props.models.map((model) => [model.id, model]));
  const elements = new Map(props.elements.map((element) => [element.id, element]));
  for (const mesh of r.meshes.values()) {
    const element = elements.get(mesh.userData.elementId);
    if (element) {
      mesh.userData.storey = element.storey;
      mesh.userData.spaceKey = spaceKey(element);
    }
    styleMesh(r, mesh, props, models.get(mesh.userData.modelId), plane);
  }
  r.renderer.shadowMap.needsUpdate = true;
  r.invalidate();
}

function meshOpacity(r: Runtime, mesh: THREE.Mesh) {
  const target = mesh.userData.inScope ? 1 : 0;
  const fade = r.selectionFade;
  const start = fade?.startOpacity.get(mesh) ?? 0;
  if (fade && !mesh.userData.modelHidden && start !== target) {
    fade.meshes.add(mesh);
    return { opacity: THREE.MathUtils.lerp(start, target, fade.progress), fading: true };
  }
  return { opacity: target, fading: false };
}

function applyMeshOpacity(mesh: THREE.Mesh, opacity: number, fading: boolean) {
  mesh.userData.scopeOpacity = opacity;
  mesh.visible = opacity > 0;
  mesh.castShadow = !fading && mesh.userData.ifcClass !== "IfcSlab";
}

function applyMaterialOpacity(material: THREE.MeshStandardMaterial, opacity: number, fading: boolean) {
  material.opacity = material.userData.baseOpacity * (fading ? opacity : 1);
  const transparent = fading || material.opacity < 1;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
  material.depthWrite = !fading && material.opacity >= 0.5;
}

function updateSelectionFade(r: Runtime, progress: number) {
  const fade = r.selectionFade;
  if (!fade) return;
  fade.progress = progress;
  if (progress === 1) {
    r.selectionFade = null;
    r.renderer.shadowMap.needsUpdate = true;
  }
  for (const mesh of fade.meshes) {
    if (r.meshes.get(mesh.userData.elementId) !== mesh) continue;
    const { opacity, fading } = meshOpacity(r, mesh);
    applyMeshOpacity(mesh, opacity, fading);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials as THREE.MeshStandardMaterial[]) {
      applyMaterialOpacity(material, opacity, fading);
    }
  }
  r.invalidate();
}

function styleMesh(r: Runtime, mesh: THREE.Mesh, props: Props, model: BimModel | undefined, plane: THREE.Plane) {
  const id = mesh.userData.elementId;
  const origin = mesh.userData.relativeGeometry
    ? (model?.renderOrigin ?? [0, 0, 0])
    : [0, 0, 0];
  const offset = model?.transform?.translation ?? [0, 0, 0];
  const radians = ((model?.transform?.rotationZDegrees ?? 0) * Math.PI) / 180;
  const c = Math.cos(radians),
    s = Math.sin(radians);
  mesh.position.set(
    c * origin[0] - s * origin[1] + offset[0],
    s * origin[0] + c * origin[1] + offset[1],
    origin[2] + offset[2],
  );
  mesh.rotation.z = radians;
  mesh.userData.modelHidden = props.hidden.has(mesh.userData.modelId);
  mesh.userData.inScope =
    !mesh.userData.modelHidden &&
    (props.floor === "all" || mesh.userData.storey === props.floor) &&
    (props.room === null || mesh.userData.spaceKey === props.room);
  const { opacity, fading } = meshOpacity(r, mesh);
  applyMeshOpacity(mesh, opacity, fading);
  const selected = id === props.selected;
  const a = props.focusIds[0] === id,
    b = props.focusIds[1] === id;
  const highlight = selected ? "#dc8950" : a ? "#d96957" : b ? "#e3af44" : undefined;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials as THREE.MeshStandardMaterial[]) {
    const slab = mesh.userData.ifcClass === "IfcSlab";
    const xrayOpacity = slab ? 0.2 : mesh.userData.ifcClass === "IfcWall" ? 0.4 : 0.9;
    const surfaceOpacity = material.userData.surfaceOpacity ?? (slab ? 0.78 : 1);
    material.color.set(highlight ?? material.userData.surfaceColor);
    material.emissive.set(selected ? "#47210e" : highlight ? "#351c0a" : "#000000");
    material.emissiveIntensity = 0.18;
    material.wireframe = props.mode === "wireframe";
    material.userData.baseOpacity = props.mode === "xray" ? (highlight ? 1 : xrayOpacity) : surfaceOpacity;
    applyMaterialOpacity(material, opacity, fading);
    material.clippingPlanes = props.section ? [plane] : [];
    if (
      material.userData.mode !== props.mode ||
      material.userData.section !== props.section
    ) {
      material.needsUpdate = true;
      Object.assign(material.userData, {
        mode: props.mode,
        section: props.section,
      });
    }
  }
}

function surfaceMaterial(color: string, opacity?: number) {
  const material = new THREE.MeshStandardMaterial({
    color, roughness: 0.82, metalness: 0, side: THREE.DoubleSide,
  });
  material.userData = { surfaceColor: color, surfaceOpacity: opacity };
  return material;
}

function focusView(r: Runtime, props: Props) {
  r.marker.visible = Boolean(props.focusPoint && props.focusIds.length);
  if (!props.focusIds.length) return;
  r.cancelFit();
  if (props.focusPoint) {
    const point = r.group.localToWorld(new THREE.Vector3(...props.focusPoint));
    r.marker.position.copy(point);
    r.controls.target.copy(point);
    r.camera.position.copy(point).add(new THREE.Vector3(7, 4, 7));
    r.controls.update();
    return;
  }
  const box = new THREE.Box3();
  for (const id of props.focusIds) {
    const mesh = r.meshes.get(id);
    if (mesh) box.expandByObject(mesh);
  }
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const distance = Math.max(7, box.getSize(new THREE.Vector3()).length() * 0.8);
  r.controls.target.copy(center);
  r.camera.position.copy(center).add(new THREE.Vector3(distance * 0.8, distance * 0.55, distance * 0.9));
  r.controls.update();
}

export default forwardRef<ViewerApi, Props>(function Viewer(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const cancelLoad = useRef<() => void>(() => {});
  const activeLoad = useRef<{
    selectionToFit?: Pick<Props, "floor" | "room">;
  } | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  useImperativeHandle(
    ref,
    () => ({
      cancelLoad() {
        cancelLoad.current();
      },
      fit() {
        if (activeLoad.current) activeLoad.current.selectionToFit = undefined;
        runtime.current?.fit();
      },
      top() {
        if (activeLoad.current) activeLoad.current.selectionToFit = undefined;
        const r = runtime.current;
        if (!r) return;
        r.cancelFit();
        const c = r.controls.target;
        const distance = Math.max(1, r.camera.position.distanceTo(c));
        r.camera.position.set(c.x + 0.01, c.y + distance, c.z);
        r.controls.update();
      },
      capture() {
        const r = runtime.current;
        if (!r) return;
        r.renderer.render(r.scene, r.camera);
        const a = document.createElement("a");
        a.download = "CIC-CDE-view.png";
        a.href = r.renderer.domElement.toDataURL("image/png");
        a.click();
      },
    }),
    [],
  );

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const background = getComputedStyle(host).getPropertyValue("--viewer-background").trim();
    scene.background = new THREE.Color(background || "#dceefa");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    const initialDirection = new THREE.Vector3(0.94, 0.63, 1.02);
    camera.position.copy(initialDirection);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      reversedDepthBuffer: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.maxDistance = 180;
    controls.minDistance = 1;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb2b8, 1.35));
    const light = new THREE.DirectionalLight(0xffffff, 1.65);
    light.position.set(12, 50, 22);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      far: 150,
    });
    light.shadow.bias = -0.001;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-30, 15, -10);
    scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.ShadowMaterial({ opacity: 0.11 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(120, 40, 0xd3d9e3, 0xe1e6ed);
    grid.position.set(15, -0.1, -10);
    scene.add(grid);
    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;
    scene.add(group);
    const meshes = new Map<string, THREE.Mesh>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fitDuration = 400;
    const easedProgress = (now: number, startedAt: number) => {
      const progress = THREE.MathUtils.clamp((now - startedAt) / fitDuration, 0, 1);
      return progress * progress * (3 - 2 * progress);
    };
    let hasFramed = false;
    let lastSelection = { floor: callbacks.current.floor, room: callbacks.current.room, request: callbacks.current.fitRequest };
    const prepareSelectionFade = (next: Props) => {
      const previous = lastSelection;
      lastSelection = { floor: next.floor, room: next.room, request: next.fitRequest };
      if (previous.floor === next.floor && previous.room === next.room) return;
      if (
        previous.request !== next.fitRequest &&
        hasFramed &&
        !reducedMotion.matches
      ) {
        const startOpacity = new Map<THREE.Mesh, number>();
        for (const mesh of meshes.values()) {
          if (mesh.visible) startOpacity.set(mesh, mesh.userData.scopeOpacity);
        }
        if (startOpacity.size) {
          r.selectionFade = {
            includesFullModel: previous.floor === "all" || next.floor === "all",
            startOpacity,
            meshes: new Set(),
            startedAt: null,
            progress: 0,
          };
          return;
        }
      }
      updateSelectionFade(r, 1);
    };
    let flight: {
      startedAt: number;
      fromTarget: THREE.Vector3;
      fromPosition: THREE.Vector3;
      toTarget: THREE.Vector3;
      toPosition: THREE.Vector3;
      near: number;
      far: number;
      maxDistance: number;
    } | null = null;
    const cancelFit = () => {
      flight = null;
      updateSelectionFade(r, 1);
    };
    const fit = (mode?: "selection") => {
      if (mode !== "selection") cancelFit();
      const startedAt = performance.now();
      const startingFade = r.selectionFade?.startedAt === null;
      if (r.selectionFade && startingFade) r.selectionFade.startedAt = startedAt;
      const bounds = new THREE.Box3();
      for (const mesh of meshes.values()) {
        if (mesh.userData.inScope) bounds.union(new THREE.Box3().setFromObject(mesh));
      }
      if (bounds.isEmpty()) {
        flight = null;
        return;
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3()).length();
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
      const distance = Math.max(
        1,
        (size * 0.55) / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)),
      );
      const direction = mode === "selection"
        ? camera.position.clone().sub(controls.target)
        : initialDirection.clone();
      if (!direction.lengthSq()) direction.copy(initialDirection);
      const position = center.clone().add(direction.setLength(distance));
      const near = Math.max(0.01, size / 2000);
      const maxDistance = Math.max(180, distance * 5);
      const far = Math.max(1000, maxDistance * 2);

      if (mode === "selection" && hasFramed && !reducedMotion.matches) {
        if (
          !startingFade && flight && flight.toTarget.equals(center) &&
          flight.toPosition.distanceToSquared(position) < 1e-8
        ) return;

        const fromTarget = controls.target.clone();
        const fromPosition = camera.position.clone();

        // Clear orbit damping without changing the starting camera pose.
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = damping;
        controls.target.copy(fromTarget);
        camera.position.copy(fromPosition);

        flight = {
          startedAt,
          fromTarget,
          fromPosition,
          toTarget: center,
          toPosition: position,
          near,
          far,
          maxDistance,
        };
        controls.maxDistance = Math.max(controls.maxDistance, maxDistance);
        camera.near = Math.min(camera.near, near);
        camera.far = Math.max(camera.far, far);
      } else {
        flight = null;
        controls.maxDistance = maxDistance;
        controls.target.copy(center);
        camera.position.copy(position);
        camera.near = near;
        camera.far = far;
        controls.update();
      }
      hasFramed = true;
      camera.updateProjectionMatrix();
      invalidate();
    };
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      new THREE.MeshBasicMaterial({
        color: "#d96a42",
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    marker.visible = false;
    marker.renderOrder = 100;
    scene.add(marker);
    let dirty = true;
    const invalidate = () => {
      dirty = true;
    };
    controls.addEventListener("change", invalidate);
    controls.addEventListener("start", cancelFit);
    const r: Runtime = {
      scene,
      camera,
      renderer,
      controls,
      group,
      marker,
      meshes,
      selectionFade: null,
      prepareSelectionFade,
      fit,
      cancelFit,
      invalidate,
    };
    runtime.current = r;
    const resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      invalidate();
    });
    resize.observe(host);
    let frame = 0;
    let disposed = false;
    let lastFrameAt = performance.now();
    const render = (now: number) => {
      if (disposed) return;
      const fade = r.selectionFade;
      if (fade?.includesFullModel && fade.startedAt != null) {
        // Keep intermediate frames when rendering the full model takes longer.
        const frameDelay = now - Math.max(lastFrameAt, fade.startedAt) - fitDuration / 4;
        if (frameDelay > 0) {
          fade.startedAt += frameDelay;
          if (flight) flight.startedAt += frameDelay;
        }
      }
      lastFrameAt = now;
      if (flight) {
        const eased = easedProgress(now, flight.startedAt);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
        if (eased === 1) {
          camera.near = flight.near;
          camera.far = flight.far;
          controls.maxDistance = flight.maxDistance;
          camera.updateProjectionMatrix();
          flight = null;
        }
        invalidate();
      }
      const fadeStart = r.selectionFade?.startedAt;
      if (fadeStart != null) updateSelectionFade(r, easedProgress(now, fadeStart));
      const changed = controls.update();
      if (dirty || changed) {
        renderer.render(scene, camera);
        dirty = false;
      }
      frame = requestAnimationFrame(render);
    };
    render(performance.now());
    const raycaster = new THREE.Raycaster();
    let startX = 0,
      startY = 0;
    let firstPoint: THREE.Vector3 | null = null;
    const down = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (
        Math.hypot(e.clientX - startX, e.clientY - startY) > 5 ||
        e.button !== 0
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hits = raycaster.intersectObjects(
        [...meshes.values()].filter((m) => m.visible && m.userData.inScope),
        false,
      );
      const hit = hits.find(
        (h) => !callbacks.current.section || h.point.y <= 17.8,
      );
      if (callbacks.current.measure && hit) {
        if (firstPoint) {
          callbacks.current.onMeasure(firstPoint.distanceTo(hit.point));
          firstPoint = null;
        } else firstPoint = hit.point.clone();
        return;
      }
      firstPoint = null;
      callbacks.current.onSelect(hit?.object.userData.elementId ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.removeEventListener("start", cancelFit);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    let cancelled = false;
    cancelLoad.current = () => {
      cancelled = true;
      activeLoad.current = null;
      callbacks.current.onGeometryLoading(false);
    };
    const models = new Map(props.models.map((model) => [model.id, model]));
    const assets = new Map(props.models.flatMap((model) =>
      (model.geometryAssets ?? []).map((asset) => [asset.id, { asset, synthetic: model.synthetic }] as const),
    ));
    const assetIdOf = (e: BimElement) =>
      e.geometry?.assetId ?? models.get(e.modelId)?.geometryAssets?.[e.geometry?.assetIndex ?? 0]?.id;
    const geometryKey = (e: BimElement) => {
      if (!e.geometry) return "legacy";
      return [
        assetIdOf(e),
        e.geometry.vertexOffset,
        e.geometry.vertexCount,
        e.geometry.indexOffset,
        e.geometry.indexCount,
        e.color,
        e.surfaceOpacity,
        JSON.stringify(e.surfaceMaterials),
      ].join(":");
    };
    const keys = new Map(props.elements.map((e) => [e.id, geometryKey(e)]));
    for (const [id, mesh] of r.meshes) {
      if (mesh.userData.geometryKey !== keys.get(id)) {
        r.group.remove(mesh);
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => material.dispose());
        r.meshes.delete(id);
      }
    }
    const fresh = props.elements.filter((e) => !props.hidden.has(e.modelId) && !r.meshes.has(e.id));
    if (!fresh.length) {
      applyAppearance(r, callbacks.current);
      callbacks.current.onGeometryLoading(false);
      return;
    }
    const loadState: NonNullable<typeof activeLoad.current> = {};
    activeLoad.current = loadState;
    callbacks.current.onGeometryLoading(true);
    let done = 0;
    callbacks.current.onGeometryProgress({ done, total: fresh.length });
    const started = performance.now();
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 17.8);
    const fitInitial = ![...r.meshes.values()].some((mesh) => mesh.visible);
    let lastProgress = started;
    let published = false;
    let movedCamera = false;
    const markCameraMoved = () => {
      movedCamera = true;
      loadState.selectionToFit = undefined;
    };
    r.controls.addEventListener("start", markCameraMoved);
    const publish = () => {
      lastProgress = performance.now();
      callbacks.current.onGeometryProgress({ done, total: fresh.length });
      if (!published) {
        published = true;
        if (fitInitial && !movedCamera && !loadState.selectionToFit && !callbacks.current.focusIds.length) {
          r.fit();
        }
        requestAnimationFrame(() => {
          if (!cancelled) performance.measure("qabim-geometry-first-frame", { start: started });
        });
      }
      r.invalidate();
    };
    const groups = new Map<string, BimElement[]>();
    for (const e of fresh) {
      const key = e.geometry
        ? assetIdOf(e) ?? "missing-asset"
        : "legacy";
      const group = groups.get(key);
      if (group) group.push(e);
      else groups.set(key, [e]);
    }
    const tasks = [...groups.entries()];
    let cursor = 0;
    const load = async () => {
      while (!cancelled && cursor < tasks.length) {
        const [assetId, elements] = tasks[cursor++];
        const entry = assets.get(assetId);
        const buffer =
          assetId === "legacy"
            ? null
            : await geometryBuffer(
                assetId,
                entry?.synthetic ? entry.asset.file : undefined,
                entry?.asset.storagePath,
              );
        if (cancelled) return;
        let sliceStarted = performance.now();
        for (const e of elements) {
          if (cancelled) return;
          if (r.meshes.has(e.id)) continue;
          const raw =
            e.geometry && buffer
              ? geometryViews(buffer, e.geometry)
              : {
                  vertices: new Float32Array(e.vertices ?? []),
                  indices: new Uint32Array(e.indices ?? []),
                };
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(raw.vertices, 3),
          );
          geometry.setIndex(new THREE.BufferAttribute(raw.indices, 1));
          geometry.computeVertexNormals();
          const material = e.surfaceMaterials?.length
            ? e.surfaceMaterials.map(({ start, count, color, opacity }, index) => {
                geometry.addGroup(start, count, index);
                return surfaceMaterial(color, opacity);
              })
            : surfaceMaterial(e.color, e.surfaceOpacity);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData = {
            elementId: e.id,
            modelId: e.modelId,
            storey: e.storey,
            spaceKey: spaceKey(e),
            ifcClass: e.ifcClass,
            relativeGeometry: Boolean(e.geometry),
            geometryKey: keys.get(e.id),
          };
          mesh.receiveShadow = true;
          styleMesh(r, mesh, callbacks.current, models.get(e.modelId), plane);
          r.group.add(mesh);
          r.meshes.set(e.id, mesh);
          done++;
          if ((!published && done >= 64) || performance.now() - lastProgress >= 150) publish();
          if (performance.now() - sliceStarted >= 12) {
            // Let input and painting run without waiting on a refresh frame for each batch.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            sliceStarted = performance.now();
          }
        }
        if (!cancelled && !published && done) publish();
      }
    };
    Promise.allSettled(
      Array.from({ length: Math.min(4, tasks.length) }, () => load()),
    )
      .then((results) => {
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        if (cancelled) return;
        publish();
        r.renderer.shadowMap.needsUpdate = true;
        const current = callbacks.current;
        const selection = loadState.selectionToFit;
        if (
          selection?.floor === current.floor &&
          selection.room === current.room &&
          !current.focusIds.length
        ) {
          r.fit("selection");
        } else if (!movedCamera) {
          if (current.focusIds.length) focusView(r, current);
          else if (fitInitial) r.fit();
        }
        performance.measure("qabim-geometry-load", {
          start: started,
          end: performance.now(),
          detail: { added: fresh.length, total: r.meshes.size },
        });
        callbacks.current.onGeometryReady({
          durationMs: performance.now() - started,
          added: fresh.length,
        });
      })
      .catch((error) => {
        if (!cancelled) callbacks.current.onGeometryError(String(error));
      })
      .finally(() => {
        r.controls.removeEventListener("start", markCameraMoved);
        if (!cancelled) {
          activeLoad.current = null;
          callbacks.current.onGeometryLoading(false);
        }
      });
    return () => {
      cancelled = true;
      activeLoad.current = null;
      r.controls.removeEventListener("start", markCameraMoved);
    };
  }, [props.elements, props.models, props.hidden, props.loadAttempt]);

  useEffect(() => {
    const r = runtime.current;
    if (!r) return;
    applyAppearance(r, props);
  }, [
    props.elements,
    props.models,
    props.hidden,
    props.floor,
    props.room,
    props.selected,
    props.focusIds,
    props.mode,
    props.section,
  ]);

  useEffect(() => {
    if (!props.fitRequest) return;
    const { floor, room } = callbacks.current;
    if (activeLoad.current) activeLoad.current.selectionToFit = { floor, room };
    runtime.current?.fit("selection");
  }, [props.fitRequest]);

  useEffect(() => {
    const r = runtime.current;
    if (r) focusView(r, props);
  }, [props.focusIds, props.focusPoint]);

  return (
    <div
      className={`three-view ${props.measure ? "measuring" : ""}`}
      ref={container}
      aria-label="Mô hình BIM 3D tương tác"
    />
  );
});
