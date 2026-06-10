import React, { useState, useRef } from 'react';
import { 
  FileText, CheckCircle2, TrendingUp, AlertTriangle, Upload, 
  MessageSquare, RefreshCw, ExternalLink, Sparkles, Send, Check, 
  X, HelpCircle, ArrowUpRight, Folder, Eye, CheckCircle,
  Pencil, MapPin, Calendar, Building2
} from 'lucide-react';
import { DocumentItem, ApprovalItem, ClashItem, ActivityItem } from '../../types';
import { ProjectItem } from '../project/ProjectList';
import { askAssistant, isAiConfigured, type ChatTurn } from '../../lib/ai/gemini';
import { updateDocument } from '../../lib/api/documents';
import { updateClashStatus, deleteApproval, logActivity } from '../../lib/api/data';
import { canApprove, roleLabel } from '../../lib/roles';

export interface DashboardTabProps {
  documents: DocumentItem[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  approvals: ApprovalItem[];
  setApprovals: React.Dispatch<React.SetStateAction<ApprovalItem[]>>;
  clashes: ClashItem[];
  setClashes: React.Dispatch<React.SetStateAction<ClashItem[]>>;
  activities: ActivityItem[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  projectId?: string;
  project?: ProjectItem | null;
  onEditProject?: () => void;
  userRole?: string;
}

export function DashboardTab({
  documents,
  setDocuments,
  approvals,
  setApprovals,
  clashes,
  setClashes,
  activities,
  setActivities,
  projectId,
  project,
  onEditProject,
  userRole
}: DashboardTabProps) {
  const mayApprove = canApprove(userRole);
  // --- STATE ---
  const documentsCount = 1243 + documents.length;
  const clashesCount = clashes.filter(c => c.status !== 'Đã giải quyết').length;
  const [approvalPercent, setApprovalPercent] = useState(84);
  const [spendingActual, setSpendingActual] = useState(82.1);


  // --- MODAL & DECISION DRAWER STATE ---
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [isClashModalOpen, setIsClashModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // AI assistant states
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    { sender: 'ai', text: 'Xin chào! Tôi là Trợ lý AI của CIC CDE. Tôi có thể hỗ trợ bạn tra cứu tiêu chuẩn kỹ thuật (TCVN), hướng dẫn quản lý tài liệu ISO 19650 hoặc phân tích các chỉ số EVA của dự án.', time: '13:58' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const sendChatMessage = async (text: string) => {
    if (!text.trim()) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text, time: timeNow };

    // Lưu lại lịch sử trước khi thêm câu hỏi mới (để gửi context cho AI).
    const history: ChatTurn[] = chatMessages.map(m => ({ sender: m.sender, text: m.text }));

    setChatMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsAiTyping(true);

    const projectContext = `- Ngân sách hoàn thành (BAC): 125.4 Tỷ VNĐ\n- Chi phí thực tế đã giải ngân (AC): ${spendingActual} Tỷ VNĐ\n- Tỷ lệ phê duyệt hồ sơ: ${approvalPercent}%\n- Số xung đột chưa xử lý: ${clashes.filter(c => c.status !== 'Đã giải quyết').length}`;

    try {
      const aiText = await askAssistant(history, text, projectContext);
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, { sender: 'ai' as const, text: aiText, time: replyTime }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'ai' as const, text: 'Đã xảy ra lỗi khi gọi trợ lý AI. Vui lòng thử lại.', time: timeNow }]);
    } finally {
      setIsAiTyping(false);
    }
  };
  
  // Custom temporary toast alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Simulated file upload states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');



