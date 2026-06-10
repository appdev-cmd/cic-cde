import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, MapPin, RefreshCw, Layers, Radio, Sparkles, Globe, Eye } from 'lucide-react';
import { fetchProjects } from '../../lib/api/projects';

export interface ProjectPin {
  id: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  location: string;
  status: string;
  tilesUrl: string;
  description: string;
  elevation: number;
}

const PROJECTS: ProjectPin[] = [
  {
    id: 'fpt-uni',
    name: 'FPT University Campus',
    coords: [21.0135, 105.5268], // Hoa Lac
    location: 'Khu công nghệ cao Hòa Lạc, Hà Nội',
    status: 'Đang vận hành',
    tilesUrl: 'https://vstorage.cde.cic.vn/3dtiles/fpt_uni/tileset.json',
    description: 'Mô hình GeoBIM quy hoạch tích hợp 3D Tiles và dữ liệu GIS khu công nghệ cao Hòa Lạc.',
    elevation: 24
  },
  {
    id: 'complex-a',
    name: 'Dự án Tòa nhà Complex A',
    coords: [10.7769, 106.7009], // HCMC Q1
    location: 'Quận 1, TP. Hồ Chí Minh',
    status: 'Đang thi công',
    tilesUrl: 'https://vstorage.cde.cic.vn/3dtiles/complex_a/tileset.json',
    description: 'Mô hình phối hợp thiết kế kiến trúc, kết cấu và MEP cho dự án tòa nhà hỗn hợp.',
    elevation: 8
  },
  {
    id: 'cde-bridge',
    name: 'Strategic CDE Bridge',
    coords: [16.0680, 108.2210], // Da Nang
    location: 'Hải Châu, Đà Nẵng',
    status: 'Thiết kế sơ bộ',
    tilesUrl: 'https://vstorage.cde.cic.vn/3dtiles/cde_bridge/tileset.json',
    description: 'Mô hình quy hoạch hạ tầng giao thông cầu kết nối đô thị Đà Nẵng.',
    elevation: 12
  }
];

const PROVINCES = [
  { name: 'Hà Nội', meridian: 105.0 },
  { name: 'Đà Nẵng', meridian: 108.0 },
  { name: 'TP. Hồ Chí Minh', meridian: 105.75 }
];

const CONVERTER_PRESETS = [
  { name: 'Hà Nội', x: '2324500', y: '554800', province: 'Hà Nội' },
  { name: 'Đà Nẵng', x: '1785560', y: '523640', province: 'Đà Nẵng' },
  { name: 'TP. Hồ Chí Minh', x: '1197660', y: '604000', province: 'TP. Hồ Chí Minh' }
];

const convertVN2000toWGS84 = (x: number, y: number, meridian: number): [number, number] => {
  // Chuẩn hóa hệ VN-2000 sang WGS-84 (Công thức Gauss-Kruger xấp xỉ dùng cho trực quan)
  const lat = x / 111132.954;
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLng = 111319.9 * Math.cos(latRad);
  const eastingOffset = y - 500000;
  const lng = meridian + eastingOffset / metersPerDegLng;
  return [lat, lng];
};

