import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as FRAG from '@thatopen/fragments';
import { Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import CameraControls from 'camera-controls';
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

/**
 * Trích Property Sets (Pset) của một cấu kiện từ quan hệ IsDefinedBy.
 * Trả về { [tênPset]: { [tênThuộcTính]: giá trị } }. Đây là dữ liệu TC2
 * (kiểm tra quy chuẩn) cần để đọc các thuộc tính như Width/IsExternal...
 * Defensive: đi đệ quy có giới hạn, bắt mọi node có HasProperties.
 */
export const extractPsets = (item: any): Record<string, Record<string, any>> => {
  const out: Record<string, Record<string, any>> = {};
  const definedBy = item?.IsDefinedBy;
  if (!definedBy) return out;
  const unwrap = (v: any) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
  const collect = (node: any, depth: number) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { for (const c of node) collect(c, depth + 1); return; }
    if (typeof node !== 'object') return;
    const hasProps = node.HasProperties;
    const psetName = unwrap(node.Name);
    if (psetName && Array.isArray(hasProps)) {
      const set: Record<string, any> = {};
      for (const p of hasProps) {
        const pn = unwrap(p?.Name);
        const pv = unwrap(p?.NominalValue ?? p?.Value ?? p?.LengthValue ?? p?.AreaValue);
        if (pn != null && pv !== undefined && pv !== null && pv !== '') set[pn] = pv;
      }
      if (Object.keys(set).length) out[psetName] = { ...(out[psetName] || {}), ...set };
    }
    for (const key in node) {
      const val = node[key];
      if (val && typeof val === 'object') collect(val, depth + 1);
    }
  };
  collect(definedBy, 0);
  return out;
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

  const map: Record<string, QtoDetailRow> = {};
  let withQ = 0;

  // Chia lô để không tạo mảng kết quả khổng lồ (kèm quan hệ IsDefinedBy) một lúc
  // — model lớn dễ làm tràn bộ nhớ tab nếu lấy toàn bộ trong 1 lần gọi.
  const BATCH = 3000;
  for (let off = 0; off < ids.length; off += BATCH) {
  const items = await model.getItemsData(ids.slice(off, off + BATCH), {
    attributesDefault: true,
    relations: {
      IsDefinedBy: { attributes: true, relations: true },
    },
  });

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
  // Nhường main thread giữa các lô
  await new Promise(r => setTimeout(r, 0));
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
  projectId?: string;
  isActive?: boolean;
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
  toggleAreaMeasurement: (active: boolean) => void;
  toggleAngleMeasurement: (active: boolean) => void;
  clearAll: () => void;
  highlightElements: (expressIds: number[]) => Promise<void>;
  isolateElements: (expressIds: number[]) => void;
  setGhostMode: (expressIds: number[], active: boolean) => void;
  setCameraView: (viewType: 'top' | 'front' | 'right' | 'iso') => void;
  getQuantityTakeoff: (modelIds?: string[]) => Promise<QtoResult | null>;
  getModelCategories: () => { modelId: string; modelName: string; categories: string[] }[];
  zoomIn: () => void;
  zoomOut: () => void;
  getLoadedModels: () => LoadedModelInfo[];
  removeModel: (modelId: string) => void;
  setRenderingEnabled: (enabled: boolean) => void;
  setFlyMode: (enabled: boolean) => void;
  setWalkMode: (active: boolean) => void;
  getCameraState: () => { position: number[]; target: number[] } | null;
  setCameraState: (state: { position: number[]; target: number[] }) => void;
  captureScreenshot: () => string | null;
  detectClashes: (tolerance?: number, maxResults?: number) => Promise<ClashResult[]>;
  focusClash: (clash: ClashResult) => Promise<void>;
  compareModels: (modelIdV1: string, modelIdV2: string) => Promise<{ added: number; deleted: number; modified: number; unchanged: number } | null>;
  clearCompare: () => Promise<void>;
  toggleMinimap: (active: boolean) => void;
  toggleViewCube: (active: boolean) => void;
  // Viewpoint mức cấu kiện (P3.1): chụp/khôi phục cấu kiện đang ẩn + mặt cắt.
  getHiddenElements: () => Promise<Record<string, number[]>>;
  applyHiddenElements: (state: Record<string, number[]>, skipModelIds?: string[]) => Promise<void>;
  getClippingPlanes: () => { normal: number[]; origin: number[] }[];
  applyClippingPlanes: (planes: { normal: number[]; origin: number[] }[]) => void;
}

export const BimViewer = forwardRef<BimViewerRef, BimViewerProps>(({ onModelLoaded, onElementSelected, projectId, isActive = true }, ref) => {
  const projectIdRef = useRef<string | undefined>(projectId);
  projectIdRef.current = projectId;
  const savedElemRef = useRef<Set<string>>(new Set()); // dedupe lazy-save thuộc tính cấu kiện
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [modelCount, setModelCount] = useState(0);
  const viewCubeContainerRef = useRef<HTMLDivElement>(null);
  const minimapContainerRef = useRef<HTMLDivElement>(null);
  const [minimapActive, setMinimapActive] = useState(false);
  const [viewCubeActive, setViewCubeActive] = useState(true);
  
  // Keep references to components for cleanup and imperative actions
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<any>(null);
  const highlighterRef = useRef<OBF.Highlighter | null>(null);
  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const clipperRef = useRef<OBC.Clipper | null>(null);
  const measurementsRef = useRef<OBF.LengthMeasurement | null>(null);
  const areaMeasurementRef = useRef<OBF.AreaMeasurement | null>(null);
  const angleMeasurementRef = useRef<OBF.AngleMeasurement | null>(null);
  const currentModelRef = useRef<any>(null);
  const loadedModelsRef = useRef<LoadedModelInfo[]>([]);
  const catMapsRef = useRef<Record<string, Record<string, number[]>>>({}); // modelId -> category -> localIds
  const flyEnabledRef = useRef(false);
  const walkEnabledRef = useRef(false);
  const sectionBoxEnabledRef = useRef(false);
  const boxMeshRef = useRef<THREE.Mesh | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const clippingPlanesRef = useRef<THREE.Plane[]>([]);
  const propsDictRef = useRef<Record<number, any>>({});

  // Hàng đợi tác vụ nặng chạy nền (trích thuộc tính, xuất .frag) — chạy TUẦN TỰ
  // để không chồng nhiều tác vụ ngốn RAM cùng lúc (nguyên nhân tab bị OOM/crash
  // khi liên hợp nhiều mô hình lớn).
  const bgQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueBg = (task: () => Promise<void>): Promise<void> => {
    const next = bgQueueRef.current.then(task).catch(e => console.warn('Tác vụ nền lỗi:', e));
    bgQueueRef.current = next;
    return next;
  };

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
    // Sử dụng SimpleRenderer mặc định (siêu nhẹ, không có post-processing)
    // Khóa antialias=false để không ngốn GPU trên các mô hình lớn
    world.renderer = new OBC.SimpleRenderer(components, containerRef.current, {
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
      antialias: false 
    });
    
    // Ép PixelRatio về 1 (không nhân độ phân giải lên 2x, 4x trên màn hình 2K/4K)
    // Đây là nguyên nhân cực lớn gây drop FPS trên các máy Windows có màn hình nét
    world.renderer.three.setPixelRatio(1);
    world.camera = new OBC.SimpleCamera(components);

    // Enable right-click panning (truck)
    const controls = world.camera.controls;
    if (controls && controls.mouseButtons) {
      controls.mouseButtons.right = CameraControls.ACTION.TRUCK;
    }

    // Prevent default context menu on the canvas to allow smooth right-click panning
    const domElement = world.renderer.three.domElement;
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    domElement.addEventListener('contextmenu', handleContextMenu);

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
        opacity: 0.6,
        transparent: true,
        renderedFaces: FRAG.RenderedFaces.TWO,
      }
    });

    // Register custom styles for 3D Version Compare
    highlighter.styles.set('added', {
      color: new THREE.Color('#22c55e'),
      opacity: 0.8,
      transparent: true,
      renderedFaces: FRAG.RenderedFaces.TWO,
    });
    highlighter.styles.set('deleted', {
      color: new THREE.Color('#ef4444'),
      opacity: 0.8,
      transparent: true,
      renderedFaces: FRAG.RenderedFaces.TWO,
    });
    highlighter.styles.set('modified', {
      color: new THREE.Color('#eab308'),
      opacity: 0.8,
      transparent: true,
      renderedFaces: FRAG.RenderedFaces.TWO,
    });
    highlighter.styles.set('unchanged', {
      color: new THREE.Color('#9ca3af'),
      opacity: 0.15,
      transparent: true,
      renderedFaces: FRAG.RenderedFaces.TWO,
    });

    // Setup Hoverer — GPU picking mặc định của ThatOpen (tự động tối ưu hóa hiệu năng)
    const hoverer = components.get(OBF.Hoverer);
    hoverer.world = world;
    hoverer.enabled = true;
    // Dùng màu vàng sáng (0xfacc15) với độ mờ 0.5 để nổi bật trên nền mô hình xám/trắng
    hoverer.material = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
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

    // Đo diện tích & góc (2.5)
    const areaMeasurement = components.get(OBF.AreaMeasurement);
    areaMeasurement.world = world;
    areaMeasurementRef.current = areaMeasurement;
    areaMeasurement.enabled = false;
    const angleMeasurement = components.get(OBF.AngleMeasurement);
    angleMeasurement.world = world;
    angleMeasurementRef.current = angleMeasurement;
    angleMeasurement.enabled = false;

    // 6. Handle Element Selection Event - Giải pháp Lai (Hybrid Selection)
    const triggerSelection = async (selectedExpressId: number | null, selectedModelId: string | null) => {
      if (!onElementSelectedRef.current) return;

      if (selectedExpressId !== null) {
        const props = propsDictRef.current[selectedExpressId];
        if (props) {
          onElementSelectedRef.current(props);
          const key = `${selectedModelId}:${selectedExpressId}`;
          if (projectIdRef.current && selectedModelId && !savedElemRef.current.has(key)) {
            savedElemRef.current.add(key);
            const sid = selectedModelId, eid = selectedExpressId;
            import('../../lib/api/data').then(api => api.saveElementProps(projectIdRef.current, sid, eid, props)).catch(() => {});
          }
        } else if (selectedModelId) {
          onElementSelectedRef.current({
            expressID: selectedExpressId,
            expressId: selectedExpressId,
            Name: `Đang tải thuộc tính [ID: ${selectedExpressId}]...`,
            ObjectType: 'IFC ELEMENT',
            GlobalId: 'N/A',
            _loading: true
          });

          import('../../lib/api/data').then(async (api) => {
            try {
              let finalProps = await api.fetchElementProperties(selectedModelId!, selectedExpressId!);
              
              if (!finalProps) {
                const modelInfo = loadedModelsRef.current.find(m => m.id === selectedModelId);
                if (modelInfo && modelInfo.model) {
                  const itemsData = await modelInfo.model.getItemsData([selectedExpressId!], {
                    attributesDefault: true,
                    // Chỉ lấy relations khi click chọn cấu kiện đơn lẻ (rất nhanh, không gây lag)
                    relations: { IsDefinedBy: { attributes: true, relations: true } },
                  });
                  
                  if (itemsData && itemsData.length > 0 && itemsData[0]) {
                    const item = itemsData[0];
                    const id = item._localId ? item._localId.value : selectedExpressId!;
                    const guid = item._guid ? item._guid.value : 'N/A';
                    const name = item.Name ? (item.Name.value !== undefined ? item.Name.value : item.Name) : `${item._category?.value || 'Element'} [ID: ${id}]`;
                    const objectType = item.ObjectType ? (item.ObjectType.value !== undefined ? item.ObjectType.value : item.ObjectType) : item._category?.value || 'IFC ELEMENT';
                    const category = item._category ? item._category.value : 'IFC ELEMENT';
                    const props: any = { expressID: id, expressId: id, Name: name, ObjectType: objectType, GlobalId: guid, GUID: guid, type: category };
                    
                    for (const key in item) {
                      if (!['_category', '_localId', '_guid', 'Name', 'ObjectType', 'IsDefinedBy'].includes(key) && item[key] !== null) {
                        const val = item[key];
                        props[key] = val && val.value !== undefined ? val.value : val;
                      }
                    }
                    
                    const psets = extractPsets(item);
                    if (Object.keys(psets).length) props._psets = psets;
                    finalProps = props;
                  }
                }
              }

              if (finalProps) {
                propsDictRef.current[selectedExpressId!] = finalProps;
                onElementSelectedRef.current?.(finalProps);
                
                const key = `${selectedModelId!}:${selectedExpressId!}`;
                if (projectIdRef.current && !savedElemRef.current.has(key)) {
                  savedElemRef.current.add(key);
                  api.saveElementProps(projectIdRef.current, selectedModelId!, selectedExpressId!, finalProps).catch(() => {});
                }
              } else {
                onElementSelectedRef.current?.({
                  expressID: selectedExpressId,
                  expressId: selectedExpressId,
                  Name: `Cấu kiện [ID: ${selectedExpressId}]`,
                  ObjectType: 'IFC ELEMENT',
                  GlobalId: 'N/A'
                });
              }
            } catch (err) {
              console.error('Lỗi truy vấn thuộc tính:', err);
              onElementSelectedRef.current?.({
                expressID: selectedExpressId,
                expressId: selectedExpressId,
                Name: `Cấu kiện [ID: ${selectedExpressId}] (Lỗi tải)`,
                ObjectType: 'IFC ELEMENT',
                GlobalId: 'N/A'
              });
            }
          });
        } else {
          // HÀNG PHÒNG THỦ: Luôn hiển thị thông tin cơ bản ngay cả khi không tìm thấy modelId
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
    };

    // Bật cơ chế chọn tự động của ThatOpen (GPU picking — cực nhạy và mượt mà)
    highlighter.enabled = true;

    // Sự kiện click chọn cấu kiện — đơn giản, không block main thread
    highlighter.events.select.onHighlight.add(async (fragmentMap) => {
      if (!onElementSelectedRef.current) return;

      try {
        let selectedExpressId: number | null = null;
        let selectedModelId: string | null = null;

        for (const fragId in fragmentMap) {
          const expressIds = fragmentMap[fragId];
          if (expressIds && expressIds.size > 0) {
            for (const id of expressIds) {
              selectedExpressId = id;
              break;
            }
            const fragment = fragments.list.get(fragId) as any;
            if (fragment?.group) {
              selectedModelId = (fragment.group as any)._cdeModelId || null;
            }
            break;
          }
        }

        // Fallback: nếu không lấy được modelId từ fragment.group
        if (selectedExpressId !== null && !selectedModelId && loadedModelsRef.current.length > 0) {
          selectedModelId = loadedModelsRef.current[0].id;
        }

        await triggerSelection(selectedExpressId, selectedModelId);
      } catch (err) {
        console.error('Lỗi trong sự kiện onHighlight:', err);
        await triggerSelection(null, null);
      }
    });

    // Setup mouse actions for double click to place clipping planes or measurements
    const handleDoubleClick = () => {
      if (clipper.enabled) {
        clipper.create(world);
      } else if (measurements.enabled) {
        measurements.create();
      } else if (areaMeasurement.enabled) {
        (areaMeasurement as any).create();
      } else if (angleMeasurement.enabled) {
        (angleMeasurement as any).create();
      }
    };

    containerRef.current.addEventListener('dblclick', handleDoubleClick);

    // Walk/Fly mode: di chuyển camera bằng WASD/QE (giữ Shift để nhanh 2x)
    const handleFlyKey = (e: KeyboardEvent) => {
      const isFly = flyEnabledRef.current;
      const isWalk = walkEnabledRef.current;
      if (!isFly && !isWalk) return;

      const controls = world.camera?.controls as any;
      if (!controls) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const base = isWalk ? 0.3 : Math.max(controls.distance * 0.05, 0.5);
      const step = base * (e.shiftKey ? 2 : 1);
      let handled = true;

      if (isFly) {
        switch (e.code) {
          case 'KeyW': controls.forward(step, true); break;
          case 'KeyS': controls.forward(-step, true); break;
          case 'KeyA': controls.truck(-step, 0, true); break;
          case 'KeyD': controls.truck(step, 0, true); break;
          case 'KeyE': case 'PageUp': controls.elevate(step, true); break;
          case 'KeyQ': case 'PageDown': controls.elevate(-step, true); break;
          default: handled = false;
        }
      } else if (isWalk) {
        // Chế độ Đi bộ (Walk Mode) góc nhìn thứ nhất
        const currentPos = new THREE.Vector3();
        const currentTarget = new THREE.Vector3();
        controls.getPosition(currentPos);
        controls.getTarget(currentTarget);

        // Tính hướng nhìn ngang (X-Z plane)
        const dir = new THREE.Vector3().subVectors(currentTarget, currentPos);
        dir.y = 0;
        if (dir.lengthSq() < 0.0001) {
          dir.set(0, 0, -1);
        } else {
          dir.normalize();
        }

        // Hướng vuông góc bên phải
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3();
        switch (e.code) {
          case 'KeyW': moveVec.add(dir); break;
          case 'KeyS': moveVec.sub(dir); break;
          case 'KeyA': moveVec.sub(right); break;
          case 'KeyD': moveVec.add(right); break;
          default: handled = false;
        }

        if (handled && moveVec.lengthSq() > 0) {
          moveVec.normalize().multiplyScalar(step);

          // Vị trí đề xuất di chuyển
          const proposedPos = currentPos.clone().add(moveVec);
          let vx = moveVec.x;
          let vz = moveVec.z;

          // Danh sách các mô hình 3D để kiểm tra va chạm
          const targets = loadedModelsRef.current.map(m => m.model?.object).filter(Boolean);

          if (targets.length > 0) {
            const raycaster = new THREE.Raycaster();
            
            // 1. Kiểm tra va chạm hướng di chuyển tổng hợp
            raycaster.set(currentPos, moveVec.clone().normalize());
            const intersects = raycaster.intersectObjects(targets, true);
            
            if (intersects.length > 0 && intersects[0].distance < 0.8) {
              // Bị cản! Thử thuật toán va chạm trượt (Sliding) theo X hoặc Z độc lập
              let canMoveX = false;
              let canMoveZ = false;

              if (Math.abs(vx) > 0.001) {
                const dirX = new THREE.Vector3(vx, 0, 0).normalize();
                raycaster.set(currentPos, dirX);
                const intersectsX = raycaster.intersectObjects(targets, true);
                if (intersectsX.length === 0 || intersectsX[0].distance >= 0.8) {
                  canMoveX = true;
                }
              }

              if (Math.abs(vz) > 0.001) {
                const dirZ = new THREE.Vector3(0, 0, vz).normalize();
                raycaster.set(currentPos, dirZ);
                const intersectsZ = raycaster.intersectObjects(targets, true);
                if (intersectsZ.length === 0 || intersectsZ[0].distance >= 0.8) {
                  canMoveZ = true;
                }
              }

              if (canMoveX && !canMoveZ) {
                moveVec.set(vx, 0, 0);
              } else if (!canMoveX && canMoveZ) {
                moveVec.set(0, 0, vz);
              } else if (canMoveX && canMoveZ) {
                if (Math.abs(vx) > Math.abs(vz)) {
                  moveVec.set(vx, 0, 0);
                } else {
                  moveVec.set(0, 0, vz);
                }
              } else {
                moveVec.set(0, 0, 0); // Bị chặn hoàn toàn
              }
              
              proposedPos.copy(currentPos).add(moveVec);
            }
            
            // 2. Trọng lực & Bám sàn (Gravity): Bắn tia thẳng đứng xuống từ vị trí đề xuất
            if (moveVec.lengthSq() > 0) {
              raycaster.set(proposedPos, new THREE.Vector3(0, -1, 0));
              const intersectsFloor = raycaster.intersectObjects(targets, true);
              if (intersectsFloor.length > 0) {
                const dist = intersectsFloor[0].distance;
                // Chỉ bám sàn nếu chênh lệch cao độ trong khoảng 1.2m (bậc thang/dốc)
                if (Math.abs(1.6 - dist) < 1.2) {
                  proposedPos.y = proposedPos.y - dist + 1.6;
                }
              }
            }
          }

          // Cập nhật vị trí camera và target sát camera (0.01m)
          const newTarget = proposedPos.clone().add(new THREE.Vector3().subVectors(currentTarget, currentPos).setLength(0.01));
          controls.setLookAt(proposedPos.x, proposedPos.y, proposedPos.z, newTarget.x, newTarget.y, newTarget.z, false);
        }
      }

      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', handleFlyKey);

    // TỐI ƯU HÓA ĐÃ KIỂM CHỨNG: Loại bỏ việc thay đổi LOD động khi xoay camera.
    // Việc thay đổi LOD liên tục làm nghẽn Main Thread gây giật hình (stuttering).
    // Giữ nguyên mức chi tiết đầy đủ để hiển thị đẹp và nhấp chọn chính xác.
    /*
    const handleCameraMoveStart = async () => { ... };
    const handleCameraRest = async () => { ... };
    */

    // Handle container resizing
    const handleResize = () => {
      world.renderer?.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleFlyKey);
      domElement.removeEventListener('contextmenu', handleContextMenu);
      if (containerRef.current) {
        containerRef.current.removeEventListener('dblclick', handleDoubleClick);
      }
      
      // Cleanup Section Box elements
      if (world.renderer?.three) {
        world.renderer.three.clippingPlanes = [];
      }
      if (boxMeshRef.current) {
        boxMeshRef.current.geometry.dispose();
        if (Array.isArray(boxMeshRef.current.material)) {
          boxMeshRef.current.material.forEach(m => m.dispose());
        } else {
          boxMeshRef.current.material.dispose();
        }
      }
      if (transformControlsRef.current) {
        transformControlsRef.current.dispose();
      }

      components.dispose();
    };
  }, []);

  // Effect setup for ViewCube
  useEffect(() => {
    if (!viewCubeActive || !viewCubeContainerRef.current || !worldRef.current) return;
    
    const container = viewCubeContainerRef.current;
    const world = worldRef.current;
    const w = 80, h = 80;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);
    
    const createFaceTexture = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f8f9fc';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 128, 128);
      ctx.fillStyle = '#0c59a9';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };
    
    const materials = [
      new THREE.MeshBasicMaterial({ map: createFaceTexture('PHẢI') }),
      new THREE.MeshBasicMaterial({ map: createFaceTexture('TRÁI') }),
      new THREE.MeshBasicMaterial({ map: createFaceTexture('TRÊN') }),
      new THREE.MeshBasicMaterial({ map: createFaceTexture('DƯỚI') }),
      new THREE.MeshBasicMaterial({ map: createFaceTexture('TRƯỚC') }),
      new THREE.MeshBasicMaterial({ map: createFaceTexture('SAU') })
    ];
    
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), materials);
    scene.add(cube);
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / w) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / h) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(cube);
      if (intersects.length > 0) {
        const faceIndex = intersects[0].faceIndex;
        if (faceIndex !== undefined) {
          const faceIdx = Math.floor(faceIndex / 2);
          const views = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;
          const clickedView = views[faceIdx];
          
          const mainControls = world.camera.controls;
          if (mainControls && loadedModelsRef.current.length > 0) {
            const bounds = new THREE.Box3();
            for (const info of loadedModelsRef.current) {
              if (info.model && info.model.object) {
                bounds.expandByObject(info.model.object);
              }
            }
            if (!bounds.isEmpty()) {
              const center = new THREE.Vector3(); bounds.getCenter(center);
              const size = new THREE.Vector3(); bounds.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              
              switch (clickedView) {
                case 'top': mainControls.setLookAt(center.x, center.y + maxDim * 1.5, center.z, center.x, center.y, center.z, true); break;
                case 'bottom': mainControls.setLookAt(center.x, center.y - maxDim * 1.5, center.z, center.x, center.y, center.z, true); break;
                case 'front': mainControls.setLookAt(center.x, center.y, center.z + maxDim * 1.5, center.x, center.y, center.z, true); break;
                case 'back': mainControls.setLookAt(center.x, center.y, center.z - maxDim * 1.5, center.x, center.y, center.z, true); break;
                case 'right': mainControls.setLookAt(center.x + maxDim * 1.5, center.y, center.z, center.x, center.y, center.z, true); break;
                case 'left': mainControls.setLookAt(center.x - maxDim * 1.5, center.y, center.z, center.x, center.y, center.z, true); break;
              }
            }
          }
        }
      }
    };
    
    renderer.domElement.addEventListener('click', onClick);
    
    let active = true;
    const animate = () => {
      if (!active || !isActive) return;
      requestAnimationFrame(animate);
      
      if (world.camera && world.camera.three) {
        const dir = new THREE.Vector3();
        world.camera.three.getWorldDirection(dir);
        
        // Position the ViewCube camera in the opposite direction of the world camera direction
        camera.position.copy(dir).multiplyScalar(-3);
        camera.up.copy(world.camera.three.up);
        camera.lookAt(0, 0, 0);
      }
      
      renderer.render(scene, camera);
    };
    animate();
    
    return () => {
      active = false;
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      materials.forEach(m => {
        m.map?.dispose();
        m.dispose();
      });
      cube.geometry.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [viewCubeActive, modelCount, isActive]);

  // Effect setup for Minimap
  useEffect(() => {
    if (!minimapActive || !minimapContainerRef.current || !worldRef.current) return;
    
    const container = minimapContainerRef.current;
    const world = worldRef.current;
    const w = 160, h = 160;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    container.appendChild(renderer.domElement);
    
    const orthoCam = new THREE.OrthographicCamera(-15, 15, 15, -15, 49, 51);
    orthoCam.up.set(0, 0, -1);
    
    const overlay = document.createElement('canvas');
    overlay.width = w; overlay.height = h;
    overlay.className = "absolute inset-0 z-20 pointer-events-auto cursor-crosshair";
    container.appendChild(overlay);
    const ctx = overlay.getContext('2d')!;
    
    const onTeleport = (e: MouseEvent) => {
      const rect = overlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const dx = clickX - w / 2;
      const dy = clickY - h / 2;
      
      const worldScale = 30 / w;
      const mainCam = world.camera.three;
      const targetX = mainCam.position.x + dx * worldScale;
      const targetZ = mainCam.position.z - dy * worldScale;
      
      const mainControls = world.camera.controls;
      if (mainControls) {
        const pos = new THREE.Vector3();
        const target = new THREE.Vector3();
        mainControls.getPosition(pos);
        mainControls.getTarget(target);
        const dir = new THREE.Vector3().subVectors(target, pos).setLength(0.01);
        
        mainControls.setLookAt(
          targetX, pos.y, targetZ,
          targetX + dir.x, pos.y + dir.y, targetZ + dir.z,
          true
        );
      }
    };
    
    overlay.addEventListener('click', onTeleport);
    
    let active = true;
    const animate = () => {
      if (!active || !isActive) return;
      requestAnimationFrame(animate);
      
      const mainCam = world.camera.three;
      const mainControls = world.camera.controls;
      if (!mainCam || !mainControls) return;
      
      orthoCam.position.set(mainCam.position.x, mainCam.position.y + 50, mainCam.position.z);
      orthoCam.lookAt(mainCam.position.x, mainCam.position.y, mainCam.position.z);
      
      renderer.render(world.scene.three, orthoCam);
      
      ctx.clearRect(0, 0, w, h);
      
      const pos = new THREE.Vector3();
      const target = new THREE.Vector3();
      mainControls.getPosition(pos);
      mainControls.getTarget(target);
      const dir = new THREE.Vector3().subVectors(target, pos);
      dir.y = 0;
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
      } else {
        dir.set(0, 0, -1);
      }
      
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const angle = Math.atan2(dir.x, -dir.z);
      ctx.rotate(angle);
      
      ctx.fillStyle = 'rgba(12, 89, 169, 0.2)';
      ctx.strokeStyle = 'rgba(12, 89, 169, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 35, -Math.PI / 6 - Math.PI / 2, Math.PI / 6 - Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    animate();
    
    return () => {
      active = false;
      overlay.removeEventListener('click', onTeleport);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (container.contains(overlay)) {
        container.removeChild(overlay);
      }
    };
  }, [minimapActive, modelCount, isActive]);

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

    // Tự động ẩn các khối không gian ẩn (IfcSpace, IfcSite, IfcOpeningElement)
    // để click chọn chính xác cấu kiện thật — không cần Raycaster xuyên không gian
    const autoHideCategories = ['IFCSPACE', 'IFCOPENINGELEMENT', 'IFCSITE', 'IFCGEOGRAPHICELEMENT'];
    for (const cat of autoHideCategories) {
      const ids = catMap[cat];
      if (ids && ids.length > 0) {
        try {
          await model.setVisible(ids, false);
        } catch (e) {
          console.warn(`Không thể ẩn ${cat}:`, e);
        }
      }
    }
    try {
      await fragmentsRef.current?.core?.update?.(true);
    } catch (_) { /* bỏ qua nếu update lỗi */ }

    // Model + cây + bộ lọc sẵn sàng NGAY (không chờ thuộc tính chi tiết)
    if (onModelLoadedRef.current) {
      onModelLoadedRef.current(spatial, propsDictRef.current, model);
    }
    const highlighter = componentsRef.current.get(OBF.Highlighter);
    await highlighter.clear();

    // Trích xuất thuộc tính đầy đủ CHẠY NỀN — xếp hàng tuần tự (enqueueBg) và chia
    // lô nhỏ để không chồng tác vụ nặng/không tạo mảng khổng lồ → tránh OOM khi
    // liên hợp nhiều mô hình lớn.
    enqueueBg(async () => {
      // Model có thể đã bị gỡ trong lúc chờ tới lượt
      if (!loadedModelsRef.current.some(m => m.id === modelId)) return;
      const localIds = Array.from(await model.getLocalIds()) as number[];
      const newProps: Record<number, any> = {};
      // Batch nhỏ hơn và tăng độ trễ nghỉ (50ms) để không gây nghẽn CPU/GPU luồng chính
      const BATCH = 500;
      for (let i = 0; i < localIds.length; i += BATCH) {
        if (!loadedModelsRef.current.some(m => m.id === modelId)) return;
        const itemsData = await model.getItemsData(localIds.slice(i, i + BATCH), {
          attributesDefault: true,
          // BỎ LẤY RELATIONS chạy nền cho toàn bộ mô hình. Việc lấy quan hệ của hàng ngàn cấu kiện
          // cùng lúc sẽ làm nghẽn WebWorker liên tục trong 20-30s, khiến việc hover/click bị đơ.
        });
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
            if (!['_category', '_localId', '_guid', 'Name', 'ObjectType', 'IsDefinedBy'].includes(key) && item[key] !== null) {
              const val = item[key];
              props[key] = val && val.value !== undefined ? val.value : val;
            }
          }
          const psets = extractPsets(item);
          if (Object.keys(psets).length) props._psets = psets;
          newProps[id] = props;
        }
        // Nhường main thread 50ms giữa các lô giúp xoay camera mượt mà
        await new Promise(r => setTimeout(r, 50));
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
    });
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
    togglePerformanceMode: (enabled: boolean) => {
      // Đã chuyển sang SimpleRenderer nên mặc định là chế độ hiệu năng cao (Performance Mode)
      console.log('Performance mode is default now.');
    },

    loadUrl: async (url: string, modelId?: string) => {
      if (!componentsRef.current || !worldRef.current) return;
      // Tránh nạp trùng model đã có
      if (modelId && loadedModelsRef.current.some(m => m.id === modelId)) return;

      setLoading(true);
      // Chờ tác vụ nền của model trước (trích thuộc tính) xong rồi mới parse IFC
      // mới — không chồng 2 tác vụ ngốn RAM → tránh crash tab khi nạp nhiều model.
      setLoadingProgress('Đang chờ xử lý mô hình trước đó...');
      await bgQueueRef.current;
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
      await bgQueueRef.current; // chờ tác vụ nền trước đó, tránh chồng tải
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
      // Chờ các tác vụ nền (trích thuộc tính) xong rồi mới serialize buffer —
      // tránh 2 tác vụ ngốn RAM chạy cùng lúc gây OOM với model lớn.
      await bgQueueRef.current;
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
      setLoadingProgress('Đang chờ xử lý mô hình trước đó...');
      await bgQueueRef.current; // tuần tự hóa tác vụ nặng, tránh OOM
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
      if (active) { // tắt các công cụ đo khác để tránh xung đột double-click
        if (areaMeasurementRef.current) areaMeasurementRef.current.enabled = false;
        if (angleMeasurementRef.current) angleMeasurementRef.current.enabled = false;
      }
      measurementsRef.current.enabled = active;
      if (!active) {
        const m = measurementsRef.current as any;
        (m.deleteAll || m.clear)?.call(m);
      }
    },

    toggleAreaMeasurement: (active: boolean) => {
      if (!areaMeasurementRef.current) return;
      if (active) {
        if (measurementsRef.current) measurementsRef.current.enabled = false;
        if (angleMeasurementRef.current) angleMeasurementRef.current.enabled = false;
      }
      areaMeasurementRef.current.enabled = active;
      if (!active) { const m = areaMeasurementRef.current as any; (m.deleteAll || m.clear)?.call(m); }
    },

    toggleAngleMeasurement: (active: boolean) => {
      if (!angleMeasurementRef.current) return;
      if (active) {
        if (measurementsRef.current) measurementsRef.current.enabled = false;
        if (areaMeasurementRef.current) areaMeasurementRef.current.enabled = false;
      }
      angleMeasurementRef.current.enabled = active;
      if (!active) { const m = angleMeasurementRef.current as any; (m.deleteAll || m.clear)?.call(m); }
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

    // Danh mục nhanh (mô hình + lớp cấu kiện) để hiện bộ chọn phạm vi NGAY,
    // không cần trích xuất khối lượng nặng trước.
    getModelCategories: () => {
      return loadedModelsRef.current.map(m => ({
        modelId: m.id,
        modelName: m.name,
        categories: Object.keys(catMapsRef.current[m.id] || {}).sort(),
      }));
    },

    getQuantityTakeoff: async (modelIds?: string[]) => {
      let models = loadedModelsRef.current;
      if (modelIds && modelIds.length) models = models.filter(m => modelIds.includes(m.id));
      if (!models.length) return null;
      // Chờ tác vụ nền (trích thuộc tính) xong để không tranh chấp worker → tránh treo
      await bgQueueRef.current;
      try {
        const detail: QtoDetailRow[] = [];
        let total = 0, withQ = 0;
        // Bóc tách khối lượng cho các mô hình ĐƯỢC CHỌN (mỗi mô hình = 1 hạng mục)
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
      
      const renderer3 = world.renderer?.three;
      if (renderer3) {
        if (enabled) {
          // Khôi phục hàm render gốc
          if ((renderer3 as any)._originalRender) {
            renderer3.render = (renderer3 as any)._originalRender;
          }
          if (world.camera?.controls) world.camera.controls.enabled = true;
          if (world.renderer) world.renderer.enabled = true;
          
          setTimeout(() => {
            try {
              world.renderer?.resize?.();
              fragmentsRef.current?.core?.update?.(true);
              renderer3.render(world.scene.three, world.camera.three);
            } catch { /* noop */ }
          }, 80);
        } else {
          // Tạm dừng: Ghi đè hàm render bằng hàm rỗng để giải phóng hoàn toàn GPU/CPU
          if (!(renderer3 as any)._originalRender) {
            (renderer3 as any)._originalRender = renderer3.render;
          }
          renderer3.render = () => {};
          
          if (world.camera?.controls) world.camera.controls.enabled = false;
          if (world.renderer) world.renderer.enabled = false;
        }
      }
    },

    setFlyMode: (enabled: boolean) => {
      flyEnabledRef.current = enabled;
      if (enabled) {
        walkEnabledRef.current = false;
        const controls = worldRef.current?.camera?.controls;
        if (controls) {
          controls.minDistance = 0;
          controls.maxDistance = Infinity;
        }
      }
    },

    setWalkMode: (active: boolean) => {
      walkEnabledRef.current = active;
      if (active) {
        flyEnabledRef.current = false;
        const controls = worldRef.current?.camera?.controls;
        if (controls) {
          const pos = new THREE.Vector3();
          const target = new THREE.Vector3();
          controls.getPosition(pos);
          controls.getTarget(target);
          const dir = new THREE.Vector3().subVectors(target, pos).normalize();
          
          controls.setLookAt(pos.x, pos.y, pos.z, pos.x + dir.x * 0.01, pos.y + dir.y * 0.01, pos.z + dir.z * 0.01, false);
          controls.minDistance = 0.01;
          controls.maxDistance = 0.01;
        }
      } else {
        const controls = worldRef.current?.camera?.controls;
        if (controls) {
          controls.minDistance = 0;
          controls.maxDistance = Infinity;
        }
      }
    },

    setSectionBox: (active: boolean) => {
      sectionBoxEnabledRef.current = active;
      const world = worldRef.current;
      if (!world) return;

      if (boxMeshRef.current) {
        world.scene.three.remove(boxMeshRef.current);
        boxMeshRef.current.geometry.dispose();
        if (Array.isArray(boxMeshRef.current.material)) {
          boxMeshRef.current.material.forEach(m => m.dispose());
        } else {
          boxMeshRef.current.material.dispose();
        }
        boxMeshRef.current = null;
      }
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
        world.scene.three.remove(transformControlsRef.current);
        transformControlsRef.current.dispose();
        transformControlsRef.current = null;
      }

      if (active) {
        const allBounds = new THREE.Box3();
        for (const info of loadedModelsRef.current) {
          if (info.model && info.model.object) {
            allBounds.expandByObject(info.model.object);
          }
        }
        if (allBounds.isEmpty()) {
          allBounds.set(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10));
        }

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        allBounds.getCenter(center);
        allBounds.getSize(size);

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
          color: 0x0c59a9,
          transparent: true,
          opacity: 0.08,
          depthWrite: false
        });
        const boxMesh = new THREE.Mesh(geometry, material);
        boxMesh.position.copy(center);
        boxMesh.scale.copy(size);
        boxMeshRef.current = boxMesh;
        world.scene.three.add(boxMesh);

        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0c59a9, linewidth: 2 }));
        boxMesh.add(line);

        const planes = [
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
          new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
          new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
          new THREE.Plane(new THREE.Vector3(0, 0, -1), 1),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 1)
        ];
        clippingPlanesRef.current = planes;

        const updatePlanes = () => {
          boxMesh.updateMatrixWorld(true);
          const currentBounds = new THREE.Box3().setFromObject(boxMesh);
          const min = currentBounds.min;
          const max = currentBounds.max;

          planes[0].constant = max.x;
          planes[1].constant = -min.x;
          planes[2].constant = max.y;
          planes[3].constant = -min.y;
          planes[4].constant = max.z;
          planes[5].constant = -min.z;
          
          fragmentsRef.current?.core?.update?.(true);
        };

        updatePlanes();
        world.renderer.three.clippingPlanes = planes;

        const transformControls = new TransformControls(world.camera.three, world.renderer.three.domElement);
        transformControls.size = 0.75;
        transformControls.attach(boxMesh);
        transformControls.setMode('scale');
        
        transformControls.addEventListener('change', () => {
          updatePlanes();
        });

        transformControls.addEventListener('dragging-changed', (event) => {
          const controls = world.camera?.controls;
          if (controls) {
            controls.enabled = !event.value;
          }
        });

        transformControlsRef.current = transformControls;
        world.scene.three.add(transformControls);
      } else {
        world.renderer.three.clippingPlanes = [];
        fragmentsRef.current?.core?.update?.(true);
      }
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
        const renderer = worldRef.current?.renderer;
        const canvas = renderer?.three?.domElement as HTMLCanvasElement;
        if (!canvas) return null;
        
        // Render thẳng để capture canvas (SimpleRenderer)
        renderer.three.render(worldRef.current.scene.three, worldRef.current.camera.three);
        
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
    },

    compareModels: async (modelIdV1: string, modelIdV2: string) => {
      if (!highlighterRef.current) return null;
      const m1Info = loadedModelsRef.current.find(m => m.id === modelIdV1);
      const m2Info = loadedModelsRef.current.find(m => m.id === modelIdV2);
      if (!m1Info || !m2Info) return null;
      const modelV1 = m1Info.model;
      const modelV2 = m2Info.model;
      
      const getModelGuidMap = async (model: any) => {
        const guidToExpressId = new Map<string, number>();
        const localIds = Array.from(await model.getLocalIds()) as number[];
        const BATCH = 5000;
        for (let i = 0; i < localIds.length; i += BATCH) {
          const items = await model.getItemsData(localIds.slice(i, i + BATCH));
          for (const item of items) {
            if (!item) continue;
            const id = item._localId ? item._localId.value : null;
            const guid = item._guid ? item._guid.value : null;
            if (id !== null && guid) {
              guidToExpressId.set(guid, id);
            }
          }
        }
        return guidToExpressId;
      };

      try {
        const guidMapV1 = await getModelGuidMap(modelV1);
        const guidMapV2 = await getModelGuidMap(modelV2);
        const addedIdsV2: number[] = [];
        const deletedIdsV1: number[] = [];
        const commonGuids: string[] = [];

        for (const [guid, id] of guidMapV2.entries()) {
          if (!guidMapV1.has(guid)) {
            addedIdsV2.push(id);
          } else {
            commonGuids.push(guid);
          }
        }
        for (const [guid, id] of guidMapV1.entries()) {
          if (!guidMapV2.has(guid)) {
            deletedIdsV1.push(id);
          }
        }

        const modifiedIdsV2: number[] = [];
        const unchangedIdsV2: number[] = [];

        if (commonGuids.length > 0) {
          const idsV1 = commonGuids.map(g => guidMapV1.get(g)!);
          const idsV2 = commonGuids.map(g => guidMapV2.get(g)!);
          const boxesV1 = await modelV1.getBoxes(idsV1);
          const boxesV2 = await modelV2.getBoxes(idsV2);

          for (let i = 0; i < commonGuids.length; i++) {
            const box1 = boxesV1[i];
            const box2 = boxesV2[i];
            const id2 = idsV2[i];
            let isModified = false;
            if (box1 && box2 && !box1.isEmpty() && !box2.isEmpty()) {
              const center1 = box1.getCenter(new THREE.Vector3());
              const center2 = box2.getCenter(new THREE.Vector3());
              const size1 = box1.getSize(new THREE.Vector3());
              const size2 = box2.getSize(new THREE.Vector3());
              if (center1.distanceTo(center2) > 0.01 || size1.distanceTo(size2) > 0.01) {
                isModified = true;
              }
            } else if ((box1 && !box2) || (!box1 && box2)) {
              isModified = true;
            }
            if (isModified) {
              modifiedIdsV2.push(id2);
            } else {
              unchangedIdsV2.push(id2);
            }
          }
        }

        const allIdsV1 = Array.from(await modelV1.getLocalIds()) as number[];
        await modelV1.setVisible(allIdsV1, false);
        if (deletedIdsV1.length > 0) {
          await modelV1.setVisible(deletedIdsV1, true);
        }
        const allIdsV2 = Array.from(await modelV2.getLocalIds()) as number[];
        await modelV2.setVisible(allIdsV2, true);
        await fragmentsRef.current?.core?.update?.(true);

        const modelV1Uuid = modelV1.modelId || modelV1.uuid;
        const modelV2Uuid = modelV2.modelId || modelV2.uuid;

        await highlighterRef.current.clear();
        if (addedIdsV2.length > 0) {
          await highlighterRef.current.highlightByID('added', { [modelV2Uuid]: new Set(addedIdsV2) }, false, false);
        }
        if (deletedIdsV1.length > 0) {
          await highlighterRef.current.highlightByID('deleted', { [modelV1Uuid]: new Set(deletedIdsV1) }, false, false);
        }
        if (modifiedIdsV2.length > 0) {
          await highlighterRef.current.highlightByID('modified', { [modelV2Uuid]: new Set(modifiedIdsV2) }, false, false);
        }
        if (unchangedIdsV2.length > 0) {
          await highlighterRef.current.highlightByID('unchanged', { [modelV2Uuid]: new Set(unchangedIdsV2) }, false, false);
        }

        return {
          added: addedIdsV2.length,
          deleted: deletedIdsV1.length,
          modified: modifiedIdsV2.length,
          unchanged: unchangedIdsV2.length
        };
      } catch (err) {
        console.error('Model comparison failed:', err);
        return null;
      }
    },

    clearCompare: async () => {
      if (!highlighterRef.current) return;
      await highlighterRef.current.clear();
      for (const info of loadedModelsRef.current) {
        if (info.model) {
          const ids = Array.from(await info.model.getLocalIds()) as number[];
          await info.model.setVisible(ids, info.model.object?.visible !== false);
        }
      }
      await fragmentsRef.current?.core?.update?.(true);
    },

    toggleMinimap: (active: boolean) => {
      setMinimapActive(active);
    },

    toggleViewCube: (active: boolean) => {
      setViewCubeActive(active);
    },

    // Lấy cấu kiện đang ẩn theo từng model (bỏ qua model bị ẩn toàn bộ —
    // trạng thái đó đã được lưu riêng ở hiddenModels).
    getHiddenElements: async () => {
      const out: Record<string, number[]> = {};
      for (const info of loadedModelsRef.current) {
        if (info.model.object && info.model.object.visible === false) continue;
        try {
          const hidden = await info.model.getItemsByVisibility(false);
          const arr = Array.from(hidden as Iterable<number>);
          if (arr.length) out[info.id] = arr;
        } catch (e) { console.warn('getHiddenElements lỗi model', info.id, e); }
      }
      return out;
    },

    // Khôi phục cấu kiện ẩn: với mỗi model hiện rõ, reset rồi ẩn lại đúng tập đã lưu.
    applyHiddenElements: async (state, skipModelIds = []) => {
      const skip = new Set(skipModelIds);
      for (const info of loadedModelsRef.current) {
        if (skip.has(info.id)) continue; // model ẩn toàn bộ → để nguyên
        try {
          await info.model.resetVisible();
          const hidden = state[info.id];
          if (hidden && hidden.length) await info.model.setVisible(hidden, false);
        } catch (e) { console.warn('applyHiddenElements lỗi model', info.id, e); }
      }
      await fragmentsRef.current?.core?.update?.(true);
    },

    // Đọc các mặt phẳng cắt hiện tại (pháp tuyến + điểm gốc) để lưu viewpoint.
    getClippingPlanes: () => {
      const clipper = clipperRef.current as any;
      if (!clipper?.list) return [];
      const planes: { normal: number[]; origin: number[] }[] = [];
      clipper.list.forEach((p: any) => {
        if (p?.normal && p?.origin) {
          planes.push({
            normal: [p.normal.x, p.normal.y, p.normal.z],
            origin: [p.origin.x, p.origin.y, p.origin.z],
          });
        }
      });
      return planes;
    },

    // Khôi phục mặt cắt: xóa hết rồi tạo lại từ pháp tuyến + điểm gốc đã lưu.
    applyClippingPlanes: (planes) => {
      const clipper = clipperRef.current;
      const world = worldRef.current;
      if (!clipper || !world) return;
      clipper.deleteAll();
      if (!planes || planes.length === 0) {
        clipper.enabled = false;
        return;
      }
      clipper.enabled = true;
      for (const p of planes) {
        try {
          const n = new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]);
          const o = new THREE.Vector3(p.origin[0], p.origin[1], p.origin[2]);
          clipper.createFromNormalAndCoplanarPoint(world, n, o);
        } catch (e) { console.warn('applyClippingPlanes lỗi', e); }
      }
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

      {/* ViewCube Overlay */}
      {viewCubeActive && (
        <div 
          ref={viewCubeContainerRef} 
          className="absolute top-4 right-4 w-[80px] h-[80px] z-10 bg-surface-container-lowest/95 backdrop-blur border border-outline-variant/60 rounded-xl shadow-md cursor-pointer select-none overflow-hidden transition-all duration-200" 
          title="Hộp xoay góc nhìn ViewCube"
        />
      )}

      {/* Minimap Overlay */}
      {minimapActive && (
        <div 
          ref={minimapContainerRef} 
          className="absolute bottom-4 left-4 w-[160px] h-[160px] z-10 bg-surface-container-lowest/95 backdrop-blur border border-outline-variant/60 rounded-2xl shadow-lg overflow-hidden select-none"
        />
      )}
    </div>
  );
});

BimViewer.displayName = 'BimViewer';