  // Trigger transient toasts
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Handle Approvals
  const handleApprove = (id: string, isAccepted: boolean) => {
    const item = approvals.find(a => a.id === id);
    if (!item) return;

    // Remove from approvals
    setApprovals(prev => prev.filter(a => a.id !== id));
    
    // Increment stats
    if (isAccepted) {
      setApprovalPercent(prev => Math.min(100, prev + 3));
      triggerToast(`Đã phê duyệt và thông qua yêu cầu ${id} thành công!`);
      
      // Update linked document if present
      if (item.documentId) {
        setDocuments(prevDocs => prevDocs.map(doc => {
          if (doc.id === item.documentId) {
            return {
              ...doc,
              folder: '02_SHARED',
              status: 'S1 - SHARED',
              modifiedDate: new Date().toISOString()
            };
          }
          return doc;
        }));
      }
    } else {
      triggerToast(`Đã từ chối và phản hồi yêu cầu ${id} về bên đệ trình.`);
      
      // Reset linked document status if present
      if (item.documentId) {
        setDocuments(prevDocs => prevDocs.map(doc => {
          if (doc.id === item.documentId) {
            return {
              ...doc,
              status: 'S0 - WIP',
              modifiedDate: new Date().toISOString()
            };
          }
          return doc;
        }));
      }
    }

    // Add activity
    const newActivity: ActivityItem = {
      id: String(Date.now()),
      user: 'BIM Manager (Bạn)',
      action: isAccepted ? 'đã phê duyệt thành công' : 'đã từ chối đề xuất',
      target: `${id}: ${item.type}`,
      time: 'Vừa xong',
      type: 'approve'
    };
    setActivities(prev => [newActivity, ...prev]);
    setSelectedApproval(null);

    // Persist to Supabase
    if (projectId) {
      deleteApproval(projectId, id);
      if (item.documentId) {
        const linkedDoc = documents.find(d => d.id === item.documentId);
        if (linkedDoc) {
          updateDocument(linkedDoc, projectId, isAccepted
            ? { folder: '02_SHARED', status: 'S1 - SHARED' }
            : { status: 'S0 - WIP' });
        }
      }
      logActivity(projectId, 'BIM Manager (Bạn)', isAccepted ? 'đã phê duyệt thành công' : 'đã từ chối đề xuất', `${id}: ${item.type}`, 'approve');
    }
  };

  // Handle Clash Resolution
  const resolveClash = (id: string) => {
    const clash = clashes.find(c => c.id === id);
    if (!clash) return;

    setClashes(prev => prev.map(c => c.id === id ? { ...c, status: 'Đã giải quyết' } : c));
    triggerToast(`Đã giải quyết dứt điểm xung đột ${id}: ${clash.elements}!`);

    const newActivity: ActivityItem = {
      id: String(Date.now()),
      user: 'BIM Manager (Bạn)',
      action: 'đã giải quyết hành động xung đột',
      target: `${id} (${clash.discipline})`,
      time: 'Vừa xong',
      type: 'clash'
    };
    setActivities(prev => [newActivity, ...prev]);

    if (projectId) {
      updateClashStatus(projectId, id, 'Đã giải quyết');
      logActivity(projectId, 'BIM Manager (Bạn)', 'đã giải quyết hành động xung đột', `${id} (${clash.discipline})`, 'clash');
    }
  };

