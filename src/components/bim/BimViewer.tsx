import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as FRAG from '@thatopen/fragments';
import { Loader2 } from 'lucide-react';
// @ts-ignore
import workerUrl from '@thatopen/fragments/worker?url';

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

export interface QtoResult {
  rows: QtoRow[];
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
export const extractQto = async (model: any): Promise<QtoResult> => {
  const idsSet = await model.getLocalIds();
  const ids = Array.from(idsSet) as number[];
  const items = await model.getItemsData(ids, {
    attributesDefault: true,
    relations: {
      IsDefinedBy: { attributes: true, relations: true },
    },
  });

  const map: Record<string, QtoRow> = {};
  let withQ = 0;

  for (const item of items) {
    if (!item) continue;
    const category = attrStr(item._category) || 'IFC ELEMENT';
    if (!map[category]) {
      map[category] = { category, count: 0, area: 0, volume: 0, length: 0 };
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

  const rows = Object.values(map)
    .filter(r => r.count > 0)
    .sort((a, b) => b.volume - a.volume || b.count - a.count);

  return { rows, totalElements: ids.length, elementsWithQuantities: withQ };
};

export interface BimViewerProps {
  onModelLoaded?: (spatialTree: any, properties: any, model: any) => void;
  onElementSelected?: (properties: any) => void;
}

export interface LoadedModelInfo {
  id: string;
  name: string;
  model: any;
}

export interface BimViewerRef {
  loadUrl: (url: string) => Promise<void>;
  loadFile: (file: File) => Promise<void>;
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
  const clipperRef = useRef<OBC.Clipper | null>(null);
  const measurementsRef = useRef<OBF.LengthMeasurement | null>(null);
  const currentModelRef = useRef<any>(null);
  const loadedModelsRef = useRef<LoadedModelInfo[]>([]);
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

    // 2. Setup Worlds
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    worldRef.current = world;

    // Initialize scene, renderer, and camera
    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, containerRef.current);
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

    // Handle container resizing
    const handleResize = () => {
      world.renderer?.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeEventListener('dblclick', handleDoubleClick);
      }
      components.dispose();
    };
  }, []);

  // Shared helper: process a loaded model (extract props, spatial, fit camera)
  const processLoadedModel = async (model: any, modelName: string) => {
    if (!componentsRef.current || !worldRef.current) return;

    const modelId = (model as any).modelId || model.uuid || crypto.randomUUID();
    currentModelRef.current = model;
    loadedModelsRef.current = [...loadedModelsRef.current, { id: modelId, name: modelName, model }];
    setModelCount(loadedModelsRef.current.length);

    worldRef.current.scene.three.add(model.object);

    // Fit camera to all loaded models combined
    const sceneBounds = new THREE.Box3();
    for (const info of loadedModelsRef.current) {
      sceneBounds.expandByObject(info.model.object);
    }
    const center = new THREE.Vector3();
    sceneBounds.getCenter(center);
    const size = new THREE.Vector3();
    sceneBounds.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    worldRef.current.camera.controls.setLookAt(
      center.x + maxDim, center.y + maxDim, center.z + maxDim,
      center.x, center.y, center.z, true
    );

    setLoadingProgress('Đang lập cấu trúc không gian...');
    const spatial = await model.getSpatialStructure();

    setLoadingProgress('Đang trích xuất thuộc tính các cấu kiện...');
    const localIdsSet = await model.getLocalIds();
    const localIds = Array.from(localIdsSet);
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

      const props: any = {
        expressID: id, expressId: id,
        Name: name, ObjectType: objectType,
        GlobalId: guid, GUID: guid, type: category
      };

      for (const key in item) {
        if (!['_category', '_localId', '_guid', 'Name', 'ObjectType'].includes(key) && item[key] !== null) {
          const val = item[key];
          props[key] = val && val.value !== undefined ? val.value : val;
        }
      }
      newProps[id] = props;
    }

    // Merge into existing properties dict (multi-model)
    propsDictRef.current = { ...propsDictRef.current, ...newProps };

    if (onModelLoadedRef.current) {
      onModelLoadedRef.current(spatial, propsDictRef.current, model);
    }

    const highlighter = componentsRef.current.get(OBF.Highlighter);
    await highlighter.clear();
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
    loadUrl: async (url: string) => {
      if (!componentsRef.current || !worldRef.current) return;

      setLoading(true);
      setLoadingProgress('Đang tải tệp tin từ máy chủ...');

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch IFC file: ${response.statusText}`);

        setLoadingProgress('Đang phân tích cấu hình hình học IFC...');
        const data = await response.arrayBuffer();
        const buffer = new Uint8Array(data);

        const ifcLoader = await setupIfcLoader();
        const modelName = url.split('/').pop() || 'default-model';

        const model = await ifcLoader.load(buffer, true, modelName, {
          instanceCallback: (importer) => {
            importer.addAllAttributes();
            importer.addAllRelations();
          }
        });

        await processLoadedModel(model, modelName);
      } catch (err) {
        console.error('Error loading IFC model:', err);
        alert('Có lỗi xảy ra khi nạp mô hình IFC: ' + (err as Error).message);
      } finally {
        setLoading(false);
        setLoadingProgress('');
      }
    },

    loadFile: async (file: File) => {
      if (!componentsRef.current || !worldRef.current) return;

      setLoading(true);
      setLoadingProgress('Đang đọc tệp tin cục bộ...');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

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
        measurementsRef.current.clear();
      }
    },

    clearAll: () => {
      if (clipperRef.current) clipperRef.current.deleteAll();
      if (measurementsRef.current) measurementsRef.current.clear();
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
      if (!currentModelRef.current) return null;
      try {
        return await extractQto(currentModelRef.current);
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
      const buffer = new Uint8Array(arrayBuffer);
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
                accept=".ifc" 
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
