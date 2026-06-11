import React, { useState, useRef, useEffect } from 'react';
import { 
  Filter, ChevronDown, ChevronRight, Folder, FolderOpen, Box, 
  Scissors, Ruler, MessageSquare, EyeOff, X, Copy, RefreshCw, Upload,
  Eye, Ghost, AlertCircle, Plus, ClipboardList, Download, Image as ImageIcon
} from 'lucide-react';
import { BimViewer, BimViewerRef, QtoResult, QtoDetailRow, LoadedModelInfo, ClashResult } from '../bim/BimViewer';
import { IssuesPanel, IssuesPanelHandle, type BcfIssue } from '../bim/IssuesPanel';
import { DocumentItem } from '../../types';
import { analyzeElement } from '../../lib/ai/gemini';
import { ifcClassLabel } from '../../lib/ifcLabels';
import { fetchViewpoints, createViewpoint, deleteViewpoint, type Viewpoint } from '../../lib/api/data';
import { fetchMembers } from '../../lib/api/team';
import { uploadFile, uploadDataUrl, compressIfcToZip, uploadArrayBuffer } from '../../lib/api/storage';
import { createDocument, deleteDocument, setDocumentFrag } from '../../lib/api/documents';
import { updateProjectCover } from '../../lib/api/projects';

interface ViewerTabProps {
  selectedModelUrl: string | null;
  setSelectedModelUrl: (url: string | null) => void;
  onModelLoaded?: (spatial: any, props: any) => void;
  selectedHighlightIds: number[];
  setSelectedHighlightIds: (ids: number[]) => void;
  viewerRef?: React.RefObject<BimViewerRef | null>;
  projectId?: string;
  documents?: DocumentItem[];
  isActive?: boolean;
  onRemoveDocument?: (code: string) => void;
  onProjectCoverChanged?: (projectId: string, url: string) => void;
  onDocFragCached?: (code: string, fragUrl: string) => void;
}

