import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as FRAG from '@thatopen/fragments';
import { Loader2 } from 'lucide-react';
import JSZip from 'jszip';
// @ts-ignore
import workerUrl from '@thatopen/fragments/worker?url';

// Giải nén nếu là .ifczip/.zip (file IFC nén); trả về buffer IFC thô để nạp.
export const extractIfcBuffer = async (buffer: Uint8Array, name = ''): Promise<Uint8Array> => {
  const isZip = /\.(ifczip|zip)$/i.test(name) || (buffer[0] === 0x50 && buffer[1] === 0x4b); // 'PK'
  if (!isZip) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  // Tìm entry .ifc đầu tiên trong zip
  const entry = Object.keys(zip.files).find(p => /\.ifc$/i.test(p) && !zip.files[p].dir);
  if (!entry) throw new Error('Không tìm thấy tệp .ifc bên trong file nén.');
  return zip.files[entry].async('uint8array');
};

// Helper to extract properties from a ThatOpen Item object
export const extractItemProperties = (item: any, id: number) => {
  if (!item) return null;
  const attrs = item._attributes || {};
  const props: any = {
    expressID: id,
    expressId: id,
    Name: attrs.Name ? (attrs.Name.value !== undefined ? attrs.Name.value : attrs.Name) : `${item._category || 'Element'} [ID: ${id}]`,
    ObjectType: attrs.ObjectType ? (attrs.ObjectType.value !== undefined ? attrs.ObjectType.value : attrs.ObjectType) : item._category || 'IFC ELEMENT',
    GlobalId: attrs.GlobalId ? (attrs.GlobalId.value !== undefined ? attrs.GlobalId.value : attrs.GlobalId) : 'N/A',
    type: item._category || 'IFC ELEMENT'
  };

  for (const key in attrs) {
    if (!['Name', 'ObjectType', 'GlobalId'].includes(key)) {
      const val = attrs[key];
      props[key] = val && val.value !== undefined ? val.value : val;
    }
  }
  return props;
};

// Quantity Take-Off (QTO) aggregated per IFC category
export interface QtoRow {
  category: string;
  count: number;
  area: number;    // m2
  volume: number;  // m3
  length: number;  // m
}

// Dòng QTO chi tiết: gắn kèm mô hình (hạng mục) để lọc theo bộ môn/hạng mục/cấu kiện
export interface QtoDetailRow extends QtoRow {
  modelId: string;
  modelName: string;
}

export interface QtoResult {
  rows: QtoRow[];           // gộp theo lớp cấu kiện (toàn bộ mô hình) — tương thích cũ
  detail: QtoDetailRow[];   // chi tiết theo (mô hình × lớp cấu kiện) — phục vụ bộ lọc
  totalElements: number;
  elementsWithQuantities: number;
}

