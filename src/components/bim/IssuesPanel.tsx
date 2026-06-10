import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, type ChangeEvent } from 'react';
import {
  Plus, Download, Upload, X, ChevronLeft, Send, Trash2, Tag, Calendar,
  User, Crosshair, Camera as CameraIcon, MessageSquare, Pencil, Clock,
} from 'lucide-react';
import {
  fetchBcfTopics, createBcfTopic, updateBcfTopic, deleteBcfTopic,
  fetchBcfComments, addBcfComment, countBcfComments,
  type BcfComment,
} from '../../lib/api/data';
import { exportBcf, importBcf } from '../../lib/bcf/bcf';

export type BcfStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface BcfIssue {
  id: string;
  title: string;
  description: string;
  status: BcfStatus;
  priority: 'High' | 'Medium' | 'Low';
  topicType?: string;
  assignedTo: string;
  author?: string;
  dueDate?: string;
  labels?: string[];
  linkedElementGuid?: string;
  linkedElementExpressId?: number;
  camera?: { position: number[]; target: number[] };
  hiddenModels?: string[];
  screenshot?: string;
  createdDate: string;
}

export interface IssuesPanelHandle {
  /** Tạo nhanh vấn đề từ một xung đột (gọi từ Clash modal). */
  createFromClash: (data: {
    title: string; description: string;
    camera?: { position: number[]; target: number[] }; hiddenModels?: string[]; screenshot?: string;
    linkedElementExpressId?: number;
  }) => Promise<void>;
}

interface IssuesPanelProps {
  projectId?: string;
  currentUserName: string;
  assigneeOptions: string[];
  selectedElement: any;
  captureViewpoint: () => { camera?: { position: number[]; target: number[] }; hiddenModels?: string[]; screenshot?: string };
  onRestoreIssue: (issue: BcfIssue) => void;
  onFocusElement?: (expressId: number) => void;
}

