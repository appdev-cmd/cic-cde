import React, { useState, useRef } from 'react';
import { 
  FolderOpen, Folder, FileText, ChevronRight, ChevronDown, Filter, 
  Columns, Upload, Download, ExternalLink, X, Box, MoreVertical, Search, Check, AlertCircle,
  RefreshCw, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Info, Settings
} from 'lucide-react';
import { DocumentItem, ApprovalItem, ActivityItem } from '../../types';

export function validateISO19650(id: string): { 
  isValid: boolean; 
  errors: string[];
  parsed?: {
    project: string;
    originator: string;
    volume: string;
    level: string;
    type: string;
    discipline: string;
    number: string;
  }
} {
  const parts = id.split('-');
  const errors: string[] = [];
  if (parts.length !== 7) {
    return { isValid: false, errors: ['Mã tài liệu phải gồm đúng 7 trường phân tách bằng dấu gạch ngang (-) theo chuẩn ISO 19650.'] };
  }
  const [project, originator, volume, level, type, discipline, number] = parts;
  if (!/^[A-Z0-9]{3,5}$/i.test(project)) {
    errors.push('Mã Dự án phải gồm 3-5 ký tự chữ hoặc số.');
  }
  if (!/^[A-Z0-9]{3}$/i.test(originator)) {
    errors.push('Mã Đơn vị (Originator) phải gồm đúng 3 ký tự.');
  }
  if (!/^[A-Z0-9]{3}$/i.test(volume)) {
    errors.push('Mã Phân khu (Volume/System) phải gồm đúng 3 ký tự.');
  }
  if (!/^[A-Z0-9]{2,3}$/i.test(level)) {
    errors.push('Mã Tầng/Cao trình (Level) phải gồm 2-3 ký tự.');
  }
  if (!/^[A-Z0-9]{2}$/i.test(type)) {
    errors.push('Mã Loại tài liệu (Type) phải gồm đúng 2 ký tự.');
  }
  if (!/^[A-Z]$/i.test(discipline)) {
    errors.push('Mã Bộ môn (Discipline) phải gồm đúng 1 ký tự chữ cái.');
  }
  if (!/^\d{4}$/.test(number)) {
    errors.push('Số thứ tự (Number) phải gồm đúng 4 chữ số.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? { project, originator, volume, level, type, discipline, number } : undefined
  };
}

interface DocumentsTabProps {
  documents: DocumentItem[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  approvals: ApprovalItem[];
  setApprovals: React.Dispatch<React.SetStateAction<ApprovalItem[]>>;
  activities: ActivityItem[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  onOpenModel?: (fileUrl: string) => void;
}

export function DocumentsTab({
  documents,
  setDocuments,
  approvals,
  setApprovals,
  activities,
  setActivities,
  onOpenModel
}: DocumentsTabProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>('PRJ-STR-Z01-ZZ-M3-S-0023');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation states
  const [activeFolder, setActiveFolder] = useState<'01_WIP' | '02_SHARED' | '03_PUBLISHED' | '04_ARCHIVE'>('02_SHARED');
  const [activeSubFolder, setActiveSubFolder] = useState<string | undefined>('Bản vẽ thiết kế');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Folder open/collapsed states in sidebar
  const [sidebarOpenFolders, setSidebarOpenFolders] = useState<Record<string, boolean>>({
    '01_WIP': true,
    '02_SHARED': true,
    '03_PUBLISHED': true,
    '04_ARCHIVE': false
  });

  // Upload simulation state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview and Name Builder States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isNameBuilderOpen, setIsNameBuilderOpen] = useState(false);
  const [nameBuilderFields, setNameBuilderFields] = useState({
    project: 'PRJ',
    originator: 'ARC',
    volume: 'Z01',
    level: 'ZZ',
    type: 'M3',
    discipline: 'A',
    number: '0001'
  });
  
  // Panning and Zooming States for CAD Sheet Preview
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleOpenNameBuilder = (doc: DocumentItem) => {
    // Attempt to parse existing ID
    const parts = doc.id.split('-');
    if (parts.length === 7) {
      setNameBuilderFields({
        project: parts[0],
        originator: parts[1],
        volume: parts[2],
        level: parts[3],
        type: parts[4],
        discipline: parts[5],
        number: parts[6]
      });
    } else {
      // Guess fields based on creator, volume, and type
      let originator = 'GEN';
      if (doc.creator.includes('ARC')) originator = 'ARC';
      else if (doc.creator.includes('STR')) originator = 'STR';
      else if (doc.creator.includes('MEP')) originator = 'MEP';
      else if (doc.creator.includes('BIM')) originator = 'BIM';

      let volume = 'Z01';
      if (doc.volume.includes('Z02')) volume = 'Z02';
      else if (doc.volume.includes('Z00')) volume = 'Z00';

      let discipline = 'Z';
      if (doc.id.includes('-S-') || doc.name.toLowerCase().includes('kết cấu')) discipline = 'S';
      else if (doc.id.includes('-A-') || doc.name.toLowerCase().includes('kiến trúc') || doc.name.toLowerCase().includes('phối cảnh')) discipline = 'A';
      else if (doc.id.includes('-M-') || doc.name.toLowerCase().includes('mep') || doc.name.toLowerCase().includes('cơ điện') || doc.name.toLowerCase().includes('nguyên lý')) discipline = 'M';

      let docType = 'DR';
      if (doc.fileType === 'ifc') docType = 'M3';

      setNameBuilderFields({
        project: 'PRJ',
        originator,
        volume,
        level: 'ZZ',
        type: docType,
        discipline,
        number: '0001'
      });
    }
    setIsNameBuilderOpen(true);
  };

  const handleSaveName = (doc: DocumentItem) => {
    const newId = `${nameBuilderFields.project}-${nameBuilderFields.originator}-${nameBuilderFields.volume}-${nameBuilderFields.level}-${nameBuilderFields.type}-${nameBuilderFields.discipline}-${nameBuilderFields.number}`.toUpperCase();
    
    // Check if new ID is valid
    const validation = validateISO19650(newId);
    if (!validation.isValid) {
      alert("Mã được xây dựng chưa hợp lệ: " + validation.errors[0]);
      return;
    }

    const oldId = doc.id;
    // Update documents
    setDocuments(prev => prev.map(d => d.id === oldId ? { ...d, id: newId, modifiedDate: new Date().toISOString() } : d));
    setSelectedDocId(newId);
    setIsNameBuilderOpen(false);

    // Log activity
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      user: 'BIM Manager (Bạn)',
      action: `đã đổi tên và chuẩn hóa mã tài liệu thành`,
      target: newId,
      time: 'Vừa xong',
      type: 'system'
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Filter documents based on active folder, subfolder, search query, and status filter
  const filteredDocuments = documents.filter(doc => {
    // 1. Folder match
    if (doc.folder !== activeFolder) return false;
    
    // 2. Subfolder match (if in SHARED or PUBLISHED)
    if ((activeFolder === '02_SHARED' || activeFolder === '03_PUBLISHED') && activeSubFolder) {
      if (doc.subFolder !== activeSubFolder) return false;
    }
    
    // 3. Status filter match
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && doc.status !== 'PENDING_APPROVAL') return false;
      if (statusFilter === 'wip' && doc.status !== 'S0 - WIP') return false;
      if (statusFilter === 'shared' && doc.status !== 'S1 - SHARED') return false;
      if (statusFilter === 'published' && doc.status !== 'S2 - PUBLISHED') return false;
    }
    
    // 4. Search query match (ID or Name)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = doc.name.toLowerCase().includes(q);
      const idMatch = doc.id.toLowerCase().includes(q);
      return nameMatch || idMatch;
    }
    
    return true;
  });

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  // Toggle folder open state in sidebar
  const toggleFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSidebarOpenFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // Select a main folder (WIP, SHARED, etc.)
  const handleSelectFolder = (folder: '01_WIP' | '02_SHARED' | '03_PUBLISHED' | '04_ARCHIVE') => {
    setActiveFolder(folder);
    if (folder === '02_SHARED' || folder === '03_PUBLISHED') {
      setActiveSubFolder('Bản vẽ thiết kế');
    } else {
      setActiveSubFolder(undefined);
    }
    setSelectedDocId(null);
  };

  // Select a subfolder
  const handleSelectSubFolder = (folder: '01_WIP' | '02_SHARED' | '03_PUBLISHED' | '04_ARCHIVE', sub: string) => {
    setActiveFolder(folder);
    setActiveSubFolder(sub);
    setSelectedDocId(null);
  };

  // Handle local file uploads (converts IFC files to Blobs for viewer tab)
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setIsUploading(true);
    setUploadProgress(10);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            
            // Create a blob URL for IFC files so they can be loaded directly inside BimViewer
            let fileUrl = undefined;
            if (file.name.endsWith('.ifc')) {
              fileUrl = URL.createObjectURL(file);
            }
            
            const fileType = file.name.endsWith('.ifc') ? 'ifc' : file.name.endsWith('.dwg') ? 'dwg' : 'pdf';
            const newDoc: DocumentItem = {
              id: `PRJ-${fileType.toUpperCase()}-${activeFolder === '02_SHARED' ? 'Z01' : 'Z02'}-ZZ-M3-${fileType === 'ifc' ? 'W' : 'A'}-${Math.floor(1000 + Math.random() * 9000)}`,
              name: file.name.replace(/\.[^/.]+$/, ""),
              folder: '01_WIP', // Standard ISO 19650: Uploaded files always start in WIP
              subFolder: activeSubFolder || 'Bản vẽ thiết kế',
              status: 'S0 - WIP',
              revision: 'P01',
              version: 'V1',
              modifiedDate: new Date().toISOString(),
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              creator: 'BIM Manager (Bạn)',
              classification: fileType === 'ifc' ? 'EF_55_20' : 'EF_20_10',
              volume: activeFolder === '02_SHARED' ? 'Z01 - Zone 1' : 'Z00 - All Zones',
              fileType,
              fileUrl
            };
            
            setDocuments(prev => [newDoc, ...prev]);
            setSelectedDocId(newDoc.id);
            setActiveFolder('01_WIP'); // Switch to WIP tab to let user see their newly uploaded file
            setActiveSubFolder(undefined);
            
            // Log activity
            const newAct: ActivityItem = {
              id: `act-${Date.now()}`,
              user: 'BIM Manager (Bạn)',
              action: 'đã tải lên tài liệu mới',
              target: file.name,
              time: 'Vừa xong',
              type: 'upload'
            };
            setActivities(prev => [newAct, ...prev]);
          }, 300);
          return 100;
        }
        return prev + 30;
      });
    }, 100);
  };

  // Submit for approval (Moves document status to PENDING_APPROVAL and alerts Dashboard)
  const handleSubmitForApproval = (doc: DocumentItem) => {
    // 1. Update document status
    setDocuments(prev => prev.map(d => {
      if (d.id === doc.id) {
        return { ...d, status: 'PENDING_APPROVAL' };
      }
      return d;
    }));
    
    // 2. Create approval item for DashboardTab
    const newApproval: ApprovalItem = {
      id: `RFI-00${Math.floor(50 + Math.random() * 50)}`,
      type: doc.name,
      deadline: 'Trong 3 ngày',
      requester: 'BIM Manager (Bạn)',
      description: `Đề xuất phê duyệt tài liệu và chuyển đổi trạng thái bản vẽ/mô hình [${doc.id}] từ WIP (01_WIP) sang SHARED (02_SHARED).`,
      file: doc.name + (doc.fileType === 'ifc' ? '.ifc' : doc.fileType === 'dwg' ? '.dwg' : '.pdf'),
      createdDate: new Date().toISOString().split('T')[0],
      documentId: doc.id
    };
    setApprovals(prev => [newApproval, ...prev]);
    
    // 3. Log activity
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      user: 'BIM Manager (Bạn)',
      action: 'đã gửi yêu cầu phê duyệt',
      target: doc.id,
      time: 'Vừa xong',
      type: 'upload'
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Handle Approve action directly from Documents tab properties panel
  const handleApproveDocument = (doc: DocumentItem) => {
    const nextFolder = doc.folder === '01_WIP' ? '02_SHARED' : '03_PUBLISHED';
    const nextStatus = nextFolder === '02_SHARED' ? 'S1 - SHARED' : 'S2 - PUBLISHED';
    
    setDocuments(prev => prev.map(d => {
      if (d.id === doc.id) {
        return {
          ...d,
          folder: nextFolder,
          status: nextStatus,
          modifiedDate: new Date().toISOString()
        };
      }
      return d;
    }));
    
    // Remove from approvals
    setApprovals(prev => prev.filter(app => app.documentId !== doc.id));
    
    // Log activity
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      user: 'BIM Manager (Bạn)',
      action: 'đã phê duyệt tài liệu',
      target: doc.id,
      time: 'Vừa xong',
      type: 'approve'
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Handle Reject action directly from Documents tab properties panel
  const handleRejectDocument = (doc: DocumentItem) => {
    setDocuments(prev => prev.map(d => {
      if (d.id === doc.id) {
        return {
          ...d,
          status: 'S0 - WIP',
          modifiedDate: new Date().toISOString()
        };
      }
      return d;
    }));
    
    // Remove from approvals
    setApprovals(prev => prev.filter(app => app.documentId !== doc.id));
    
    // Log activity
    const newAct: ActivityItem = {
      id: `act-${Date.now()}`,
      user: 'BIM Manager (Bạn)',
      action: 'đã từ chối phê duyệt tài liệu',
      target: doc.id,
      time: 'Vừa xong',
      type: 'system'
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Canvas Panning handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // Get count of files in specific folders for sidebar badges
  const getFolderCount = (folder: '01_WIP' | '02_SHARED' | '03_PUBLISHED' | '04_ARCHIVE') => {
    return documents.filter(d => d.folder === folder).length;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface relative">
      
      {/* ISO 19650 Structural Sidebar */}
      <aside className="w-[280px] bg-surface-container-lowest border-r border-outline-variant shrink-0 flex flex-col z-20 shadow-[1px_0_2px_rgba(0,0,0,0.01)]">
         <div className="p-4 border-b border-outline-variant bg-surface-container-low/30 flex items-center justify-between">
            <h3 className="font-bold text-[11px] tracking-wider uppercase text-outline">Cấu trúc ISO 19650</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">CDE</span>
         </div>
         <div className="flex-1 overflow-y-auto p-2 pb-6 custom-scrollbar">
            <ul className="space-y-[4px]">
              
              {/* WIP Folder */}
              <li>
                 <div 
                   onClick={() => handleSelectFolder('01_WIP')}
                   className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer group transition-all duration-150 ${
                     activeFolder === '01_WIP' 
                       ? 'bg-primary-container/20 border border-primary/20 text-primary font-semibold' 
                       : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                   }`}
                 >
                    <button 
                      onClick={(e) => toggleFolder('01_WIP', e)}
                      className="text-outline hover:text-on-surface p-0.5 rounded transition-colors"
                    >
                      {sidebarOpenFolders['01_WIP'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <FolderOpen size={16} className={activeFolder === '01_WIP' ? "text-primary" : "text-outline"} fill="currentColor" fillOpacity={activeFolder === '01_WIP' ? 0.2 : 0.05} />
                    <span className="text-[13.5px] flex-1 truncate">01_WIP</span>
                    <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
                      {getFolderCount('01_WIP')}
                    </span>
                 </div>
              </li>

              {/* SHARED Folder */}
              <li>
                 <div 
                   onClick={() => handleSelectFolder('02_SHARED')}
                   className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer group transition-all duration-150 ${
                     activeFolder === '02_SHARED' && !activeSubFolder
                       ? 'bg-primary-container/20 border border-primary/20 text-primary font-semibold' 
                       : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                   }`}
                 >
                    <button 
                      onClick={(e) => toggleFolder('02_SHARED', e)}
                      className="text-outline hover:text-on-surface p-0.5 rounded transition-colors"
                    >
                      {sidebarOpenFolders['02_SHARED'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <Folder size={16} className={activeFolder === '02_SHARED' ? "text-primary" : "text-outline"} fill="currentColor" fillOpacity={0.05} />
                    <span className="text-[13.5px] flex-1 truncate">02_SHARED</span>
                    <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
                      {getFolderCount('02_SHARED')}
                    </span>
                 </div>
                 
                 {sidebarOpenFolders['02_SHARED'] && (
                    <ul className="pl-6 space-y-[2px] mt-1 relative before:absolute before:left-[17px] before:top-0 before:bottom-0 before:w-px before:bg-outline-variant/40">
                      <li>
                         <div 
                           onClick={() => handleSelectSubFolder('02_SHARED', 'Bản vẽ thiết kế')}
                           className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer relative transition-all duration-150 ${
                             activeFolder === '02_SHARED' && activeSubFolder === 'Bản vẽ thiết kế'
                               ? 'text-primary font-semibold'
                               : 'hover:bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface'
                           }`}
                         >
                            <div className="absolute left-[-9px] w-[9px] h-px bg-outline-variant/40 top-1/2"></div>
                            <FileText size={14} className={activeFolder === '02_SHARED' && activeSubFolder === 'Bản vẽ thiết kế' ? "text-primary" : "text-outline"} />
                            <span className="text-[12.5px]">Bản vẽ thiết kế</span>
                         </div>
                      </li>
                      <li>
                         <div 
                           onClick={() => handleSelectSubFolder('02_SHARED', 'Mô hình phối hợp')}
                           className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer relative transition-all duration-150 ${
                             activeFolder === '02_SHARED' && activeSubFolder === 'Mô hình phối hợp'
                               ? 'text-primary font-semibold'
                               : 'hover:bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface'
                           }`}
                         >
                            <div className="absolute left-[-9px] w-[9px] h-px bg-outline-variant/40 top-1/2"></div>
                            <Box size={14} className={activeFolder === '02_SHARED' && activeSubFolder === 'Mô hình phối hợp' ? "text-primary" : "text-outline"} />
                            <span className="text-[12.5px]">Mô hình phối hợp</span>
                         </div>
                      </li>
                    </ul>
                 )}
              </li>

              {/* PUBLISHED Folder */}
              <li className="mt-1">
                 <div 
                   onClick={() => handleSelectFolder('03_PUBLISHED')}
                   className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer group transition-all duration-150 ${
                     activeFolder === '03_PUBLISHED' && !activeSubFolder
                       ? 'bg-primary-container/20 border border-primary/20 text-primary font-semibold' 
                       : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                   }`}
                 >
                    <button 
                      onClick={(e) => toggleFolder('03_PUBLISHED', e)}
                      className="text-outline hover:text-on-surface p-0.5 rounded transition-colors"
                    >
                      {sidebarOpenFolders['03_PUBLISHED'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <Folder size={16} className={activeFolder === '03_PUBLISHED' ? "text-primary" : "text-outline"} fill="currentColor" fillOpacity={0.05} />
                    <span className="text-[13.5px] flex-1 truncate">03_PUBLISHED</span>
                    <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
                      {getFolderCount('03_PUBLISHED')}
                    </span>
                 </div>
                 
                 {sidebarOpenFolders['03_PUBLISHED'] && (
                    <ul className="pl-6 space-y-[2px] mt-1 relative before:absolute before:left-[17px] before:top-0 before:bottom-0 before:w-px before:bg-outline-variant/40">
                      <li>
                         <div 
                           onClick={() => handleSelectSubFolder('03_PUBLISHED', 'Bản vẽ thiết kế')}
                           className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer relative transition-all duration-150 ${
                             activeFolder === '03_PUBLISHED' && activeSubFolder === 'Bản vẽ thiết kế'
                               ? 'text-primary font-semibold'
                               : 'hover:bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface'
                           }`}
                         >
                            <div className="absolute left-[-9px] w-[9px] h-px bg-outline-variant/40 top-1/2"></div>
                            <FileText size={14} className={activeFolder === '03_PUBLISHED' && activeSubFolder === 'Bản vẽ thiết kế' ? "text-primary" : "text-outline"} />
                            <span className="text-[12.5px]">Bản vẽ thiết kế</span>
                         </div>
                      </li>
                      <li>
                         <div 
                           onClick={() => handleSelectSubFolder('03_PUBLISHED', 'Mô hình phối hợp')}
                           className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer relative transition-all duration-150 ${
                             activeFolder === '03_PUBLISHED' && activeSubFolder === 'Mô hình phối hợp'
                               ? 'text-primary font-semibold'
                               : 'hover:bg-surface-container-low/60 text-on-surface-variant hover:text-on-surface'
                           }`}
                         >
                            <div className="absolute left-[-9px] w-[9px] h-px bg-outline-variant/40 top-1/2"></div>
                            <Box size={14} className={activeFolder === '03_PUBLISHED' && activeSubFolder === 'Mô hình phối hợp' ? "text-primary" : "text-outline"} />
                            <span className="text-[12.5px]">Mô hình phối hợp</span>
                         </div>
                      </li>
                    </ul>
                 )}
              </li>

              {/* ARCHIVE Folder */}
              <li>
                 <div 
                   onClick={() => handleSelectFolder('04_ARCHIVE')}
                   className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer group transition-all duration-150 ${
                     activeFolder === '04_ARCHIVE' 
                       ? 'bg-primary-container/20 border border-primary/20 text-primary font-semibold' 
                       : 'hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-transparent'
                   }`}
                 >
                    <button 
                      onClick={(e) => toggleFolder('04_ARCHIVE', e)}
                      className="text-outline hover:text-on-surface p-0.5 rounded transition-colors"
                    >
                      {sidebarOpenFolders['04_ARCHIVE'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <Folder size={16} className={activeFolder === '04_ARCHIVE' ? "text-primary" : "text-outline"} fill="currentColor" fillOpacity={0.05} />
                    <span className="text-[13.5px] flex-1 truncate">04_ARCHIVE</span>
                    <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-medium">
                      {getFolderCount('04_ARCHIVE')}
                    </span>
                 </div>
              </li>

            </ul>
         </div>
      </aside>

      {/* Main Table Area */}
      <div 
        className={`flex-1 flex flex-col min-w-0 bg-surface transition-all duration-300 ${
          isDragOver ? 'bg-primary/5 border-2 border-dashed border-primary/40' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
         
         {/* Sub-Header / Path */}
         <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-lowest shrink-0 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
            <div>
               <div className="flex items-center gap-1.5 text-outline font-mono text-[10.5px] mb-1.5 uppercase tracking-wider">
                  <span>Dự án Complex A</span>
                  <ChevronRight size={10} />
                  <span>{activeFolder}</span>
                  {activeSubFolder && (
                    <>
                      <ChevronRight size={10} />
                      <span className="text-on-surface font-semibold">{activeSubFolder}</span>
                    </>
                  )}
               </div>
               <h2 className="text-[20px] font-bold text-on-surface flex items-center gap-3 tracking-tight">
                  {activeSubFolder || activeFolder}
                  <span className="bg-surface-container-high text-on-surface-variant font-mono text-[11px] px-2 py-0.5 rounded border border-outline-variant font-semibold">
                    {filteredDocuments.length} Files
                  </span>
               </h2>
            </div>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-[13px] hover:bg-primary/95 transition-all shadow-sm h-9 active:scale-98"
               >
                  <Upload size={16} />
                  Tải lên tệp tin
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef}
                 onChange={(e) => handleFileUpload(e.target.files)}
                 className="hidden" 
                 accept=".ifc,.pdf,.dwg"
               />
            </div>
         </div>

         {/* Toolbar */}
         <div className="px-6 py-2.5 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 flex-1">
               <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={15} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên hoặc mã tài liệu..."
                    className="w-full pl-9 pr-4 py-1.5 bg-surface border border-outline-variant/60 rounded-lg text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/70"
                  />
               </div>
               <div className="flex gap-2">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 pl-3 pr-8 py-0 bg-surface text-on-surface-variant font-semibold text-[11.5px] border border-outline-variant/60 rounded-lg focus:ring-primary focus:border-primary shadow-sm appearance-none outline-none cursor-pointer"
                  >
                     <option value="all">Trạng thái (Tất cả)</option>
                     <option value="wip">S0 - WIP</option>
                     <option value="pending">Chờ phê duyệt</option>
                     <option value="shared">S1 - SHARED</option>
                     <option value="published">S2 - PUBLISHED</option>
                  </select>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg border border-transparent transition-all">
                  <Columns size={16} />
               </button>
            </div>
         </div>

         {/* Table Canvas */}
         <div className="flex-1 overflow-auto bg-surface p-6 font-sans relative">
            
            {/* Uploading progress bar */}
            {isUploading && (
              <div className="mb-4 bg-primary-container/20 border border-primary/20 rounded-xl p-4 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="animate-spin text-primary" size={14} />
                    Đang nạp tệp tin lên máy chủ CDE (ISO 19650)...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {filteredDocuments.length === 0 ? (
              <div className="h-64 border border-outline-variant/40 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center text-on-surface-variant gap-3 bg-surface-container-lowest/20">
                <FileText size={36} className="text-outline/40" />
                <div>
                   <h4 className="font-semibold text-sm text-on-surface mb-1">Không có tài liệu nào</h4>
                   <p className="text-xs leading-relaxed max-w-xs text-outline">
                      Kéo thả tệp tin hoặc click "Tải lên" ở trên để đưa tài liệu vào thư mục này.
                   </p>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm flex flex-col min-w-[800px] overflow-hidden">
                 {/* Table Header */}
                 <div className="grid grid-cols-[40px_minmax(280px,2fr)_140px_90px_80px_150px_40px] items-center px-4 py-3 border-b border-outline-variant bg-surface-container-low/40 font-bold text-[10px] tracking-wider uppercase text-outline sticky top-0 z-10">
                    <div className="flex justify-center">
                       <input type="checkbox" className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary bg-surface cursor-pointer" />
                    </div>
                    <div>TÊN TÀI LIỆU</div>
                    <div>TRẠNG THÁI</div>
                    <div>REVISION</div>
                    <div>VER</div>
                    <div>NGÀY SỬA</div>
                    <div></div>
                 </div>

                 {/* Table Body */}
                 <div className="flex-1 divide-y divide-outline-variant/40">
                    {filteredDocuments.map(doc => {
                      const isSelected = doc.id === selectedDocId;
                      const isPending = doc.status === 'PENDING_APPROVAL';
                      
                      return (
                        <div 
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`grid grid-cols-[40px_minmax(280px,2fr)_140px_90px_80px_150px_40px] items-center px-4 py-3 hover:bg-surface-container-low/30 transition-colors group cursor-pointer border-l-2 ${
                            isSelected 
                              ? 'bg-primary-container/10 border-l-primary' 
                              : 'border-l-transparent'
                          }`}
                        >
                           <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => setSelectedDocId(isSelected ? null : doc.id)}
                                className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer" 
                              />
                           </div>
                           <div className="flex items-center gap-3 pr-4 overflow-hidden">
                              {doc.fileType === 'ifc' ? (
                                <div className="relative shrink-0">
                                   <Box size={22} className="text-primary" strokeWidth={1.5} />
                                   <span className="absolute -bottom-1 -right-1 bg-surface-container-lowest rounded-full p-[1.5px] border border-outline-variant/50">
                                      <span className="block w-2.5 h-2.5 bg-teal-accent rounded-full animate-pulse"></span>
                                   </span>
                                </div>
                              ) : (
                                <FileText size={22} className="text-outline shrink-0" strokeWidth={1.5} />
                              )}
                              <div className="min-w-0">
                                 <div className={`font-bold text-[13.5px] truncate group-hover:text-primary transition-colors ${
                                   isSelected ? 'text-primary' : 'text-on-surface'
                                 }`}>
                                   {doc.name}
                                 </div>
                                 <div className="font-mono text-[10.5px] text-on-surface-variant truncate mt-0.5 tracking-tight flex items-center gap-1.5">
                                    <span>{doc.id}</span>
                                    {!validateISO19650(doc.id).isValid && (
                                      <span className="inline-flex items-center text-error font-bold" title="Mã chưa đạt chuẩn ISO 19650">
                                         <AlertTriangle size={11} />
                                      </span>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <div>
                              {isPending ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container/30 border border-error-container/50 text-error font-mono text-[10px] font-bold tracking-tight animate-pulse">
                                   <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                                   CHỜ DUYỆT
                                </span>
                              ) : doc.status === 'S0 - WIP' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-variant/70 border border-outline-variant/70 text-on-surface-variant font-mono text-[10px] font-bold tracking-tight">
                                   <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                                   S0 - WIP
                                </span>
                              ) : doc.status === 'S1 - SHARED' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/20 border border-secondary-container/50 text-on-secondary-container font-mono text-[10px] font-bold tracking-tight">
                                   <span className="w-1.5 h-1.5 rounded-full bg-surface-tint"></span>
                                   S1 - SHARED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-accent/10 border border-teal-accent/30 text-teal-accent font-mono text-[10px] font-bold tracking-tight">
                                   <span className="w-1.5 h-1.5 rounded-full bg-teal-accent"></span>
                                   S2 - PUBLISHED
                                </span>
                              )}
                           </div>
                           <div className="font-mono text-[12px] text-on-surface px-1">{doc.revision}</div>
                           <div className="font-mono text-[12px] text-outline px-1">{doc.version}</div>
                           <div className="text-[12px] text-on-surface-variant">{formatDate(doc.modifiedDate)}</div>
                           <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1 text-on-surface-variant hover:text-primary rounded"><MoreVertical size={16} /></button>
                           </div>
                        </div>
                      );
                    })}
                 </div>
                 
                 {/* Footer */}
                 <div className="px-5 py-3.5 border-t border-outline-variant bg-surface-container-low/20 text-[12px] text-on-surface-variant flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-4">
                        <span>Đã chọn {selectedDoc ? '1' : '0'} tài liệu</span>
                        {selectedDoc && (
                          <>
                            <div className="h-3 w-px bg-outline-variant"></div>
                            <span className="hover:text-primary cursor-pointer transition-colors font-semibold" onClick={() => setSelectedDocId(null)}>Bỏ chọn</span>
                          </>
                        )}
                     </div>
                     <div className="flex items-center gap-4">
                        <span>1-{filteredDocuments.length} trong {filteredDocuments.length}</span>
                     </div>
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* Right Properties Panel */}
      {selectedDoc && (
         <aside className="w-[330px] xl:w-[360px] bg-surface-container-lowest border-l border-outline-variant shadow-[-4px_0_12px_rgba(0,0,0,0.015)] shrink-0 flex flex-col z-30 transform transition-transform">
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
               <h3 className="font-bold text-[16px] text-on-surface tracking-tight">Chi tiết Thuộc tính</h3>
               <button onClick={() => setSelectedDocId(null)} className="p-1 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors">
                  <X size={18} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-5 custom-scrollbar">
               {/* Preview Placeholder */}
               <div 
                 onClick={() => {
                   if (selectedDoc.fileType === 'pdf' || selectedDoc.fileType === 'dwg') {
                     setZoomScale(1.0);
                     setPanOffset({ x: 0, y: 0 });
                     setIsPreviewOpen(true);
                   } else if (selectedDoc.fileType === 'ifc') {
                     if (onOpenModel && selectedDoc.fileUrl) {
                       onOpenModel(selectedDoc.fileUrl);
                     } else if (onOpenModel) {
                       onOpenModel('https://thatopen.github.io/engine_ui-components/resources/small.ifc');
                     }
                   }
                 }}
                 className="w-full aspect-video bg-surface-container-low hover:bg-surface-container rounded-xl flex flex-col items-center justify-center border-2 border-outline-variant/30 hover:border-primary/50 border-dashed relative overflow-hidden group cursor-pointer transition-all duration-200"
               >
                  {selectedDoc.fileType === 'ifc' ? (
                    <Box size={44} className="text-primary/45 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                  ) : (
                    <FileText size={44} className="text-outline-variant/50 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                  )}
                  
                  {selectedDoc.fileType === 'ifc' ? (
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-primary bg-surface shadow-sm border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        BIM MODEL <Box size={8} />
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-on-surface/0 group-hover:bg-on-surface/5 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 duration-200">
                      <span className="text-[11px] font-bold text-on-surface bg-surface shadow border border-outline-variant/50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                        Xem bản vẽ <ExternalLink size={10} />
                      </span>
                    </div>
                  )}
               </div>

               <div>
                  <h4 className="font-bold text-[15px] text-on-surface leading-snug tracking-tight mb-1">{selectedDoc.name}</h4>
                  <div className="flex flex-col gap-1.5 pb-4 border-b border-outline-variant/60">
                     <p className="font-mono text-[11.5px] text-on-surface-variant truncate tracking-tighter">{selectedDoc.id}</p>
                     
                     {/* ISO 19650 validator alert */}
                     {(() => {
                        const validation = validateISO19650(selectedDoc.id);
                        if (!validation.isValid) {
                          return (
                            <div className="mt-1 p-2.5 bg-error-container/20 border border-error/20 rounded-lg flex flex-col gap-2">
                              <div className="flex items-start gap-1.5 text-error text-left">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <div className="text-[11px] leading-tight">
                                  <span className="font-bold block">Tên chưa chuẩn ISO 19650</span>
                                  <span className="text-on-surface-variant/90 text-[10.5px] font-normal block mt-1 leading-snug">
                                    {validation.errors[0]}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenNameBuilder(selectedDoc)}
                                className="px-2.5 py-1.5 bg-error text-on-error rounded-lg text-[11px] font-bold self-start hover:bg-error/95 transition-all shadow-sm active:scale-98 cursor-pointer"
                              >
                                Chuẩn hóa tên ngay
                              </button>
                            </div>
                          );
                        } else {
                          return (
                            <div className="mt-0.5 inline-flex items-center gap-1.5 text-teal-accent font-semibold text-[11.5px]">
                              <CheckCircle size={12} />
                              <span>Đạt chuẩn ISO 19650</span>
                            </div>
                          );
                        }
                     })()}
                  </div>
               </div>

               <div className="space-y-3">
                  {[
                     { label: 'Trạng thái', value: selectedDoc.status === 'PENDING_APPROVAL' ? 'CHỜ PHÊ DUYỆT' : selectedDoc.status },
                     { label: 'Revision', value: selectedDoc.revision },
                     { label: 'Version', value: selectedDoc.version },
                     { label: 'Phân loại', value: selectedDoc.classification },
                     { label: 'Người tạo', value: selectedDoc.creator },
                     { label: 'Khối lượng / Khu', value: selectedDoc.volume },
                     { label: 'Kích thước tệp', value: selectedDoc.size },
                     { label: 'Ngày sửa đổi', value: formatDate(selectedDoc.modifiedDate) }
                  ].map((prop, i) => (
                     <div key={i} className="grid grid-cols-[100px_1fr] border-b border-outline-variant/20 pb-2 text-[12.5px] items-baseline">
                        <div className="font-mono text-[10.5px] text-outline flex items-center">{prop.label}</div>
                        <div className="font-semibold text-on-surface flex justify-end text-right truncate pl-2">{prop.value}</div>
                     </div>
                  ))}
               </div>

               {/* BIM Agent Insight Panel */}
               <div>
                  <h5 className="font-bold text-[10px] tracking-wider uppercase text-outline mb-2">BIM Agent Insight</h5>
                  <div className="p-3.5 bg-tertiary-fixed/30 border border-tertiary-fixed-dim/40 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                     <div className="flex gap-2.5 items-start">
                        <span className="text-tertiary shrink-0 mt-0.5 font-bold animate-pulse">*</span>
                        <p className="font-medium text-[11.5px] text-on-tertiary-fixed leading-relaxed">
                           {selectedDoc.status === 'PENDING_APPROVAL' ? (
                             'Bản vẽ đang chờ xét duyệt để tích hợp vào thư mục SHARED của dự án. BIM Agent phân tích cho thấy các liên kết định vị dầm cột khớp với thiết kế chuẩn của khối tháp chính.'
                           ) : selectedDoc.fileType === 'ifc' ? (
                             'Mô hình IFC này chứa đầy đủ thông số BIM thiết kế kiến trúc và kết cấu tầng 15. Bạn có thể mở trực tiếp mô hình này trong phân hệ 3D Viewer bằng nút hành động bên dưới.'
                           ) : (
                             'Tài liệu kỹ thuật định nghĩa cấu trúc dập dầm. Bản vẽ được kiểm chứng không phát hiện lỗi thiết kế gãy góc nào ở dầm thô.'
                           )}
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Actions block */}
            <div className="p-4 border-t border-outline-variant flex flex-col gap-2 shrink-0 bg-surface-container-lowest shadow-[0_-1px_3px_rgba(0,0,0,0.015)]">
               
               {/* Contextual actions based on ISO 19650 workflow status */}
               {selectedDoc.status === 'S0 - WIP' && (
                 <button 
                   onClick={() => handleSubmitForApproval(selectedDoc)}
                   className="w-full py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-[13px] shadow transition-all active:scale-98 flex items-center justify-center gap-1.5"
                 >
                   Gửi yêu cầu phê duyệt
                 </button>
               )}

               {selectedDoc.status === 'PENDING_APPROVAL' && (
                 <div className="flex gap-2.5 w-full">
                    <button 
                      onClick={() => handleRejectDocument(selectedDoc)}
                      className="flex-1 py-2.5 border border-error text-error hover:bg-error-container/20 rounded-xl font-bold text-[13px] transition-colors focus:outline-none"
                    >
                      Từ chối
                    </button>
                    <button 
                      onClick={() => handleApproveDocument(selectedDoc)}
                      className="flex-1 py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-[13px] shadow transition-all active:scale-98"
                    >
                      Phê duyệt
                    </button>
                 </div>
               )}

               <div className="flex gap-2 w-full">
                  {selectedDoc.fileType === 'ifc' && (
                    <button 
                      onClick={() => {
                        if (onOpenModel && selectedDoc.fileUrl) {
                          onOpenModel(selectedDoc.fileUrl);
                        } else if (onOpenModel) {
                          // Fallback to small.ifc default sample URL if no blob URL
                          onOpenModel('https://thatopen.github.io/engine_ui-components/resources/small.ifc');
                        }
                      }}
                      className="flex-1 py-2 border border-primary text-primary hover:bg-primary/5 rounded-xl font-bold text-[12px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      Xem mô hình 3D
                    </button>
                  )}
                  <a 
                    href={selectedDoc.fileUrl || 'https://thatopen.github.io/engine_ui-components/resources/small.ifc'}
                    download={selectedDoc.name + (selectedDoc.fileType === 'ifc' ? '.ifc' : selectedDoc.fileType === 'dwg' ? '.dwg' : '.pdf')}
                    className="flex-1 py-2 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-xl font-bold text-[12px] text-on-surface flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                     Tải xuống
                  </a>
               </div>
            </div>
         </aside>
      )}

      {/* 1. CAD SHEET PREVIEW MODAL */}
      {isPreviewOpen && selectedDoc && (
        <div className="fixed inset-0 bg-inverse-on-surface/85 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="w-[95vw] h-[90vh] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {selectedDoc.fileType === 'dwg' ? (
                  <span className="bg-amber-500/10 text-amber-500 font-bold px-2 py-0.5 rounded text-[11px] font-mono border border-amber-500/20">CAD DWG</span>
                ) : (
                  <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[11px] font-mono border border-primary/20">PDF DRAWING</span>
                )}
                <div>
                  <h3 className="font-bold text-[16px] text-on-surface tracking-tight leading-none">{selectedDoc.name}</h3>
                  <span className="font-mono text-[11px] text-outline mt-1.5 block leading-none">{selectedDoc.id}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)} 
                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              
              {/* Left Viewport (Canvas Area) */}
              <div className="flex-1 bg-surface-container-high/40 relative overflow-hidden flex items-center justify-center select-none border-r border-outline-variant">
                {/* Control Panel Floating Overlay */}
                <div className="absolute top-4 left-4 z-40 bg-surface-container-lowest/95 backdrop-blur-sm border border-outline-variant/60 rounded-xl p-2 shadow-md flex items-center gap-2">
                  <button 
                    onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.25))}
                    className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg cursor-pointer transition-colors"
                    title="Phóng to"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button 
                    onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                    className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg cursor-pointer transition-colors"
                    title="Thu nhỏ"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button 
                    onClick={() => { setZoomScale(1.0); setPanOffset({ x: 0, y: 0 }); }}
                    className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg cursor-pointer transition-colors"
                    title="Đặt lại góc nhìn"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <div className="h-4 w-px bg-outline-variant/60 mx-1"></div>
                  <span className="font-mono text-xs font-bold text-on-surface-variant px-1 w-12 text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 z-40 bg-surface-container-lowest/80 text-[11px] font-medium text-outline px-3 py-1.5 rounded-lg border border-outline-variant/40 shadow-sm pointer-events-none flex items-center gap-1.5">
                  <Info size={13} />
                  <span>Kéo chuột để di chuyển bản vẽ (Pan)</span>
                </div>

                {/* Drawing Sheet Canvas Wrapper */}
                <div 
                  className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                >
                  <div 
                    style={{ 
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                      transformOrigin: 'center',
                      transition: isDraggingCanvas ? 'none' : 'transform 0.15s ease-out'
                    }}
                    className="w-[800px] h-[580px] bg-[#0c1222] text-white rounded-lg shadow-2xl border-4 border-slate-700/50 p-2 flex items-center justify-center relative select-none"
                  >
                    {/* SVG Realistic CAD Drawing */}
                    <svg width="100%" height="100%" viewBox="0 0 800 560" className="w-full h-full font-mono text-[9px]">
                      {/* Grid Lines */}
                      <g className="opacity-15">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <line key={`v-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={560} stroke="#38bdf8" strokeWidth="0.5" />
                        ))}
                        {Array.from({ length: 12 }).map((_, i) => (
                          <line key={`h-${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke="#38bdf8" strokeWidth="0.5" />
                        ))}
                      </g>

                      {/* Border Frame */}
                      <rect x="15" y="15" width="770" height="530" fill="none" stroke="#38bdf8" strokeWidth="2" />
                      <rect x="20" y="20" width="760" height="520" fill="none" stroke="#38bdf8" strokeWidth="0.75" />

                      {/* Render Drawing Based on Name */}
                      {selectedDoc.name.toLowerCase().includes('cột') || selectedDoc.name.toLowerCase().includes('structural') ? (
                        /* SECTION A-A: STRUCTURAL COLUMN REBAR DETAIL */
                        <g>
                          {/* Title text */}
                          <text x="50" y="60" className="fill-sky-400 font-bold text-sm">CHI TIẾT MẶT CẮT CỘT BTCT C1 (MẶT CẮT A-A)</text>
                          <text x="50" y="80" className="fill-slate-400">TỈ LỆ: 1:20 | BỘ MÔN KẾT CẤU</text>

                          {/* Column Concrete Outline */}
                          <rect x="280" y="150" width="240" height="240" fill="none" stroke="#fff" strokeWidth="3" />
                          <rect x="288" y="158" width="224" height="224" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />

                          {/* Rebar stirrup (Ties) */}
                          <rect x="295" y="165" width="210" height="210" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                          {/* Inner stirrup */}
                          <rect x="315" y="185" width="170" height="170" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="2,2" />

                          {/* Corner Rebar Dots (Main longitudinal bars - 8 bars) */}
                          {/* Corners */}
                          <circle cx="300" cy="170" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="500" cy="170" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="300" cy="370" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="500" cy="370" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          {/* Midpoints */}
                          <circle cx="400" cy="170" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="400" cy="370" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="300" cy="270" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                          <circle cx="500" cy="270" r="10" fill="#38bdf8" stroke="#fff" strokeWidth="1" />

                          {/* Rebar labels and arrows */}
                          <path d="M 300 170 L 220 120 L 150 120" fill="none" stroke="#38bdf8" strokeWidth="1" />
                          <text x="145" y="115" className="fill-sky-300 font-bold text-[10px]">8 Thép chủ D22 (nhóm CB400V)</text>
                          <circle cx="300" cy="170" r="3" fill="#fff" />

                          <path d="M 295 240 L 210 240 L 150 210" fill="none" stroke="#ef4444" strokeWidth="1" />
                          <text x="145" y="205" className="fill-red-400 font-bold text-[10px]">Đai thép D10 @ 150 (CB300T)</text>
                          <circle cx="295" cy="240" r="3" fill="#fff" />

                          {/* Dimension Lines */}
                          {/* Width */}
                          <line x1="280" y1="420" x2="520" y2="420" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="280" y1="415" x2="280" y2="425" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="520" y1="415" x2="520" y2="425" stroke="#38bdf8" strokeWidth="1" />
                          <text x="400" y="435" textAnchor="middle" className="fill-sky-300 font-bold">b = 600 mm</text>

                          {/* Height */}
                          <line x1="550" y1="150" x2="550" y2="390" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="545" y1="150" x2="555" y2="150" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="545" y1="390" x2="555" y2="390" stroke="#38bdf8" strokeWidth="1" />
                          <text x="560" y="275" className="fill-sky-300 font-bold">h = 600 mm</text>

                          {/* Notes */}
                          <rect x="50" y="320" width="180" height="90" fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2,2" />
                          <text x="60" y="340" className="fill-slate-400 font-bold uppercase text-[9px]">Ghi chú kỹ thuật:</text>
                          <text x="60" y="360" className="fill-slate-300">- Cấp độ bền bê tông: B30 (M400)</text>
                          <text x="60" y="375" className="fill-slate-300">- Lớp bảo vệ bê tông: 35mm</text>
                          <text x="60" y="390" className="fill-slate-300">- Mối nối so le tối thiểu 50%</text>
                        </g>
                      ) : selectedDoc.name.toLowerCase().includes('mep') || selectedDoc.name.toLowerCase().includes('nước') ? (
                        /* MEP WATER PIPING SYSTEM DIAGRAM */
                        <g>
                          <text x="50" y="60" className="fill-sky-400 font-bold text-sm">SƠ ĐỒ NGUYÊN LÝ CẤP THOÁT NƯỚC - TẦNG 2</text>
                          <text x="50" y="80" className="fill-slate-400">TỈ LỆ: N/A | BỘ MÔN MEP (CƠ ĐIỆN)</text>

                          {/* Riser pipes (vertical conduits) */}
                          <line x1="120" y1="120" x2="120" y2="480" stroke="#3b82f6" strokeWidth="4" />
                          <text x="110" y="110" className="fill-blue-400 font-bold">RISER CẤP NƯỚC SẠCH (DN50)</text>

                          <line x1="200" y1="120" x2="200" y2="480" stroke="#10b981" strokeWidth="4" />
                          <text x="190" y="110" className="fill-emerald-400 font-bold">RISER THOÁT NƯỚC THẢI (DN100)</text>

                          <line x1="280" y1="120" x2="280" y2="480" stroke="#ef4444" strokeWidth="3" />
                          <text x="270" y="110" className="fill-red-400 font-bold">CỨU HỎA SPRINKLER (DN65)</text>

                          {/* Branch Lines for Floor units */}
                          {/* Unit A */}
                          <path d="M 120 200 L 450 200 L 450 280 L 520 280" fill="none" stroke="#60a5fa" strokeWidth="2.5" />
                          <text x="320" y="190" className="fill-blue-300">Nhánh cấp căn hộ A (PPR-D25)</text>
                          
                          {/* Valve symbols */}
                          <polygon points="250,195 250,205 260,200" fill="#60a5fa" />
                          <polygon points="270,195 270,205 260,200" fill="#60a5fa" />
                          <text x="252" y="185" className="fill-blue-300 text-[8px] font-bold">VALVE</text>

                          {/* Plumbing fixture nodes */}
                          <circle cx="520" cy="280" r="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                          <text x="535" y="284" className="fill-sky-300 font-bold text-[9.5px]">Lavabo / Bồn rửa</text>

                          <path d="M 200 320 L 450 320 L 450 350 L 520 350" fill="none" stroke="#34d399" strokeWidth="3" />
                          <text x="320" y="315" className="fill-emerald-300">Nhánh thoát xí bệt (uPVC-D110)</text>

                          <circle cx="520" cy="350" r="10" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                          <text x="535" y="354" className="fill-emerald-300 font-bold text-[9.5px]">Xí bệt / Toilet</text>

                          {/* Pump room assembly */}
                          <rect x="580" y="380" width="160" height="120" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
                          <text x="590" y="400" className="fill-red-400 font-bold">CỤM BƠM BÙ ÁP CỨU HỎA</text>
                          
                          <circle cx="630" cy="450" r="15" fill="none" stroke="#fff" strokeWidth="2" />
                          <circle cx="690" cy="450" r="15" fill="none" stroke="#fff" strokeWidth="2" />
                          <text x="630" y="453" textAnchor="middle" className="fill-white font-bold">P1</text>
                          <text x="690" y="453" textAnchor="middle" className="fill-white font-bold">P2</text>
                          <line x1="645" y1="450" x2="675" y2="450" stroke="#ef4444" strokeWidth="2" />
                        </g>
                      ) : (
                        /* ARCHITECTURAL FLOOR PLAN (Default view) */
                        <g>
                          {/* Title text */}
                          <text x="50" y="60" className="fill-sky-400 font-bold text-sm">MẶT BẰNG THIẾT KẾ KIẾN TRÚC TẦNG DIỂN HÌNH (L15)</text>
                          <text x="50" y="80" className="fill-slate-400">DỰ ÁN: COMPLEX A | THIẾT KẾ CƠ SỞ</text>

                          {/* Outer Walls (Double line layout) */}
                          <rect x="150" y="130" width="500" height="300" fill="none" stroke="#fff" strokeWidth="3.5" />
                          <rect x="142" y="122" width="516" height="316" fill="none" stroke="#38bdf8" strokeWidth="0.75" />

                          {/* Interior partition walls */}
                          {/* Elevator core / Lobby */}
                          <rect x="340" y="210" width="120" height="140" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                          <text x="400" y="275" textAnchor="middle" className="fill-sky-300 font-bold text-[10px]">HỐ THANG MÁY</text>
                          <line x1="340" y1="210" x2="460" y2="350" stroke="#38bdf8" strokeWidth="1" opacity="0.3" />
                          <line x1="460" y1="210" x2="340" y2="350" stroke="#38bdf8" strokeWidth="1" opacity="0.3" />

                          {/* Room separators */}
                          <line x1="150" y1="250" x2="340" y2="250" stroke="#fff" strokeWidth="2" />
                          <line x1="460" y1="250" x2="650" y2="250" stroke="#fff" strokeWidth="2" />
                          <line x1="300" y1="250" x2="300" y2="430" stroke="#fff" strokeWidth="2" />

                          {/* Columns Layout */}
                          {Array.from({ length: 4 }).map((_, colIdx) => (
                            <g key={colIdx}>
                              <rect x={140 + colIdx * 163} y="120" width="20" height="20" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                              <rect x={140 + colIdx * 163} y="420" width="20" height="20" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
                            </g>
                          ))}

                          {/* Door swings (arcs) */}
                          <path d="M 150 250 A 40 40 0 0 1 190 210" fill="none" stroke="#10b981" strokeWidth="1.5" />
                          <line x1="150" y1="250" x2="150" y2="210" stroke="#10b981" strokeWidth="1.5" />

                          {/* Text room annotations */}
                          <text x="220" y="180" textAnchor="middle" className="fill-white font-bold">PHÒNG KHÁCH</text>
                          <text x="220" y="195" textAnchor="middle" className="fill-slate-400 text-[8px]">S = 32.4 m²</text>

                          <text x="220" y="320" textAnchor="middle" className="fill-white font-bold">PHÒNG NGỦ 1</text>
                          <text x="220" y="335" textAnchor="middle" className="fill-slate-400 text-[8px]">S = 22.8 m²</text>

                          <text x="560" y="180" textAnchor="middle" className="fill-white font-bold">PHÒNG KHÁCH KHU B</text>
                          <text x="560" y="320" textAnchor="middle" className="fill-white font-bold">PHÒNG HỌP LỚN</text>

                          {/* Dimension ticks */}
                          <line x1="150" y1="465" x2="650" y2="465" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="150" y1="460" x2="150" y2="470" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="340" y1="460" x2="340" y2="470" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="460" y1="460" x2="460" y2="470" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="650" y1="460" x2="650" y2="470" stroke="#38bdf8" strokeWidth="1" />
                          <text x="245" y="480" textAnchor="middle" className="fill-sky-300 font-bold text-[8.5px]">8,200</text>
                          <text x="400" y="480" textAnchor="middle" className="fill-sky-300 font-bold text-[8.5px]">4,500</text>
                          <text x="555" y="480" textAnchor="middle" className="fill-sky-300 font-bold text-[8.5px]">8,200</text>
                        </g>
                      )}

                      {/* Title Block Box (Standard Drawing Sheet Element) */}
                      <g transform="translate(480, 440)">
                        <rect x="0" y="0" width="300" height="90" fill="#0b132b" stroke="#38bdf8" strokeWidth="1.5" />
                        <line x1="0" y1="30" x2="300" y2="30" stroke="#38bdf8" strokeWidth="0.75" />
                        <line x1="0" y1="60" x2="300" y2="60" stroke="#38bdf8" strokeWidth="0.75" />
                        <line x1="180" y1="30" x2="180" y2="90" stroke="#38bdf8" strokeWidth="0.75" />

                        {/* Top row */}
                        <text x="10" y="20" className="fill-sky-400 font-bold text-[10px]">CDE CIC COLLABORATION ENVIRONMENT</text>
                        <text x="290" y="20" textAnchor="end" className="fill-sky-300 font-bold">V1.5</text>

                        {/* Mid row */}
                        <text x="10" y="48" className="fill-slate-400 text-[8px]">TÊN DỰ ÁN (PROJECT NAME)</text>
                        <text x="10" y="56" className="fill-white font-bold text-[9px] truncate w-[160px]">COMPLEX A BUILDING</text>

                        <text x="190" y="48" className="fill-slate-400 text-[8px]">MÃ BẢN VẼ (DRAWING NO.)</text>
                        <text x="190" y="56" className="fill-yellow-400 font-bold text-[8.5px] font-mono">{selectedDoc.id}</text>

                        {/* Bottom row */}
                        <text x="10" y="75" className="fill-slate-400 text-[8px]">THIẾT KẾ (DESIGNED BY)</text>
                        <text x="10" y="84" className="fill-white font-bold">{selectedDoc.creator}</text>

                        <text x="190" y="75" className="fill-slate-400 text-[8px]">REVISION / STATUS</text>
                        <text x="190" y="84" className="fill-sky-300 font-bold">{selectedDoc.revision} / {selectedDoc.status === 'PENDING_APPROVAL' ? 'PENDING' : selectedDoc.status.replace('S0 - ', '').replace('S1 - ', '').replace('S2 - ', '')}</text>
                      </g>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Right Sidebar (Metadata and validation status inside Modal) */}
              <aside className="w-[320px] xl:w-[350px] bg-surface flex flex-col p-5 overflow-y-auto shrink-0 select-none space-y-5">
                <div>
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">Mã và Chi tiết</h4>
                  <div className="font-mono text-xs font-bold text-on-surface bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/50 break-all select-all">
                    {selectedDoc.id}
                  </div>
                </div>

                {/* Live validation summary card */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider">Trạng thái định dạng ISO 19650</h4>
                  {(() => {
                    const validation = validateISO19650(selectedDoc.id);
                    if (validation.isValid) {
                      return (
                        <div className="bg-teal-accent/5 border border-teal-accent/30 rounded-xl p-4 flex gap-3 text-on-surface">
                          <CheckCircle className="text-teal-accent shrink-0 mt-0.5" size={18} />
                          <div>
                            <span className="font-bold text-xs text-teal-accent block">Đạt chuẩn (Compliant)</span>
                            <span className="text-[11px] text-on-surface-variant block mt-1.5 leading-normal">Tên bản vẽ hoàn toàn chính xác theo định dạng tiêu chuẩn quy hoạch thông tin ISO 19650.</span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-error-container/10 border border-error/30 rounded-xl p-4 flex flex-col gap-3 text-on-surface">
                          <div className="flex gap-3">
                            <AlertTriangle className="text-error shrink-0 mt-0.5" size={18} />
                            <div>
                              <span className="font-bold text-xs text-error block">Cảnh báo: Sai tiêu chuẩn định dạng</span>
                              <span className="text-[11px] text-on-surface-variant block mt-1 leading-normal">Mã tài liệu hiện tại không hợp lệ. Bản vẽ sẽ không thể chuyển đổi trạng thái sang SHARED/PUBLISHED nếu tên không hợp chuẩn.</span>
                            </div>
                          </div>
                          <ul className="text-[10px] font-mono text-error list-disc pl-4 space-y-1 bg-surface p-2.5 rounded-lg border border-outline-variant/40">
                            {validation.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                          <button 
                            onClick={() => {
                              setIsPreviewOpen(false);
                              handleOpenNameBuilder(selectedDoc);
                            }}
                            className="w-full py-2 bg-error text-on-error rounded-xl font-bold text-[11.5px] cursor-pointer hover:bg-error/95 transition-all shadow-sm active:scale-98"
                          >
                            Cấu hình chuẩn hóa tên mã tệp
                          </button>
                        </div>
                      );
                    }
                  })()}
                </div>

                <div className="space-y-3.5">
                  <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider border-b border-outline-variant/20 pb-1.5">Thuộc tính Bản vẽ</h4>
                  {[
                    { label: 'Tên tệp tin', value: selectedDoc.name },
                    { label: 'Giai đoạn', value: selectedDoc.folder },
                    { label: 'Đơn vị tạo', value: selectedDoc.creator },
                    { label: 'Revision', value: selectedDoc.revision },
                    { label: 'Mã khu vực', value: selectedDoc.volume },
                    { label: 'Phân loại IFC', value: selectedDoc.classification },
                    { label: 'Kích thước tệp', value: selectedDoc.size },
                  ].map((p, i) => (
                    <div key={i} className="flex justify-between items-baseline text-[12px] border-b border-outline-variant/15 pb-2">
                      <span className="text-outline">{p.label}</span>
                      <span className="font-semibold text-on-surface text-right truncate max-w-[180px] pl-2">{p.value}</span>
                    </div>
                  ))}
                </div>

                {/* Modal Footer Actions inside sidebar */}
                <div className="pt-4 flex flex-col gap-2 border-t border-outline-variant/30 mt-auto shrink-0">
                  {selectedDoc.status === 'S0 - WIP' && (
                    <button 
                      onClick={() => {
                        handleSubmitForApproval(selectedDoc);
                        setIsPreviewOpen(false);
                      }}
                      className="w-full py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-[12.5px] shadow transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Gửi yêu cầu phê duyệt
                    </button>
                  )}

                  {selectedDoc.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => {
                          handleRejectDocument(selectedDoc);
                          setIsPreviewOpen(false);
                        }}
                        className="flex-1 py-2.5 border border-error text-error hover:bg-error-container/20 rounded-xl font-bold text-[12.5px] transition-colors focus:outline-none cursor-pointer"
                      >
                        Từ chối
                      </button>
                      <button 
                        onClick={() => {
                          handleApproveDocument(selectedDoc);
                          setIsPreviewOpen(false);
                        }}
                        className="flex-1 py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-[12.5px] shadow transition-all active:scale-98 cursor-pointer"
                      >
                        Phê duyệt
                      </button>
                    </div>
                  )}

                  {selectedDoc.fileType === 'ifc' && onOpenModel && (
                    <button 
                      onClick={() => {
                        setIsPreviewOpen(false);
                        if (selectedDoc.fileUrl) {
                          onOpenModel(selectedDoc.fileUrl);
                        } else {
                          onOpenModel('https://thatopen.github.io/engine_ui-components/resources/small.ifc');
                        }
                      }}
                      className="w-full py-2 border border-primary text-primary hover:bg-primary/5 rounded-xl font-bold text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      Xem trong BIM 3D Viewer
                    </button>
                  )}
                  
                  <a 
                    href={selectedDoc.fileUrl || 'https://thatopen.github.io/engine_ui-components/resources/small.ifc'}
                    download={selectedDoc.name + (selectedDoc.fileType === 'ifc' ? '.ifc' : selectedDoc.fileType === 'dwg' ? '.dwg' : '.pdf')}
                    className="w-full py-2 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-xl font-bold text-[12px] text-on-surface flex items-center justify-center gap-1.5 transition-colors text-center cursor-pointer"
                  >
                     Tải tệp tin gốc xuống
                  </a>
                </div>
              </aside>

            </div>
          </div>
        </div>
      )}

      {/* 2. ISO 19650 NAME BUILDER MODAL */}
      {isNameBuilderOpen && selectedDoc && (
        <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-[500px] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant flex flex-col p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-[17px] text-on-surface tracking-tight mb-2 flex items-center gap-2">
              <Settings size={20} className="text-primary" />
              Công cụ cấu hình chuẩn hóa tên mã tệp (ISO 19650)
            </h3>
            <p className="text-xs text-on-surface-variant mb-5">Xây dựng mã định danh tài liệu dựa trên các quy tắc chuẩn hóa dự án CDE CIC.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">1. Dự án (Project)</label>
                  <select 
                    value={nameBuilderFields.project}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, project: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                  >
                    <option value="PRJ">PRJ (Project Default)</option>
                    <option value="CIC">CIC (CIC Tower)</option>
                    <option value="CDE">CDE (CDE Platform)</option>
                    <option value="FPT">FPT (FPT Campus)</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">2. Đơn vị tạo (Originator)</label>
                  <select 
                    value={nameBuilderFields.originator}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, originator: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="ARC">ARC (Kiến trúc)</option>
                    <option value="STR">STR (Kết cấu)</option>
                    <option value="MEP">MEP (Cơ điện)</option>
                    <option value="GEN">GEN (Tổng hợp/General)</option>
                    <option value="BIM">BIM (BIM Management)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">3. Phân khu (Volume)</label>
                  <select 
                    value={nameBuilderFields.volume}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, volume: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="Z01">Z01 (Phân khu 1)</option>
                    <option value="Z02">Z02 (Phân khu 2)</option>
                    <option value="Z00">Z00 (Toàn bộ / Hệ thống)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">4. Tầng / Cao trình (Level)</label>
                  <select 
                    value={nameBuilderFields.level}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, level: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="ZZ">ZZ (Toàn tầng / Mặt đứng)</option>
                    <option value="GF">GF (Tầng trệt / Ground)</option>
                    <option value="01">01 (Tầng 1)</option>
                    <option value="02">02 (Tầng 2)</option>
                    <option value="08">08 (Tầng 8)</option>
                    <option value="15">15 (Tầng 15)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">5. Loại tài liệu (Type)</label>
                  <select 
                    value={nameBuilderFields.type}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, type: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="DR">DR (Bản vẽ 2D - Drawing)</option>
                    <option value="M3">M3 (Mô hình BIM 3D)</option>
                    <option value="RP">RP (Báo cáo - Report)</option>
                    <option value="SP">SP (Chỉ dẫn kỹ thuật)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-outline uppercase">6. Kỷ luật / Bộ môn (Discipline)</label>
                  <select 
                    value={nameBuilderFields.discipline}
                    onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, discipline: e.target.value })}
                    className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none outline-none cursor-pointer"
                  >
                    <option value="A">A (Kiến trúc)</option>
                    <option value="S">S (Kết cấu)</option>
                    <option value="M">M (Cơ điện)</option>
                    <option value="W">W (Xung đột/Tổng hợp)</option>
                    <option value="Z">Z (Kỷ luật khác)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-outline uppercase">7. Số thứ tự tài liệu (Number - 4 chữ số)</label>
                <input 
                  type="text" 
                  maxLength={4}
                  value={nameBuilderFields.number}
                  onChange={(e) => setNameBuilderFields({ ...nameBuilderFields, number: e.target.value.replace(/\D/g, '') })}
                  className="w-full p-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  placeholder="Ví dụ: 0001"
                />
              </div>

              {/* Concatenated Preview Box */}
              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/40 mt-6 flex flex-col gap-1">
                <span className="text-[9px] font-bold text-outline uppercase tracking-wider">Xem trước mã định danh ISO 19650</span>
                <div className="font-mono text-sm font-extrabold text-primary break-all select-all flex items-center justify-between">
                  <span>
                    {`${nameBuilderFields.project}-${nameBuilderFields.originator}-${nameBuilderFields.volume}-${nameBuilderFields.level}-${nameBuilderFields.type}-${nameBuilderFields.discipline}-${nameBuilderFields.number}`.toUpperCase()}
                  </span>
                  
                  {(() => {
                    const validationId = `${nameBuilderFields.project}-${nameBuilderFields.originator}-${nameBuilderFields.volume}-${nameBuilderFields.level}-${nameBuilderFields.type}-${nameBuilderFields.discipline}-${nameBuilderFields.number}`.toUpperCase();
                    const validCheck = validateISO19650(validationId);
                    if (validCheck.isValid) {
                      return (
                        <span className="text-[10px] bg-teal-accent/15 text-teal-accent font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-teal-accent/25">
                          Hợp lệ <Check size={10} />
                        </span>
                      );
                    } else {
                      return (
                        <span className="text-[10px] bg-error-container/20 text-error font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-error/25 animate-pulse">
                          Chưa hợp lệ
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant/20">
              <button 
                type="button"
                onClick={() => setIsNameBuilderOpen(false)}
                className="px-4 py-2 border border-outline text-on-surface hover:bg-surface-container rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                 Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={() => handleSaveName(selectedDoc)}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold shadow hover:bg-primary/95 transition-all cursor-pointer active:scale-98"
              >
                 Lưu tên chuẩn hóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
