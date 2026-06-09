import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, ChevronDown, ChevronRight, Folder, FolderOpen, Box, 
  Scissors, Ruler, MessageSquare, EyeOff, X, Copy, RefreshCw, Upload,
  Eye, Ghost, AlertCircle, Plus, ClipboardList, Download
} from 'lucide-react';
import { BimViewer, BimViewerRef, QtoResult } from '../bim/BimViewer';
import { analyzeElement } from '../../lib/ai/gemini';
import { exportBcf, importBcf } from '../../lib/bcf/bcf';
import { fetchBcfTopics, createBcfTopic } from '../../lib/api/data';

interface ViewerTabProps {
  selectedModelUrl: string | null;
  setSelectedModelUrl: (url: string | null) => void;
  onModelLoaded?: (spatial: any, props: any) => void;
  selectedHighlightIds: number[];
  setSelectedHighlightIds: (ids: number[]) => void;
  viewerRef?: React.RefObject<BimViewerRef | null>;
  projectId?: string;
}

interface BcfIssue {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'Resolved' | 'Closed';
  priority: 'High' | 'Medium' | 'Low';
  assignedTo: string;
  linkedElementGuid?: string;
  linkedElementExpressId?: number;
  createdDate: string;
}

export function ViewerTab({ 
  selectedModelUrl, 
  setSelectedModelUrl,
  onModelLoaded,
  selectedHighlightIds,
  setSelectedHighlightIds,
  viewerRef: externalViewerRef,
  projectId
}: ViewerTabProps) {
  const localViewerRef = useRef<BimViewerRef>(null);
  const viewerRef = externalViewerRef ?? localViewerRef;
  
  // State variables for BIM dynamic data
  const [spatialTree, setSpatialTree] = useState<any>(null);
  const [properties, setProperties] = useState<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  // Sidebar controls
  const [leftSidebarTab, setLeftSidebarTab] = useState<'spatial' | 'classes'>('spatial');
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'bcf'>('properties');
  
  // BCF States
  const [bcfIssues, setBcfIssues] = useState<BcfIssue[]>([
    {
      id: 'BCF-001',
      title: 'Xung đột dầm phụ trục C với ống gió cứu hỏa',
      description: 'Đường ống cứu hỏa đi xuyên trực tiếp qua dầm kết cấu trục C tầng 2, cần hạ cao độ.',
      status: 'Open',
      priority: 'High',
      assignedTo: 'KS. Nguyễn Văn Hải',
      linkedElementGuid: '1A2B3C4D5E6F7G8H9',
      linkedElementExpressId: 1045,
      createdDate: '2026-06-07'
    },
    {
      id: 'BCF-002',
      title: 'Lệch vị trí ô chờ cửa thoát hiểm block B',
      description: 'Vị trí trích ô chờ cửa lệch 150mm so với bản vẽ dầm chuyển vách.',
      status: 'Open',
      priority: 'Medium',
      assignedTo: 'KTS. Lê Minh Hoàng',
      linkedElementGuid: '9H8G7F6E5D4C3B2A1',
      linkedElementExpressId: 2314,
      createdDate: '2026-06-08'
    }
  ]);
  const [isCreatingBcf, setIsCreatingBcf] = useState(false);
  const [newBcfTitle, setNewBcfTitle] = useState('');
  const [newBcfDesc, setNewBcfDesc] = useState('');
  const [newBcfPriority, setNewBcfPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [newBcfAssignee, setNewBcfAssignee] = useState('KS. Nguyễn Văn Hải');

  // Category visibility states
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedModelUrl && viewerRef.current) {
      viewerRef.current.loadUrl(selectedModelUrl);
      setSelectedModelUrl(null);
    }
  }, [selectedModelUrl, setSelectedModelUrl]);

  useEffect(() => {
    if (selectedHighlightIds.length > 0 && viewerRef.current) {
      viewerRef.current.highlightElements(selectedHighlightIds);
    }
  }, [selectedHighlightIds]);
  
  // Tool state variables
  const [clippingActive, setClippingActive] = useState(false);
  const [measurementActive, setMeasurementActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // AI analysis state for the selected element
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // QTO (Quantity Take-Off) state
  const [qtoOpen, setQtoOpen] = useState(false);
  const [qtoLoading, setQtoLoading] = useState(false);
  const [qtoResult, setQtoResult] = useState<QtoResult | null>(null);

  const handleOpenQto = async () => {
    setQtoOpen(true);
    setQtoLoading(true);
    setQtoResult(null);
    try {
      const result = await viewerRef.current?.getQuantityTakeoff();
      setQtoResult(result ?? null);
    } catch (err) {
      console.error(err);
      setQtoResult(null);
    } finally {
      setQtoLoading(false);
    }
  };

  const handleExportQtoCsv = () => {
    if (!qtoResult) return;
    const header = 'Loai cau kien (IFC),So luong,Dien tich (m2),The tich (m3),Chieu dai (m)';
    const lines = qtoResult.rows.map(r =>
      `${r.category},${r.count},${r.area.toFixed(2)},${r.volume.toFixed(2)},${r.length.toFixed(2)}`
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QTO_BouocKhoiLuong_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeAI = async () => {
    if (!selectedElement) return;
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const result = await analyzeElement(selectedElement);
      setAiAnalysis(result);
    } catch (err) {
      setAiAnalysis('Không thực hiện được phân tích AI: ' + (err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  // Reset AI analysis whenever the selected element changes
  useEffect(() => {
    setAiAnalysis(null);
    setAiLoading(false);
  }, [selectedElement]);

  // Load sample IFC file
  const handleLoadSample = async () => {
    if (viewerRef.current) {
      viewerRef.current.loadUrl("https://thatopen.github.io/engine_ui-components/resources/small.ifc");
    }
  };

  const handleModelLoaded = (spatial: any, props: any, model: any) => {
    setSpatialTree(spatial);
    setProperties(props);
    setSelectedElement(null);
    setHiddenCategories(new Set());
    if (onModelLoaded) {
      onModelLoaded(spatial, props);
    }
  };

  const handleElementSelected = (props: any) => {
    setSelectedElement(props);
  };

  const handleToggleClipping = () => {
    const nextState = !clippingActive;
    setClippingActive(nextState);
    if (nextState) setMeasurementActive(false);
    viewerRef.current?.toggleClipping(nextState);
    viewerRef.current?.toggleMeasurement(false);
  };

  const handleToggleMeasurement = () => {
    const nextState = !measurementActive;
    setMeasurementActive(nextState);
    if (nextState) setClippingActive(false);
    viewerRef.current?.toggleMeasurement(nextState);
    viewerRef.current?.toggleClipping(false);
  };

  const handleCopyGuid = (guid: string) => {
    navigator.clipboard.writeText(guid);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Group IDs by IFC type
  const groupByCategory = () => {
    if (!properties) return {};
    const groups: Record<string, number[]> = {};
    for (const idStr in properties) {
      const id = Number(idStr);
      const item = properties[id];
      const cat = (item.type || 'IFCELEMENT').toUpperCase();
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(id);
    }
    return groups;
  };

  const categoriesMap = groupByCategory();
  const categoriesList = Object.keys(categoriesMap).sort();

  const handleToggleCategoryVisibility = (category: string) => {
    const nextHidden = new Set(hiddenCategories);
    if (nextHidden.has(category)) {
      nextHidden.delete(category);
    } else {
      nextHidden.add(category);
    }
    setHiddenCategories(nextHidden);

    if (viewerRef.current && properties) {
      const visibleIds: number[] = [];
      for (const cat in categoriesMap) {
        if (!nextHidden.has(cat)) {
          visibleIds.push(...categoriesMap[cat]);
        }
      }
      viewerRef.current.isolateElements(visibleIds);
    }
  };

  // BCF Creation
  const handleCreateBcf = () => {
    if (!newBcfTitle.trim()) return;
    const newIssue: BcfIssue = {
      id: `BCF-00${bcfIssues.length + 1}`,
      title: newBcfTitle,
      description: newBcfDesc,
      status: 'Open',
      priority: newBcfPriority,
      assignedTo: newBcfAssignee,
      linkedElementGuid: selectedElement ? (selectedElement.GlobalId || selectedElement.GUID) : undefined,
      linkedElementExpressId: selectedElement ? selectedElement.expressID : undefined,
      createdDate: new Date().toISOString().split('T')[0]
    };
    setBcfIssues([...bcfIssues, newIssue]);
    setNewBcfTitle('');
    setNewBcfDesc('');
    setIsCreatingBcf(false);

    // Persist to Supabase
    if (projectId) {
      createBcfTopic(projectId, {
        title: newIssue.title,
        description: newIssue.description,
        status: newIssue.status,
        priority: newIssue.priority,
        assignedTo: newIssue.assignedTo,
        linkedElementGuid: newIssue.linkedElementGuid,
        linkedElementExpressId: newIssue.linkedElementExpressId,
      });
    }
  };

  // Nạp sự vụ BCF từ Supabase theo dự án
  useEffect(() => {
    if (!projectId) return;
    fetchBcfTopics(projectId)
      .then(rows => {
        if (rows.length === 0) return; // giữ mẫu mặc định nếu DB trống
        setBcfIssues(rows.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          status: (r.status as BcfIssue['status']) || 'Open',
          priority: (r.priority as BcfIssue['priority']) || 'Medium',
          assignedTo: r.assignedTo,
          linkedElementGuid: r.linkedElementGuid,
          linkedElementExpressId: r.linkedElementExpressId,
          createdDate: r.createdDate,
        })));
      })
      .catch(err => console.error('Không tải được BCF:', err));
  }, [projectId]);

  const handleExportBcf = async () => {
    if (bcfIssues.length === 0) return;
    try {
      await exportBcf(bcfIssues);
    } catch (err) {
      alert('Không xuất được file BCF: ' + (err as Error).message);
    }
  };

  const handleImportBcf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBcf(file);
      if (imported.length === 0) {
        alert('Không tìm thấy sự vụ BCF nào trong file.');
        return;
      }
      // Gộp, bỏ trùng theo id
      setBcfIssues(prev => {
        const existing = new Set(prev.map(i => i.id));
        const merged = [...prev];
        for (const iss of imported) {
          if (!existing.has(iss.id)) merged.push(iss as BcfIssue);
        }
        return merged;
      });

      // Persist imported topics vào Supabase
      if (projectId) {
        for (const iss of imported) {
          createBcfTopic(projectId, {
            title: iss.title,
            description: iss.description,
            status: iss.status,
            priority: iss.priority,
            assignedTo: iss.assignedTo,
            linkedElementGuid: iss.linkedElementGuid,
            linkedElementExpressId: iss.linkedElementExpressId,
          });
        }
      }
      alert(`Đã nhập ${imported.length} sự vụ BCF từ "${file.name}".`);
    } catch (err) {
      alert('Không đọc được file BCF: ' + (err as Error).message);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectBcfIssue = (issue: BcfIssue) => {
    if (issue.linkedElementExpressId && viewerRef.current) {
      viewerRef.current.highlightElements([issue.linkedElementExpressId]);
      if (properties && properties[issue.linkedElementExpressId]) {
        setSelectedElement(properties[issue.linkedElementExpressId]);
        setRightPanelTab('properties');
      }
    }
  };

  const getPropValue = (prop: any): string => {
    if (prop === null || prop === undefined) return 'N/A';
    if (typeof prop === 'object') {
      if ('value' in prop) return String(prop.value);
      return JSON.stringify(prop);
    }
    return String(prop);
  };

  return (
    <div className="flex-1 flex overflow-hidden relative selection:bg-none">
      
      {/* Left Spatial Tree / IFC Filter */}
      <aside className="w-[300px] xl:w-[340px] bg-surface-container-lowest border-r border-outline-variant flex flex-col z-20 shrink-0 shadow-sm">
         <div className="p-3 border-b border-outline-variant flex items-center justify-between gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/60 w-full">
              <button 
                onClick={() => setLeftSidebarTab('spatial')}
                className={`flex-1 text-center py-1.5 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                  leftSidebarTab === 'spatial' 
                    ? 'bg-surface text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Không gian
              </button>
              <button 
                onClick={() => setLeftSidebarTab('classes')}
                className={`flex-1 text-center py-1.5 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                  leftSidebarTab === 'classes' 
                    ? 'bg-surface text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Bộ lọc IFC
              </button>
            </div>
            <button 
              onClick={handleLoadSample}
              className="text-primary hover:text-primary/80 transition-colors hover:bg-primary-container/10 p-1.5 rounded-md flex items-center gap-1 font-extrabold text-xs shrink-0"
              title="Tải Mô hình Mẫu"
            >
              <RefreshCw size={14} /> Mẫu
            </button>
         </div>

         {/* Left Sidebar Body */}
         <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {leftSidebarTab === 'spatial' ? (
              spatialTree ? (
                 <div className="flex flex-col select-none">
                    <SpatialTreeNode 
                      node={spatialTree} 
                      properties={properties}
                      onSelect={(id) => {
                        if (properties && properties[id]) {
                          setSelectedElement(properties[id]);
                        } else {
                          setSelectedElement({
                            expressID: id,
                            Name: `Cấu kiện [ID: ${id}]`,
                            ObjectType: 'IFC ELEMENT'
                          });
                        }
                      }} 
                    />
                 </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center p-6 text-center text-on-surface-variant gap-3">
                    <Folder size={32} className="text-outline/40" />
                    <p className="text-xs font-medium leading-relaxed">
                       Nhấp vào <strong>"Mẫu"</strong> phía trên hoặc tải lên file IFC để xem cấu trúc không gian của công trình.
                    </p>
                 </div>
              )
            ) : (
              properties ? (
                <div className="space-y-3 p-1">
                  <div className="text-[10px] font-bold text-outline tracking-wider uppercase mb-2">Bộ lọc cấu kiện theo nhóm lớp IFC</div>
                  {categoriesList.map(cat => {
                    const isHidden = hiddenCategories.has(cat);
                    const count = categoriesMap[cat].length;
                    return (
                      <div 
                        key={cat} 
                        onClick={() => handleToggleCategoryVisibility(cat)}
                        className="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg cursor-pointer transition-colors border border-transparent hover:border-outline-variant/30"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input 
                            type="checkbox" 
                            checked={!isHidden} 
                            onChange={() => {}} // Controlled by click on parent
                            className="rounded text-primary focus:ring-primary border-outline-variant shrink-0 cursor-pointer"
                          />
                          <span className={`text-[12px] truncate font-semibold ${isHidden ? 'text-outline line-through' : 'text-on-surface'}`}>
                            {cat}
                          </span>
                        </div>
                        <span className="text-[10.5px] font-mono font-bold bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-on-surface-variant gap-3">
                   <Filter size={32} className="text-outline/40" />
                   <p className="text-xs font-medium leading-relaxed">
                      Chưa nạp thuộc tính mô hình để thực hiện phân nhóm bộ lọc.
                   </p>
                </div>
              )
            )}
         </div>
      </aside>

      {/* Center 3D Workspace */}
      <div className="flex-1 relative bg-surface-container-low overflow-hidden flex items-center justify-center">
         
         {/* Render actual BimViewer component */}
         <BimViewer 
            ref={viewerRef}
            onModelLoaded={handleModelLoaded}
            onElementSelected={handleElementSelected}
         />

         {/* Floating Camera Angles Selector */}
         <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/60 p-1 rounded-xl shadow-md flex gap-1 z-10">
           {([
             { id: 'iso', label: 'ISO' },
             { id: 'top', label: 'TOP' },
             { id: 'front', label: 'FRONT' },
             { id: 'right', label: 'RIGHT' }
           ] as const).map(view => (
             <button 
               key={view.id}
               onClick={() => viewerRef.current?.setCameraView(view.id)} 
               className="px-2 py-1 text-[11px] font-bold text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition-colors cursor-pointer"
             >
               {view.label}
             </button>
           ))}
         </div>

         {/* Floating Pill Toolbar */}
         <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-surface-container-lowest/80 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-lg border border-outline-variant/50 flex items-center gap-1 z-20">
            <ToolButton 
              icon={<Scissors size={20} />} 
              label="Cắt lát (Click đúp để cắt)" 
              active={clippingActive}
              onClick={handleToggleClipping}
            />
            <ToolButton 
              icon={<Ruler size={20} />} 
              label="Đo khoảng cách (Click đúp đặt điểm)" 
              active={measurementActive}
              onClick={handleToggleMeasurement}
            />
            <div className="w-px h-5 bg-outline-variant/60 mx-2"></div>
            <ToolButton
              icon={<MessageSquare size={20} />}
              label="Tạo Sự vụ BCF"
              active={rightPanelTab === 'bcf'}
              onClick={() => setRightPanelTab(rightPanelTab === 'bcf' ? 'properties' : 'bcf')}
            />
            <ToolButton
              icon={<ClipboardList size={20} />}
              label="Bóc tách khối lượng (QTO)"
              active={qtoOpen}
              onClick={handleOpenQto}
            />
            <div className="w-px h-5 bg-outline-variant/60 mx-2"></div>
            <ToolButton 
              icon={<EyeOff size={20} />} 
              label="Ẩn / Xóa đo đạc" 
              onClick={() => {
                viewerRef.current?.clearAll();
                viewerRef.current?.isolateElements([]);
                viewerRef.current?.setGhostMode([], false);
              }}
            />
         </div>
      </div>

      {/* Right Sidebar Panel */}
      <aside className="w-[320px] xl:w-[360px] bg-surface-container-lowest border-l border-outline-variant flex flex-col z-20 shrink-0 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
         
         {/* Right Sidebar Tabs Switcher */}
         <div className="p-3 border-b border-outline-variant flex bg-surface-container-low shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex bg-surface rounded-lg p-0.5 border border-outline-variant/60 w-full">
              <button 
                onClick={() => setRightPanelTab('properties')}
                className={`flex-1 text-center py-1.5 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                  rightPanelTab === 'properties' 
                    ? 'bg-surface-container-highest text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Thuộc tính
              </button>
              <button 
                onClick={() => setRightPanelTab('bcf')}
                className={`flex-1 text-center py-1.5 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                  rightPanelTab === 'bcf' 
                    ? 'bg-surface-container-highest text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Sự vụ BCF
              </button>
            </div>
         </div>

         {rightPanelTab === 'properties' ? (
           /* PROPERTIES VIEW */
           <>
             {/* Header */}
             <div className="p-4 border-b border-outline-variant bg-surface-container-low/20 flex justify-between items-start shrink-0">
                <div className="min-w-0 pr-4">
                   <h2 className="font-semibold text-[17px] text-on-surface mb-0.5 truncate tracking-tight">
                      {selectedElement ? getPropValue(selectedElement.Name) : 'Chọn Cấu kiện'}
                   </h2>
                   <p className="font-mono text-[11px] text-on-surface-variant truncate">
                      {selectedElement ? getPropValue(selectedElement.ObjectType) : 'Nhấp chuột vào mô hình 3D'}
                   </p>
                </div>
                {selectedElement && (
                  <button 
                    onClick={() => setSelectedElement(null)}
                    className="text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container p-1 rounded-full shrink-0"
                  >
                     <X size={18} />
                  </button>
                )}
             </div>

             {/* Scrollable Properties */}
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                {selectedElement ? (
                  <>
                    <PropertyGroup title="Công cụ Cấu kiện (Element Tools)">
                      <div className="flex gap-2 p-3 bg-surface-container-lowest border-b border-outline-variant/20">
                        <button 
                          onClick={() => {
                            if (selectedElement && viewerRef.current) {
                              viewerRef.current.isolateElements([selectedElement.expressID]);
                            }
                          }}
                          className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs py-2 rounded-lg font-bold transition-all text-center cursor-pointer"
                        >
                          Cô lập (Isolate)
                        </button>
                        <button 
                          onClick={() => {
                            if (selectedElement && viewerRef.current) {
                              viewerRef.current.setGhostMode([selectedElement.expressID], true);
                            }
                          }}
                          className="flex-1 bg-tertiary-container/10 hover:bg-tertiary-container/20 text-tertiary border border-tertiary-container/20 text-xs py-2 rounded-lg font-bold transition-all text-center cursor-pointer"
                        >
                          Làm mờ xung quanh
                        </button>
                        <button 
                          onClick={() => {
                            if (viewerRef.current) {
                              viewerRef.current.isolateElements([]);
                              viewerRef.current.setGhostMode([], false);
                            }
                          }}
                          className="px-2.5 bg-surface border border-outline-variant hover:bg-surface-container text-on-surface-variant text-xs py-2 rounded-lg font-bold transition-all text-center cursor-pointer"
                          title="Thiết lập lại hiển thị"
                        >
                          Reset
                        </button>
                      </div>
                    </PropertyGroup>

                    <PropertyGroup title="Nhận dạng (Identity)">
                       <PropertyRow label="Tên" value={getPropValue(selectedElement.Name)} isMono />
                       <PropertyRow 
                         label="GUID" 
                         value={getPropValue(selectedElement.GlobalId || selectedElement.GUID)} 
                         isMono 
                         hasCopy 
                         onCopy={() => handleCopyGuid(getPropValue(selectedElement.GlobalId || selectedElement.GUID))}
                       />
                       <PropertyRow label="ID (Express)" value={String(selectedElement.expressID || selectedElement.expressId || '')} isMono />
                       <PropertyRow label="Phân lớp IFC" value={getPropValue(selectedElement.type || selectedElement.ObjectType)} />
                    </PropertyGroup>

                    {/* Render other properties dynamically if present */}
                    {Object.keys(selectedElement).filter(key => 
                      !['Name', 'GlobalId', 'GUID', 'ObjectType', 'type', 'expressID', 'expressId'].includes(key) && 
                      selectedElement[key] !== null && 
                      selectedElement[key] !== undefined
                    ).length > 0 && (
                      <PropertyGroup title="Thông số Thuộc tính (Parameters)">
                         {Object.keys(selectedElement).filter(key => 
                           !['Name', 'GlobalId', 'GUID', 'ObjectType', 'type', 'expressID', 'expressId'].includes(key)
                         ).map(key => (
                           <PropertyRow 
                             key={key} 
                             label={key} 
                             value={getPropValue(selectedElement[key])} 
                           />
                         ))}
                      </PropertyGroup>
                    )}
                  </>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center p-6 text-center text-on-surface-variant gap-2">
                      <span className="text-sm font-medium">Chưa chọn cấu kiện nào</span>
                      <p className="text-[11px] leading-relaxed text-outline">
                         Nhấp đúp hoặc click chọn cấu kiện trên bản vẽ 3D để hiển thị đầy đủ thuộc tính kỹ thuật ở đây.
                      </p>
                   </div>
                )}
             </div>

             {/* AI Action Area */}
             <div className="p-5 border-t border-outline-variant bg-surface-container-lowest shrink-0 space-y-3">
                <button
                   onClick={handleAnalyzeAI}
                   disabled={!selectedElement || aiLoading}
                   className="w-full bg-surface-container border border-tertiary-container/40 text-tertiary-container hover:text-tertiary py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-tertiary-fixed/30 transition-colors font-semibold text-[13px] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {aiLoading ? (
                     <>
                       <RefreshCw size={14} className="animate-spin" />
                       Đang phân tích...
                     </>
                   ) : (
                     <>
                       <span className="text-tertiary font-bold animate-pulse">*</span>
                       Phân tích với AI
                     </>
                   )}
                </button>
                {aiAnalysis && (
                  <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-lg p-3 max-h-48 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Phân tích AI</span>
                      <button onClick={() => setAiAnalysis(null)} className="text-on-surface-variant hover:text-error transition-colors" title="Đóng">
                        <X size={13} />
                      </button>
                    </div>
                    <p className="text-[12px] leading-relaxed text-on-surface whitespace-pre-wrap">{aiAnalysis}</p>
                  </div>
                )}
             </div>
           </>
         ) : (
           /* BCF ISSUES VIEW */
           <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar h-full space-y-4">
             <div className="space-y-4">
               <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
                 <span className="text-[11px] font-bold text-outline uppercase tracking-wider">Danh sách sự vụ ({bcfIssues.length})</span>
                 <div className="flex items-center gap-1">
                   <label
                     className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                     title="Nhập file .bcfzip từ Revit/Navisworks"
                   >
                     <Download size={12} /> Nhập
                     <input type="file" accept=".bcfzip,.zip" onChange={handleImportBcf} className="hidden" />
                   </label>
                   <button
                     onClick={handleExportBcf}
                     disabled={bcfIssues.length === 0}
                     className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-primary/5 transition-colors flex items-center gap-1 font-bold text-[11px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                     title="Xuất tất cả sự vụ ra file .bcfzip"
                   >
                     <Upload size={12} /> Xuất
                   </button>
                   <button
                     onClick={() => setIsCreatingBcf(true)}
                     className="text-primary hover:text-primary-container p-1 rounded hover:bg-primary/5 transition-colors flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                   >
                     <Plus size={12} /> Tạo mới
                   </button>
                 </div>
               </div>

               {isCreatingBcf ? (
                 /* Creation Form */
                 <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                   <div className="flex justify-between items-center mb-1">
                     <h4 className="font-bold text-[12px] text-on-surface">Tạo sự vụ BCF mới</h4>
                     <button 
                       onClick={() => setIsCreatingBcf(false)}
                       className="text-on-surface-variant hover:text-error transition-colors font-bold text-[11px] cursor-pointer"
                     >
                       Hủy
                     </button>
                   </div>

                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-outline uppercase">Tiêu đề sự vụ</label>
                     <input 
                       type="text" 
                       placeholder="Ví dụ: Xung đột dầm với ống nước" 
                       value={newBcfTitle}
                       onChange={(e) => setNewBcfTitle(e.target.value)}
                       className="w-full px-2.5 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface"
                     />
                   </div>

                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-outline uppercase">Mô tả chi tiết</label>
                     <textarea 
                       placeholder="Mô tả hiện trạng và giải pháp..." 
                       value={newBcfDesc}
                       onChange={(e) => setNewBcfDesc(e.target.value)}
                       rows={3}
                       className="w-full px-2.5 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface resize-none"
                     />
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                     <div className="space-y-1">
                       <label className="text-[10px] font-bold text-outline uppercase">Độ ưu tiên</label>
                       <select 
                         value={newBcfPriority}
                         onChange={(e) => setNewBcfPriority(e.target.value as any)}
                         className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                       >
                         <option value="High">Cao</option>
                         <option value="Medium">Trung bình</option>
                         <option value="Low">Thấp</option>
                       </select>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[10px] font-bold text-outline uppercase">Giao xử lý</label>
                       <select 
                         value={newBcfAssignee}
                         onChange={(e) => setNewBcfAssignee(e.target.value)}
                         className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                       >
                         <option value="KS. Nguyễn Văn Hải">KS. Nguyễn Văn Hải</option>
                         <option value="KTS. Lê Minh Hoàng">KTS. Lê Minh Hoàng</option>
                         <option value="KS. Trần Thu Thảo">KS. Trần Thu Thảo</option>
                       </select>
                     </div>
                   </div>

                   <div className="bg-primary/5 p-2 rounded-lg border border-primary/10 text-[10.5px] leading-relaxed text-on-surface-variant font-medium">
                     <span className="font-bold text-primary">Cấu kiện: </span>
                     {selectedElement ? (
                       <span className="font-semibold text-on-surface truncate inline-block max-w-[200px] align-bottom">
                         {getPropValue(selectedElement.Name)}
                       </span>
                     ) : (
                       <span className="text-outline">Chọn cấu kiện để liên kết</span>
                     )}
                   </div>

                   <button 
                     onClick={handleCreateBcf}
                     className="w-full bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs py-2 rounded-lg transition-colors text-center cursor-pointer shadow-sm mt-1"
                   >
                     Gửi Sự vụ BCF
                   </button>
                 </div>
               ) : (
                 /* Issues List */
                 <div className="space-y-3 overflow-y-auto">
                   {bcfIssues.map(issue => (
                     <div 
                       key={issue.id}
                       onClick={() => handleSelectBcfIssue(issue)}
                       className="bg-surface border border-outline-variant/40 hover:border-primary/40 rounded-xl p-3.5 cursor-pointer transition-all duration-200 group"
                     >
                       <div className="flex justify-between items-center mb-1.5">
                         <span className="font-mono text-[10.5px] font-bold text-primary bg-primary-container/10 px-2 py-0.5 rounded">
                           {issue.id}
                         </span>
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                           issue.priority === 'High' 
                             ? 'bg-error-container/20 text-error border-error-variant/20' 
                             : issue.priority === 'Medium' 
                             ? 'bg-warning/10 text-warning border-warning/20' 
                             : 'bg-surface-container text-on-surface-variant'
                         }`}>
                           {issue.priority === 'High' ? 'Ưu tiên Cao' : issue.priority === 'Medium' ? 'Trung bình' : 'Thấp'}
                         </span>
                       </div>
                       <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors leading-snug mb-1">
                         {issue.title}
                       </h4>
                       <p className="text-[11px] text-outline leading-normal line-clamp-2 mb-2 font-medium">
                         {issue.description}
                       </p>
                       <div className="flex justify-between items-center text-[10.5px] font-semibold text-on-surface-variant border-t border-outline-variant/20 pt-2">
                         <span>Giao: {issue.assignedTo}</span>
                         <span className="font-mono text-outline text-[10px]">{issue.createdDate}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         )}
      </aside>

      {/* QTO Modal */}
      {qtoOpen && (
        <div
          className="absolute inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[100] animate-in fade-in duration-200 p-6"
          onClick={() => setQtoOpen(false)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl border border-outline-variant flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" />
                <h3 className="font-bold text-[15px] text-on-surface">Bảng Bóc tách Khối lượng (QTO)</h3>
              </div>
              <button
                onClick={() => setQtoOpen(false)}
                className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {qtoLoading ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <RefreshCw size={28} className="animate-spin text-primary" />
                  <span className="text-sm font-medium">Đang trích xuất khối lượng từ mô hình IFC...</span>
                </div>
              ) : !qtoResult || qtoResult.rows.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center gap-2 text-center text-on-surface-variant px-6">
                  <AlertCircle size={28} className="text-outline/50" />
                  <p className="text-sm font-medium">Chưa nạp mô hình hoặc mô hình không chứa dữ liệu khối lượng (Qto_*BaseQuantities).</p>
                  <p className="text-[11px] text-outline">Hãy nạp một mô hình IFC có bộ thuộc tính khối lượng để bóc tách.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] text-on-surface-variant font-medium">
                      Tổng <span className="font-bold text-on-surface">{qtoResult.totalElements}</span> cấu kiện,
                      trong đó <span className="font-bold text-primary">{qtoResult.elementsWithQuantities}</span> có dữ liệu khối lượng.
                    </div>
                    <button
                      onClick={handleExportQtoCsv}
                      className="flex items-center gap-1.5 bg-primary text-on-primary hover:bg-primary/95 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      <Upload size={13} /> Xuất CSV
                    </button>
                  </div>
                  <table className="w-full text-[12.5px] border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-outline border-b border-outline-variant">
                        <th className="text-left font-bold py-2 px-2">Loại cấu kiện (IFC)</th>
                        <th className="text-right font-bold py-2 px-2">Số lượng</th>
                        <th className="text-right font-bold py-2 px-2">Diện tích (m²)</th>
                        <th className="text-right font-bold py-2 px-2">Thể tích (m³)</th>
                        <th className="text-right font-bold py-2 px-2">Chiều dài (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qtoResult.rows.map((r) => (
                        <tr key={r.category} className="border-b border-outline-variant/30 hover:bg-surface-container/40 transition-colors">
                          <td className="py-2 px-2 font-semibold text-on-surface">{r.category}</td>
                          <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.count}</td>
                          <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.area > 0 ? r.area.toFixed(2) : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.volume > 0 ? r.volume.toFixed(2) : '—'}</td>
                          <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.length > 0 ? r.length.toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-outline-variant font-bold text-on-surface">
                        <td className="py-2 px-2">TỔNG CỘNG</td>
                        <td className="py-2 px-2 text-right font-mono">{qtoResult.rows.reduce((s, r) => s + r.count, 0)}</td>
                        <td className="py-2 px-2 text-right font-mono">{qtoResult.rows.reduce((s, r) => s + r.area, 0).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">{qtoResult.rows.reduce((s, r) => s + r.volume, 0).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">{qtoResult.rows.reduce((s, r) => s + r.length, 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="text-[10.5px] text-outline mt-4 leading-relaxed">
                    * Khối lượng được trích trực tiếp từ bộ thuộc tính <code className="font-mono">Qto_*BaseQuantities</code> trong tệp IFC.
                    Đây là nền tảng cho dự toán 5D (gắn đơn giá định mức Bộ Xây dựng) ở giai đoạn sau.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy Toast Alert */}
      {copySuccess && (
        <div className="absolute top-4 right-4 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md border border-outline-variant z-50 animate-in fade-in duration-150">
          Đã sao chép GUID!
        </div>
      )}

    </div>
  );
}

interface SpatialTreeNodeProps {
  node: any;
  onSelect: (id: number) => void;
  properties: any;
}

// Recursive spatial tree node renderer
const SpatialTreeNode: React.FC<SpatialTreeNodeProps> = ({ node, onSelect, properties }) => {
  const expressId = node.localId;
  const category = node.category;

  // If the node has no category but has children, skip rendering this level and render its children instead
  if (!category && node.children && node.children.length > 0) {
    return (
      <>
        {node.children.map((child: any, idx: number) => (
          <SpatialTreeNode key={idx} node={child} onSelect={onSelect} properties={properties} />
        ))}
      </>
    );
  }

  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const resolvedCategory = category || 'Element';

  // Helper to extract property value
  const getPropValue = (prop: any): string => {
    if (prop === null || prop === undefined) return '';
    if (typeof prop === 'object') {
      if ('value' in prop) return String(prop.value);
      return JSON.stringify(prop);
    }
    return String(prop);
  };

  // Resolve custom name from properties
  let displayName = '';
  if (expressId && properties && properties[expressId]) {
    displayName = getPropValue(properties[expressId].Name);
  }
  if (!displayName) {
    displayName = node.name || `${resolvedCategory} [ID: ${expressId || 'N/A'}]`;
  }

  return (
    <div className="ml-4 flex flex-col mt-0.5">
      <div 
        onClick={() => {
          if (hasChildren) setIsOpen(!isOpen);
          if (expressId) {
            onSelect(expressId);
          }
        }}
        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-container-low rounded cursor-pointer group transition-colors"
      >
        {hasChildren ? (
          isOpen ? <ChevronDown size={14} className="text-on-surface-variant group-hover:text-primary" /> : <ChevronRight size={14} className="text-on-surface-variant group-hover:text-primary" />
        ) : (
          <div className="w-3.5" />
        )}
        
        {/* Render appropriate folder/element icons */}
        {['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY'].includes(resolvedCategory.toUpperCase()) ? (
          isOpen ? <FolderOpen size={16} className="text-surface-tint" fill="currentColor" fillOpacity={0.15} /> : <Folder size={16} className="text-outline" />
        ) : (
          <Box size={14} className="text-outline group-hover:text-primary transition-colors" />
        )}
        
        <span className={`text-[12.5px] truncate flex-1 tracking-tight ${hasChildren ? 'font-semibold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
          {displayName}
        </span>
      </div>
      {hasChildren && isOpen && (
        <div className="border-l border-outline-variant/40 pl-1">
          {node.children.map((child: any, idx: number) => (
            <SpatialTreeNode key={idx} node={child} onSelect={onSelect} properties={properties} />
          ))}
        </div>
      )}
    </div>
  );
};

function ToolButton({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
     <button 
       onClick={onClick}
       className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors group focus:outline-none ${
         active 
           ? 'bg-primary text-on-primary shadow-inner scale-95' 
           : 'hover:bg-surface-container-high text-on-surface-variant hover:text-primary'
       }`}
     >
        {icon}
        <span className="absolute -top-8 bg-inverse-surface text-inverse-on-surface font-bold tracking-wider uppercase text-[9px] px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm z-50">
           {label}
        </span>
     </button>
  );
}

function PropertyGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border-b border-outline-variant">
       <div className="bg-surface-container/50 px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-container/80 transition-colors">
          <h3 className="font-bold text-[10px] tracking-wider uppercase text-on-surface">{title}</h3>
       </div>
       <div className="flex flex-col bg-outline-variant/10">
          {children}
       </div>
    </div>
  );
}

interface PropertyRowProps {
  label: string;
  value: string;
  isMono?: boolean;
  hasCopy?: boolean;
  onCopy?: () => void;
  rightAlign?: boolean;
}

const PropertyRow: React.FC<PropertyRowProps> = ({ label, value, isMono = false, hasCopy = false, onCopy, rightAlign = false }) => {
  return (
     <div className="flex bg-surface-container-lowest p-3 border-b border-outline-variant/20 hover:bg-surface-container-low/40 transition-colors items-baseline">
        <span className="w-[35%] min-w-0 font-medium text-[11.5px] text-on-surface-variant pr-2 truncate">{label}</span>
        <div className="flex-1 flex min-w-0 items-center justify-between group">
           <span className={`truncate w-full ${isMono ? 'font-mono text-[11px]' : 'font-medium text-[12.5px]'} text-on-surface ${rightAlign ? 'text-right' : ''}`}>
              {value}
           </span>
           {hasCopy && onCopy && (
              <button 
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className="opacity-0 group-hover:opacity-100 text-primary hover:text-primary-container transition-opacity ml-1 p-1" 
                title="Sao chép"
              >
                 <Copy size={12} />
              </button>
           )}
        </div>
     </div>
  );
};