const STATUS_FLOW: Record<BcfStatus, BcfStatus> = {
  'Open': 'In Progress', 'In Progress': 'Resolved', 'Resolved': 'Closed', 'Closed': 'Open',
};
const STATUS_LABEL: Record<BcfStatus, string> = {
  'Open': 'Mở', 'In Progress': 'Đang xử lý', 'Resolved': 'Đã xử lý', 'Closed': 'Đã đóng',
};
const STATUS_ORDER: BcfStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITY_LABEL: Record<BcfIssue['priority'], string> = { High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' };
const TYPE_LABEL: Record<string, string> = {
  Clash: 'Xung đột', Drawing: 'Bản vẽ', RFI: 'RFI', Issue: 'Vấn đề chung', Comment: 'Ghi chú',
};

const statusBadge = (s: BcfStatus) =>
  s === 'Open' ? 'bg-error/10 text-error border-error/20'
  : s === 'In Progress' ? 'bg-warning/10 text-warning border-warning/20'
  : s === 'Resolved' ? 'bg-success/10 text-success border-success/20'
  : 'bg-surface-container text-on-surface-variant border-outline-variant/30';

const priorityBadge = (p: BcfIssue['priority']) =>
  p === 'High' ? 'bg-error-container/20 text-error border-error-variant/20'
  : p === 'Medium' ? 'bg-warning/10 text-warning border-warning/20'
  : 'bg-surface-container text-on-surface-variant border-outline-variant/30';

function relTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

// id thật là UUID Supabase; "BCF-001"/"BCF-<timestamp>" là mẫu/cục bộ chưa lưu DB
const isPersisted = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const isOverdue = (issue: BcfIssue) =>
  !!issue.dueDate && issue.status !== 'Resolved' && issue.status !== 'Closed' &&
  new Date(issue.dueDate).getTime() < Date.now() - 86400000;

const DEFAULT_ISSUES: BcfIssue[] = [
  {
    id: 'BCF-001', title: 'Xung đột dầm phụ trục C với ống gió cứu hỏa',
    description: 'Đường ống cứu hỏa đi xuyên trực tiếp qua dầm kết cấu trục C tầng 2, cần hạ cao độ.',
    status: 'Open', priority: 'High', topicType: 'Clash', assignedTo: 'KS. Nguyễn Văn Hải',
    linkedElementGuid: '1A2B3C4D5E6F7G8H9', linkedElementExpressId: 1045, createdDate: '2026-06-07',
  },
  {
    id: 'BCF-002', title: 'Lệch vị trí ô chờ cửa thoát hiểm block B',
    description: 'Vị trí trích ô chờ cửa lệch 150mm so với bản vẽ dầm chuyển vách.',
    status: 'Open', priority: 'Medium', topicType: 'Drawing', assignedTo: 'KTS. Lê Minh Hoàng',
    linkedElementGuid: '9H8G7F6E5D4C3B2A1', linkedElementExpressId: 2314, createdDate: '2026-06-08',
  },
];

export const IssuesPanel = forwardRef<IssuesPanelHandle, IssuesPanelProps>(({
  projectId, currentUserName, assigneeOptions, selectedElement,
  captureViewpoint, onRestoreIssue, onFocusElement,
}, ref) => {
  const [issues, setIssues] = useState<BcfIssue[]>(DEFAULT_ISSUES);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | BcfStatus>('all');
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create form
  const [form, setForm] = useState({ title: '', desc: '', priority: 'High' as BcfIssue['priority'], type: 'Clash', assignee: assigneeOptions[0] ?? 'Chưa giao', dueDate: '' });

  // Detail: comments
  const [comments, setComments] = useState<BcfComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ title: '', desc: '' });
  const [newLabel, setNewLabel] = useState('');

  const selected = issues.find(i => i.id === selectedId) || null;

  // Nạp vấn đề + số bình luận từ Supabase
  useEffect(() => {
    if (!projectId) return;
    fetchBcfTopics(projectId).then(rows => {
      if (rows.length === 0) return; // giữ mẫu mặc định khi DB trống
      setIssues(rows.map(r => ({
        id: r.id, title: r.title, description: r.description,
        status: (r.status as BcfStatus) || 'Open',
        priority: (r.priority as BcfIssue['priority']) || 'Medium',
        topicType: r.topicType, assignedTo: r.assignedTo, author: r.author,
        dueDate: r.dueDate, labels: r.labels,
        linkedElementGuid: r.linkedElementGuid, linkedElementExpressId: r.linkedElementExpressId,
        camera: r.camera, hiddenModels: r.hiddenModels, screenshot: r.screenshot,
        createdDate: r.createdDate,
      })));
    }).catch(err => console.error('Không tải được vấn đề:', err));
    countBcfComments(projectId).then(setCommentCounts).catch(() => {});
  }, [projectId]);

  // Nạp bình luận khi mở chi tiết
  useEffect(() => {
    if (!selectedId) { setComments([]); return; }
    const isReal = /^[0-9a-f-]{36}$/i.test(selectedId);
    if (!isReal) { setComments([]); return; }
    setLoadingComments(true);
    fetchBcfComments(selectedId).then(setComments).finally(() => setLoadingComments(false));
  }, [selectedId]);

  const logSystem = useCallback(async (topicId: string, body: string, type: BcfComment['commentType']) => {
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(topicId)) return;
    const c = await addBcfComment(topicId, projectId, currentUserName, body, type);
    if (c) {
      setComments(prev => [...prev, c]);
      setCommentCounts(prev => ({ ...prev, [topicId]: (prev[topicId] ?? 0) + 1 }));
    }
  }, [projectId, currentUserName]);

  // ----- Tạo vấn đề mới -----
  const handleCreate = async () => {
    if (!form.title.trim()) return;
    const vp = captureViewpoint();
    const tempId = `BCF-${Date.now()}`;
    const issue: BcfIssue = {
      id: tempId, title: form.title, description: form.desc,
      status: 'Open', priority: form.priority, topicType: form.type, assignedTo: form.assignee,
      author: currentUserName, dueDate: form.dueDate || undefined, labels: [],
      linkedElementGuid: selectedElement ? (selectedElement.GlobalId || selectedElement.GUID) : undefined,
      linkedElementExpressId: selectedElement ? selectedElement.expressID : undefined,
      camera: vp.camera, hiddenModels: vp.hiddenModels, screenshot: vp.screenshot,
      createdDate: new Date().toISOString().split('T')[0],
    };
    setIssues(prev => [issue, ...prev]);
    setForm({ title: '', desc: '', priority: 'High', type: 'Clash', assignee: assigneeOptions[0] ?? 'Chưa giao', dueDate: '' });
    setMode('list');

    if (projectId) {
      const realId = await createBcfTopic(projectId, {
        title: issue.title, description: issue.description, status: issue.status,
        priority: issue.priority, topicType: issue.topicType, assignedTo: issue.assignedTo,
        author: currentUserName, dueDate: issue.dueDate, labels: [],
        linkedElementGuid: issue.linkedElementGuid, linkedElementExpressId: issue.linkedElementExpressId,
        camera: issue.camera, hiddenModels: issue.hiddenModels, screenshot: issue.screenshot,
      });
      if (realId) {
        setIssues(prev => prev.map(i => i.id === tempId ? { ...i, id: realId } : i));
        await logSystem(realId, `${currentUserName} đã tạo vấn đề.`, 'system');
      }
    }
  };

  // ----- Tạo từ xung đột (imperative) -----
  useImperativeHandle(ref, () => ({
    createFromClash: async (data) => {
      const tempId = `BCF-${Date.now()}`;
      const issue: BcfIssue = {
        id: tempId, title: data.title, description: data.description,
        status: 'Open', priority: 'High', topicType: 'Clash', assignedTo: 'Chưa giao',
        author: currentUserName, labels: [],
        camera: data.camera, hiddenModels: data.hiddenModels, screenshot: data.screenshot,
        linkedElementExpressId: data.linkedElementExpressId,
        createdDate: new Date().toISOString().split('T')[0],
      };
      setIssues(prev => [issue, ...prev]);
      if (projectId) {
        const realId = await createBcfTopic(projectId, {
          title: issue.title, description: issue.description, status: 'Open', priority: 'High',
          topicType: 'Clash', assignedTo: 'Chưa giao', author: currentUserName, labels: [],
          linkedElementExpressId: data.linkedElementExpressId,
          camera: data.camera, hiddenModels: data.hiddenModels, screenshot: data.screenshot,
        });
        if (realId) {
          setIssues(prev => prev.map(i => i.id === tempId ? { ...i, id: realId } : i));
          await logSystem(realId, `${currentUserName} đã tạo vấn đề từ xung đột.`, 'system');
        }
      }
    },
  }), [projectId, currentUserName, logSystem]);

  // ----- Cập nhật trường vấn đề -----
  const patchIssue = (id: string, patch: Partial<BcfIssue>) =>
    setIssues(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const handleStatus = async (issue: BcfIssue, status: BcfStatus) => {
    if (issue.status === status) return;
    patchIssue(issue.id, { status });
    if (!isPersisted(issue.id)) return;
    await updateBcfTopic(issue.id, { status });
    await logSystem(issue.id, `Đổi trạng thái: ${STATUS_LABEL[issue.status]} → ${STATUS_LABEL[status]}`, 'status');
  };
  const handlePriority = async (issue: BcfIssue, priority: BcfIssue['priority']) => {
    patchIssue(issue.id, { priority });
    if (!isPersisted(issue.id)) return;
    await updateBcfTopic(issue.id, { priority });
    await logSystem(issue.id, `Đổi độ ưu tiên → ${PRIORITY_LABEL[priority]}`, 'priority');
  };
  const handleAssignee = async (issue: BcfIssue, assignedTo: string) => {
    patchIssue(issue.id, { assignedTo });
    if (!isPersisted(issue.id)) return;
    await updateBcfTopic(issue.id, { assignedTo });
    await logSystem(issue.id, `Giao xử lý cho: ${assignedTo}`, 'assign');
  };
  const handleDue = async (issue: BcfIssue, dueDate: string) => {
    patchIssue(issue.id, { dueDate: dueDate || undefined });
    if (!isPersisted(issue.id)) return;
    await updateBcfTopic(issue.id, { dueDate: dueDate || null });
    await logSystem(issue.id, dueDate ? `Đặt hạn xử lý: ${dueDate}` : 'Bỏ hạn xử lý', 'system');
  };
  const handleAddLabel = async (issue: BcfIssue) => {
    const l = newLabel.trim();
    if (!l) return;
    const labels = Array.from(new Set([...(issue.labels ?? []), l]));
    patchIssue(issue.id, { labels });
    setNewLabel('');
    if (isPersisted(issue.id)) await updateBcfTopic(issue.id, { labels });
  };
  const handleRemoveLabel = async (issue: BcfIssue, label: string) => {
    const labels = (issue.labels ?? []).filter(x => x !== label);
    patchIssue(issue.id, { labels });
    if (isPersisted(issue.id)) await updateBcfTopic(issue.id, { labels });
  };
  const handleSaveEdit = async (issue: BcfIssue) => {
    patchIssue(issue.id, { title: editDraft.title, description: editDraft.desc });
    setEditing(false);
    if (isPersisted(issue.id)) await updateBcfTopic(issue.id, { title: editDraft.title, description: editDraft.desc });
  };
  const handleDelete = async (issue: BcfIssue) => {
    if (!confirm(`Xóa vấn đề "${issue.title}"?`)) return;
    setIssues(prev => prev.filter(i => i.id !== issue.id));
    setSelectedId(null);
    if (isPersisted(issue.id)) await deleteBcfTopic(issue.id);
  };

  const handleAddComment = async () => {
    if (!selected || !newComment.trim() || !projectId || !isPersisted(selected.id)) return;
    const c = await addBcfComment(selected.id, projectId, currentUserName, newComment.trim(), 'comment');
    if (c) {
      setComments(prev => [...prev, c]);
      setCommentCounts(prev => ({ ...prev, [selected.id]: (prev[selected.id] ?? 0) + 1 }));
    }
    setNewComment('');
  };

  // ----- BCF import/export -----
  const handleExport = async () => {
    if (issues.length === 0) return;
    try { await exportBcf(issues as any); }
    catch (err) { alert('Không xuất được file BCF: ' + (err as Error).message); }
  };
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBcf(file);
      if (imported.length === 0) { alert('Không tìm thấy vấn đề nào trong file.'); return; }
      setIssues(prev => {
        const existing = new Set(prev.map(i => i.id));
        return [...prev, ...imported.filter(i => !existing.has(i.id)) as BcfIssue[]];
      });
      if (projectId) {
        for (const iss of imported) {
          createBcfTopic(projectId, {
            title: iss.title, description: iss.description, status: iss.status, priority: iss.priority,
            assignedTo: iss.assignedTo, author: currentUserName,
            linkedElementGuid: iss.linkedElementGuid, linkedElementExpressId: iss.linkedElementExpressId,
          });
        }
      }
      alert(`Đã nhập ${imported.length} vấn đề từ "${file.name}".`);
    } catch (err) {
      alert('Không đọc được file BCF: ' + (err as Error).message);
    } finally { e.target.value = ''; }
  };

  const filtered = issues.filter(i => statusFilter === 'all' || i.status === statusFilter);

  // ============ DETAIL VIEW ============
  if (selected) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* Detail header */}
        <div className="p-3 border-b border-outline-variant bg-surface-container-low/30 shrink-0">
          <button onClick={() => { setSelectedId(null); setEditing(false); }}
            className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-primary mb-2 cursor-pointer">
            <ChevronLeft size={14} /> Danh sách vấn đề
          </button>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {selected.topicType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">{TYPE_LABEL[selected.topicType] ?? selected.topicType}</span>}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priorityBadge(selected.priority)}`}>{PRIORITY_LABEL[selected.priority]}</span>
                {isOverdue(selected) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20">Quá hạn</span>}
              </div>
              {editing ? (
                <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full px-2 py-1 bg-surface border border-outline-variant/60 rounded-lg text-[14px] font-bold text-on-surface focus:outline-none focus:border-primary" />
              ) : (
                <h3 className="font-bold text-[14px] text-on-surface leading-snug">{selected.title}</h3>
              )}
            </div>
            <button onClick={() => { setEditing(e => !e); setEditDraft({ title: selected.title, desc: selected.description }); }}
              className="p-1 text-on-surface-variant hover:text-primary rounded shrink-0 cursor-pointer" title="Chỉnh sửa">
              <Pencil size={14} />
            </button>
            <button onClick={() => handleDelete(selected)}
              className="p-1 text-on-surface-variant hover:text-error rounded shrink-0 cursor-pointer" title="Xóa vấn đề">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Status segmented */}
          <div className="p-3 border-b border-outline-variant/40">
            <label className="text-[10px] font-bold text-outline uppercase">Trạng thái</label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {STATUS_ORDER.map(s => (
                <button key={s} onClick={() => handleStatus(selected, s)}
                  className={`text-[10px] font-bold py-1.5 rounded-lg border transition-colors cursor-pointer ${selected.status === s ? statusBadge(s).replace('/10', '/20') + ' ring-1 ring-current/30' : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:border-primary/40'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Viewpoint */}
          {(selected.screenshot || selected.camera) && (
            <div className="p-3 border-b border-outline-variant/40">
              <button onClick={() => onRestoreIssue(selected)} className="w-full group cursor-pointer" title="Mở góc nhìn của vấn đề">
                {selected.screenshot
                  ? <img src={selected.screenshot} alt="" className="w-full h-32 object-cover rounded-lg border border-outline-variant/40 group-hover:border-primary transition-colors" />
                  : <div className="w-full h-20 rounded-lg bg-surface-container flex items-center justify-center border border-outline-variant/40"><CameraIcon size={20} className="text-outline" /></div>}
                <span className="flex items-center justify-center gap-1 text-[10.5px] font-bold text-primary mt-1.5"><CameraIcon size={12} /> Mở góc nhìn (camera + ẩn/hiện)</span>
              </button>
              {selected.linkedElementExpressId != null && (
                <button onClick={() => onFocusElement?.(selected.linkedElementExpressId!)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-[10.5px] font-bold text-on-surface-variant hover:text-primary bg-surface-container hover:bg-primary/5 border border-outline-variant/40 rounded-lg py-1.5 cursor-pointer">
                  <Crosshair size={12} /> Phóng tới cấu kiện liên kết
                </button>
              )}
            </div>
          )}

          {/* Meta: assignee / due */}
          <div className="p-3 border-b border-outline-variant/40 space-y-2.5">
            <div className="flex items-center gap-2">
              <User size={13} className="text-outline shrink-0" />
              <span className="text-[11px] font-bold text-outline w-16 shrink-0">Giao xử lý</span>
              <select value={selected.assignedTo} onChange={e => handleAssignee(selected, e.target.value)}
                className="flex-1 bg-surface border border-outline-variant/60 rounded-lg px-2 py-1 text-[11px] font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                {!assigneeOptions.includes(selected.assignedTo) && <option value={selected.assignedTo}>{selected.assignedTo}</option>}
                <option value="Chưa giao">Chưa giao</option>
                {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-outline shrink-0" />
              <span className="text-[11px] font-bold text-outline w-16 shrink-0">Hạn xử lý</span>
              <input type="date" value={selected.dueDate ?? ''} onChange={e => handleDue(selected, e.target.value)}
                className={`flex-1 bg-surface border rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none focus:border-primary cursor-pointer ${isOverdue(selected) ? 'border-error/50 text-error' : 'border-outline-variant/60 text-on-surface'}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-outline w-16 shrink-0 ml-[21px]">Ưu tiên</span>
              <select value={selected.priority} onChange={e => handlePriority(selected, e.target.value as BcfIssue['priority'])}
                className="flex-1 bg-surface border border-outline-variant/60 rounded-lg px-2 py-1 text-[11px] font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                <option value="High">Cao</option><option value="Medium">Trung bình</option><option value="Low">Thấp</option>
              </select>
            </div>
          </div>

          {/* Labels */}
          <div className="p-3 border-b border-outline-variant/40">
            <div className="flex items-center gap-1.5 mb-1.5"><Tag size={12} className="text-outline" /><span className="text-[10px] font-bold text-outline uppercase">Nhãn</span></div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(selected.labels ?? []).map(l => (
                <span key={l} className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {l}<button onClick={() => handleRemoveLabel(selected, l)} className="hover:text-error cursor-pointer"><X size={10} /></button>
                </span>
              ))}
              {(!selected.labels || selected.labels.length === 0) && <span className="text-[10px] text-outline">Chưa có nhãn</span>}
            </div>
            <div className="flex gap-1">
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLabel(selected)}
                placeholder="Thêm nhãn..." className="flex-1 px-2 py-1 bg-surface border border-outline-variant/60 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface" />
              <button onClick={() => handleAddLabel(selected)} className="px-2 bg-surface-container hover:bg-primary/10 border border-outline-variant/40 rounded-lg text-primary cursor-pointer"><Plus size={12} /></button>
            </div>
          </div>

          {/* Description */}
          <div className="p-3 border-b border-outline-variant/40">
            <label className="text-[10px] font-bold text-outline uppercase">Mô tả</label>
            {editing ? (
              <>
                <textarea value={editDraft.desc} onChange={e => setEditDraft(d => ({ ...d, desc: e.target.value }))} rows={4}
                  className="w-full mt-1 px-2 py-1.5 bg-surface border border-outline-variant/60 rounded-lg text-[12px] focus:outline-none focus:border-primary text-on-surface resize-none" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleSaveEdit(selected)} className="flex-1 bg-primary text-on-primary font-bold text-[11px] py-1.5 rounded-lg cursor-pointer">Lưu</button>
                  <button onClick={() => setEditing(false)} className="px-3 bg-surface-container text-on-surface-variant font-bold text-[11px] py-1.5 rounded-lg cursor-pointer">Hủy</button>
                </div>
              </>
            ) : (
              <p className="text-[12px] leading-relaxed text-on-surface whitespace-pre-wrap mt-1">{selected.description || <span className="text-outline">Không có mô tả.</span>}</p>
            )}
          </div>

          {/* Comments / Activity */}
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-2"><MessageSquare size={12} className="text-outline" /><span className="text-[10px] font-bold text-outline uppercase">Trao đổi & Nhật ký ({comments.length})</span></div>
            {loadingComments && <p className="text-[11px] text-outline">Đang tải...</p>}
            <div className="space-y-2 mb-3">
              {comments.map(c => c.commentType !== 'comment' ? (
                <div key={c.id} className="flex items-center gap-1.5 text-[10.5px] text-on-surface-variant pl-1">
                  <Clock size={11} className="text-outline shrink-0" />
                  <span className="font-medium">{c.body}</span>
                  <span className="text-outline ml-auto shrink-0">{relTime(c.createdAt)}</span>
                </div>
              ) : (
                <div key={c.id} className="bg-surface-container/60 border border-outline-variant/30 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-bold text-on-surface">{c.author}</span>
                    <span className="text-[9.5px] text-outline">{relTime(c.createdAt)}</span>
                  </div>
                  <p className="text-[11.5px] text-on-surface whitespace-pre-wrap leading-snug">{c.body}</p>
                </div>
              ))}
              {!loadingComments && comments.length === 0 && <p className="text-[11px] text-outline">Chưa có trao đổi. Hãy bắt đầu thảo luận.</p>}
            </div>
            <div className="flex gap-1.5">
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                placeholder="Viết bình luận... (Ctrl+Enter để gửi)" rows={2}
                className="flex-1 px-2 py-1.5 bg-surface border border-outline-variant/60 rounded-lg text-[11.5px] focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface resize-none" />
              <button onClick={handleAddComment} disabled={!newComment.trim() || !projectId || !isPersisted(selected.id)}
                className="px-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-stretch flex items-center" title="Gửi bình luận">
                <Send size={14} />
              </button>
            </div>
            {!isPersisted(selected.id) && <p className="text-[10px] text-outline mt-1">Đây là vấn đề mẫu (chưa lưu hệ thống) nên chưa thể trao đổi. Hãy tạo vấn đề mới.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ============ CREATE VIEW ============
  if (mode === 'create') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center mb-1">
            <h4 className="font-bold text-[12px] text-on-surface">Tạo vấn đề mới</h4>
            <button onClick={() => setMode('list')} className="text-on-surface-variant hover:text-error font-bold text-[11px] cursor-pointer">Hủy</button>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-outline uppercase">Tiêu đề</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ví dụ: Xung đột dầm với ống nước"
              className="w-full px-2.5 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-outline uppercase">Mô tả chi tiết</label>
            <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} rows={3} placeholder="Mô tả hiện trạng và giải pháp..."
              className="w-full px-2.5 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline/60 text-on-surface resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase">Độ ưu tiên</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as BcfIssue['priority'] }))}
                className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                <option value="High">Cao</option><option value="Medium">Trung bình</option><option value="Low">Thấp</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase">Giao xử lý</label>
              <select value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                <option value="Chưa giao">Chưa giao</option>
                {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase">Loại vấn đề</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer">
                <option value="Clash">Xung đột (Clash)</option><option value="Drawing">Bản vẽ (Drawing)</option>
                <option value="RFI">Yêu cầu thông tin (RFI)</option><option value="Issue">Vấn đề chung</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-outline uppercase">Hạn xử lý</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer" />
            </div>
          </div>
          <div className="bg-primary/5 p-2 rounded-lg border border-primary/10 text-[10.5px] leading-relaxed text-on-surface-variant font-medium">
            <span className="font-bold text-primary">Cấu kiện: </span>
            {selectedElement
              ? <span className="font-semibold text-on-surface truncate inline-block max-w-[200px] align-bottom">{selectedElement.Name?.value ?? selectedElement.Name ?? 'Đã chọn'}</span>
              : <span className="text-outline">Chọn cấu kiện để liên kết</span>}
            <div className="mt-1 text-[10px] text-outline">📸 Góc nhìn hiện tại (camera + ẩn/hiện) sẽ được lưu kèm.</div>
          </div>
          <button onClick={handleCreate} className="w-full bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs py-2 rounded-lg cursor-pointer shadow-sm mt-1">Tạo vấn đề</button>
        </div>
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div className="p-4 flex-1 flex flex-col overflow-y-auto custom-scrollbar h-full space-y-4">
      <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
        <span className="text-[11px] font-bold text-outline uppercase tracking-wider">Danh sách vấn đề ({issues.length})</span>
        <div className="flex items-center gap-1">
          <label className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-primary/5 flex items-center gap-1 font-bold text-[11px] cursor-pointer" title="Nhập file .bcfzip từ Revit/Navisworks">
            <Download size={12} /> Nhập
            <input type="file" accept=".bcfzip,.zip" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} disabled={issues.length === 0}
            className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-primary/5 flex items-center gap-1 font-bold text-[11px] cursor-pointer disabled:opacity-40" title="Xuất ra file .bcfzip">
            <Upload size={12} /> Xuất
          </button>
          <button onClick={() => setMode('create')} className="text-primary hover:text-primary-container p-1 rounded hover:bg-primary/5 flex items-center gap-1 font-bold text-[11px] cursor-pointer">
            <Plus size={12} /> Tạo mới
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(['all', 'Open', 'In Progress', 'Resolved', 'Closed'] as const).map(s => {
          const count = s === 'all' ? issues.length : issues.filter(i => i.status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors cursor-pointer ${statusFilter === s ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-outline-variant/50 text-on-surface-variant hover:border-primary/40'}`}>
              {s === 'all' ? 'Tất cả' : STATUS_LABEL[s]} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map(issue => (
          <div key={issue.id} onClick={() => setSelectedId(issue.id)}
            className="bg-surface border border-outline-variant/40 hover:border-primary/40 rounded-xl p-3 transition-all duration-200 group cursor-pointer">
            <div className="flex gap-3">
              <div className="shrink-0">
                {issue.screenshot
                  ? <img src={issue.screenshot} alt="" className="w-16 h-12 object-cover rounded-lg border border-outline-variant/40" />
                  : <div className="w-16 h-12 rounded-lg bg-surface-container flex items-center justify-center"><MessageSquare size={16} className="text-outline" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {issue.topicType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">{TYPE_LABEL[issue.topicType] ?? issue.topicType}</span>}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${priorityBadge(issue.priority)}`}>{PRIORITY_LABEL[issue.priority]}</span>
                  {isOverdue(issue) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20">Quá hạn</span>}
                </div>
                <h4 className="font-bold text-[13px] text-on-surface group-hover:text-primary transition-colors leading-snug line-clamp-2">{issue.title}</h4>
                <p className="text-[10.5px] text-outline leading-normal truncate font-medium">{issue.assignedTo}</p>
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/20">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(issue.status)}`}>{STATUS_LABEL[issue.status]}</span>
              <div className="flex items-center gap-2">
                {(commentCounts[issue.id] ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant"><MessageSquare size={11} />{commentCounts[issue.id]}</span>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleStatus(issue, STATUS_FLOW[issue.status]); }}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer" title="Chuyển trạng thái tiếp theo">
                  → {STATUS_LABEL[STATUS_FLOW[issue.status]]}
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-[12px] text-outline text-center py-6">Không có vấn đề nào.</p>}
      </div>
    </div>
  );
});

IssuesPanel.displayName = 'IssuesPanel';