// Pull a numeric value out of an ItemAttribute-like object ({value} | number)
const attrNum = (a: any): number | null => {
  if (a === null || a === undefined) return null;
  const v = typeof a === 'object' && 'value' in a ? a.value : a;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const attrStr = (a: any): string => {
  if (a === null || a === undefined) return '';
  const v = typeof a === 'object' && 'value' in a ? a.value : a;
  return String(v ?? '');
};

/**
 * Extract Quantity Take-Off from a Fragments model by reading IFC quantity sets
 * (Qto_*BaseQuantities) attached to elements via the IsDefinedBy relation.
 * Defensive: classifies each quantity by its *Value field name (Volume/Area/Length).
 */
export const extractQto = async (
  model: any, modelId = '', modelName = ''
): Promise<{ detail: QtoDetailRow[]; total: number; withQ: number }> => {
  const idsSet = await model.getLocalIds();
  const ids = Array.from(idsSet) as number[];
  const items = await model.getItemsData(ids, {
    attributesDefault: true,
    relations: {
      IsDefinedBy: { attributes: true, relations: true },
    },
  });

  const map: Record<string, QtoDetailRow> = {};
  let withQ = 0;

  for (const item of items) {
    if (!item) continue;
    const category = attrStr(item._category) || 'IFC ELEMENT';
    if (!map[category]) {
      map[category] = { modelId, modelName, category, count: 0, area: 0, volume: 0, length: 0 };
    }
    map[category].count += 1;

    const definedBy = (item as any).IsDefinedBy;
    if (!Array.isArray(definedBy)) continue;

    // Recursively walk the relation tree and collect any *Value quantity fields,
    // regardless of how the Fragments API nests quantity sets. Bounded depth to
    // avoid pathological recursion.
    let elementHasQ = false;
    const visit = (node: any, depth: number) => {
      if (!node || depth > 6) return;
      if (Array.isArray(node)) {
        for (const child of node) visit(child, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      for (const key in node) {
        const val = node[key];
        if (key.endsWith('VolumeValue')) {
          const n = attrNum(val); if (n) { map[category].volume += n; elementHasQ = true; }
        } else if (key.endsWith('AreaValue')) {
          const n = attrNum(val); if (n) { map[category].area += n; elementHasQ = true; }
        } else if (key.endsWith('LengthValue')) {
          const n = attrNum(val); if (n) { map[category].length += n; elementHasQ = true; }
        } else if (val && typeof val === 'object') {
          visit(val, depth + 1);
        }
      }
    };
    visit(definedBy, 0);
    if (elementHasQ) withQ += 1;
  }

  const detail = Object.values(map).filter(r => r.count > 0);
  return { detail, total: ids.length, withQ };
};

export interface ClashResult {
  id: string;
  modelAId: string;
  modelAName: string;
  localIdA: number;
  modelBId: string;
  modelBName: string;
  localIdB: number;
  center: [number, number, number];
}

export interface BimViewerProps {
  // isPropsRefresh=true khi đây chỉ là lần cập nhật thuộc tính chạy nền (không phải
  // mô hình mới) → UI không reset lựa chọn/đang lọc của người dùng.
  onModelLoaded?: (spatialTree: any, properties: any, model: any, isPropsRefresh?: boolean) => void;
  onElementSelected?: (properties: any) => void;
}

export interface LoadedModelInfo {
  id: string;
  name: string;
  model: any;
}

export interface BimViewerRef {
  loadUrl: (url: string, modelId?: string) => Promise<void>;
  loadFile: (file: File, modelId?: string) => Promise<void>;
  loadFragments: (url: string, modelId: string) => Promise<void>;
  getModelBuffer: (modelId: string) => Promise<ArrayBuffer | null>;
  setModelVisibility: (modelId: string, visible: boolean) => void;
  applyCategoryVisibility: (hiddenCategories: string[]) => void;
  fitToModel: (modelId: string) => void;
  setModelsRecentered: (enabled: boolean) => void;
  fitToAll: () => void;
  toggleClipping: (active: boolean) => void;
  toggleMeasurement: (active: boolean) => void;
  clearAll: () => void;
  highlightElements: (expressIds: number[]) => Promise<void>;
  isolateElements: (expressIds: number[]) => void;
  setGhostMode: (expressIds: number[], active: boolean) => void;
  setCameraView: (viewType: 'top' | 'front' | 'right' | 'iso') => void;
  getQuantityTakeoff: () => Promise<QtoResult | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  getLoadedModels: () => LoadedModelInfo[];
  removeModel: (modelId: string) => void;
  setRenderingEnabled: (enabled: boolean) => void;
  setFlyMode: (enabled: boolean) => void;
  getCameraState: () => { position: number[]; target: number[] } | null;
  setCameraState: (state: { position: number[]; target: number[] }) => void;
  captureScreenshot: () => string | null;
  detectClashes: (tolerance?: number, maxResults?: number) => Promise<ClashResult[]>;
  focusClash: (clash: ClashResult) => Promise<void>;
}

export const BimViewer = forwardRef<BimViewerRef, BimViewerProps>(({ onModelLoaded, onElementSelected }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [modelCount, setModelCount] = useState(0);
  
  // Keep references to components for cleanup and imperative actions
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<any>(null);
  const highlighterRef = useRef<OBF.Highlighter | null>(null);
  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const clipperRef = useRef<OBC.Clipper | null>(null);
  const measurementsRef = useRef<OBF.LengthMeasurement | null>(null);
  const currentModelRef = useRef<any>(null);
  const loadedModelsRef = useRef<LoadedModelInfo[]>([]);
  const catMapsRef = useRef<Record<string, Record<string, number[]>>>({}); // modelId -> category -> localIds
  const flyEnabledRef = useRef(false);
  const propsDictRef = useRef<Record<number, any>>({});

  // Store callbacks in refs to prevent useEffect dependency cycle
  const onElementSelectedRef = useRef(onElementSelected);
  const onModelLoadedRef = useRef(onModelLoaded);

  useEffect(() => {
    onElementSelectedRef.current = onElementSelected;
  }, [onElementSelected]);

  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize Components Manager
    const components = new OBC.Components();
    componentsRef.current = components;

    // Initialize FragmentsManager
    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(workerUrl);
    fragmentsRef.current = fragments;

    // 2. Setup Worlds
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    worldRef.current = world;

    // Initialize scene, renderer, and camera
    world.scene = new OBC.SimpleScene(components);
    // preserveDrawingBuffer: true để chụp screenshot (viewpoint/BCF) không bị trắng
    world.renderer = new OBC.SimpleRenderer(components, containerRef.current, { preserveDrawingBuffer: true });
    // Fix: Force pixel ratio to 1 so FastModelPicker's scissor coordinates
    // match its readPixelAt coordinates (ThatOpen bug: renderPickPass divides
    // scissor by dpr but readPixelAt doesn't).
    world.renderer.three.setPixelRatio(1);
    world.camera = new OBC.SimpleCamera(components);

    components.init();

    // Setup scene lights and environment
    world.scene.setup();
    world.scene.three.background = new THREE.Color('#ededf4'); // Mapped to var(--color-surface-container)

    // Fit camera to scene bounds
    world.camera.controls.setLookAt(10, 10, 10, 0, 0, 0);

    // 3. Setup Highlighter for Element Selection
    const highlighter = components.get(OBF.Highlighter);
    highlighterRef.current = highlighter;
    highlighter.setup({
      world,
      selectMaterialDefinition: {
        color: new THREE.Color('#0c59a9'),
        opacity: 0.8,
        transparent: true,
        renderedFaces: FRAG.RenderedFaces.TWO,
      }
    });

    // Setup Hoverer for hover feedback
    const hoverer = components.get(OBF.Hoverer);
    hoverer.world = world;
    hoverer.enabled = true;
    hoverer.material = new THREE.MeshBasicMaterial({
      color: 0xbad2ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    // 4. Setup Clipper (Clipping Planes)
    const clipper = components.get(OBC.Clipper);
    clipperRef.current = clipper;
    clipper.enabled = false;

    // 5. Setup Measurements (Ruler Tool)
    const measurements = components.get(OBF.LengthMeasurement);
    measurements.world = world;
    measurementsRef.current = measurements;
    measurements.enabled = false;

    // 6. Handle Element Selection Event
    highlighter.events.select.onHighlight.add(async (fragmentMap) => {
      if (!onElementSelectedRef.current || !currentModelRef.current) return;

      let selectedExpressId: number | null = null;
      for (const key in fragmentMap) {
        const expressIds = fragmentMap[key];
        if (expressIds && expressIds.size > 0) {
          for (const id of expressIds) {
            selectedExpressId = id;
            break;
          }
        }
        if (selectedExpressId !== null) break;
      }

      if (selectedExpressId !== null) {
        const props = propsDictRef.current[selectedExpressId];
        if (props) {
          onElementSelectedRef.current(props);
        } else {
          onElementSelectedRef.current({
            expressID: selectedExpressId,
            expressId: selectedExpressId,
            Name: `Cấu kiện [ID: ${selectedExpressId}]`,
            ObjectType: 'IFC ELEMENT',
            GlobalId: 'N/A'
          });
        }
      } else {
        onElementSelectedRef.current(null);
      }
    });

    // Setup mouse actions for double click to place clipping planes or measurements
    const handleDoubleClick = () => {
      if (clipper.enabled) {
        clipper.create(world);
      } else if (measurements.enabled) {
        measurements.create();
      }
    };

    containerRef.current.addEventListener('dblclick', handleDoubleClick);

    // Walk/Fly mode: di chuyển camera bằng WASD/QE (giữ Shift để nhanh 2x)
    const handleFlyKey = (e: KeyboardEvent) => {
      if (!flyEnabledRef.current) return;
      const controls = world.camera?.controls as any;
      if (!controls) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const base = Math.max(controls.distance * 0.05, 0.5);
      const step = base * (e.shiftKey ? 2 : 1);
      let handled = true;
      switch (e.code) {
        case 'KeyW': controls.forward(step, true); break;
        case 'KeyS': controls.forward(-step, true); break;
        case 'KeyA': controls.truck(-step, 0, true); break;
        case 'KeyD': controls.truck(step, 0, true); break;
        case 'KeyE': case 'PageUp': controls.elevate(step, true); break;
        case 'KeyQ': case 'PageDown': controls.elevate(-step, true); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', handleFlyKey);

    // Refresh culling/LOD khi camera dừng di chuyển
    const handleCameraRest = () => { fragmentsRef.current?.core?.update?.(true); };
    world.camera.controls.addEventListener('rest', handleCameraRest);

    // Handle container resizing
    const handleResize = () => {
      world.renderer?.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleFlyKey);
      world.camera.controls.removeEventListener('rest', handleCameraRest);
      if (containerRef.current) {
        containerRef.current.removeEventListener('dblclick', handleDoubleClick);
      }
      components.dispose();
    };
  }, []);

  // Shared helper: process a loaded model (extract props, spatial, fit camera)
  const processLoadedModel = async (model: any, modelName: string, explicitId?: string) => {
    if (!componentsRef.current || !worldRef.current) return;

    const modelId = explicitId || (model as any).modelId || model.uuid || crypto.randomUUID();
    (model as any)._cdeModelId = modelId;
    currentModelRef.current = model;
    loadedModelsRef.current = [...loadedModelsRef.current, { id: modelId, name: modelName, model }];
    setModelCount(loadedModelsRef.current.length);

    worldRef.current.scene.three.add(model.object);

    // Bật culling theo camera để render mượt model nặng (chỉ vẽ vật trong tầm nhìn).
    // QUAN TRỌNG: dùng ALL_GEOMETRY (không thay hình học xa bằng LOD đơn giản) — vì
    // LodMode.DEFAULT khiến FastModelPicker không chọn/hover được cấu kiện khi zoom xa
    // (picker ẩn LOD trong lượt pick → không có hình để chọn). ALL_GEOMETRY giữ hình
    // thật nên luôn chọn được, vẫn cull theo khung nhìn để giữ hiệu năng.
    try {
      model.useCamera(worldRef.current.camera.three);
      await model.setLodMode(FRAG.LodMode.ALL_GEOMETRY);
      await fragmentsRef.current?.core?.update?.(true);
    } catch (e) {
      console.warn('LOD/culling setup failed:', e);
    }

    // Fit camera — ưu tiên fit theo MODEL VỪA TẢI (tránh trường hợp một model
    // khác có toạ độ thực rất xa làm bbox tổng hợp khổng lồ → camera bay mất hút)
    const fitBounds = new THREE.Box3().setFromObject(model.object);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (!fitBounds.isEmpty()) {
      fitBounds.getCenter(center);
      fitBounds.getSize(size);
    }
    const maxDim = Math.max(size.x, size.y, size.z);
    const finite = [center.x, center.y, center.z, maxDim].every(Number.isFinite) && maxDim > 0 && maxDim < 1e7;

    if (finite) {
      worldRef.current.camera.controls.setLookAt(
        center.x + maxDim, center.y + maxDim, center.z + maxDim,
        center.x, center.y, center.z, true
      );
    } else {
      console.warn('Bỏ qua fit camera: model có bounding box bất thường', modelName);
    }

    setLoadingProgress('Đang lập cấu trúc không gian...');
    const spatial = await model.getSpatialStructure();

    // Dựng catMap (lớp IFC -> localIds) NGAY từ spatial structure để bộ lọc IFC
    // dùng được liền, không phải chờ trích toàn bộ thuộc tính.
    const catMap: Record<string, number[]> = {};
    const walkCat = (node: any) => {
      if (!node) return;
      if (node.category && node.localId != null) {
        const c = String(node.category).toUpperCase();
        (catMap[c] ||= []).push(node.localId);
      }
      if (node.children) for (const ch of node.children) walkCat(ch);
    };
    walkCat(spatial);
    catMapsRef.current[modelId] = catMap;

    // Model + cây + bộ lọc sẵn sàng NGAY (không chờ thuộc tính chi tiết)
    if (onModelLoadedRef.current) {
      onModelLoadedRef.current(spatial, propsDictRef.current, model);
    }
    const highlighter = componentsRef.current.get(OBF.Highlighter);
    await highlighter.clear();

    // Trích xuất thuộc tính đầy đủ CHẠY NỀN (không chặn) — model lớn không bị khựng.
    void (async () => {
      try {
        const localIds = Array.from(await model.getLocalIds());
        const itemsData = await model.getItemsData(localIds);
        const newProps: Record<number, any> = {};
        for (const item of itemsData) {
          if (!item) continue;
          const id = item._localId ? item._localId.value : null;
          if (id === null) continue;
          const guid = item._guid ? item._guid.value : 'N/A';
          const name = item.Name ? (item.Name.value !== undefined ? item.Name.value : item.Name) : `${item._category?.value || 'Element'} [ID: ${id}]`;
          const objectType = item.ObjectType ? (item.ObjectType.value !== undefined ? item.ObjectType.value : item.ObjectType) : item._category?.value || 'IFC ELEMENT';
          const category = item._category ? item._category.value : 'IFC ELEMENT';
          const props: any = { expressID: id, expressId: id, Name: name, ObjectType: objectType, GlobalId: guid, GUID: guid, type: category };
          for (const key in item) {
            if (!['_category', '_localId', '_guid', 'Name', 'ObjectType'].includes(key) && item[key] !== null) {
              const val = item[key];
              props[key] = val && val.value !== undefined ? val.value : val;
            }
          }
          newProps[id] = props;
        }
        propsDictRef.current = { ...propsDictRef.current, ...newProps };
        // Cập nhật lại UI với tên/thuộc tính đầy đủ + catMap hoàn chỉnh
        if (Object.keys(newProps).length) {
          const fullCat: Record<string, number[]> = {};
          for (const idStr in newProps) {
            const cat = (newProps[idStr].type || 'IFCELEMENT').toUpperCase();
            (fullCat[cat] ||= []).push(Number(idStr));
          }
          catMapsRef.current[modelId] = fullCat;
          onModelLoadedRef.current?.(spatial, propsDictRef.current, model, true);
        }
      } catch (e) {
        console.warn('Trích thuộc tính nền lỗi:', e);
      }
    })();
  };

  // Shared helper: configure IfcLoader WASM
  const setupIfcLoader = async () => {
    const ifcLoader = componentsRef.current!.get(OBC.IfcLoader);
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: window.location.origin + "/", absolute: true }
    });
    return ifcLoader;
  };

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    loadUrl: async (url: string, modelId?: string) => {
      if (!componentsRef.current || !worldRef.current) return;
      // Tránh nạp trùng model đã có
      if (modelId && loadedModelsRef.current.some(m => m.id === modelId)) return;

      setLoading(true);
      setLoadingProgress('Đang tải tệp tin từ máy chủ...');

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch IFC file: ${response.statusText}`);

        setLoadingProgress('Đang phân tích cấu hình hình học IFC...');
        const data = await response.arrayBuffer();
        let buffer = new Uint8Array(data);
        buffer = await extractIfcBuffer(buffer, modelId || url); // tự giải nén .ifczip

        const ifcLoader = await setupIfcLoader();
        const modelName = modelId || url.split('/').pop() || 'default-model';

        const model = await ifcLoader.load(buffer, true, modelName, {
          instanceCallback: (importer) => {
            importer.addAllAttributes();
            importer.addAllRelations();
          }
        });

        await processLoadedModel(model, modelName, modelId);
      } catch (err) {
        console.error('Error loading IFC model:', err);
        alert('Có lỗi xảy ra khi nạp mô hình IFC: ' + (err as Error).message);
      } finally {
        setLoading(false);
        setLoadingProgress('');
      }
    },

    // Nạp NHANH từ file .frag đã cache (không parse lại IFC)
    loadFragments: async (url: string, modelId: string) => {
      if (!componentsRef.current || !worldRef.current || !fragmentsRef.current) return;
      if (loadedModelsRef.current.some(m => m.id === modelId)) return;
      setLoading(true);
      setLoadingProgress('Đang nạp mô hình (định dạng nhanh)...');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch frag failed');
        const buf = await res.arrayBuffer();
        const model = await (fragmentsRef.current as any).core.load(new Uint8Array(buf), {
          modelId, camera: worldRef.current.camera.three,
        });
        await processLoadedModel(model, modelId, modelId);
      } catch (err) {
        console.error('loadFragments error:', err);
        throw err; // để caller fallback sang IFC
      } finally {
        setLoading(false);
        setLoadingProgress('');
      }
    },

    getModelBuffer: async (modelId: string) => {
      const info = loadedModelsRef.current.find(m => m.id === modelId);
      if (!info) return null;
      try {
        return await info.model.getBuffer(false);
      } catch (err) {
        console.error('getModelBuffer error:', err);
        return null;
      }
    },

    loadFile: async (file: File, modelId?: string) => {
      if (!componentsRef.current || !worldRef.current) return;

      setLoading(true);
      setLoadingProgress('Đang đọc tệp tin cục bộ...');

      try {
        const arrayBuffer = await file.arrayBuffer();
        let buffer = new Uint8Array(arrayBuffer);
        buffer = await extractIfcBuffer(buffer, file.name); // tự giải nén .ifczip

        setLoadingProgress('Đang nạp mô hình 3D (WebAssembly)...');
        const ifcLoader = await setupIfcLoader();

        const model = await ifcLoader.load(buffer, true, file.name, {
          instanceCallback: (importer) => {
            importer.addAllAttributes();
            importer.addAllRelations();
          }
        });

        await processLoadedModel(model, file.name, modelId);
      } catch (err) {
        console.error('Error loading IFC file:', err);
        alert('Không thể nạp tệp IFC: ' + (err as Error).message);
      } finally {
        setLoading(false);
        setLoadingProgress('');
      }
    },

    toggleClipping: (active: boolean) => {
      if (!clipperRef.current) return;
      clipperRef.current.enabled = active;
      if (!active) {
        clipperRef.current.deleteAll();
      }
    },

    toggleMeasurement: (active: boolean) => {
      if (!measurementsRef.current) return;
      measurementsRef.current.enabled = active;
      if (!active) {
        const m = measurementsRef.current as any;
        (m.deleteAll || m.clear)?.call(m);
      }
    },

    clearAll: () => {
      if (clipperRef.current) clipperRef.current.deleteAll();
      if (measurementsRef.current) {
        const m = measurementsRef.current as any;
        (m.deleteAll || m.clear)?.call(m);
      }
      if (highlighterRef.current) highlighterRef.current.clear();
    },

    highlightElements: async (expressIds: number[]) => {
      if (!highlighterRef.current || !currentModelRef.current) return;
      const model = currentModelRef.current;

      await highlighterRef.current.clear("select");
      if (expressIds.length === 0) return;

      const modelIdMap: Record<string, Set<number>> = {
        [(model as any).modelId || model.uuid]: new Set(expressIds)
      };

      await highlighterRef.current.highlightByID("select", modelIdMap, true, true);
    },

    isolateElements: (expressIds: number[]) => {
      if (!currentModelRef.current) return;
      const model = currentModelRef.current;
      
      model.getLocalIds().then((idsSet) => {
        const allIds = Array.from(idsSet) as number[];
        if (expressIds.length === 0) {
          model.resetVisible();
        } else {
          model.setVisible(allIds, false);
          model.setVisible(expressIds, true);
        }
      });
    },

    setGhostMode: (expressIds: number[], active: boolean) => {
      if (!currentModelRef.current) return;
      const model = currentModelRef.current;
      
      model.getLocalIds().then((idsSet) => {
        const allIds = Array.from(idsSet) as number[];
        if (!active || expressIds.length === 0) {
          model.resetOpacity(allIds);
        } else {
          const selectedSet = new Set(expressIds);
          const unselectedIds = allIds.filter(id => !selectedSet.has(id));
          model.resetOpacity(allIds);
          model.setOpacity(unselectedIds, 0.15);
        }
      });
    },

    setCameraView: (viewType: 'top' | 'front' | 'right' | 'iso') => {
      if (!currentModelRef.current || !worldRef.current) return;
      const model = currentModelRef.current;
      const controls = worldRef.current.camera.controls;
      if (!controls) return;

      const bounds = new THREE.Box3().setFromObject(model.object);
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      switch (viewType) {
        case 'top':
          controls.setLookAt(center.x, center.y + maxDim * 1.5, center.z, center.x, center.y, center.z, true);
          break;
        case 'front':
          controls.setLookAt(center.x, center.y, center.z + maxDim * 1.5, center.x, center.y, center.z, true);
          break;
        case 'right':
          controls.setLookAt(center.x + maxDim * 1.5, center.y, center.z, center.x, center.y, center.z, true);
          break;
        case 'iso':
        default:
          controls.setLookAt(center.x + maxDim, center.y + maxDim, center.z + maxDim, center.x, center.y, center.z, true);
          break;
      }
    },

    getQuantityTakeoff: async () => {
      const models = loadedModelsRef.current;
      if (!models.length) return null;
      try {
        const detail: QtoDetailRow[] = [];
        let total = 0, withQ = 0;
        // Bóc tách khối lượng cho TẤT CẢ mô hình đang liên hợp (mỗi mô hình = 1 hạng mục)
        for (const { id, name, model } of models) {
          try {
            const r = await extractQto(model, id, name);
            detail.push(...r.detail);
            total += r.total; withQ += r.withQ;
          } catch (e) { console.error('QTO model error', name, e); }
        }
        // Gộp theo lớp cấu kiện (toàn dự án) để tương thích các nơi dùng .rows
        const agg: Record<string, QtoRow> = {};
        for (const d of detail) {
          const a = (agg[d.category] ||= { category: d.category, count: 0, area: 0, volume: 0, length: 0 });
          a.count += d.count; a.area += d.area; a.volume += d.volume; a.length += d.length;
        }
        const rows = Object.values(agg).sort((a, b) => b.volume - a.volume || b.count - a.count);
        return { rows, detail, totalElements: total, elementsWithQuantities: withQ };
      } catch (err) {
        console.error('QTO extraction error:', err);
        return null;
      }
    },

    zoomIn: () => {
      const controls = worldRef.current?.camera?.controls;
      if (!controls) return;
      controls.dolly(controls.distance * 0.3, true);
    },

    zoomOut: () => {
      const controls = worldRef.current?.camera?.controls;
      if (!controls) return;
      controls.dolly(-controls.distance * 0.3, true);
    },

    getLoadedModels: () => {
      return loadedModelsRef.current.map(m => ({ id: m.id, name: m.name, model: m.model }));
    },

    // Bật/tắt vòng lặp render — tắt khi rời tab Mô hình 3D để không ngốn GPU/CPU
    setRenderingEnabled: (enabled: boolean) => {
      const world = worldRef.current;
      if (!world) return;
      if (world.renderer) world.renderer.enabled = enabled;
      if (world.camera?.controls) world.camera.controls.enabled = enabled;
      // Khi bật lại (quay lại tab Mô hình 3D): canvas vừa rời display:none nên
      // có thể 0x0 và geometry đã bị culling ẩn (LOD chỉ cập nhật lúc camera 'rest').
      // → ép resize + cập nhật fragments + vẽ lại 1 frame để hình hiện lại ngay.
      if (enabled) {
        setTimeout(() => {
          try {
            world.renderer?.resize?.();
            fragmentsRef.current?.core?.update?.(true);
            world.renderer?.three?.render?.(world.scene.three, world.camera.three);
          } catch { /* noop */ }
        }, 80);
      }
    },

    setFlyMode: (enabled: boolean) => {
      flyEnabledRef.current = enabled;
    },

    getCameraState: () => {
      const controls = worldRef.current?.camera?.controls;
      if (!controls) return null;
      const p = new THREE.Vector3();
      const t = new THREE.Vector3();
      controls.getPosition(p);
      controls.getTarget(t);
      return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
    },

    setCameraState: (state) => {
      const controls = worldRef.current?.camera?.controls;
      if (!controls || !state) return;
      const [px, py, pz] = state.position;
      const [tx, ty, tz] = state.target;
      controls.setLookAt(px, py, pz, tx, ty, tz, true);
    },

    captureScreenshot: () => {
      try {
        const canvas = worldRef.current?.renderer?.three?.domElement as HTMLCanvasElement;
        if (!canvas) return null;
        worldRef.current.renderer.three.render(worldRef.current.scene.three, worldRef.current.camera.three);
        const url = canvas.toDataURL('image/png');
        return url && url.length > 1000 ? url : null;
      } catch (err) {
        console.warn('Screenshot failed:', err);
        return null;
      }
    },

    // Phát hiện xung đột (clash) giữa các mô hình bằng giao cắt bounding-box.
    // Broad-phase dùng lưới không gian (spatial hash) để tránh O(n*m).
    detectClashes: async (tolerance = 0.05, maxResults = 500) => {
      const models = loadedModelsRef.current;
      if (models.length < 2) return [];

      // Lấy bounding-box từng cấu kiện cho mỗi model
      const data: { id: string; name: string; ids: number[]; boxes: THREE.Box3[] }[] = [];
      for (const info of models) {
        try {
          const ids = Array.from(await info.model.getLocalIds()) as number[];
          if (ids.length === 0 || ids.length > 200000) continue; // bỏ qua model quá lớn
          const boxes = await info.model.getBoxes(ids);
          // getBoxes trả tọa độ gốc của model; cộng offset object.position để khớp
          // tọa độ hiển thị thực tế (quan trọng khi đã bật "Căn tâm")
          const offset = info.model.object?.position as THREE.Vector3 | undefined;
          if (offset && (offset.x || offset.y || offset.z)) {
            for (const b of boxes) { if (b && !b.isEmpty()) b.translate(offset); }
          }
          data.push({ id: info.id, name: info.name, ids, boxes });
        } catch (e) {
          console.warn('getBoxes failed for', info.name, e);
        }
      }

      const results: ClashResult[] = [];
      const intersect = (a: THREE.Box3, b: THREE.Box3): THREE.Box3 | null => {
        if (!a.intersectsBox(b)) return null;
        const min = new THREE.Vector3(Math.max(a.min.x, b.min.x), Math.max(a.min.y, b.min.y), Math.max(a.min.z, b.min.z));
        const max = new THREE.Vector3(Math.min(a.max.x, b.max.x), Math.min(a.max.y, b.max.y), Math.min(a.max.z, b.max.z));
        // Cần chồng lấn thực sự (hard clash), bỏ trường hợp chỉ chạm mặt
        if (max.x - min.x < tolerance || max.y - min.y < tolerance || max.z - min.z < tolerance) return null;
        return new THREE.Box3(min, max);
      };

      // So từng cặp model (khác bộ môn). Broad-phase: lưới theo cell.
      for (let i = 0; i < data.length && results.length < maxResults; i++) {
        for (let j = i + 1; j < data.length && results.length < maxResults; j++) {
          const A = data[i], B = data[j];
          // Kích thước cell = trung bình cạnh box của B (clamp)
          let avg = 0, cnt = 0;
          const tmp = new THREE.Vector3();
          for (const bx of B.boxes) { if (bx && !bx.isEmpty()) { bx.getSize(tmp); avg += (tmp.x + tmp.y + tmp.z) / 3; cnt++; } }
          const cell = Math.min(Math.max((cnt ? avg / cnt : 1) * 2, 0.5), 50);
          const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
          // Hash các box của B
          const grid = new Map<string, number[]>();
          for (let bi = 0; bi < B.boxes.length; bi++) {
            const bx = B.boxes[bi];
            if (!bx || bx.isEmpty() || !Number.isFinite(bx.min.x)) continue;
            for (let gx = Math.floor(bx.min.x / cell); gx <= Math.floor(bx.max.x / cell); gx++)
              for (let gy = Math.floor(bx.min.y / cell); gy <= Math.floor(bx.max.y / cell); gy++)
                for (let gz = Math.floor(bx.min.z / cell); gz <= Math.floor(bx.max.z / cell); gz++) {
                  const k = `${gx},${gy},${gz}`;
                  (grid.get(k) || grid.set(k, []).get(k)!).push(bi);
                }
          }
          // Test box của A với candidate trong cùng cell
          const seen = new Set<string>();
          for (let ai = 0; ai < A.boxes.length && results.length < maxResults; ai++) {
            const ax = A.boxes[ai];
            if (!ax || ax.isEmpty() || !Number.isFinite(ax.min.x)) continue;
            const cand = new Set<number>();
            for (let gx = Math.floor(ax.min.x / cell); gx <= Math.floor(ax.max.x / cell); gx++)
              for (let gy = Math.floor(ax.min.y / cell); gy <= Math.floor(ax.max.y / cell); gy++)
                for (let gz = Math.floor(ax.min.z / cell); gz <= Math.floor(ax.max.z / cell); gz++) {
                  const arr = grid.get(`${gx},${gy},${gz}`);
                  if (arr) for (const bi of arr) cand.add(bi);
                }
            for (const bi of cand) {
              const pairKey = `${ai}-${bi}`;
              if (seen.has(pairKey)) continue;
              seen.add(pairKey);
              const ov = intersect(ax, B.boxes[bi]);
              if (ov) {
                const c = ov.getCenter(new THREE.Vector3());
                results.push({
                  id: `CL-${A.id.slice(0, 4)}-${B.id.slice(0, 4)}-${results.length + 1}`,
                  modelAId: A.id, modelAName: A.name, localIdA: A.ids[ai],
                  modelBId: B.id, modelBName: B.name, localIdB: B.ids[bi],
                  center: [c.x, c.y, c.z],
                });
                if (results.length >= maxResults) break;
              }
            }
          }
        }
      }
      return results;
    },

    focusClash: async (clash: ClashResult) => {
      if (!worldRef.current || !highlighterRef.current) return;
      const [x, y, z] = clash.center;
      if ([x, y, z].every(Number.isFinite)) {
        worldRef.current.camera.controls.setLookAt(x + 8, y + 8, z + 8, x, y, z, true);
      }
      // Highlight cả 2 cấu kiện xung đột
      const mA = loadedModelsRef.current.find(m => m.id === clash.modelAId)?.model;
      const mB = loadedModelsRef.current.find(m => m.id === clash.modelBId)?.model;
      const map: Record<string, Set<number>> = {};
      if (mA) map[(mA as any).modelId || mA.uuid] = new Set([clash.localIdA]);
      if (mB) map[(mB as any).modelId || mB.uuid] = new Set([clash.localIdB]);
      try {
        await highlighterRef.current.clear('select');
        await highlighterRef.current.highlightByID('select', map, true, true);
      } catch (e) { console.warn('focusClash highlight failed', e); }
    },

    setModelVisibility: async (modelId: string, visible: boolean) => {
      const info = loadedModelsRef.current.find(m => m.id === modelId);
      if (!info) return;
      const model = info.model;
      // Cách tin cậy với ThatOpen fragments: bật/tắt hiển thị theo localIds
      const idsSet: Set<number> = await model.getLocalIds();
      const ids = Array.from(idsSet) as number[];
      await model.setVisible(ids, visible);
      if (model.object) model.object.visible = visible;
      // Bắt buộc fragments engine cập nhật để render lại
      await fragmentsRef.current?.core?.update?.(true);
    },

    // Căn tâm: dịch mỗi model sao cho tâm bbox về gốc (0,0,0) để các bộ môn
    // lệch toạ độ vẫn đè lên nhau. Tắt thì khôi phục vị trí gốc.
    setModelsRecentered: (enabled: boolean) => {
      if (!worldRef.current) return;
      for (const info of loadedModelsRef.current) {
        const obj = info.model.object;
        if (enabled) {
          if (!obj.userData._origPos) obj.userData._origPos = obj.position.clone();
          else obj.position.copy(obj.userData._origPos);
          obj.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(obj);
          if (box.isEmpty()) continue;
          const center = box.getCenter(new THREE.Vector3());
          if (![center.x, center.y, center.z].every(Number.isFinite)) continue;
          obj.position.sub(center);
        } else if (obj.userData._origPos) {
          obj.position.copy(obj.userData._origPos);
        }
        obj.updateMatrixWorld(true);
      }
      fragmentsRef.current?.core?.update?.(true);
      // Fit lại toàn cảnh
      const all = new THREE.Box3();
      for (const info of loadedModelsRef.current) all.expandByObject(info.model.object);
      if (!all.isEmpty()) {
        const c = all.getCenter(new THREE.Vector3());
        const s = all.getSize(new THREE.Vector3());
        const d = Math.max(s.x, s.y, s.z);
        if ([c.x, c.y, c.z, d].every(Number.isFinite) && d > 0 && d < 1e7) {
          worldRef.current.camera.controls.setLookAt(c.x + d, c.y + d, c.z + d, c.x, c.y, c.z, true);
        }
      }
    },

    fitToAll: () => {
      if (!worldRef.current) return;
      const all = new THREE.Box3();
      for (const info of loadedModelsRef.current) all.expandByObject(info.model.object);
      if (all.isEmpty()) return;
      const c = all.getCenter(new THREE.Vector3());
      const s = all.getSize(new THREE.Vector3());
      const d = Math.max(s.x, s.y, s.z);
      if (![c.x, c.y, c.z, d].every(Number.isFinite) || d <= 0 || d > 1e7) return;
      worldRef.current.camera.controls.setLookAt(c.x + d, c.y + d, c.z + d, c.x, c.y, c.z, true);
    },

    // Ẩn/hiện cấu kiện theo lớp IFC trên TẤT CẢ mô hình đang tải (bỏ qua model
    // đang ẩn toàn bộ). hiddenCategories = danh sách lớp cần ẩn.
    applyCategoryVisibility: async (hiddenCategories: string[]) => {
      const hiddenSet = new Set(hiddenCategories.map(c => c.toUpperCase()));
      for (const info of loadedModelsRef.current) {
        if (info.model.object && info.model.object.visible === false) continue; // model ẩn toàn bộ
        const catMap = catMapsRef.current[info.id];
        if (!catMap) continue;
        const hideIds: number[] = [];
        const showIds: number[] = [];
        for (const cat in catMap) {
          (hiddenSet.has(cat) ? hideIds : showIds).push(...catMap[cat]);
        }
        try {
          if (showIds.length) await info.model.setVisible(showIds, true);
          if (hideIds.length) await info.model.setVisible(hideIds, false);
        } catch (e) { console.warn('applyCategoryVisibility failed', info.name, e); }
      }
      await fragmentsRef.current?.core?.update?.(true);
    },

    fitToModel: (modelId: string) => {
      const info = loadedModelsRef.current.find(m => m.id === modelId);
      if (!info || !worldRef.current) return;
      const bounds = new THREE.Box3().setFromObject(info.model.object);
      if (bounds.isEmpty()) { alert('Mô hình không có hình học để phóng tới.'); return; }
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      // Chống bounding box vô cực/NaN (model lỗi hình học) làm camera bay mất hút
      if (![center.x, center.y, center.z, maxDim].every(Number.isFinite) || maxDim <= 0 || maxDim > 1e7) {
        alert('Mô hình có toạ độ/kích thước bất thường, không thể phóng tới chính xác.');
        return;
      }
      worldRef.current.camera.controls.setLookAt(
        center.x + maxDim, center.y + maxDim, center.z + maxDim,
        center.x, center.y, center.z, true
      );
    },

    removeModel: (modelId: string) => {
      const idx = loadedModelsRef.current.findIndex(m => m.id === modelId);
      if (idx === -1) return;
      const info = loadedModelsRef.current[idx];
      worldRef.current?.scene?.three?.remove(info.model.object);
      info.model.dispose?.();
      loadedModelsRef.current = loadedModelsRef.current.filter(m => m.id !== modelId);
      setModelCount(loadedModelsRef.current.length);
      if (currentModelRef.current === info.model) {
        currentModelRef.current = loadedModelsRef.current.length > 0
          ? loadedModelsRef.current[loadedModelsRef.current.length - 1].model
          : null;
      }
      // Rebuild propsDictRef from remaining models would be complex;
      // for now properties from removed model remain accessible (harmless)
    }
  }));

  // Expose a file input handler that delegates to the imperative loadFile
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    // Delegate to the imperative loadFile (which uses processLoadedModel)
    if (!componentsRef.current || !worldRef.current) return;
    setLoading(true);
    setLoadingProgress('Đang đọc tệp tin cục bộ...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      let buffer = new Uint8Array(arrayBuffer);
      buffer = await extractIfcBuffer(buffer, file.name); // tự giải nén .ifczip
      setLoadingProgress('Đang nạp mô hình 3D (WebAssembly)...');
      const ifcLoader = await setupIfcLoader();
      const model = await ifcLoader.load(buffer, true, file.name, {
        instanceCallback: (importer) => {
          importer.addAllAttributes();
          importer.addAllRelations();
        }
      });
      await processLoadedModel(model, file.name);
    } catch (err) {
      console.error('Error loading IFC file:', err);
      alert('Không thể nạp tệp IFC: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-surface-container-low overflow-hidden">
      
      {/* 3D View Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-sm z-[99] flex flex-col items-center justify-center gap-4 transition-all">
          <div className="p-4 bg-surface rounded-2xl shadow-lg border border-outline-variant flex flex-col items-center gap-3 w-72 text-center animate-in scale-in duration-200">
            <Loader2 className="animate-spin text-primary" size={36} />
            <div className="font-bold text-sm text-on-surface">Vui lòng chờ</div>
            <div className="text-[12px] text-on-surface-variant font-medium leading-relaxed">{loadingProgress}</div>
          </div>
        </div>
      )}

      {/* Local File Picker Hint Overlay when empty */}
      {!loading && modelCount === 0 && (
        <div className="absolute z-10 p-6 bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-2xl shadow-lg flex flex-col items-center gap-4 text-center max-w-sm mx-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">*</div>
          <div>
            <h3 className="font-bold text-[15px] text-on-surface mb-1">Môi trường 3D Sẵn sàng</h3>
            <p className="text-[12px] text-on-surface-variant font-medium leading-relaxed">
              Vui lòng tải lên tệp tin thiết kế hoặc nhấp vào nút tải mẫu thử nghiệm để khám phá không gian 3D.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <label className="w-full bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm text-center">
              Chọn tệp tin IFC cục bộ
              <input
                type="file"
                accept=".ifc,.ifczip,.zip"
                onChange={handleLocalFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
});

BimViewer.displayName = 'BimViewer';