export function ViewerTab({
  selectedModelUrl, 
  setSelectedModelUrl,
  onModelLoaded,
  selectedHighlightIds,
  setSelectedHighlightIds,
  viewerRef: externalViewerRef,
  projectId,
  documents = [],
  isActive = true,
  onRemoveDocument,
  onProjectCoverChanged,
  onDocFragCached
}: ViewerTabProps) {
  const localViewerRef = useRef<BimViewerRef>(null);
  const viewerRef = externalViewerRef ?? localViewerRef;
  
  // State variables for BIM dynamic data
  const [spatialTree, setSpatialTree] = useState<any>(null);
  const [properties, setProperties] = useState<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  // Sidebar controls
  const [leftSidebarTab, setLeftSidebarTab] = useState<'models' | 'spatial' | 'classes'>('models');
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'bcf'>('properties');
  
  // Issues (Vấn đề) — module riêng IssuesPanel quản lý dữ liệu
  const issuesPanelRef = useRef<IssuesPanelHandle>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([
    'KS. Nguyễn Văn Hải', 'KTS. Lê Minh Hoàng', 'KS. Trần Thu Thảo',
  ]);

  // Nạp danh sách thành viên dự án để gợi ý người xử lý
  useEffect(() => {
    if (!projectId) return;
    fetchMembers(projectId)
      .then(ms => { if (ms.length) setAssigneeOptions(ms.map(m => m.name)); })
      .catch(() => {});
  }, [projectId]);

  // Chụp viewpoint hiện tại (camera + model ẩn + ảnh) cho vấn đề
  const captureViewpoint = () => ({
    camera: viewerRef.current?.getCameraState() || undefined,
    hiddenModels: Array.from(hiddenModelIds) as string[],
    screenshot: viewerRef.current?.captureScreenshot() || undefined,
  });

  // Khôi phục góc nhìn của một vấn đề (camera + ẩn/hiện + highlight)
  const handleRestoreIssue = (issue: BcfIssue) => {
    if (!viewerRef.current) return;
    if (issue.hiddenModels) {
      const hide = new Set(issue.hiddenModels);
      loadedModels.forEach(m => viewerRef.current!.setModelVisibility(m.id, !hide.has(m.id)));
      setHiddenModelIds(hide);
    }
    if (issue.camera) viewerRef.current.setCameraState(issue.camera);
    if (issue.linkedElementExpressId != null) {
      viewerRef.current.highlightElements([issue.linkedElementExpressId]);
      if (properties && properties[issue.linkedElementExpressId]) {
        setSelectedElement(properties[issue.linkedElementExpressId]);
      }
    }
  };

  const handleFocusIssueElement = (expressId: number) => {
    viewerRef.current?.highlightElements([expressId]);
    viewerRef.current?.isolateElements([expressId]);
    if (properties && properties[expressId]) setSelectedElement(properties[expressId]);
  };

  // Multi-model management (Federation)
  const [loadedModels, setLoadedModels] = useState<LoadedModelInfo[]>([]);
  const [hiddenModelIds, setHiddenModelIds] = useState<Set<string>>(new Set());
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [recentered, setRecentered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleRecenter = () => {
    if (!viewerRef.current) return;
    const next = !recentered;
    setRecentered(next);
    viewerRef.current.setModelsRecentered(next);
  };

  const handleFitAll = () => viewerRef.current?.fitToAll();

  // Walk/Fly mode
  const [flyMode, setFlyMode] = useState(false);
  const handleToggleFly = () => {
    const next = !flyMode;
    setFlyMode(next);
    viewerRef.current?.setFlyMode(next);
  };

  // Viewpoints (góc nhìn đã lưu)
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>([]);
  const [savingVp, setSavingVp] = useState(false);
  const [newVpName, setNewVpName] = useState('');

  useEffect(() => {
    if (!projectId) return;
    fetchViewpoints(projectId).then(setViewpoints).catch(err => console.error('Không tải được viewpoints:', err));
  }, [projectId]);

  const handleSaveViewpoint = async () => {
    if (!viewerRef.current || !projectId) return;
    const cam = viewerRef.current.getCameraState();
    if (!cam) { alert('Chưa có camera để lưu.'); return; }
    const name = newVpName.trim() || `Góc nhìn ${viewpoints.length + 1}`;
    const screenshot = viewerRef.current.captureScreenshot() || undefined;
    setSavingVp(true);
    try {
      const vp = await createViewpoint(projectId, {
        name, camera: cam, hiddenModels: Array.from(hiddenModelIds), recentered, screenshot,
      });
      if (vp) setViewpoints(prev => [vp, ...prev]);
      setNewVpName('');
    } finally {
      setSavingVp(false);
    }
  };

  const handleRestoreViewpoint = (vp: Viewpoint) => {
    if (!viewerRef.current) return;
    // Khôi phục căn tâm nếu khác
    if (vp.recentered !== recentered) {
      setRecentered(vp.recentered);
      viewerRef.current.setModelsRecentered(vp.recentered);
    }
    // Khôi phục ẩn/hiện model
    const hide = new Set(vp.hiddenModels);
    loadedModels.forEach(m => viewerRef.current!.setModelVisibility(m.id, !hide.has(m.id)));
    setHiddenModelIds(hide);
    // Khôi phục camera
    viewerRef.current.setCameraState(vp.camera);
  };

  const handleDeleteViewpoint = async (id: string) => {
    await deleteViewpoint(id);
    setViewpoints(prev => prev.filter(v => v.id !== id));
  };

  // Đặt góc nhìn làm ảnh đại diện dự án
  const [coverSavingId, setCoverSavingId] = useState<string | null>(null);
  const handleSetAsCover = async (vp: Viewpoint) => {
    if (!projectId) return;
    let img = vp.screenshot;
    // Nếu góc nhìn chưa có ảnh, chụp màn hình hiện tại
    if (!img) img = viewerRef.current?.captureScreenshot() || undefined;
    if (!img) { alert('Không có ảnh để đặt làm đại diện. Hãy mở mô hình rồi thử lại.'); return; }
    setCoverSavingId(vp.id);
    try {
      const url = await uploadDataUrl(img, `covers/${projectId}_${Date.now()}.png`);
      await updateProjectCover(projectId, url);
      onProjectCoverChanged?.(projectId, url);
      alert('Đã đặt làm ảnh đại diện dự án.');
    } catch (err) {
      alert('Không đặt được ảnh đại diện: ' + (err as Error).message);
    } finally {
      setCoverSavingId(null);
    }
  };

  // Clash detection (Phase D)
  const [clashOpen, setClashOpen] = useState(false);
  const [clashLoading, setClashLoading] = useState(false);
  const [clashes, setClashes] = useState<ClashResult[] | null>(null);

  const handleDetectClashes = async () => {
    if (!viewerRef.current) return;
    if (loadedModels.length < 2) { alert('Cần tải ít nhất 2 mô hình để kiểm tra xung đột.'); return; }
    setClashOpen(true);
    setClashLoading(true);
    setClashes(null);
    try {
      const res = await viewerRef.current.detectClashes();
      setClashes(res);
    } catch (err) {
      console.error(err);
      setClashes([]);
    } finally {
      setClashLoading(false);
    }
  };

  const handleFocusClash = (c: ClashResult) => {
    viewerRef.current?.focusClash(c);
  };

  const handleClashToBcf = async (c: ClashResult) => {
    if (!viewerRef.current) return;
    await viewerRef.current.focusClash(c);
    const vp = captureViewpoint();
    await issuesPanelRef.current?.createFromClash({
      title: `Xung đột: ${c.modelAName} ↔ ${c.modelBName}`,
      description: `Xung đột hình học giữa cấu kiện #${c.localIdA} (${c.modelAName}) và #${c.localIdB} (${c.modelBName}).`,
      camera: vp.camera, hiddenModels: vp.hiddenModels, screenshot: vp.screenshot,
    });
    setRightPanelTab('bcf');
    alert('Đã tạo vấn đề từ xung đột.');
  };

  // Suy bộ môn từ tên/mã mô hình (dùng cho cả model upload lẫn tài liệu Supabase)
  const deriveDiscipline = (label: string): string => {
    const s = (label || '').toUpperCase();
    if (/ARCH|KIEN|\bARC\b|-A-|_ARC/.test(s)) return 'Kiến trúc';
    if (/STRU|KET\s?CAU|\bSTR\b|-S-|_STR/.test(s)) return 'Kết cấu';
    if (/ELEC|HVAC|PLUM|FIRE|MEFP|\bMEP\b|MECH|-M-|-E-|-P-|-H-|-F-|_ELE|_HVA|_PLU/.test(s)) return 'MEP';
    if (/COORD|PHOI\s?HOP|-W-|_ALL|FEDER/.test(s)) return 'Phối hợp';
    return 'Khác';
  };

  // Tài liệu IFC thêm trong phiên (vừa upload) — để hiện ngay mà không cần reload
  const [extraDocs, setExtraDocs] = useState<DocumentItem[]>([]);

  const handleUploadModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewerRef.current) return;
    e.target.value = '';
    setLoadingModelId('__upload__');
    try {
      if (projectId) {
        // LƯU THẬT: nén .ifc -> .ifczip (nếu cần) rồi đẩy lên Storage + tạo bản ghi
        const code = file.name.replace(/\.[^/.]+$/, '').replace(/[^\w.\-]/g, '_');
        const toUpload = await compressIfcToZip(file);
        const up = await uploadFile(toUpload, projectId);
        const rec = await createDocument({
          projectId, code, name: file.name.replace(/\.[^/.]+$/, ''),
          folder: '02_SHARED', subFolder: 'Mô hình phối hợp', status: 'S1 - SHARED',
          suitabilityCode: 'S1', revision: 'P01', version: 'V1', size: up.sizeLabel,
          creator: 'BIM Manager (Bạn)', classification: 'EF_55_20', volume: 'Z00 - All Zones',
          fileType: 'ifc', fileUrl: up.publicUrl, hashSha256: up.hash,
        });
        // Hiện ngay trong phiên + nạp vào viewer từ URL (modelId = code)
        setExtraDocs(prev => prev.some(d => d.id === rec.id) ? prev : [...prev, rec]);
        await viewerRef.current.loadUrl(up.publicUrl, rec.id);
        cacheFragInBackground(rec.id); // tạo cache .frag cho lần sau nạp nhanh
      } else {
        // Không có dự án (hiếm) — nạp tạm trong bộ nhớ
        await viewerRef.current.loadFile(file);
      }
      setLoadedModels(viewerRef.current.getLoadedModels());
      if (recentered) viewerRef.current.setModelsRecentered(true);
    } catch (err) {
      alert('Tải/lưu mô hình thất bại: ' + (err as Error).message);
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleRemoveModel = (modelId: string) => {
    if (!viewerRef.current) return;
    viewerRef.current.removeModel(modelId);
    setLoadedModels(viewerRef.current.getLoadedModels());
    setHiddenModelIds(prev => { const n = new Set(prev); n.delete(modelId); return n; });
  };

  // Ẩn/hiện một mô hình ĐÃ tải
  const handleToggleVisibility = (modelId: string) => {
    if (!viewerRef.current) return;
    const willHide = !hiddenModelIds.has(modelId);
    viewerRef.current.setModelVisibility(modelId, !willHide);
    setHiddenModelIds(prev => { const n = new Set(prev); willHide ? n.add(modelId) : n.delete(modelId); return n; });
  };

  // Ẩn/hiện cả một bộ môn (nhóm)
  const handleToggleDiscipline = (models: LoadedModelInfo[]) => {
    if (!viewerRef.current) return;
    const anyVisible = models.some(m => !hiddenModelIds.has(m.id));
    const willHide = anyVisible; // nếu đang có cái hiện -> ẩn hết, ngược lại hiện hết
    setHiddenModelIds(prev => {
      const n = new Set(prev);
      models.forEach(m => {
        viewerRef.current?.setModelVisibility(m.id, !willHide);
        willHide ? n.add(m.id) : n.delete(m.id);
      });
      return n;
    });
  };

  // Zoom camera tới một mô hình (giúp định vị model nhỏ/ở xa như MEP)
  const handleFitModel = (modelId: string) => {
    viewerRef.current?.fitToModel(modelId);
  };

  // Tải một tài liệu IFC từ Supabase vào liên hợp
  // Chuyển đổi & cache .frag sau khi đã nạp IFC (chạy nền) để lần sau nạp nhanh
  const cacheFragInBackground = async (code: string) => {
    if (!projectId || !viewerRef.current) return;
    try {
      const buf = await viewerRef.current.getModelBuffer(code);
      if (!buf) return;
      const url = await uploadArrayBuffer(buf, `frags/${projectId}/${code}.frag`);
      await setDocumentFrag(projectId, code, url);
      setExtraDocs(prev => prev.map(d => d.id === code ? { ...d, fragUrl: url } : d));
      onDocFragCached?.(code, url);
    } catch (err) {
      console.warn('cacheFrag failed:', err);
    }
  };

  const handleLoadDoc = async (doc: DocumentItem) => {
    if (!viewerRef.current) return;
    if (!doc.fileUrl && !doc.fragUrl) { alert('Tài liệu này chưa có tệp IFC để tải.'); return; }
    setLoadingModelId(doc.id);
    try {
      if (doc.fragUrl) {
        // NẠP NHANH từ .frag đã cache; lỗi thì fallback sang IFC
        try {
          await viewerRef.current.loadFragments(doc.fragUrl, doc.id);
        } catch {
          if (doc.fileUrl) await viewerRef.current.loadUrl(doc.fileUrl, doc.id);
        }
      } else {
        await viewerRef.current.loadUrl(doc.fileUrl!, doc.id);
        cacheFragInBackground(doc.id); // tạo cache cho lần sau
      }
      setLoadedModels(viewerRef.current.getLoadedModels());
      if (recentered) viewerRef.current.setModelsRecentered(true);
    } catch {
      alert('Không tải được mô hình: ' + doc.name);
    } finally {
      setLoadingModelId(null);
    }
  };

  // Xóa hẳn một mô hình/tài liệu IFC khỏi dự án (Storage + DB)
  const handleDeleteDoc = async (doc: DocumentItem) => {
    if (!projectId) return;
    if (!window.confirm(`Xóa vĩnh viễn mô hình "${doc.name}" khỏi dự án? Hành động không thể hoàn tác.`)) return;
    try {
      // Nếu đang tải thì gỡ khỏi viewer trước
      if (loadedModels.some(m => m.id === doc.id)) handleRemoveModel(doc.id);
      await deleteDocument({ dbId: (doc as any).dbId, id: doc.id, fileUrl: doc.fileUrl }, projectId);
      setExtraDocs(prev => prev.filter(d => d.id !== doc.id));
      onRemoveDocument?.(doc.id);
    } catch (err) {
      alert('Xóa mô hình thất bại: ' + (err as Error).message);
    }
  };

  // Tài liệu IFC của dự án chưa được tải
  const ifcDocuments = [
    ...documents.filter(d => d.fileType === 'ifc'),
    ...extraDocs.filter(e => !documents.some(d => d.id === e.id)),
  ];
  const loadedIds = new Set(loadedModels.map(m => m.id));
  const unloadedDocs = ifcDocuments.filter(d => !loadedIds.has(d.id));

  // Nhóm model ĐÃ tải theo bộ môn (suy từ tên)
  const loadedByDiscipline = loadedModels.reduce((acc, m) => {
    const g = deriveDiscipline(m.name);
    (acc[g] ??= []).push(m);
    return acc;
  }, {} as Record<string, LoadedModelInfo[]>);

  // Category visibility states
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedModelUrl && viewerRef.current) {
      // Gắn modelId = mã tài liệu nếu URL khớp một tài liệu IFC (để đồng bộ panel)
      const match = ifcDocuments.find(d => d.fileUrl === selectedModelUrl);
      viewerRef.current.loadUrl(selectedModelUrl, match?.id).then(() => {
        if (viewerRef.current) setLoadedModels(viewerRef.current.getLoadedModels());
      });
      setSelectedModelUrl(null);
    }
  }, [selectedModelUrl, setSelectedModelUrl]);

  useEffect(() => {
    if (selectedHighlightIds.length > 0 && viewerRef.current) {
      viewerRef.current.highlightElements(selectedHighlightIds);
    }
  }, [selectedHighlightIds]);

  // Khi quay lại tab Mô hình 3D (canvas vừa hiện lại), ép renderer resize để
  // khớp kích thước container (tránh canvas 0x0 do display:none).
  useEffect(() => {
    // Tạm dừng render khi rời tab → các tab khác không bị lag
    viewerRef.current?.setRenderingEnabled(isActive);
    if (isActive) {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  // ----- Tự động nạp lại các mô hình của lần trước (session restore) -----
  const restoreStartedRef = useRef<string | null>(null);
  const restoreDoneRef = useRef<string | null>(null);
  const openModelsKey = projectId ? `cic_cde_open_models_${projectId}` : '';

  useEffect(() => {
    if (!projectId || !viewerRef.current) return;
    if (restoreStartedRef.current === projectId) return;
    if (ifcDocuments.length === 0) return; // chờ danh sách tài liệu IFC sẵn sàng
    restoreStartedRef.current = projectId;
    (async () => {
      try {
        const saved: string[] = JSON.parse(localStorage.getItem(openModelsKey) || '[]');
        for (const id of saved) {
          const d = ifcDocuments.find(x => x.id === id);
          if (!d || viewerRef.current!.getLoadedModels().some(m => m.id === id)) continue;
          if (d.fragUrl) {
            try { await viewerRef.current!.loadFragments(d.fragUrl, id); }
            catch { if (d.fileUrl) await viewerRef.current!.loadUrl(d.fileUrl, id); }
          } else if (d.fileUrl) {
            await viewerRef.current!.loadUrl(d.fileUrl, id);
          }
        }
        restoreDoneRef.current = projectId; // đánh dấu trước khi setState để persist đúng
        setLoadedModels(viewerRef.current!.getLoadedModels());
        if (recentered) viewerRef.current!.setModelsRecentered(true);
      } catch {
        restoreDoneRef.current = projectId;
      }
    })();
  }, [projectId, ifcDocuments.length]);

  // Ghi nhớ danh sách model đang mở (chỉ sau khi đã restore xong, tránh ghi đè rỗng)
  useEffect(() => {
    if (!projectId || restoreDoneRef.current !== projectId) return;
    localStorage.setItem(openModelsKey, JSON.stringify(loadedModels.map(m => m.id)));
  }, [loadedModels, projectId]);
  
  // Tool state variables
  const [clippingActive, setClippingActive] = useState(false);
  const [measurementActive, setMeasurementActive] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // AI analysis state for the selected element
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // QTO (Quantity Take-Off): chọn phạm vi (bộ môn/hạng mục/cấu kiện) TRƯỚC, rồi bóc tách
  const [qtoOpen, setQtoOpen] = useState(false);
  const [qtoLoading, setQtoLoading] = useState(false);
  const [qtoExtracted, setQtoExtracted] = useState(false);
  const [qtoResult, setQtoResult] = useState<QtoResult | null>(null);
  // Danh mục nhanh (mô hình + lớp cấu kiện) — lấy NGAY khi mở, không cần trích nặng
  const [qtoScope, setQtoScope] = useState<{ modelId: string; modelName: string; categories: string[] }[]>([]);
  const [qtoDiscFilter, setQtoDiscFilter] = useState<Set<string>>(new Set());
  const [qtoModelFilter, setQtoModelFilter] = useState<Set<string>>(new Set());
  const [qtoCatFilter, setQtoCatFilter] = useState<Set<string>>(new Set());

  // Mở bảng QTO: hiện bộ chọn phạm vi NGAY (không trích xuất gì cả)
  const handleOpenQto = () => {
    setQtoOpen(true);
    setQtoLoading(false);
    setQtoExtracted(false);
    setQtoResult(null);
    const scope = viewerRef.current?.getModelCategories() ?? [];
    setQtoScope(scope);
    // Mặc định chọn tất cả
    setQtoDiscFilter(new Set(scope.map(s => deriveDiscipline(s.modelName))));
    setQtoModelFilter(new Set(scope.map(s => s.modelId)));
    setQtoCatFilter(new Set(scope.flatMap(s => s.categories)));
  };

  // Bóc tách khối lượng theo phạm vi đã chọn (bộ môn + hạng mục)
  const handleRunQto = async () => {
    const ids = qtoScope
      .filter(s => qtoDiscFilter.has(deriveDiscipline(s.modelName)) && qtoModelFilter.has(s.modelId))
      .map(s => s.modelId);
    if (ids.length === 0) return;
    setQtoLoading(true);
    setQtoExtracted(true);
    try {
      const result = await viewerRef.current?.getQuantityTakeoff(ids);
      setQtoResult(result ?? null);
    } catch (err) {
      console.error(err);
      setQtoResult(null);
    } finally {
      setQtoLoading(false);
    }
  };

  // Bật/tắt một mục trong tập bộ lọc
  const toggleInSet = (set: Set<string>, setFn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };

  // Lựa chọn bộ lọc lấy từ DANH MỤC NHANH (có ngay, trước khi bóc tách)
  const qtoDisciplines: string[] = Array.from(new Set(qtoScope.map(s => deriveDiscipline(s.modelName))));
  const qtoModels: { id: string; name: string }[] = qtoScope.map(s => ({ id: s.modelId, name: s.modelName }));
  // Lớp cấu kiện chỉ hiện của các mô hình/bộ môn đang chọn
  const qtoCategories: string[] = Array.from(new Set<string>(
    qtoScope
      .filter(s => qtoDiscFilter.has(deriveDiscipline(s.modelName)) && qtoModelFilter.has(s.modelId))
      .flatMap(s => s.categories)
  )).sort();
  const qtoDetailRows: QtoDetailRow[] = qtoResult?.detail ?? [];

  // Lọc chi tiết theo 3 tiêu chí rồi gộp lại theo lớp cấu kiện để hiển thị
  const qtoFilteredDetail = qtoDetailRows.filter(d =>
    qtoDiscFilter.has(deriveDiscipline(d.modelName)) &&
    qtoModelFilter.has(d.modelId) &&
    qtoCatFilter.has(d.category)
  );
  const qtoDisplayRows = (() => {
    const agg: Record<string, { category: string; count: number; area: number; volume: number; length: number }> = {};
    for (const d of qtoFilteredDetail) {
      const a = (agg[d.category] ||= { category: d.category, count: 0, area: 0, volume: 0, length: 0 });
      a.count += d.count; a.area += d.area; a.volume += d.volume; a.length += d.length;
    }
    return Object.values(agg).sort((x, y) => y.volume - x.volume || y.count - x.count);
  })();

  const handleExportQtoCsv = () => {
    if (qtoFilteredDetail.length === 0) return;
    // Xuất chi tiết theo Bộ môn / Hạng mục / Lớp cấu kiện (đúng phạm vi đang lọc)
    const header = 'Bo mon,Hang muc (mo hinh),Loai cau kien (IFC),So luong,Dien tich (m2),The tich (m3),Chieu dai (m)';
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = qtoFilteredDetail
      .slice()
      .sort((a, b) => a.modelName.localeCompare(b.modelName) || a.category.localeCompare(b.category))
      .map(r =>
        [esc(deriveDiscipline(r.modelName)), esc(r.modelName), esc(r.category), r.count, r.area.toFixed(2), r.volume.toFixed(2), r.length.toFixed(2)].join(',')
      );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QTO_BocKhoiLuong_${new Date().toISOString().split('T')[0]}.csv`;
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

  const handleModelLoaded = (spatial: any, props: any, _model: any, isPropsRefresh?: boolean) => {
    // Lần cập nhật thuộc tính chạy nền: chỉ làm mới dữ liệu, KHÔNG reset lựa chọn
    // /bộ lọc của người dùng (tránh mất cấu kiện đang chọn khi nền trích xong).
    setSpatialTree(spatial);
    setProperties(props);
    if (onModelLoaded) onModelLoaded(spatial, props);
    if (isPropsRefresh) return;

    setSelectedElement(null);
    setHiddenCategories(new Set());
    if (viewerRef.current) {
      setLoadedModels(viewerRef.current.getLoadedModels());
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
    // Áp bộ lọc theo lớp IFC trên TẤT CẢ mô hình đang tải
    viewerRef.current?.applyCategoryVisibility(Array.from(nextHidden));
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
         <div className="p-3 border-b border-outline-variant flex flex-col gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between gap-1">
              <div className="flex bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/60 flex-1">
                <button
                  onClick={() => setLeftSidebarTab('models')}
                  className={`flex-1 text-center py-1.5 rounded-md font-bold text-[11.5px] transition-colors cursor-pointer ${
                    leftSidebarTab === 'models'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Mô hình
                </button>
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
            {/* Upload & loaded models */}
            <div className="flex items-center gap-1.5">
              <label className="flex-1 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-on-primary font-bold text-[11px] py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm text-center">
                <Upload size={13} /> Tải mô hình IFC
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ifc,.ifczip,.zip"
                  onChange={handleUploadModel}
                  className="hidden"
                />
              </label>
              {loadedModels.length > 0 && (
                <span className="text-[10px] font-bold bg-primary-container/20 text-primary px-2 py-1 rounded-md shrink-0">
                  {loadedModels.length} mô hình
                </span>
              )}
            </div>
         </div>

         {/* Left Sidebar Body */}
         <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {leftSidebarTab === 'models' ? (
              (loadedModels.length === 0 && ifcDocuments.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-on-surface-variant gap-3">
                  <Box size={32} className="text-outline/40" />
                  <p className="text-xs font-medium leading-relaxed">
                    Chưa có mô hình. Bấm "Tải mô hình IFC" phía trên hoặc mở từ tab Tài liệu.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* MÔ HÌNH ĐÃ TẢI — nhóm theo bộ môn, ẩn/hiện */}
                  {loadedModels.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Liên hợp ({loadedModels.length})</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadedModels.forEach(m => { if (hiddenModelIds.has(m.id)) handleToggleVisibility(m.id); })}
                            className="text-[10px] font-bold text-on-surface-variant hover:text-primary"
                            title="Hiện tất cả mô hình"
                          >
                            Hiện tất cả
                          </button>
                          <button
                            onClick={handleFitAll}
                            className="text-[10px] font-bold text-on-surface-variant hover:text-primary"
                            title="Phóng toàn cảnh"
                          >
                            Fit
                          </button>
                        </div>
                      </div>
                      {/* Toggle căn tâm — đưa các bộ môn lệch toạ độ về đè lên nhau */}
                      <button
                        onClick={handleToggleRecenter}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-[10.5px] font-bold transition-colors ${
                          recentered ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:border-primary/30'
                        }`}
                        title="Dịch các mô hình về gốc chung để chồng khít (dùng khi các bộ môn lệch toạ độ)"
                      >
                        <span className="flex items-center gap-1.5"><Box size={12} /> Căn tâm mô hình</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${recentered ? 'bg-primary text-on-primary' : 'bg-surface-container text-outline'}`}>
                          {recentered ? 'BẬT' : 'TẮT'}
                        </span>
                      </button>
                      {(Object.entries(loadedByDiscipline) as [string, LoadedModelInfo[]][]).map(([disc, models]) => {
                        const groupAllHidden = models.every(m => hiddenModelIds.has(m.id));
                        return (
                        <div key={disc}>
                          <div className="text-[10.5px] font-bold text-on-surface-variant px-1 mb-1 flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggleDiscipline(models)}
                              className="shrink-0 hover:text-primary"
                              title={groupAllHidden ? 'Hiện cả bộ môn' : 'Ẩn cả bộ môn'}
                            >
                              {groupAllHidden ? <EyeOff size={13} className="text-outline" /> : <Eye size={13} className="text-primary" />}
                            </button>
                            <Folder size={12} className="text-outline" /> {disc}
                            <span className="text-outline font-mono">({models.length})</span>
                          </div>
                          <div className="space-y-1">
                            {models.map(m => {
                              const hidden = hiddenModelIds.has(m.id);
                              return (
                                <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-primary/5 border-primary/30">
                                  <button
                                    onClick={() => handleToggleVisibility(m.id)}
                                    className="shrink-0 text-on-surface-variant hover:text-primary"
                                    title={hidden ? 'Đang ẩn — nhấn để hiện' : 'Đang hiện — nhấn để ẩn'}
                                  >
                                    {hidden ? <EyeOff size={15} className="text-outline" /> : <Eye size={15} className="text-primary" />}
                                  </button>
                                  <button
                                    onClick={() => handleFitModel(m.id)}
                                    className={`text-[11px] font-semibold truncate flex-1 text-left hover:text-primary transition-colors ${hidden ? 'text-outline line-through' : 'text-on-surface'}`}
                                    title={`${m.name} — nhấn để phóng tới mô hình`}
                                  >
                                    {m.name}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveModel(m.id)}
                                    className="shrink-0 text-on-surface-variant hover:text-error p-0.5"
                                    title="Gỡ khỏi liên hợp"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TÀI LIỆU IFC CHƯA TẢI */}
                  {unloadedDocs.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider px-1 pt-2 border-t border-outline-variant/30">
                        Tài liệu IFC của dự án ({unloadedDocs.length})
                      </div>
                      {unloadedDocs.map(doc => {
                        const isLoadingThis = loadingModelId === doc.id;
                        return (
                          <div key={doc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-surface border-outline-variant/30 hover:border-primary/30">
                            <button
                              onClick={() => handleLoadDoc(doc)}
                              disabled={isLoadingThis}
                              className="shrink-0 text-on-surface-variant hover:text-primary disabled:opacity-50"
                              title="Tải & hiển thị"
                            >
                              {isLoadingThis ? <RefreshCw size={15} className="animate-spin text-primary" /> : <Plus size={15} className="text-outline" />}
                            </button>
                            <span className="text-[11px] font-semibold truncate flex-1 text-on-surface-variant" title={doc.name}>
                              {doc.name}
                            </span>
                            <button
                              onClick={() => handleDeleteDoc(doc)}
                              className="shrink-0 text-on-surface-variant hover:text-error p-0.5"
                              title="Xóa mô hình khỏi dự án"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ) : leftSidebarTab === 'spatial' ? (
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
                          <span className={`text-[12px] truncate font-semibold ${isHidden ? 'text-outline line-through' : 'text-on-surface'}`} title={cat}>
                            {cat}
                            {ifcClassLabel(cat) && (
                              <span className="text-on-surface-variant font-medium"> ({ifcClassLabel(cat)})</span>
                            )}
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

         {/* Floating Camera Angles Selector + Fly toggle */}
         <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur border border-outline-variant/60 p-1 rounded-xl shadow-md flex gap-1 z-10 items-center">
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
           <div className="w-px h-4 bg-outline-variant/60 mx-0.5"></div>
           <button
             onClick={handleToggleFly}
             className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${flyMode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'}`}
             title="Chế độ bay (WASD di chuyển, Q/E lên xuống, Shift nhanh 2x)"
           >
             ✈ BAY
           </button>
         </div>

         {/* Floating Viewpoints panel */}
         <div className="absolute top-16 right-4 w-60 bg-surface-container-lowest/95 backdrop-blur border border-outline-variant/60 rounded-xl shadow-md z-10 overflow-hidden">
           <div className="px-3 py-2 border-b border-outline-variant/50 flex items-center justify-between">
             <span className="text-[11px] font-bold text-on-surface flex items-center gap-1.5"><Eye size={13} className="text-primary" /> Góc nhìn ({viewpoints.length})</span>
           </div>
           <div className="p-2 flex gap-1.5 border-b border-outline-variant/30">
             <input
               value={newVpName}
               onChange={e => setNewVpName(e.target.value)}
               placeholder="Tên góc nhìn..."
               className="flex-1 px-2 py-1 bg-surface border border-outline-variant/60 rounded text-[11px] focus:outline-none focus:border-primary min-w-0"
             />
             <button
               onClick={handleSaveViewpoint}
               disabled={savingVp}
               className="bg-primary text-on-primary text-[11px] font-bold px-2 py-1 rounded hover:bg-primary/95 disabled:opacity-50 shrink-0"
               title="Lưu góc nhìn hiện tại"
             >
               {savingVp ? '...' : 'Lưu'}
             </button>
           </div>
           <div className="max-h-56 overflow-y-auto custom-scrollbar">
             {viewpoints.length === 0 ? (
               <div className="px-3 py-4 text-center text-[10.5px] text-outline">Chưa có góc nhìn. Lưu góc nhìn hiện tại để quay lại nhanh.</div>
             ) : viewpoints.map(vp => (
               <div key={vp.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-container/50 border-b border-outline-variant/20 group">
                 <button onClick={() => handleRestoreViewpoint(vp)} className="flex items-center gap-2 flex-1 min-w-0 text-left" title="Khôi phục góc nhìn">
                   {vp.screenshot
                     ? <img src={vp.screenshot} alt="" className="w-9 h-7 object-cover rounded border border-outline-variant/40 shrink-0" />
                     : <div className="w-9 h-7 rounded bg-surface-container flex items-center justify-center shrink-0"><Eye size={12} className="text-outline" /></div>}
                   <span className="text-[11px] font-semibold text-on-surface truncate">{vp.name}</span>
                 </button>
                 <button onClick={() => handleSetAsCover(vp)} disabled={coverSavingId === vp.id} className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary p-0.5 shrink-0 disabled:opacity-50" title="Đặt làm ảnh đại diện dự án">
                   {coverSavingId === vp.id ? <RefreshCw size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                 </button>
                 <button onClick={() => handleDeleteViewpoint(vp.id)} className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error p-0.5 shrink-0" title="Xóa">
                   <X size={12} />
                 </button>
               </div>
             ))}
           </div>
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
              label="Vấn đề (Issue)"
              active={rightPanelTab === 'bcf'}
              onClick={() => setRightPanelTab(rightPanelTab === 'bcf' ? 'properties' : 'bcf')}
            />
            <ToolButton
              icon={<ClipboardList size={20} />}
              label="Bóc tách khối lượng (QTO)"
              active={qtoOpen}
              onClick={handleOpenQto}
            />
            <ToolButton
              icon={<AlertCircle size={20} />}
              label="Kiểm tra xung đột (Clash)"
              active={clashOpen}
              onClick={handleDetectClashes}
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
                Vấn đề
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
           /* ISSUES (VẤN ĐỀ) PANEL */
           <IssuesPanel
             ref={issuesPanelRef}
             projectId={projectId}
             currentUserName="BIM Manager (Bạn)"
             assigneeOptions={assigneeOptions}
             selectedElement={selectedElement}
             captureViewpoint={captureViewpoint}
             onRestoreIssue={handleRestoreIssue}
             onFocusElement={handleFocusIssueElement}
           />
         )}
      </aside>

      {/* Clash Detection Modal */}
      {clashOpen && (
        <div
          className="absolute inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[100] animate-in fade-in duration-200 p-6"
          onClick={() => setClashOpen(false)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl border border-outline-variant flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-error" />
                <h3 className="font-bold text-[15px] text-on-surface">Kiểm tra Xung đột (Clash Detection)</h3>
              </div>
              <button onClick={() => setClashOpen(false)} className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full cursor-pointer"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {clashLoading ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <RefreshCw size={28} className="animate-spin text-primary" />
                  <span className="text-sm font-medium">Đang phân tích giao cắt hình học giữa các mô hình...</span>
                </div>
              ) : !clashes || clashes.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center gap-2 text-center text-on-surface-variant px-6">
                  <Ghost size={28} className="text-success/60" />
                  <p className="text-sm font-medium">Không phát hiện xung đột hình học giữa các mô hình đang tải.</p>
                  <p className="text-[11px] text-outline">Lưu ý: cần ít nhất 2 mô hình ở cùng hệ toạ độ (dùng "Căn tâm" nếu lệch).</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-bold text-error">Phát hiện {clashes.length} xung đột{clashes.length >= 500 ? '+ (giới hạn 500)' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {clashes.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 bg-surface border border-outline-variant/40 rounded-lg hover:border-error/40 transition-colors">
                        <button onClick={() => handleFocusClash(c)} className="flex items-center gap-2 min-w-0 flex-1 text-left" title="Phóng tới xung đột">
                          <span className="font-mono text-[10px] font-bold text-error bg-error/10 px-1.5 py-0.5 rounded shrink-0">{c.id}</span>
                          <span className="text-[11.5px] text-on-surface truncate">
                            <span className="font-semibold">{c.modelAName}</span> ↔ <span className="font-semibold">{c.modelBName}</span>
                          </span>
                        </button>
                        <button
                          onClick={() => handleClashToBcf(c)}
                          className="shrink-0 text-[10px] font-bold text-primary hover:underline"
                          title="Tạo sự vụ BCF từ xung đột này"
                        >
                          + Sự vụ
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10.5px] text-outline mt-4 leading-relaxed">
                    * Phát hiện bằng giao cắt hộp bao (bounding-box) phía trình duyệt — nhanh, gần đúng cho điều phối.
                    Clash chính xác theo hình học sẽ do dịch vụ Python (giai đoạn sau) đảm nhiệm.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
              {qtoScope.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center gap-2 text-center text-on-surface-variant px-6">
                  <AlertCircle size={28} className="text-outline/50" />
                  <p className="text-sm font-medium">Chưa có mô hình nào được nạp.</p>
                  <p className="text-[11px] text-outline">Hãy nạp ít nhất một mô hình IFC ở tab “Mô hình” rồi mở lại bảng bóc tách.</p>
                </div>
              ) : (
                <>
                  {/* BƯỚC 1: Chọn phạm vi bóc tách (hiện ngay, không cần trích nặng) */}
                  <div className="space-y-2.5 mb-4 bg-surface-container-low/40 border border-outline-variant/40 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface">
                      <Filter size={13} className="text-primary" /> Bước 1 — Chọn phạm vi bóc tách
                    </div>
                    <QtoFilterGroup
                      label="Bộ môn"
                      items={qtoDisciplines.map(d => ({ key: d, label: d }))}
                      selected={qtoDiscFilter}
                      onToggle={(k) => toggleInSet(qtoDiscFilter, setQtoDiscFilter, k)}
                      onAll={() => setQtoDiscFilter(new Set(qtoDisciplines))}
                      onNone={() => setQtoDiscFilter(new Set())}
                    />
                    <QtoFilterGroup
                      label="Hạng mục"
                      items={qtoModels.map(m => ({ key: m.id, label: m.name }))}
                      selected={qtoModelFilter}
                      onToggle={(k) => toggleInSet(qtoModelFilter, setQtoModelFilter, k)}
                      onAll={() => setQtoModelFilter(new Set(qtoModels.map(m => m.id)))}
                      onNone={() => setQtoModelFilter(new Set())}
                    />
                    <QtoFilterGroup
                      label="Cấu kiện"
                      items={qtoCategories.map(c => ({ key: c, label: ifcClassLabel(c) ? `${c} · ${ifcClassLabel(c)}` : c }))}
                      selected={qtoCatFilter}
                      onToggle={(k) => toggleInSet(qtoCatFilter, setQtoCatFilter, k)}
                      onAll={() => setQtoCatFilter(new Set(qtoCategories))}
                      onNone={() => setQtoCatFilter(new Set())}
                      scroll
                    />
                    <button
                      onClick={handleRunQto}
                      disabled={qtoLoading || qtoScope.filter(s => qtoDiscFilter.has(deriveDiscipline(s.modelName)) && qtoModelFilter.has(s.modelId)).length === 0}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 bg-primary text-on-primary hover:bg-primary/95 text-[12.5px] font-bold py-2 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {qtoLoading ? <><RefreshCw size={14} className="animate-spin" /> Đang bóc tách...</> : <><ClipboardList size={14} /> Bóc tách khối lượng</>}
                    </button>
                  </div>

                  {qtoLoading ? (
                    <div className="h-32 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                      <RefreshCw size={26} className="animate-spin text-primary" />
                      <span className="text-[13px] font-medium">Đang trích xuất khối lượng từ mô hình đã chọn...</span>
                    </div>
                  ) : !qtoExtracted ? (
                    <div className="h-28 flex flex-col items-center justify-center gap-1.5 text-center text-on-surface-variant">
                      <ClipboardList size={24} className="text-outline/50" />
                      <p className="text-[12.5px] font-medium">Chọn phạm vi ở trên rồi bấm <span className="font-bold text-primary">Bóc tách khối lượng</span>.</p>
                    </div>
                  ) : !qtoResult || qtoResult.rows.length === 0 ? (
                    <div className="h-28 flex flex-col items-center justify-center gap-1.5 text-center text-on-surface-variant px-6">
                      <AlertCircle size={24} className="text-outline/50" />
                      <p className="text-[12.5px] font-medium">Phạm vi đã chọn không có dữ liệu khối lượng (Qto_*BaseQuantities) trong IFC.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] text-on-surface-variant font-medium">
                          Hiển thị <span className="font-bold text-primary">{qtoDisplayRows.reduce((s, r) => s + r.count, 0)}</span> cấu kiện
                          ({qtoDisplayRows.length} lớp) / đã bóc {qtoResult.totalElements} · {qtoResult.elementsWithQuantities} có khối lượng.
                        </div>
                        <button
                          onClick={handleExportQtoCsv}
                          disabled={qtoFilteredDetail.length === 0}
                          className="flex items-center gap-1.5 bg-primary text-on-primary hover:bg-primary/95 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Upload size={13} /> Xuất CSV
                        </button>
                      </div>
                      {qtoDisplayRows.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-center text-[12px] text-outline">
                          Không có cấu kiện nào khớp lọc “Cấu kiện”. Hãy chọn thêm lớp cấu kiện.
                        </div>
                      ) : (
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
                          {qtoDisplayRows.map((r) => (
                            <tr key={r.category} className="border-b border-outline-variant/30 hover:bg-surface-container/40 transition-colors">
                              <td className="py-2 px-2 font-semibold text-on-surface">
                                {r.category}{ifcClassLabel(r.category) && <span className="text-outline font-normal"> · {ifcClassLabel(r.category)}</span>}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.count}</td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.area > 0 ? r.area.toFixed(2) : "—"}</td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.volume > 0 ? r.volume.toFixed(2) : "—"}</td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface-variant">{r.length > 0 ? r.length.toFixed(2) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-outline-variant font-bold text-on-surface">
                            <td className="py-2 px-2">TỔNG CỘNG</td>
                            <td className="py-2 px-2 text-right font-mono">{qtoDisplayRows.reduce((s, r) => s + r.count, 0)}</td>
                            <td className="py-2 px-2 text-right font-mono">{qtoDisplayRows.reduce((s, r) => s + r.area, 0).toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono">{qtoDisplayRows.reduce((s, r) => s + r.volume, 0).toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono">{qtoDisplayRows.reduce((s, r) => s + r.length, 0).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                      )}
                      <p className="text-[10.5px] text-outline mt-4 leading-relaxed">
                        * Khối lượng được trích trực tiếp từ bộ thuộc tính <code className="font-mono">Qto_*BaseQuantities</code> trong tệp IFC.
                        Đây là nền tảng cho dự toán 5D (gắn đơn giá định mức Bộ Xây dựng) ở giai đoạn sau.
                      </p>
                    </>
                  )}
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
    const vi = ifcClassLabel(resolvedCategory);
    const catLabel = vi ? `${resolvedCategory} (${vi})` : resolvedCategory;
    displayName = node.name || `${catLabel} [ID: ${expressId || 'N/A'}]`;
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

// Nhóm chip lọc QTO (Bộ môn / Hạng mục / Cấu kiện) với nút Tất cả / Bỏ chọn
function QtoFilterGroup({ label, items, selected, onToggle, onAll, onNone, scroll = false }: {
  label: string;
  items: { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onAll: () => void;
  onNone: () => void;
  scroll?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-outline uppercase tracking-wider w-16 shrink-0">{label}</span>
        <span className="text-[10px] text-on-surface-variant">{selected.size}/{items.length}</span>
        <button onClick={onAll} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">Tất cả</button>
        <button onClick={onNone} className="text-[10px] font-bold text-on-surface-variant hover:underline cursor-pointer">Bỏ chọn</button>
      </div>
      <div className={`flex flex-wrap gap-1 ${scroll ? 'max-h-24 overflow-y-auto custom-scrollbar pr-1' : ''}`}>
        {items.map(it => {
          const on = selected.has(it.key);
          return (
            <button key={it.key} onClick={() => onToggle(it.key)} title={it.label}
              className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer max-w-[200px] truncate ${
                on ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant/50 text-on-surface-variant hover:border-primary/40'
              }`}>
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