  // Simulated File Upload Action
  const triggerMockUpload = (fileName: string) => {
    if (!fileName) return;
    setIsUploading(true);
    setUploadProgress(5);
    setUploadedFileName(fileName);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            setIsUploadModalOpen(false);
            
            // Create and append a new document item in WIP
            const fileType = fileName.endsWith('.ifc') ? 'ifc' : fileName.endsWith('.dwg') ? 'dwg' : 'pdf';
            const newDoc: DocumentItem = {
              id: `PRJ-${fileType.toUpperCase()}-Z01-ZZ-M3-${fileType === 'ifc' ? 'W' : 'A'}-${Math.floor(1000 + Math.random() * 9000)}`,
              name: fileName.replace(/\.[^/.]+$/, ""),
              folder: '01_WIP',
              subFolder: 'Bản vẽ thiết kế',
              status: 'S0 - WIP',
              revision: 'P01',
              version: 'V1',
              modifiedDate: new Date().toISOString(),
              size: '1.2 MB',
              creator: 'BIM Manager (Bạn)',
              classification: 'EF_20_10',
              volume: 'Z01 - Zone 1',
              fileType
            };
            setDocuments(prevDocs => [newDoc, ...prevDocs]);
            
            triggerToast(`Tải lên tài liệu "${fileName}" hoàn tất và lưu trữ vào thư mục ISO 19650!`);
            
            // Log activity
            const newAct: ActivityItem = {
              id: String(Date.now()),
              user: 'BIM Manager (Bạn)',
              action: 'đã tải lên tài liệu mới',
              target: fileName,
              time: 'Vừa xong',
              type: 'upload'
            };
            setActivities(prevAct => [newAct, ...prevAct]);
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  // Dynamic Spend additions
  const addSpendingMock = (amount: number) => {
    setSpendingActual(prev => {
      const updated = parseFloat((prev + amount).toFixed(1));
      triggerToast(`Đại lượng thực tế chi ngân sách đã tăng thêm +${amount} Tỷ. Cập nhật tiến trình dự toán.`);
      return updated;
    });
    setIsBudgetModalOpen(false);
  };



  return (
    <div className="flex-1 overflow-y-auto bg-surface p-4 md:p-6 lg:p-8 relative">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* --- TOAST NOTIFICATION RENDERER --- */}
        {toastMessage && (
          <div className="fixed top-4 right-4 bg-inverse-surface text-inverse-on-surface shadow-lg px-4 py-3 rounded-xl flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 border border-outline/30 font-medium text-sm">
            <CheckCircle className="text-teal-accent" size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* --- KPI METRIC CARDS --- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Card 1: Tài liệu Mới */}
          <div 
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-98"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-primary-container/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <FileText size={20} />
              </div>
              <span className="font-mono text-[11px] font-semibold text-primary px-2 py-0.5 bg-primary-container/10 rounded flex items-center gap-1">
                Tải lên <Upload size={10} />
              </span>
            </div>
            <div>
              <div className="text-[13px] text-on-surface-variant mb-1 group-hover:text-on-surface transition-colors">Tài liệu Mới</div>
              <div className="font-bold text-3xl tracking-tight text-on-surface flex items-baseline gap-1.5">
                {documentsCount.toLocaleString()}
                <span className="text-xs text-outline font-normal">tập tin</span>
              </div>
            </div>
          </div>

          {/* Card 2: Phê duyệt */}
          <div 
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between hover:border-outline-variant/80 transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-tertiary-container/10 rounded-lg text-tertiary">
                <CheckCircle2 size={20} />
              </div>
              <span className="font-mono text-[11px] font-bold text-error px-2 py-0.5 bg-error-container/30 rounded">
                {approvals.length} chờ xử lý
              </span>
            </div>
            <div>
              <div className="text-[13px] text-on-surface-variant mb-1">Tỷ lệ Phê duyệt</div>
              <div className="font-bold text-3xl tracking-tight text-on-surface flex items-baseline gap-1">
                {approvalPercent}%
                <span className="text-[10px] text-teal-accent font-semibold">↑ tăng</span>
              </div>
            </div>
          </div>

          {/* Card 3: Tiến độ */}
          <div 
            onClick={() => setIsBudgetModalOpen(true)}
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between hover:border-primary-container/40 hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-98"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-secondary-container/30 rounded-lg text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <TrendingUp size={20} />
              </div>
              <span className="font-mono text-[11px] font-bold text-primary px-2 py-0.5 bg-primary-fixed/20 rounded-full group-hover:bg-primary-fixed transition-colors">
                Cập nhật chi phí
              </span>
            </div>
            <div>
              <div className="text-[13px] text-on-surface-variant mb-1 group-hover:text-on-surface transition-colors">Thực tế Đã chi</div>
              <div className="font-bold text-3xl tracking-tight text-primary flex items-baseline gap-1">
                {spendingActual} Tỷ
                <span className="text-[11px] text-outline font-normal">/ 125.4T</span>
              </div>
            </div>
          </div>

          {/* Card 4: Xung đột */}
          <div 
            onClick={() => setIsClashModalOpen(true)}
            className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between hover:border-error/40 hover:shadow-md transition-all duration-200 cursor-pointer group active:scale-98"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-error-container/20 rounded-lg text-error group-hover:bg-error group-hover:text-on-error transition-colors">
                <AlertTriangle size={20} />
              </div>
              {clashesCount > 0 ? (
                <span className="font-mono text-[11px] font-bold text-error px-2 py-0.5 bg-error-container/30 rounded flex items-center gap-1 animate-pulse">
                  Giải quyết <ArrowUpRight size={10} />
                </span>
              ) : (
                <span className="font-mono text-[11px] font-bold text-teal-accent px-2 py-0.5 bg-teal-accent/10 rounded">Sạch</span>
              )}
            </div>
            <div>
              <div className="text-[13px] text-on-surface-variant mb-1 group-hover:text-on-surface transition-colors">Xung đột (Clash)</div>
              <div className={`font-bold text-3xl tracking-tight transition-colors ${clashesCount > 0 ? 'text-error' : 'text-teal-accent'}`}>
                {clashesCount}
              </div>
            </div>
          </div>
        </section>

        {/* --- MAIN THREE COLUMN AREA --- */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Project Info Widget */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/30 shrink-0">
              <h3 className="font-semibold text-[15px] text-on-surface flex items-center gap-1.5">
                <Building2 size={16} className="text-primary" />
                Thông tin Dự án
              </h3>
              {onEditProject && (
                <button
                  onClick={onEditProject}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-container bg-primary/5 hover:bg-primary-container/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer border border-primary/20"
                >
                  <Pencil size={11} />
                  Sửa
                </button>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[360px] text-xs">
              {project ? (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Mã Dự án (ISO 19650)</div>
                    <div className="font-mono text-sm text-on-surface font-semibold bg-surface-container/60 px-2 py-1 rounded border border-outline-variant/45 inline-block">
                      #{project.id.toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Chủ đầu tư</div>
                    <div className="text-on-surface font-semibold">{project.client || 'Chưa cập nhật'}</div>
                  </div>

                  {/* Nhóm dự án & Cấp công trình */}
                  {(project.projectGroup || project.buildingGrade) && (
                    <div className="grid grid-cols-2 gap-2">
                      {project.projectGroup && (
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Nhóm dự án</div>
                          <div className="text-on-surface font-semibold bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30 text-[11px] inline-block">
                            {project.projectGroup}
                          </div>
                        </div>
                      )}
                      {project.buildingGrade && (
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Cấp công trình</div>
                          <div className="text-on-surface font-semibold bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30 text-[11px] inline-block">
                            {project.buildingGrade}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Ngày bắt đầu</div>
                    <div className="text-on-surface font-semibold flex items-center gap-1.5">
                      <Calendar size={13} className="text-outline" />
                      {project.startDate || 'Chưa cập nhật'}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Địa điểm thực tế</div>
                    <div className="text-on-surface font-semibold flex items-center gap-1.5">
                      <MapPin size={13} className="text-outline" />
                      {project.location || 'Chưa cập nhật'}
                    </div>
                  </div>

                  {project.lat !== undefined && project.lng !== undefined && (
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Tọa độ địa lý</div>
                      <div className="text-on-surface font-semibold font-mono">
                        {project.lat.toFixed(5)}, {project.lng.toFixed(5)} ({project.province || 'Bản đồ'})
                      </div>
                    </div>
                  )}

                  {project.tilesUrl && (
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Mô hình 3D Tiles (GIS)</div>
                      <div className="text-primary font-mono truncate hover:underline flex items-center gap-1" title={project.tilesUrl}>
                        <ExternalLink size={12} className="shrink-0 text-outline" />
                        <span className="truncate">{project.tilesUrl}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-0.5 pt-2 border-t border-outline-variant/30">
                    <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Mô tả quy mô</div>
                    <p className="text-on-surface-variant font-normal leading-relaxed text-[11.5px] italic">
                      "{project.description || 'Chưa có thông tin mô tả chi tiết quy mô công trình.'}"
                    </p>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-outline py-8">
                  Không tìm thấy thông tin chi tiết dự án.
                </div>
              )}
            </div>
          </div>
          
          {/* Recent Activity List widget (State reactive for logs) */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/30 shrink-0">
              <h3 className="font-semibold text-[15px] text-on-surface">Hoạt động Gần đây</h3>
              <span className="text-[11px] text-outline">Ghi nhật trình hoạt động</span>
            </div>
            <div className="p-2 flex-1 flex flex-col gap-1 overflow-y-auto max-h-[360px]">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-on-surface-variant text-sm">Chưa có nhật trình nào hôm nay.</div>
              ) : (
                activities.map(act => (
                  <div key={act.id} className="p-3 flex items-start gap-4 hover:bg-surface-container-low/40 rounded-lg transition-colors cursor-pointer group animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className={`w-8 h-8 rounded-full flex flex-col items-center justify-center shrink-0 ${
                      act.type === 'upload' ? 'bg-primary-container/20 text-primary' : 
                      act.type === 'approve' ? 'bg-teal-accent/10 text-teal-accent' :
                      act.type === 'clash' ? 'bg-error-container/20 text-error' :
                      act.type === 'comment' ? 'bg-tertiary-container/10 text-tertiary' : 'bg-secondary-container/10 text-secondary'
                    }`}>
                      {act.type === 'upload' && <Upload size={14} />}
                      {act.type === 'approve' && <Check size={14} />}
                      {act.type === 'clash' && <AlertTriangle size={14} />}
                      {act.type === 'comment' && <MessageSquare size={14} />}
                      {act.type === 'system' && <RefreshCw size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-on-surface leading-normal">
                        <span className="font-semibold text-on-surface">{act.user}</span> {act.action} <span className="font-mono text-[12px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant break-all font-medium inline-block">{act.target}</span>
                      </p>
                      <p className="font-mono text-[10px] text-outline mt-1.5">{act.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Approvals Table widget */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-low/30 shrink-0">
              <h3 className="font-semibold text-[15px] text-on-surface">Phê duyệt Chờ xử lý</h3>
              {approvals.length > 0 ? (
                <span className="bg-error-container text-on-error-container font-semibold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full">
                  {approvals.length} Cần chú ý
                </span>
              ) : (
                <span className="bg-teal-accent/10 text-teal-accent font-semibold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full">
                  Hoàn tất đạt 100%
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto p-0 flex-1 max-h-[360px]">
              {approvals.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant flex flex-col items-center gap-2">
                  <CheckCircle className="text-teal-accent" size={36} />
                  <span className="font-semibold text-sm">Toàn bộ hồ sơ phê duyệt đã được giải quyết xong!</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[420px]">
                  <thead>
                    <tr className="bg-surface/50 border-b border-outline-variant/30 font-mono text-[11px] text-on-surface-variant/85 sticky top-0 bg-surface-container-lowest z-10">
                      <th className="px-5 py-3 font-semibold">MÃ / ID</th>
                      <th className="px-5 py-3 font-semibold">LOẠI</th>
                      <th className="px-5 py-3 font-semibold">HẠN CHÓT</th>
                      <th className="px-5 py-3 font-semibold text-right">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {approvals.map(app => (
                      <tr key={app.id} className="border-b border-outline-variant/10 hover:bg-surface-container-low/30 group cursor-pointer transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[12px] text-primary font-semibold">{app.id}</td>
                        <td className="px-5 py-3.5 text-on-surface font-medium group-hover:text-primary transition-colors">{app.type}</td>
                        <td className={`px-5 py-3.5 font-medium ${app.deadline === 'Hôm nay' ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>
                          {app.deadline}
                        </td>
                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => setSelectedApproval(app)}
                            className="bg-primary/5 hover:bg-primary hover:text-on-primary text-primary px-3 py-1.5 rounded-lg font-bold text-[11px] tracking-wider transition-all"
                          >
                            XEM
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* --- SIDE DECISION DRAWER FOR APPROVAL DETAILS --- */}
      {selectedApproval && (
         <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex justify-end z-[90] animate-in fade-in duration-200">
            <div 
               className="w-full max-w-[420px] bg-surface-container-lowest h-full shadow-[status_bar_shadow] flex flex-col animate-in slide-in-from-right duration-300 border-l border-outline-variant"
               onClick={(e) => e.stopPropagation()}
            >
               {/* Drawer Header */}
               <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-[15px] text-on-surface">Chi tiết Hồ sơ Trình duyệt</h3>
                  <button 
                     onClick={() => setSelectedApproval(null)}
                     className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                     <X size={18} />
                  </button>
               </div>
               
               {/* Body Content */}
               <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-5">
                  <div className="w-full aspect-video bg-surface-container-low rounded-xl flex items-center justify-center border border-dashed border-outline-variant/60">
                     <FileText size={44} className="text-outline/40" />
                  </div>

                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] font-bold text-primary bg-primary-fixed/20 px-2 py-0.5 rounded">
                           {selectedApproval.id}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-error bg-error-container/40 text-error px-2 py-0.5 rounded">
                           Hạn: {selectedApproval.deadline}
                        </span>
                     </div>
                     <h4 className="font-bold text-[16px] text-on-surface tracking-tight mt-2">{selectedApproval.type}</h4>
                     <p className="text-[12px] text-outline font-mono mt-0.5">Ngày tạo: {selectedApproval.createdDate} | Người đề xuất: {selectedApproval.requester}</p>
                  </div>

                  <div className="bg-surface-container p-4 rounded-xl border border-outline-variant/30 text-sm leading-relaxed text-on-surface space-y-2">
                     <p className="font-medium">Nội dung đề xuất giải quyết:</p>
                     <p className="text-on-surface-variant text-[13px] font-normal">{selectedApproval.description}</p>
                  </div>

                  <div className="space-y-2.5">
                     <p className="font-bold text-[10px] tracking-wider uppercase text-outline">Tập tin đính kèm trình ký</p>
                     <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant/50 rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                           <FileText size={18} className="text-primary" />
                           <span className="font-mono text-xs text-on-surface truncate pr-2">{selectedApproval.file}</span>
                        </div>
                        <span className="text-[10px] bg-surface-container p-1 rounded font-mono font-medium">1.4 MB</span>
                     </div>
                  </div>

                  <div className="bg-tertiary-fixed/30 border border-tertiary-fixed-dim/40 rounded-xl p-4 flex gap-2 text-xs leading-relaxed text-on-tertiary-fixed">
                     <span className="text-tertiary font-bold shrink-0">*</span>
                     <p className="font-medium">
                        <strong>BIM Agent Gợi ý:</strong> Hồ sơ liên kết đầy đủ, các kích thước dập dầm khớp phối cảnh thiết kế tổng thể. Đề xuất **Phê duyệt** để giải phóng tiến trình thi công móng.
                     </p>
                  </div>
               </div>

               {/* Actions block — chỉ vai trò có quyền mới được duyệt */}
               {mayApprove ? (
                 <div className="p-4 border-t border-outline-variant flex gap-3 shrink-0 bg-surface-container-lowest">
                    <button
                       onClick={() => handleApprove(selectedApproval.id, false)}
                       className="flex-1 py-2.5 border border-error text-error hover:bg-error-container/20 rounded-xl font-bold text-[13px] transition-colors focus:outline-none"
                    >
                       Từ chối
                    </button>
                    <button
                       onClick={() => handleApprove(selectedApproval.id, true)}
                       className="flex-1 py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-[13px] shadow transition-colors focus:outline-none"
                    >
                       Phê duyệt
                    </button>
                 </div>
               ) : (
                 <div className="p-4 border-t border-outline-variant shrink-0 bg-surface-container-lowest text-[11.5px] text-on-surface-variant text-center font-medium">
                   Vai trò của bạn ({roleLabel(userRole)}) không có quyền phê duyệt. Cần vai trò Người kiểm/Phê duyệt/Quản trị.
                 </div>
               )}
            </div>
         </div>
      )}

      {/* --- CLASH MANAGEMENT MODAL --- */}
      {isClashModalOpen && (
         <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
            <div 
               className="w-full max-w-[680px] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 flex flex-col max-h-[90vh] overflow-hidden" 
               onClick={(e) => e.stopPropagation()}
            >
               {/* Modal Header */}
               <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                     <AlertTriangle className="text-error" size={20} />
                     <h3 className="font-bold text-[16px] text-on-surface">Quản lý Xung đột BIM (Clashes)</h3>
                  </div>
                  <button 
                     onClick={() => setIsClashModalOpen(false)}
                     className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
                  >
                     <X size={18} />
                  </button>
               </div>

               {/* Modal Body */}
               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">
                     Danh sách các xung đột hình học va chạm giao cắt giữa các bộ môn Thiết kế Kiến trúc (AR), Kết cấu (ST), Cơ điện (MEP). Việc giải quyết xung đột trực tiếp trên mô hình giúp giảm thiểu lãng phí nhân công sửa đổi tại công trường ngoài thực địa.
                  </p>
                  
                  <div className="space-y-3">
                     {clashes.map(cls => (
                        <div 
                           key={cls.id} 
                           className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                              cls.status === 'Đã giải quyết' 
                                ? 'bg-teal-accent/5 border-teal-accent/20' 
                                : 'bg-surface border-outline-variant/55'
                           }`}
                        >
                           <div className="space-y-1.5 md:max-w-[70%]">
                              <div className="flex items-center gap-2">
                                 <span className="font-mono text-[11px] font-bold text-on-surface bg-surface-container-highest px-1.5 py-0.5 rounded">{cls.id}</span>
                                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    cls.severity === 'Cao' ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container/30 text-on-tertiary-container'
                                 }`}>
                                    Trọng yếu: {cls.severity}
                                 </span>
                                 <span className="font-mono text-[10px] font-semibold text-outline">{cls.discipline}</span>
                              </div>
                              <p className="font-bold text-sm text-on-surface tracking-tight">{cls.elements}</p>
                              <p className="text-xs text-on-surface-variant font-normal leading-relaxed">{cls.description}</p>
                           </div>
                           <div className="shrink-0 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                              {cls.status === 'Đã giải quyết' ? (
                                 <span className="text-xs text-teal-accent font-semibold flex items-center gap-1.5 px-3 py-1.5 bg-teal-accent/10 border border-teal-accent/25 rounded-lg">
                                    <Check size={14} /> Đã giải quyết
                                 </span>
                              ) : (
                                 <button 
                                    onClick={() => resolveClash(cls.id)}
                                    className="bg-primary text-on-primary hover:bg-primary/95 text-xs font-semibold px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                 >
                                    Giải quyết
                                 </button>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
               
               {/* Modal Footer */}
               <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low/20 flex justify-between items-center sm:gap-2">
                  <span className="font-mono text-xs text-on-surface-variant font-medium">Tổng số: {clashesCount} xung đột còn tồn đọng</span>
                  <button 
                     onClick={() => setIsClashModalOpen(false)}
                     className="bg-surface-container border border-outline text-on-surface hover:bg-surface-container-highest text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                     Đóng
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* --- DOCUMENT UPLOAD SIMULATION DIALOG --- */}
      {isUploadModalOpen && (
         <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
            <div 
               className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 flex flex-col p-6 overflow-hidden" 
               onClick={(e) => e.stopPropagation()}
            >
               {/* Header */}
               <div className="flex justify-between items-start mb-4">
                  <div>
                     <h3 className="font-bold text-[16px] text-on-surface tracking-tight">Tải tài liệu mới lên (ISO 19650)</h3>
                     <p className="text-xs text-on-surface-variant mt-1">Chọn hoặc tải bản vẽ của bạn trực tiếp lên CDE.</p>
                  </div>
                  <button 
                     onClick={() => setIsUploadModalOpen(false)}
                     className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors shrink-0"
                  >
                     <X size={18} />
                  </button>
               </div>

               {/* Modal Upload Area */}
               {!isUploading ? (
                  <div className="space-y-4 py-4">
                     {/* Simulated files list to let users choose */}
                     <p className="font-bold text-[10px] tracking-wider text-outline uppercase">Chọn một bản vẽ mô phỏng mẫu</p>
                     <div className="grid grid-cols-1 gap-2">
                        {[
                          'MEP-HAC-L03-v2.pdf',
                          'STRUCTURAL-DETAIL-A0.dwg',
                          'FIRE-SAFETY-STRATEGY.pdf',
                          'LANDSCAPE-LAYOUT-v4.dwg'
                        ].map((fileSim) => (
                           <button
                              key={fileSim}
                              onClick={() => triggerMockUpload(fileSim)}
                              className="p-3 text-left bg-surface border border-outline-variant/50 hover:border-primary rounded-xl flex items-center justify-between text-xs font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer transition-colors group"
                           >
                              <div className="flex items-center gap-2 truncate">
                                 <FileText size={16} className="text-outline-variant group-hover:text-primary" />
                                 <span className="truncate">{fileSim}</span>
                              </div>
                              <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-outline-variant">Simulate</span>
                           </button>
                        ))}
                     </div>
                     
                     <div className="border-t border-outline-variant/20 pt-4 text-center">
                        <span className="text-on-surface-variant text-[11px] font-normal">Nhấp chọn bất kỳ dải tập tin nào phía trên để kích hoạt mô phỏng tải lên thực tế.</span>
                     </div>
                  </div>
               ) : (
                  <div className="py-8 space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-primary truncate pr-4">{uploadedFileName}</span>
                        <span className="text-xs font-bold font-mono text-outline shrink-0">{uploadProgress}%</span>
                     </div>
                     <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                        <div 
                           className="bg-primary h-full rounded-full transition-all duration-150" 
                           style={{ width: `${uploadProgress}%` }}
                        ></div>
                     </div>
                     <p className="text-xs text-on-surface-variant text-center">Đang nén dữ liệu cấu trúc và ánh xạ thẻ định vị nội dung...</p>
                  </div>
               )}
            </div>
         </div>
      )}

      {/* --- COST/BUDGET INTERACTIVE MODAL --- */}
      {isBudgetModalOpen && (
         <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
            <div 
               className="w-full max-w-[400px] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 flex flex-col p-6 overflow-hidden" 
               onClick={(e) => e.stopPropagation()}
            >
               {/* Header */}
               <div className="flex justify-between items-start mb-4 shrink-0">
                  <div>
                     <h3 className="font-bold text-[16px] text-on-surface tracking-tight">Cập Nhật Ngân quỹ Dự Án</h3>
                     <p className="text-xs text-on-surface-variant mt-1">Phản ánh chi thực tế đã thanh toán nghiệm thu.</p>
                  </div>
                  <button 
                     onClick={() => setIsBudgetModalOpen(false)}
                     className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors shrink-0"
                  >
                     <X size={18} />
                  </button>
               </div>

               {/* Spend selection list */}
               <div className="space-y-4 py-4 shrink-0">
                  <p className="font-bold text-[10px] tracking-wider text-outline uppercase pl-1">Chọn hạng mục thanh toán gần nhất</p>
                  <div className="grid grid-cols-1 gap-2.5">
                     {[
                        { title: 'Nghiệm thu phần cọc khoan nhồi thô', cost: 1.2 },
                        { title: 'Thỏa thuận lắp đặt kỹ thuật hành lang', cost: 0.8 },
                        { title: 'Thanh toán bê tông dầm sàn tầng 8', cost: 2.1 },
                        { title: 'Ký thỏa thuận đệ trình thiết bị chữa cháy', cost: 3.5 }
                     ].map((item, idX) => (
                        <button
                           key={idX}
                           onClick={() => addSpendingMock(item.cost)}
                           className="p-3 bg-surface border border-outline-variant/50 hover:border-primary hover:bg-surface-container-low rounded-xl text-left flex justify-between items-center transition-colors group cursor-pointer"
                        >
                           <div className="pr-4">
                              <div className="font-semibold text-[13px] text-on-surface group-hover:text-primary transition-colors">{item.title}</div>
                              <span className="font-mono text-[10px] text-outline-variant">Giai đoạn khối tháp B</span>
                           </div>
                           <span className="font-bold text-sm text-primary group-hover:scale-105 transition-transform shrink-0">
                             +{item.cost} Tỷ
                           </span>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Floating AI Assistant FAB */}
      <button
        onClick={() => setIsAiDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-primary to-tertiary text-on-primary p-4 rounded-full shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group flex items-center gap-2"
        title="Trợ lý ảo AI Assistant"
      >
        <Sparkles size={22} className="animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold text-xs whitespace-nowrap">
          Trợ lý AI
        </span>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border border-surface animate-ping"></span>
      </button>

      {/* --- AI ASSISTANT RIGHT-SLIDING DRAWER --- */}
      {isAiDrawerOpen && (
         <div 
           className="fixed inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex justify-end z-[100] animate-in fade-in duration-200"
           onClick={() => setIsAiDrawerOpen(false)}
         >
            <div 
               className="w-full max-w-[420px] bg-surface-container-lowest h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-outline-variant"
               onClick={(e) => e.stopPropagation()}
            >
               {/* Drawer Header */}
               <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                     <Sparkles className="text-primary animate-pulse" size={18} />
                     <h3 className="font-bold text-[15px] text-on-surface">Trợ lý ảo AI Assistant</h3>
                     <span className="w-2 h-2 rounded-full bg-teal-accent animate-pulse"></span>
                  </div>
                  <button 
                     onClick={() => setIsAiDrawerOpen(false)}
                     className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer"
                  >
                     <X size={18} />
                  </button>
               </div>
               
               {/* Message Feed */}
               <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {!isAiConfigured() && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-[11.5px] leading-relaxed text-on-surface-variant font-medium">
                      <span className="font-bold text-warning">Chế độ ngoại tuyến:</span> chưa cấu hình <code className="font-mono">VITE_GEMINI_API_KEY</code>. Trợ lý đang dùng câu trả lời mẫu. Thêm key vào <code className="font-mono">.env</code> để bật AI đầy đủ.
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-primary text-on-primary rounded-tr-none'
                          : 'bg-surface-container border border-outline-variant/40 text-on-surface rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-outline mt-1 px-1 font-mono">{msg.time}</span>
                    </div>
                  ))}
                  
                  {isAiTyping && (
                    <div className="flex flex-col items-start">
                      <div className="bg-surface-container border border-outline-variant/40 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                        <div className="flex gap-1.5 items-center">
                          <span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
               </div>

               {/* Quick Action Shortcut Chips */}
               <div className="px-5 py-3 border-t border-outline-variant/20 bg-surface-container-low/30 shrink-0">
                 <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Gợi ý câu hỏi nhanh</p>
                 <div className="flex flex-wrap gap-2">
                   {[
                     { label: 'Quy tắc đặt tên ISO 19650', text: 'Chuẩn ISO 19650 yêu cầu quy tắc đặt tên tệp tin như thế nào?' },
                     { label: 'Tra cứu TCVN động đất', text: 'Thông tin kỹ thuật về thiết kế chịu động đất TCVN 9386:2012?' },
                     { label: 'Báo cáo chỉ số EVA', text: 'Tóm tắt báo cáo EVA hiện tại của dự án?' },
                     { label: 'Xung đột dầm trục 3-C', text: 'Gợi ý phương án giải quyết xung đột dầm trục 3-C (CL-01)?' }
                   ].map((chip, i) => (
                     <button
                       key={i}
                       onClick={() => sendChatMessage(chip.text)}
                       className="px-2.5 py-1.5 bg-surface-container border border-outline-variant/60 hover:border-primary hover:bg-surface rounded-lg text-[11px] font-semibold text-on-surface-variant hover:text-primary transition-all cursor-pointer text-left"
                     >
                       {chip.label}
                     </button>
                   ))}
                 </div>
               </div>

               {/* Input Block */}
               <div className="p-4 border-t border-outline-variant flex gap-2 shrink-0 bg-surface-container-lowest">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendChatMessage(inputValue);
                    }}
                    placeholder="Hỏi AI về tiêu chuẩn hoặc tiến độ..."
                    className="flex-1 px-3.5 py-2.5 bg-surface border border-outline-variant/60 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button 
                     onClick={() => sendChatMessage(inputValue)}
                     className="p-2.5 bg-primary text-on-primary hover:bg-primary/95 rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                  >
                     <Send size={15} />
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