export function GeoBimMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  
  const [projects, setProjects] = useState<ProjectPin[]>(PROJECTS);
  const [selectedProject, setSelectedProject] = useState<ProjectPin>(PROJECTS[0]);

  // Nạp dự án thật từ Supabase (chỉ lấy dự án có toạ độ); fallback hardcoded
  useEffect(() => {
    fetchProjects().then(rows => {
      const pins: ProjectPin[] = rows
        .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
        .map(p => ({
          id: p.id, name: p.name, coords: [p.lat as number, p.lng as number],
          location: p.location, status: p.status,
          tilesUrl: p.tilesUrl || `https://vstorage.cde.cic.vn/3dtiles/${p.id}/tileset.json`,
          description: p.description, elevation: 0,
        }));
      if (pins.length > 0) {
        setProjects(pins);
        setSelectedProject(pins[0]);
      }
    }).catch(e => console.error('GeoBIM: không tải được dự án', e));
  }, []);
  const [isTilesStreaming, setIsTilesStreaming] = useState(false);
  const [streamLods, setStreamLods] = useState<string>('LOD 3 (Chi tiết thiết kế)');
  const [tilesLoadedCount, setTilesLoadedCount] = useState(37);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLayerState, setMapLayerState] = useState<'dark' | 'satellite'>('dark');

  // Trạng thái bộ chuyển đổi tọa độ VN-2000
  const [vn2000X, setVn2000X] = useState<string>('2324500');
  const [vn2000Y, setVn2000Y] = useState<string>('554800');
  const [selectedProvince, setSelectedProvince] = useState<string>('Hà Nội');
  const [convertedWGS84, setConvertedWGS84] = useState<[number, number] | null>(null);

  // 1. Dynamic Leaflet Map setup
  useEffect(() => {
    let active = true;
    
    const initMap = () => {
      if (!mapContainerRef.current || !active) return;
      const L = (window as any).L;
      if (!L) return;

      // Remove existing map instance if any
      if (mapRef.current) {
        mapRef.current.remove();
      }

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(selectedProject.coords, 13);
      mapRef.current = map;

      // Add default dark tile layer
      const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      });
      darkLayer.addTo(map);
      tileLayerRef.current = darkLayer;

      // Markers được vẽ ở effect riêng theo `projects` (xem bên dưới)

      // Add custom attribution
      L.control.attribution({
        prefix: 'CIC CDE Platform & copy; OSM & CartoDB'
      }).addTo(map);

      setMapLoaded(true);

      // Sửa lỗi hiển thị nửa trang của Leaflet: invalidateSize sau khi DOM ổn định
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 250);
    };

    // Load Leaflet JS
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Vẽ lại markers khi danh sách dự án thay đổi (hoặc map sẵn sàng)
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map || !mapLoaded) return;
    // Xoá markers cũ
    markersRef.current.forEach((m: any) => map.removeLayer(m.marker));
    markersRef.current = [];
    const icon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-primary/30 opacity-75"></span>
        <div class="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary border border-surface shadow">
          <div class="h-1.5 w-1.5 rounded-full bg-on-primary"></div>
        </div>
      </div>`,
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    projects.forEach(proj => {
      const marker = L.marker(proj.coords, { icon }).addTo(map);
      marker.on('click', () => handleSelectProject(proj));
      markersRef.current.push({ id: proj.id, marker });
    });
  }, [projects, mapLoaded]);

  // Thay đổi Lớp Bản Đồ
  const changeMapLayer = (layerType: 'dark' | 'satellite') => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    let newLayer;
    if (layerType === 'satellite') {
      newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri Satellite &copy; Esri &mdash; GIS Community'
      });
    } else {
      newLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: 'CIC CDE Platform &copy; OSM & CartoDB'
      });
    }

    newLayer.addTo(mapRef.current);
    tileLayerRef.current = newLayer;
    setMapLayerState(layerType);
  };

  // Xử lý chuyển đổi tọa độ VN-2000 sang WGS-84 & Định vị bản đồ
  const handleConvertAndLocate = () => {
    const x = parseFloat(vn2000X);
    const y = parseFloat(vn2000Y);
    if (isNaN(x) || isNaN(y)) {
      alert('Vui lòng nhập tọa độ X và Y hợp lệ.');
      return;
    }

    const prov = PROVINCES.find(p => p.name === selectedProvince);
    const meridian = prov ? prov.meridian : 105.0;

    const [lat, lng] = convertVN2000toWGS84(x, y, meridian);
    setConvertedWGS84([lat, lng]);

    if (mapRef.current) {
      const L = (window as any).L;
      if (L) {
        // Xóa marker chuyển đổi cũ nếu có
        if ((window as any).tempMarker) {
          mapRef.current.removeLayer((window as any).tempMarker);
        }

        const convertIcon = L.divIcon({
          className: 'custom-leaflet-marker-converted',
          html: `<div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-500/40 opacity-75"></span>
            <div class="relative flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border border-surface shadow">
              <div class="h-2 w-2 rounded-full bg-white"></div>
            </div>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const newMarker = L.marker([lat, lng], { icon: convertIcon })
          .addTo(mapRef.current)
          .bindPopup(`<div class="p-2 text-xs font-sans">
            <b class="text-teal-600 dark:text-emerald-400 font-bold">Điểm chuyển đổi VN-2000</b><br/>
            X: ${x.toLocaleString()} m<br/>
            Y: ${y.toLocaleString()} m<br/>
            WGS84: ${lat.toFixed(6)}, ${lng.toFixed(6)}
          </div>`)
          .openPopup();

        (window as any).tempMarker = newMarker;

        mapRef.current.flyTo([lat, lng], 15, {
          duration: 1.2
        });
      }
    }
  };

  // Chọn dự án và di chuyển bản đồ
  const handleSelectProject = (proj: ProjectPin) => {
    setSelectedProject(proj);
    
    if (mapRef.current) {
      mapRef.current.flyTo(proj.coords, 15, {
        duration: 1.2,
        easeLinearity: 0.25
      });
      // Đảm bảo cập nhật kích thước map
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 300);
    }

    // Giả lập tiến trình streaming 3D Tiles LOD
    setIsTilesStreaming(true);
    setTilesLoadedCount(5);
    setStreamLods('LOD 1 (Khái quát vùng)');

    let step = 1;
    const interval = setInterval(() => {
      step++;
      if (step === 2) {
        setStreamLods('LOD 2 (Khối bao cảnh)');
        setTilesLoadedCount(18);
      } else if (step === 3) {
        setStreamLods('LOD 3 (Chi tiết thiết kế)');
        setTilesLoadedCount(37);
        clearInterval(interval);
        setTimeout(() => {
          setIsTilesStreaming(false);
        }, 500);
      }
    }, 400);
  };

  // 2. Three.js OGC 3D Tiles Simulation with OrbitControls and distinct meshes
  useEffect(() => {
    if (!threeContainerRef.current) return;

    const width = threeContainerRef.current.clientWidth || 300;
    const height = threeContainerRef.current.clientHeight || 400;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101014'); // Đồng bộ dark theme

    // Setup camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5, 5, 7);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    threeContainerRef.current.appendChild(renderer.domElement);

    // Setup OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Không quay xuống dưới mặt đất
    controls.minDistance = 2;
    controls.maxDistance = 15;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0c59a9, 0.5); // Ánh sáng xanh thương hiệu
    dirLight2.position.set(-5, 5, -7);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x00f0ff, 1.2, 15); // Glow màu cyan
    pointLight.position.set(0, 1.5, 0);
    scene.add(pointLight);

    // Group chứa các đối tượng mô hình
    const group = new THREE.Group();
    scene.add(group);

    // Tấm nền cơ sở
    const baseGeo = new THREE.BoxGeometry(4.6, 0.1, 4.6);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x1d1e26, flatShading: true });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.05;
    group.add(baseMesh);

    // Lưới kỹ thuật đại diện cho GIS Grid
    const gridHelper = new THREE.GridHelper(5, 12, 0x0c59a9, 0x333340);
    gridHelper.position.y = 0.005;
    group.add(gridHelper);

    // Xây dựng mô hình 3D tương ứng cho từng dự án
    const buildingMeshes: THREE.Mesh[] = [];
    const glassyMaterial = (colorCode: number) => {
      return new THREE.MeshPhysicalMaterial({
        color: colorCode,
        transparent: true,
        opacity: 0.45,
        roughness: 0.15,
        metalness: 0.2,
        transmission: 0.55,
        thickness: 0.4
      });
    };

    const wiremat = new THREE.LineBasicMaterial({ color: 0x00d0ff, linewidth: 1 });

    const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      group.add(mesh);
      buildingMeshes.push(mesh);

      // Thêm lưới khung dây bên ngoài (wireframe) tạo cảm giác mô hình quy hoạch công nghệ cao
      const wiregeo = new THREE.EdgesGeometry(geo);
      const wireframe = new THREE.LineSegments(wiregeo, wiremat);
      wireframe.position.copy(pos);
      group.add(wireframe);
    };

    // Tạo hình học dựa trên dự án được chọn
    if (selectedProject.id === 'fpt-uni') {
      // 1. FPT Campus: Khu học xá phức hợp, thấp tầng trải rộng
      addMesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), glassyMaterial(0x00f0ff), new THREE.Vector3(0, 0.4, 0));
      addMesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), glassyMaterial(0x3b82f6), new THREE.Vector3(-1.2, 0.25, -1.2));
      addMesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), glassyMaterial(0x3b82f6), new THREE.Vector3(1.2, 0.25, 1.2));
      addMesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), glassyMaterial(0x00b981), new THREE.Vector3(1.2, 0.2, -1.2));
      addMesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), glassyMaterial(0x00b981), new THREE.Vector3(-1.2, 0.2, 1.2));
    } else if (selectedProject.id === 'complex-a') {
      // 2. Complex A: Tòa nhà chọc trời phân đoạn giật cấp
      const floorHeight = 0.45;
      const totalFloors = 7;
      for (let i = 0; i < totalFloors; i++) {
        const size = 1.6 - i * 0.15;
        addMesh(
          new THREE.BoxGeometry(size, floorHeight - 0.05, size),
          glassyMaterial(0x3b82f6),
          new THREE.Vector3(0, floorHeight / 2 + i * floorHeight, 0)
        );
      }
    } else if (selectedProject.id === 'cde-bridge') {
      // 3. Strategic CDE Bridge: Cầu dây văng
      // Mặt cầu
      addMesh(new THREE.BoxGeometry(4.8, 0.08, 0.8), glassyMaterial(0x10b981), new THREE.Vector3(0, 0.4, 0));
      
      // Trụ tháp cầu (Pylons)
      const towerGeo = new THREE.BoxGeometry(0.15, 1.5, 0.15);
      addMesh(towerGeo, glassyMaterial(0xf59e0b), new THREE.Vector3(-1.2, 0.75, 0.3));
      addMesh(towerGeo, glassyMaterial(0xf59e0b), new THREE.Vector3(-1.2, 0.75, -0.3));
      addMesh(towerGeo, glassyMaterial(0xf59e0b), new THREE.Vector3(1.2, 0.75, 0.3));
      addMesh(towerGeo, glassyMaterial(0xf59e0b), new THREE.Vector3(1.2, 0.75, -0.3));

      // Xà ngang nối đỉnh tháp
      addMesh(new THREE.BoxGeometry(0.15, 0.08, 0.75), glassyMaterial(0xf59e0b), new THREE.Vector3(-1.2, 1.35, 0));
      addMesh(new THREE.BoxGeometry(0.15, 0.08, 0.75), glassyMaterial(0xf59e0b), new THREE.Vector3(1.2, 1.35, 0));

      // Hệ dây văng (Cables)
      const cableMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const drawCableLine = (start: THREE.Vector3, end: THREE.Vector3) => {
        const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
        group.add(new THREE.Line(geom, cableMat));
      };

      for (let offset = 0.3; offset <= 1.8; offset += 0.3) {
        drawCableLine(new THREE.Vector3(-1.2, 1.35, 0), new THREE.Vector3(-1.2 - offset, 0.4, 0));
        drawCableLine(new THREE.Vector3(-1.2, 1.35, 0), new THREE.Vector3(-1.2 + offset, 0.4, 0));
        drawCableLine(new THREE.Vector3(1.2, 1.35, 0), new THREE.Vector3(1.2 - offset, 0.4, 0));
        drawCableLine(new THREE.Vector3(1.2, 1.35, 0), new THREE.Vector3(1.2 + offset, 0.4, 0));
      }
    }

    // Vòng lặp Render & Animation
    let animationFrameId: number;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Xoay chậm mô hình tự động để tạo cảm giác sống động
      group.rotation.y += 0.0015;
      
      // Hiệu ứng nhấp nhô nhẹ theo thời gian của mô hình 3D
      const time = Date.now() * 0.0015;
      buildingMeshes.forEach((mesh, index) => {
        mesh.scale.setScalar(1 + Math.sin(time + index * 0.4) * 0.008);
      });

      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();

    // Thay đổi kích cỡ
    const handleResize = () => {
      if (!threeContainerRef.current) return;
      const w = threeContainerRef.current.clientWidth;
      const h = threeContainerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      if (threeContainerRef.current && renderer.domElement) {
        threeContainerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [selectedProject]);

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm overflow-hidden flex flex-col lg:flex-row relative min-h-[480px] lg:h-[620px]">
      <div className="absolute top-0 left-0 w-full lg:w-1.5 h-1.5 lg:h-full bg-primary"></div>
      
      {/* GIS Sidebar Controls */}
      <div className="lg:w-[35%] p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-outline-variant/30 bg-surface-container-low/10 z-10 shrink-0 lg:h-full overflow-y-auto custom-scrollbar">
         <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
               <span className="p-1.5 bg-primary-container/10 text-primary rounded-lg">
                  <Layers size={16} />
               </span>
               <h3 className="font-bold text-[14px] text-on-surface tracking-tight">GeoBIM GIS 3D Dashboard</h3>
            </div>
            
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
               Hệ thống quy hoạch số tích hợp trích xuất tọa độ địa lý và truyền dẫn mô hình công trình 3D Tiles trực tiếp trên bản đồ số VN-2000/WGS-84.
            </p>

            {/* Project selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-outline tracking-wider uppercase">Lựa chọn dự án</label>
              <div className="flex flex-col gap-1.5">
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className={`text-left px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                      selectedProject.id === proj.id
                        ? 'bg-primary/5 border-primary text-primary shadow-sm'
                        : 'bg-surface hover:bg-surface-container-low border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="truncate">{proj.name}</span>
                    <MapPin size={13} className={selectedProject.id === proj.id ? 'text-primary' : 'text-outline'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Map Layers controls */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-outline tracking-wider uppercase">Lớp bản đồ nền GIS</label>
              <div className="flex gap-2">
                <button
                  onClick={() => changeMapLayer('dark')}
                  className={`flex-1 py-1.5 px-3 rounded-lg border text-[11px] font-semibold text-center transition-all cursor-pointer ${
                    mapLayerState === 'dark'
                      ? 'bg-primary/5 border-primary text-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-container-low border-outline-variant/60 text-on-surface-variant'
                  }`}
                >
                  Bản đồ Tối
                </button>
                <button
                  onClick={() => changeMapLayer('satellite')}
                  className={`flex-1 py-1.5 px-3 rounded-lg border text-[11px] font-semibold text-center transition-all cursor-pointer ${
                    mapLayerState === 'satellite'
                      ? 'bg-primary/5 border-primary text-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-container-low border-outline-variant/60 text-on-surface-variant'
                  }`}
                >
                  Vệ tinh (Esri)
                </button>
              </div>
            </div>

            {/* GIS Coordinate Converter */}
            <div className="border-t border-outline-variant/20 pt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe size={13} className="text-primary" />
                <span className="text-[10px] font-bold text-outline tracking-wider uppercase">Chuyển đổi VN-2000</span>
              </div>
              
              <div className="p-3 bg-surface rounded-xl border border-outline-variant/50 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-outline uppercase">Tọa độ X (N)</label>
                    <input 
                      type="number" 
                      value={vn2000X} 
                      onChange={(e) => setVn2000X(e.target.value)} 
                      className="w-full mt-1 px-2 py-1 bg-surface-container border border-outline-variant/60 rounded text-[11px] font-semibold text-on-surface"
                      placeholder="Ví dụ: 2324500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-outline uppercase">Tọa độ Y (E)</label>
                    <input 
                      type="number" 
                      value={vn2000Y} 
                      onChange={(e) => setVn2000Y(e.target.value)} 
                      className="w-full mt-1 px-2 py-1 bg-surface-container border border-outline-variant/60 rounded text-[11px] font-semibold text-on-surface"
                      placeholder="Ví dụ: 554800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-outline uppercase">Kinh tuyến tỉnh</label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full mt-1 px-1.5 py-1 bg-surface-container border border-outline-variant/60 rounded text-[11px] font-semibold text-on-surface cursor-pointer"
                    >
                      {PROVINCES.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.meridian}°)</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={handleConvertAndLocate}
                      className="w-full bg-primary hover:bg-primary/95 text-on-primary font-bold text-[11px] py-1.5 rounded transition-all active:scale-98 cursor-pointer shadow-sm text-center"
                    >
                      Định vị Map
                    </button>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-outline-variant/20">
                  <span className="text-[9px] text-outline font-semibold">Tọa độ mẫu:</span>
                  <div className="flex gap-1 flex-wrap">
                    {CONVERTER_PRESETS.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setVn2000X(preset.x);
                          setVn2000Y(preset.y);
                          setSelectedProvince(preset.province);
                          // Giả lập click định vị
                          setTimeout(() => {
                            const prov = PROVINCES.find(p => p.name === preset.province);
                            const meridian = prov ? prov.meridian : 105.0;
                            const [lat, lng] = convertVN2000toWGS84(parseFloat(preset.x), parseFloat(preset.y), meridian);
                            setConvertedWGS84([lat, lng]);
                            
                            if (mapRef.current) {
                              const L = (window as any).L;
                              if (L) {
                                if ((window as any).tempMarker) {
                                  mapRef.current.removeLayer((window as any).tempMarker);
                                }
                                const convertIcon = L.divIcon({
                                  className: 'custom-leaflet-marker-converted',
                                  html: `<div class="relative flex items-center justify-center">
                                    <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-500/40 opacity-75"></span>
                                    <div class="relative flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border border-surface shadow">
                                      <div class="h-2 w-2 rounded-full bg-white"></div>
                                    </div>
                                  </div>`,
                                  iconSize: [28, 28],
                                  iconAnchor: [14, 14]
                                });
                                const newMarker = L.marker([lat, lng], { icon: convertIcon })
                                  .addTo(mapRef.current)
                                  .bindPopup(`<div class="p-2 text-xs font-sans">
                                    <b class="text-primary font-bold">Tọa độ mẫu ${preset.name}</b><br/>
                                    VN-2000 X: ${preset.x} m<br/>
                                    VN-2000 Y: ${preset.y} m<br/>
                                    WGS84: ${lat.toFixed(6)}, ${lng.toFixed(6)}
                                  </div>`)
                                  .openPopup();
                                (window as any).tempMarker = newMarker;
                                mapRef.current.flyTo([lat, lng], 15);
                              }
                            }
                          }, 0);
                        }}
                        className="text-[9px] bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 px-1.5 py-0.5 rounded text-on-surface-variant font-medium cursor-pointer"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* GIS Metadata details */}
            <div className="border-t border-outline-variant/20 pt-3 space-y-2">
              <div className="flex justify-between items-center text-[12px]">
                <span className="font-mono text-[10.5px] text-outline">Vị trí địa lý</span>
                <span className="font-semibold text-on-surface text-right font-mono truncate max-w-[140px]" title={selectedProject.location}>
                  {selectedProject.coords[0].toFixed(4)}, {selectedProject.coords[1].toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="font-mono text-[10.5px] text-outline">Độ cao cơ sở (MSL)</span>
                <span className="font-semibold text-on-surface">+{selectedProject.elevation} m</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="font-mono text-[10.5px] text-outline">URL 3D Tiles</span>
                <span className="font-mono text-[10px] text-primary truncate max-w-[120px] hover:underline cursor-pointer" title={selectedProject.tilesUrl}>
                  {selectedProject.tilesUrl.split('/').pop()}
                </span>
              </div>
            </div>
         </div>

         {/* Streaming feedback panel */}
         <div className="mt-4 pt-3 border-t border-outline-variant/20">
           <div className={`p-3 rounded-lg border ${
             isTilesStreaming 
               ? 'bg-primary-container/10 border-primary/20 text-primary animate-pulse' 
               : 'bg-teal-accent/5 border-teal-accent/15 text-on-surface'
           } flex items-center gap-2.5 text-xs`}>
             <Radio size={14} className={isTilesStreaming ? 'text-primary animate-pulse' : 'text-teal-accent'} />
             <div className="min-w-0 flex-1">
               <div className="font-bold flex items-center gap-1">
                 {isTilesStreaming ? 'Streaming 3D Tiles...' : 'Đã truyền dẫn hoàn tất'}
                 {!isTilesStreaming && <Sparkles size={11} className="text-tertiary" />}
               </div>
               <div className="text-[10.5px] text-on-surface-variant font-medium mt-0.5">
                 {isTilesStreaming ? `${streamLods} | Tải: ${tilesLoadedCount} mảnh` : `LOD 3 ổn định | Đã tải: ${tilesLoadedCount} mảnh b3dm`}
               </div>
             </div>
           </div>
         </div>
      </div>

      {/* Map + 3D Render Area */}
      <div className="flex-1 flex flex-col md:flex-row relative h-[480px] lg:h-full min-w-0 z-0">
         
         {/* Live Leaflet GIS map */}
         <div className="flex-1 relative h-[60%] md:h-full min-w-0 bg-surface-container-lowest">
           <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
           {!mapLoaded && (
             <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low/90 z-20 gap-2 font-semibold text-xs text-on-surface-variant">
               <RefreshCw className="animate-spin text-primary" size={14} />
               Khởi tạo bản đồ GIS...
             </div>
           )}
           <div className="absolute top-3 left-3 bg-surface-container-lowest/80 backdrop-blur border border-outline-variant/40 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-mono text-outline z-10 font-bold uppercase tracking-wider">
             GIS Map View
           </div>
         </div>

         {/* 3D tiles building detail stream preview */}
         <div className="w-full md:w-[35%] xl:w-[30%] border-t md:border-t-0 md:border-l border-outline-variant/30 h-[40%] md:h-full relative flex flex-col bg-[#101014] z-10 shrink-0">
           <div className="absolute top-3 left-3 bg-[#18181c] border border-outline-variant/20 px-2.5 py-1 rounded-md shadow-sm text-[9px] font-mono text-outline/80 z-20 font-bold uppercase tracking-wider flex items-center gap-1">
             <span className="w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-pulse"></span>
             OGC 3D Tiles View
           </div>
           
           <div ref={threeContainerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />
           
           <div className="p-3 bg-[#141419] border-t border-outline-variant/15 text-[11px] text-outline shrink-0 leading-relaxed font-sans">
             <span className="font-bold text-on-surface flex items-center gap-1.5">
               <Eye size={12} className="text-primary" />
               {selectedProject.name}
             </span>
             <p className="text-[10px] text-on-surface-variant/80 mt-0.5 line-clamp-2">{selectedProject.description}</p>
           </div>
         </div>

      </div>
    </section>
  );
}
