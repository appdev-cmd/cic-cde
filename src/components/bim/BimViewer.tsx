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

export interface BimViewerProps {
  onModelLoaded?: (spatialTree: any, properties: any, model: any) => void;
  onElementSelected?: (properties: any) => void;
}

export interface BimViewerRef {
  loadUrl: (url: string) => Promise<void>;
  toggleClipping: (active: boolean) => void;
  toggleMeasurement: (active: boolean) => void;
  clearAll: () => void;
  highlightElements: (expressIds: number[]) => Promise<void>;
  isolateElements: (expressIds: number[]) => void;
  setGhostMode: (expressIds: number[], active: boolean) => void;
  setCameraView: (viewType: 'top' | 'front' | 'right' | 'iso') => void;
}

export const BimViewer = forwardRef<BimViewerRef, BimViewerProps>(({ onModelLoaded, onElementSelected }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  
  // Keep references to components for cleanup and imperative actions
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<any>(null);
  const highlighterRef = useRef<OBF.Highlighter | null>(null);
  const clipperRef = useRef<OBC.Clipper | null>(null);
  const measurementsRef = useRef<OBF.LengthMeasurement | null>(null);
  const currentModelRef = useRef<any>(null);
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

      // Find selected Express ID from Fragment Map
      let selectedExpressId: number | null = null;
      for (const fragmentId in fragmentMap) {
        const expressIds = fragmentMap[fragmentId];
        if (expressIds) {
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
        // Deselected
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

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    loadUrl: async (url: string) => {
      if (!componentsRef.current || !worldRef.current) return;
      
      setLoading(true);
      setLoadingProgress('Đang tải tệp tin từ máy chủ...');
      
      try {
        console.log("Antigravity: Fetching URL:", url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch IFC file: ${response.statusText}`);
        
        setLoadingProgress('Đang phân tích cấu hình hình học IFC...');
        const data = await response.arrayBuffer();
        const buffer = new Uint8Array(data);
        console.log("Antigravity: Fetched buffer size:", buffer.length);

        // Get IfcLoader component
        const ifcLoader = componentsRef.current.get(OBC.IfcLoader);
        
        // Configure WASM paths
        await ifcLoader.setup({
          autoSetWasm: false,
          wasm: {
            path: window.location.origin + "/",
            absolute: true,
          }
        });
        console.log("Antigravity: IfcLoader configured.");

        const modelName = url.split('/').pop() || 'default-model';
        console.log("Antigravity: Loading model via ifcLoader...");
        const model = await ifcLoader.load(buffer, true, modelName, {
          instanceCallback: (importer) => {
            importer.addAllAttributes();
            importer.addAllRelations();
          }
        });
        console.log("Antigravity: Model loaded:", model);
        
        // Expose to window for debugging
        (window as any).debugModel = model;
        (window as any).debugComponents = componentsRef.current;
        (window as any).debugWorld = worldRef.current;

        currentModelRef.current = model;
        worldRef.current.scene.three.add(model.object);
        console.log("Antigravity: Model added to ThreeJS scene.");

        // Fit camera to model
        const bounds = new THREE.Box3().setFromObject(model.object);
        const center = new THREE.Vector3();
        bounds.getCenter(center);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        worldRef.current.camera.controls.setLookAt(
          center.x + maxDim,
          center.y + maxDim,
          center.z + maxDim,
          center.x,
          center.y,
          center.z,
          true
        );
        console.log("Antigravity: Camera positioned.");

        setLoadingProgress('Đang lập cấu trúc không gian...');
        console.log("Antigravity: Retrieving spatial structure...");
        
        // Retrieve spatial structure
        const spatial = await model.getSpatialStructure();
        console.log("Antigravity: Spatial structure retrieved:", spatial);
        (window as any).debugSpatial = spatial;
        
        // Build properties dictionary dynamically
        setLoadingProgress('Đang trích xuất thuộc tính các cấu kiện...');
        console.log("Antigravity: Building properties dictionary...");
        const localIdsSet = await model.getLocalIds();
        const localIds = Array.from(localIdsSet);
        const itemsData = await model.getItemsData(localIds);
        const propsDict: Record<number, any> = {};
        
        for (const item of itemsData) {
          if (!item) continue;
          const id = item._localId ? item._localId.value : null;
          if (id === null) continue;
          
          const guid = item._guid ? item._guid.value : 'N/A';
          const name = item.Name ? (item.Name.value !== undefined ? item.Name.value : item.Name) : `${item._category?.value || 'Element'} [ID: ${id}]`;
          const objectType = item.ObjectType ? (item.ObjectType.value !== undefined ? item.ObjectType.value : item.ObjectType) : item._category?.value || 'IFC ELEMENT';
          const category = item._category ? item._category.value : 'IFC ELEMENT';

          const props: any = {
            expressID: id,
            expressId: id,
            Name: name,
            ObjectType: objectType,
            GlobalId: guid,
            GUID: guid,
            type: category
          };

          // Copy other attributes
          for (const key in item) {
            if (!['_category', '_localId', '_guid', 'Name', 'ObjectType'].includes(key) && item[key] !== null) {
              const val = item[key];
              props[key] = val && val.value !== undefined ? val.value : val;
            }
          }
          propsDict[id] = props;
        }
        console.log("Antigravity: Properties dictionary built. Size:", Object.keys(propsDict).length);
        propsDictRef.current = propsDict;

        if (onModelLoadedRef.current) {
          onModelLoadedRef.current(spatial, propsDict, model);
        }

        // Clear previous highlights
        const highlighter = componentsRef.current.get(OBF.Highlighter);
        await highlighter.clear();
        console.log("Antigravity: Highlighter cleared.");

      } catch (err) {
        console.error('Error loading IFC model:', err);
        alert('Có lỗi xảy ra khi nạp mô hình IFC: ' + (err as Error).message);
      } finally {
        setLoading(false);
        setLoadingProgress('');
        console.log("Antigravity: Finished loadUrl.");
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
      
      const modelIdMap = {
        [model.uuid]: expressIds
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
    }
  }));

  // Handle local file upload
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !componentsRef.current || !worldRef.current) return;

    setLoading(true);
    setLoadingProgress('Đang đọc tệp tin cục bộ...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const buffer = new Uint8Array(event.target?.result as ArrayBuffer);
          const ifcLoader = componentsRef.current!.get(OBC.IfcLoader);
          
          await ifcLoader.setup({
            autoSetWasm: false,
            wasm: {
              path: window.location.origin + "/",
              absolute: true,
            }
          });

          setLoadingProgress('Đang nạp mô hình 3D (WebAssembly)...');
          
          // Clear previous model if exists
          if (currentModelRef.current) {
            worldRef.current.scene.three.remove(currentModelRef.current.object);
            currentModelRef.current.dispose?.();
          }

          const model = await ifcLoader.load(buffer, true, file.name, {
            instanceCallback: (importer) => {
              importer.addAllAttributes();
              importer.addAllRelations();
            }
          });
          currentModelRef.current = model;
          worldRef.current.scene.three.add(model.object);

          // Center camera
          const bounds = new THREE.Box3().setFromObject(model.object);
          const center = new THREE.Vector3();
          bounds.getCenter(center);
          const size = new THREE.Vector3();
          bounds.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          
          worldRef.current.camera.controls.setLookAt(
            center.x + maxDim,
            center.y + maxDim,
            center.z + maxDim,
            center.x,
            center.y,
            center.z,
            true
          );

          setLoadingProgress('Đang giải nén thuộc tính BIM...');
          const spatial = await model.getSpatialStructure();

          // Build properties dictionary dynamically
          setLoadingProgress('Đang trích xuất thuộc tính các cấu kiện...');
          const localIdsSet = await model.getLocalIds();
          const localIds = Array.from(localIdsSet);
          const itemsData = await model.getItemsData(localIds);
          const propsDict: Record<number, any> = {};
          
          for (const item of itemsData) {
            if (!item) continue;
            const id = item._localId ? item._localId.value : null;
            if (id === null) continue;
            
            const guid = item._guid ? item._guid.value : 'N/A';
            const name = item.Name ? (item.Name.value !== undefined ? item.Name.value : item.Name) : `${item._category?.value || 'Element'} [ID: ${id}]`;
            const objectType = item.ObjectType ? (item.ObjectType.value !== undefined ? item.ObjectType.value : item.ObjectType) : item._category?.value || 'IFC ELEMENT';
            const category = item._category ? item._category.value : 'IFC ELEMENT';

            const props: any = {
              expressID: id,
              expressId: id,
              Name: name,
              ObjectType: objectType,
              GlobalId: guid,
              GUID: guid,
              type: category
            };

            // Copy other attributes
            for (const key in item) {
              if (!['_category', '_localId', '_guid', 'Name', 'ObjectType'].includes(key) && item[key] !== null) {
                const val = item[key];
                props[key] = val && val.value !== undefined ? val.value : val;
              }
            }
            propsDict[id] = props;
          }
          propsDictRef.current = propsDict;

          if (onModelLoadedRef.current) {
            onModelLoadedRef.current(spatial, propsDict, model);
          }

          // Clear previous highlights
          const highlighter = componentsRef.current!.get(OBF.Highlighter);
          await highlighter.clear();
          
        } catch (err) {
          console.error(err);
          alert('Không thể nạp tệp IFC: ' + (err as Error).message);
        } finally {
          setLoading(false);
          setLoadingProgress('');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
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
      {!loading && !currentModelRef.current && (
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
