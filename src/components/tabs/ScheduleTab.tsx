import React, { useState, useEffect, useRef } from 'react';
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2, FolderOpen, Box, Calendar, Edit2, Info, Eye, CheckCircle, Upload, X } from 'lucide-react';
import { TabContext } from '../../App';

interface GanttTask {
  id: string;
  name: string;
  code: string;
  startMonth: number; // 1-12
  durationMonths: number;
  progress: number; // 0-100
  budget: number; // Cost in Tỷ
  volume?: string;
  type: 'phase' | 'task';
  categories?: string[];
  actualCost?: number; // Cost in Tỷ (Custom actual cost input)
}

interface ScheduleTabProps {
  viewerProperties: any;
  setSelectedHighlightIds: (ids: number[]) => void;
  setActiveTab: (tab: TabContext) => void;
}

export function ScheduleTab({
  viewerProperties,
  setSelectedHighlightIds,
  setActiveTab
}: ScheduleTabProps) {
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
  
  // State for tasks with customizable actualCost
  const [tasks, setTasks] = useState<GanttTask[]>([
    { id: '1', name: '1. Phần ngầm', code: 'FOUNDATION', startMonth: 1, durationMonths: 3, progress: 100, budget: 35.0, type: 'phase', actualCost: 35.0 },
    { id: '2.1', name: '2.1 Cột / Vách', code: 'ST-01', startMonth: 3, durationMonths: 2, progress: 100, budget: 22.0, volume: '1,200 m³', type: 'task', categories: ['IFCCOLUMN', 'IFCWALLSTANDARDCASE', 'IFCWALL'], actualCost: 23.8 },
    { id: '2.2', name: '2.2 Dầm / Sàn', code: 'ST-02', startMonth: 4, durationMonths: 3, progress: 60, budget: 38.0, volume: '3,500 m³', type: 'task', categories: ['IFCBEAM', 'IFCSLAB'], actualCost: 21.6 },
    { id: '3', name: '3. Cơ điện (MEP)', code: 'MEP', startMonth: 6, durationMonths: 4, progress: 20, budget: 20.0, type: 'phase', actualCost: 4.5 },
    { id: '4', name: '4. Hoàn thiện', code: 'FINISHING', startMonth: 8, durationMonths: 4, progress: 0, budget: 10.4, type: 'phase', actualCost: 0 }
  ]);

  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // EVA status month slider and Primavera import state
  const [currentMonth, setCurrentMonth] = useState(6);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');

  // Dragging states
  const [dragging, setDragging] = useState<{
    taskId: string;
    action: 'move' | 'resize';
    startX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  // Drag handlers
  const startDrag = (e: React.MouseEvent, taskId: string, action: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    setDragging({
      taskId,
      action,
      startX: e.clientX,
      initialStart: task.startMonth,
      initialDuration: task.durationMonths
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragging.startX;
      const ganttEl = document.getElementById('gantt-grid-timeline');
      if (!ganttEl) return;
      const colWidth = ganttEl.clientWidth / 12;
      const deltaCols = Math.round(deltaX / colWidth);

      setTasks(prev => prev.map(t => {
        if (t.id === dragging.taskId) {
          if (dragging.action === 'move') {
            const nextStart = Math.max(1, Math.min(12 - t.durationMonths + 1, dragging.initialStart + deltaCols));
            return { ...t, startMonth: nextStart };
          } else {
            const nextDuration = Math.max(1, Math.min(12 - t.startMonth + 1, dragging.initialDuration + deltaCols));
            return { ...t, durationMonths: nextDuration };
          }
        }
        return t;
      }));
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // Trigger transient toasts
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 4D link: Query loaded 3D properties by Category and highlight in ViewerTab
  const handle4DLink = (task: GanttTask) => {
    if (!task.categories || task.categories.length === 0) {
      triggerToast(`Hạng mục "${task.name}" không có phân lớp cấu kiện liên kết 3D.`);
      return;
    }
    
    if (!viewerProperties) {
      triggerToast("Vui lòng nạp mô hình 3D (IFC) trước ở tab Mô hình 3D để kích hoạt liên kết 4D!");
      return;
    }

    // Filter elements in viewer matching task categories
    const matchingIds: number[] = [];
    for (const idStr in viewerProperties) {
      const item = viewerProperties[idStr];
      const category = item.type?.toUpperCase() || '';
      
      const match = task.categories.some(cat => category.includes(cat.toUpperCase()));
      if (match) {
        matchingIds.push(item.expressID);
      }
    }

    if (matchingIds.length === 0) {
      triggerToast(`Mô hình đã nạp không chứa cấu kiện thuộc phân lớp: ${task.categories.join(', ')}`);
      return;
    }

    // Set highlight IDs and route to Viewer
    setSelectedHighlightIds(matchingIds);
    triggerToast(`Đã tìm thấy ${matchingIds.length} cấu kiện ${task.name}. Đang chuyển sang mô hình 3D...`);
    
    setTimeout(() => {
      setActiveTab('viewer');
    }, 1500);
  };

  // Calculate S-Curve based on task budget and completion percentages
  // Calculate S-Curve based on task budget, actual progress, and actual cost
  const getSCurveData = () => {
    const pvMonthly = Array(12).fill(0);
    const evMonthly = Array(12).fill(0);
    const acMonthly = Array(12).fill(0);

    tasks.forEach(t => {
      // 1. PV distribution (even allocation over planned months)
      const pvRate = t.budget / t.durationMonths;
      for (let m = t.startMonth - 1; m < t.startMonth - 1 + t.durationMonths; m++) {
        if (m >= 0 && m < 12) {
          pvMonthly[m] += pvRate;
        }
      }

      // 2. EV & AC distribution (even allocation over active months)
      const evTotal = t.budget * (t.progress / 100);
      const acTotal = t.actualCost !== undefined ? t.actualCost : evTotal * (t.id === '2.1' ? 1.08 : t.id === '2.2' ? 0.94 : 1.02);
      
      const evRate = evTotal / t.durationMonths;
      const acRate = acTotal / t.durationMonths;

      for (let m = t.startMonth - 1; m < t.startMonth - 1 + t.durationMonths; m++) {
        if (m >= 0 && m < 12) {
          evMonthly[m] += evRate;
          acMonthly[m] += acRate;
        }
      }
    });

    const plannedCum: number[] = [];
    const earnedCum: number[] = [];
    const actualCum: number[] = [];
    
    let pSum = 0;
    let eSum = 0;
    let aSum = 0;

    for (let m = 0; m < 12; m++) {
      pSum += pvMonthly[m];
      eSum += evMonthly[m];
      aSum += acMonthly[m];
      
      plannedCum.push(parseFloat(pSum.toFixed(2)));
      earnedCum.push(parseFloat(eSum.toFixed(2)));
      actualCum.push(parseFloat(aSum.toFixed(2)));
    }

    return { plannedCum, earnedCum, actualCum };
  };

  const { plannedCum, earnedCum, actualCum } = getSCurveData();

  // Dynamic calculations for KPI cards based on currentMonth (1-indexed status month)
  // Cumulative PV, EV, AC up to currentMonth
  const evalPV = plannedCum[currentMonth - 1] || 0;
  const evalEV = earnedCum[currentMonth - 1] || 0;
  const evalAC = actualCum[currentMonth - 1] || 0;

  const totalBudget = parseFloat(tasks.reduce((sum, t) => sum + t.budget, 0).toFixed(1));
  const cvTotal = parseFloat((evalEV - evalAC).toFixed(1));
  const svTotal = parseFloat((evalEV - evalPV).toFixed(1));
  
  const overallProgress = Math.round((evalEV / totalBudget) * 100);
  
  const cpiVal = evalAC > 0 ? evalEV / evalAC : 1.0;
  const spiVal = evalPV > 0 ? evalEV / evalPV : 1.0;

  // Task editor submission
  const handleEditTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setTasks(prev => prev.map(t => {
      if (t.id === selectedTask.id) {
        return {
          ...t,
          name: selectedTask.name,
          progress: Math.max(0, Math.min(100, selectedTask.progress)),
          budget: Math.max(0, selectedTask.budget),
          actualCost: Math.max(0, selectedTask.actualCost !== undefined ? selectedTask.actualCost : 0),
          startMonth: Math.max(1, Math.min(12, selectedTask.startMonth)),
          durationMonths: Math.max(1, Math.min(12 - selectedTask.startMonth + 1, selectedTask.durationMonths))
        };
      }
      return t;
    }));
    
    // Log activity
    triggerToast(`Đã cập nhật tiến độ công tác: ${selectedTask.name}`);
    setSelectedTask(null);
  };

  // Primavera P6 mock schedule import handler
  const triggerP6Import = (fileName: string) => {
    setIsImporting(true);
    setImportProgress(10);
    setImportFileName(fileName);
    
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsImporting(false);
            setIsImportModalOpen(false);
            
            // Replaces tasks state with 7 Primavera tasks
            const newTasks: GanttTask[] = [
              { id: '1', name: '1. Thiết kế kỹ thuật & Phê duyệt', code: 'ARC-01', startMonth: 1, durationMonths: 2, progress: 100, budget: 15.0, type: 'phase', actualCost: 15.0 },
              { id: '2', name: '2. Công tác Cọc nhồi & Móng', code: 'FND-01', startMonth: 2, durationMonths: 3, progress: 100, budget: 42.0, type: 'task', categories: ['IFCPILE'], actualCost: 44.5 },
              { id: '3', name: '3. Bê tông Thân - Khối Tháp B', code: 'STR-01', startMonth: 4, durationMonths: 4, progress: 80, budget: 55.0, type: 'task', categories: ['IFCCOLUMN', 'IFCBEAM', 'IFCSLAB'], actualCost: 42.8 },
              { id: '4', name: '4. Lắp đặt MEP Trục đứng', code: 'MEP-01', startMonth: 6, durationMonths: 4, progress: 30, budget: 28.0, type: 'task', categories: ['IFCFLOWSEGMENT', 'IFCFLOWTERMINAL'], actualCost: 8.5 },
              { id: '5', name: '5. Hoàn thiện Kiến trúc', code: 'FIN-01', startMonth: 8, durationMonths: 3, progress: 0, budget: 18.5, type: 'task', categories: ['IFCWALL', 'IFCDOOR', 'IFCWINDOW'], actualCost: 0 },
              { id: '6', name: '6. Cảnh quan & Hạ tầng ngoài', code: 'LAN-01', startMonth: 10, durationMonths: 2, progress: 0, budget: 12.0, type: 'task', actualCost: 0 },
              { id: '7', name: '7. Nghiệm thu & Bàn giao', code: 'COM-01', startMonth: 11, durationMonths: 2, progress: 0, budget: 5.0, type: 'phase', actualCost: 0 }
            ];
            
            setTasks(newTasks);
            setCurrentMonth(7); // Jump status month to Month 7 for imported schedule!
            triggerToast(`Đã nhập thành công tiến độ Primavera P6 (${fileName}) gồm 7 công tác WBS và đồng bộ 4D BIM!`);
          }, 300);
          return 100;
        }
        return prev + 30;
      });
    }, 120);
  };

  // Convert SVG coordinates
  const svgWidth = 1100;
  const svgHeight = 220;
  const paddingX = 60;
  const paddingY = 30;

  const getSvgCoordinates = (index: number, value: number) => {
    const x = paddingX + (index * (svgWidth - paddingX * 2)) / 11;
    const maxVal = Math.max(130, Math.max(...plannedCum) * 1.1);
    const y = svgHeight - paddingY - (value * (svgHeight - paddingY * 2)) / maxVal;
    return { x, y };
  };

  const plannedPoints = plannedCum.map((val, idx) => getSvgCoordinates(idx, val));
  const earnedPoints = earnedCum.slice(0, currentMonth).map((val, idx) => getSvgCoordinates(idx, val));
  const actualPoints = actualCum.slice(0, currentMonth).map((val, idx) => getSvgCoordinates(idx, val));

  const plannedPath = plannedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const earnedPath = earnedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

return (
    <div className="flex-1 overflow-y-auto bg-surface p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6 select-none relative">

        {/* Transient Toast Alerts */}
        {toastMessage && (
          <div className="fixed top-4 right-4 bg-inverse-surface text-inverse-on-surface shadow-lg px-4 py-3 rounded-xl flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 border border-outline/30 font-medium text-sm">
            <CheckCircle className="text-teal-accent" size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Block with WBS & P6 Import Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 border-b border-outline-variant/30 pb-4 gap-4">
           <div>
              <h2 className="text-[20px] font-bold text-on-surface tracking-tight flex items-center gap-2.5">
                 <Calendar className="text-primary" size={24} />
                 Quản lý Tiến độ & Hiệu năng Chi phí EVA
              </h2>
              <p className="text-[12.5px] text-on-surface-variant font-medium mt-0.5">
                 Đồng bộ Gantt 4D với mô hình BIM và giám sát sức khỏe dự án qua phương pháp Earned Value Analysis.
              </p>
           </div>
           <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-primary text-on-primary rounded-lg font-bold text-[12.5px] hover:bg-primary/95 transition-all shadow-sm cursor-pointer h-9 active:scale-98"
              >
                 <Upload size={15} />
                 Nhập tệp MS Project / P6
              </button>
           </div>
        </div>

        {/* KPI Cards Row (Reactive to currentMonth) */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 shrink-0">
           {/* Budget Plan (BAC) */}
           <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm flex flex-col justify-between hover:border-outline-variant/80 transition-colors">
              <div className="flex justify-between items-start mb-6">
                 <span className="font-bold text-[10.5px] tracking-wider uppercase text-on-surface-variant">DỰ TOÁN HOÀN THÀNH (BAC)</span>
                 <Wallet size={20} className="text-outline" />
              </div>
              <div>
                 <div className="font-semibold text-3xl text-on-surface tracking-tight mb-2">{totalBudget} Tỷ</div>
                 <div className="font-mono text-[11px] text-on-surface-variant">Tổng chi ngân sách cho WBS</div>
              </div>
           </div>

           {/* Planned Value (PV) */}
           <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm flex flex-col justify-between hover:border-outline-variant/80 transition-colors">
              <div className="flex justify-between items-start mb-6">
                 <span className="font-bold text-[10.5px] tracking-wider uppercase text-on-surface-variant">KẾ HOẠCH BÁO CÁO (PV)</span>
                 <CheckCircle2 size={20} className="text-outline" />
              </div>
              <div>
                 <div className="font-semibold text-3xl text-on-surface tracking-tight mb-2">{evalPV.toFixed(1)} Tỷ</div>
                 <div className="font-mono text-[11px] text-on-surface-variant">Tại thời điểm Tháng {currentMonth}</div>
              </div>
           </div>

           {/* Earned Value (EV) */}
           <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-outline-variant/80 transition-colors">
              <div className="absolute right-0 top-0 w-24 h-24 bg-primary-fixed/30 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="flex justify-between items-start mb-6">
                 <span className="font-bold text-[10.5px] tracking-wider uppercase text-on-surface-variant">GIÁ TRỊ THU ĐƯỢC (EV)</span>
                 <TrendingUp size={20} className="text-primary" />
              </div>
              <div>
                 <div className="font-semibold text-3xl text-primary tracking-tight mb-2">{evalEV.toFixed(1)} Tỷ</div>
                 <div className="font-mono text-[11px] text-on-surface-variant">{overallProgress}% tổng khối lượng</div>
              </div>
           </div>

           {/* Actual Cost (AC) */}
           <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/50 shadow-sm flex flex-col justify-between hover:border-outline-variant/80 transition-colors">
              <div className="flex justify-between items-start mb-6">
                 <span className="font-bold text-[10.5px] tracking-wider uppercase text-on-surface-variant">CHI PHÍ THỰC TẾ (AC)</span>
                 <AlertTriangle size={20} className={evalAC > evalEV ? "text-error" : "text-teal-accent"} />
              </div>
              <div>
                 <div className={`font-semibold text-3xl tracking-tight mb-2 ${evalAC > evalEV ? "text-error" : "text-teal-accent"}`}>
                   {evalAC.toFixed(1)} Tỷ
                 </div>
                 <div className={`font-semibold flex items-center gap-1.5 text-[11.5px] ${evalAC > evalEV ? "text-error" : "text-teal-accent"}`}>
                    <span>{evalAC > evalEV ? "↑ Vượt ngân sách nhẹ" : "↓ Tiết kiệm chi phí"}</span>
                 </div>
              </div>
           </div>
        </section>

        {/* Gantt Chart Area */}
        <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[380px]">
           
           {/* Chart Header */}
           <div className="grid grid-cols-[280px_1fr] bg-surface-container-low/40 border-b border-outline-variant/60 shrink-0">
              <div className="font-bold text-[10px] tracking-wider uppercase text-outline px-6 py-4 flex items-center">
                 MÃ WBS / HẠNG MỤC THI CÔNG
              </div>
              <div className="grid grid-cols-12 relative w-full">
                 {months.map((m) => (
                    <div key={m} className="font-mono font-bold text-[10px] text-outline flex items-center justify-center py-4 border-l border-outline-variant/30">
                       {m}
                    </div>
                 ))}
              </div>
           </div>

           {/* Chart Body */}
           <div className="flex-1 overflow-y-auto relative font-sans text-[14px]">
               
               {/* Grid background lines */}
               <div id="gantt-grid-timeline" className="absolute top-0 bottom-0 left-[280px] right-0 grid grid-cols-12 z-0 pointer-events-none">
                   {months.map((_, i) => (
                      <div key={i} className="border-l border-outline-variant/20 border-dashed"></div>
                   ))}
               </div>

               <div className="relative z-10 py-2 divide-y divide-outline-variant/20">
                  {tasks.map(t => {
                    const isPhase = t.type === 'phase';
                    const hasLink = t.categories && t.categories.length > 0;
                    
                    return (
                      <div key={t.id} className="grid grid-cols-[280px_1fr] px-6 py-3 hover:bg-surface-container-low/30 transition-colors group items-center">
                          <div className="flex items-center justify-between pr-4">
                             <div className="flex items-center gap-2.5 min-w-0">
                                {isPhase ? (
                                   <FolderOpen size={16} className="text-outline shrink-0 group-hover:text-primary transition-colors" />
                                ) : (
                                   <Box size={14} className="text-outline shrink-0 ml-4 group-hover:text-primary transition-colors" />
                                )}
                                <div className="truncate">
                                   <span className={`text-[13px] truncate block tracking-tight ${isPhase ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>{t.name}</span>
                                   {!isPhase && <span className="font-mono text-[9px] text-outline">BAC: {t.budget}T | AC: {(t.actualCost !== undefined ? t.actualCost : t.budget * (t.progress / 100) * (t.id === '2.1' ? 1.08 : 0.98)).toFixed(1)}T</span>}
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                               {hasLink && (
                                 <button 
                                   onClick={() => handle4DLink(t)}
                                   className="p-1 text-primary hover:bg-primary-container/20 rounded transition-colors cursor-pointer"
                                   title="Liên kết 4D Highlight mô hình"
                                 >
                                   <Eye size={14} />
                                 </button>
                               )}
                               <button 
                                 onClick={() => setSelectedTask(t)}
                                 className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container cursor-pointer"
                                 title="Chỉnh sửa công tác"
                               >
                                 <Edit2 size={13} />
                               </button>
                             </div>
                          </div>
                          
                          {/* Timeline Gantt bar rendering */}
                          <div className="grid grid-cols-12 relative w-full h-[32px] items-center">
                             <div 
                               style={{
                                 gridColumnStart: t.startMonth,
                                 gridColumnEnd: t.startMonth + t.durationMonths,
                               }}
                               onMouseDown={(e) => startDrag(e, t.id, 'move')}
                               className={`h-6 rounded relative shadow-sm border overflow-hidden cursor-grab active:cursor-grabbing flex items-center transition-all ${
                                 isPhase 
                                   ? 'bg-outline-variant/65 border-outline-variant text-on-surface-variant font-bold' 
                                   : 'bg-primary-container/30 border-primary/20 text-primary font-semibold'
                               }`}
                             >
                                {/* Progress visual fill */}
                                <div 
                                  className={`absolute left-0 top-0 bottom-0 z-0 transition-all ${
                                    isPhase ? 'bg-outline-variant' : 'bg-primary/30'
                                  }`} 
                                  style={{ width: `${t.progress}%` }}
                                />
                                
                                <span className="font-mono text-[10.5px] text-on-surface-variant absolute left-3 z-10 font-bold select-none pointer-events-none">
                                  {t.progress}%
                                </span>

                                {/* Resize handle on the right edge */}
                                <div 
                                  onMouseDown={(e) => startDrag(e, t.id, 'resize')}
                                  className="absolute right-0 top-0 bottom-0 w-2 hover:bg-primary/40 cursor-ew-resize z-20 flex items-center justify-center border-l border-primary/10 transition-colors"
                                  title="Kéo giãn thời gian"
                                >
                                  <div className="w-0.5 h-3 bg-outline-variant/60"></div>
                                </div>
                             </div>
                          </div>
                      </div>
                    );
                  })}
               </div>
            </div>
        </section>

        {/* Dynamic EVA Performance KPI Table */}
        <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-sm space-y-4">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-outline-variant/30">
              <div>
                 <h3 className="font-bold text-[15px] text-on-surface tracking-tight">Bảng Chỉ số Hiệu năng Tiến độ & Chi phí (EVM/EVA)</h3>
                 <p className="text-xs text-on-surface-variant mt-0.5">Giá trị lũy kế tích lũy tại điểm cuối của tháng báo cáo.</p>
              </div>

              {/* Status Month Slider Selector */}
              <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/40 self-stretch sm:self-auto justify-between sm:justify-start">
                 <span className="font-bold text-[11.5px] text-on-surface-variant uppercase tracking-wider">Tháng Báo Cáo:</span>
                 <input 
                   type="range" 
                   min="1" 
                   max="12" 
                   value={currentMonth}
                   onChange={(e) => setCurrentMonth(parseInt(e.target.value) || 6)}
                   className="w-32 accent-primary h-1 bg-outline-variant rounded-lg cursor-pointer"
                 />
                 <span className="font-mono text-[13px] font-bold text-primary w-8 text-right">Tháng {currentMonth}</span>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                 <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low/40 font-mono text-[10.5px] text-outline font-bold">
                       <th className="px-4 py-3">MÃ WBS</th>
                       <th className="px-4 py-3">HẠNG MỤC THI CÔNG</th>
                       <th className="px-4 py-3 text-right">BAC (DỰ TOÁN)</th>
                       <th className="px-4 py-3 text-right">PV (KẾ HOẠCH)</th>
                       <th className="px-4 py-3 text-right">EV (ĐẠT ĐƯỢC)</th>
                       <th className="px-4 py-3 text-right">AC (CHI THỰC TẾ)</th>
                       <th className="px-4 py-3 text-right">CV (LỆCH PHÍ)</th>
                       <th className="px-4 py-3 text-right">SV (LỆCH TIẾN)</th>
                       <th className="px-4 py-3 text-right">CPI</th>
                       <th className="px-4 py-3 text-right">SPI</th>
                    </tr>
                 </thead>
                 <tbody className="text-[12.5px] font-medium">
                    {tasks.map(t => {
                      const isPhase = t.type === 'phase';
                      
                      // Calculate individual EVA values
                      const tPV = (currentMonth < t.startMonth) 
                        ? 0 
                        : (currentMonth >= t.startMonth + t.durationMonths) 
                          ? t.budget 
                          : t.budget * ((currentMonth - t.startMonth + 1) / t.durationMonths);
                          
                      const tEV = t.budget * (t.progress / 100);
                      const tAC = t.actualCost !== undefined ? t.actualCost : tEV * (t.id === '2.1' ? 1.08 : t.id === '2.2' ? 0.94 : 1.02);
                      
                      const tCV = tEV - tAC;
                      const tSV = tEV - tPV;
                      const tCPI = tAC > 0 ? tEV / tAC : 1.0;
                      const tSPI = tPV > 0 ? tEV / tPV : 1.0;

                      return (
                         <tr 
                           key={t.id} 
                           className={`border-b border-outline-variant/20 hover:bg-surface-container-low/30 transition-colors ${
                             isPhase ? 'bg-surface-container-low/10 font-bold' : ''
                           }`}
                         >
                            <td className="px-4 py-3.5 font-mono text-[11.5px] text-primary">{t.code || `WBS-${t.id}`}</td>
                            <td className="px-4 py-3.5 text-on-surface">{t.name}</td>
                            <td className="px-4 py-3.5 text-right font-mono">{t.budget.toFixed(1)} Tỷ</td>
                            <td className="px-4 py-3.5 text-right font-mono text-outline">{tPV.toFixed(1)} Tỷ</td>
                            <td className="px-4 py-3.5 text-right font-mono text-primary">{tEV.toFixed(1)} Tỷ</td>
                            <td className="px-4 py-3.5 text-right font-mono text-on-surface-variant">{tAC.toFixed(1)} Tỷ</td>
                            <td className={`px-4 py-3.5 text-right font-mono font-bold ${tCV >= 0 ? "text-teal-accent" : "text-error"}`}>
                               {tCV > 0 ? `+${tCV.toFixed(1)}` : tCV.toFixed(1)} Tỷ
                            </td>
                            <td className={`px-4 py-3.5 text-right font-mono font-bold ${tSV >= 0 ? "text-teal-accent" : "text-error"}`}>
                               {tSV > 0 ? `+${tSV.toFixed(1)}` : tSV.toFixed(1)} Tỷ
                            </td>
                            <td className={`px-4 py-3.5 text-right font-mono font-bold ${tCPI >= 1.0 ? "text-teal-accent" : "text-error"}`}>
                               {tCPI.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3.5 text-right font-mono font-bold ${tSPI >= 1.0 ? "text-teal-accent" : "text-error"}`}>
                               {tSPI.toFixed(2)}
                            </td>
                         </tr>
                      );
                    })}
                    {/* Total Summary Row */}
                    <tr className="bg-surface-container/60 border-t-2 border-outline-variant font-bold text-on-surface font-mono">
                       <td className="px-4 py-4">ALL</td>
                       <td className="px-4 py-4 uppercase">Tổng Lũy Kế Hệ Thống</td>
                       <td className="px-4 py-4 text-right">{totalBudget.toFixed(1)} Tỷ</td>
                       <td className="px-4 py-4 text-right text-outline">{evalPV.toFixed(1)} Tỷ</td>
                       <td className="px-4 py-4 text-right text-primary">{evalEV.toFixed(1)} Tỷ</td>
                       <td className="px-4 py-4 text-right text-on-surface-variant">{evalAC.toFixed(1)} Tỷ</td>
                       <td className={`px-4 py-4 text-right font-bold ${cvTotal >= 0 ? "text-teal-accent" : "text-error"}`}>
                          {cvTotal > 0 ? `+${cvTotal.toFixed(1)}` : cvTotal.toFixed(1)} Tỷ
                       </td>
                       <td className={`px-4 py-4 text-right font-bold ${svTotal >= 0 ? "text-teal-accent" : "text-error"}`}>
                          {svTotal > 0 ? `+${svTotal.toFixed(1)}` : svTotal.toFixed(1)} Tỷ
                       </td>
                       <td className={`px-4 py-4 text-right font-bold ${cpiVal >= 1.0 ? "text-teal-accent" : "text-error"}`}>
                          {cpiVal.toFixed(2)}
                       </td>
                       <td className={`px-4 py-4 text-right font-bold ${spiVal >= 1.0 ? "text-teal-accent" : "text-error"}`}>
                          {spiVal.toFixed(2)}
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </section>

        {/* Cost EVM S-Curve Charts */}
        <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-5 shadow-sm flex flex-col gap-4">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                 <span className="p-1.5 bg-primary-container/10 text-primary rounded-lg">
                    <TrendingUp size={16} />
                 </span>
                 <h3 className="font-bold text-[14px] text-on-surface tracking-tight">Biểu đồ Lũy kế Chi phí & Giá trị Đạt được (EVM S-Curve)</h3>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                 <div className="flex items-center gap-1.5 text-outline">
                    <div className="w-3 h-0.5 border-t-2 border-dashed border-outline/75"></div>
                    <span>Giá trị Kế hoạch (PV)</span>
                 </div>
                 <div className="flex items-center gap-1.5 text-primary">
                    <div className="w-3 h-0.5 bg-primary"></div>
                    <span>Giá trị Thực hiện (EV)</span>
                 </div>
                 <div className="flex items-center gap-1.5 text-error">
                    <div className="w-3 h-0.5 bg-error"></div>
                    <span>Chi phí Thực tế (AC)</span>
                 </div>
              </div>
           </div>

           {/* S-Curve SVG Viewport */}
           <div className="relative w-full h-[240px] bg-[#101014]/5 rounded-xl border border-outline-variant/20 p-2 flex items-center justify-center">
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                 
                 {/* X Axis labels */}
                 {months.map((m, idx) => {
                    const coords = getSvgCoordinates(idx, 0);
                    return (
                       <text 
                         key={idx} 
                         x={coords.x} 
                         y={svgHeight - 8} 
                         textAnchor="middle" 
                         className="font-mono text-[10px] fill-outline/80 font-bold"
                       >
                          {m}
                       </text>
                    );
                 })}

                 {/* Y Axis Grid lines */}
                 {[0, 25, 50, 75, 100, 125, 150].map((val) => {
                    const coordsL = getSvgCoordinates(0, val);
                    const coordsR = getSvgCoordinates(11, val);
                    return (
                       <g key={val}>
                          <line 
                            x1={coordsL.x} 
                            y1={coordsL.y} 
                            x2={coordsR.x} 
                            y2={coordsR.y} 
                            className="stroke-outline-variant/30 stroke-dashed" 
                          />
                          <text 
                            x={paddingX - 12} 
                            y={coordsL.y + 3} 
                            textAnchor="end" 
                            className="font-mono text-[9px] fill-outline/70 font-semibold"
                          >
                             {val}T
                          </text>
                       </g>
                    );
                 })}

                 {/* Planned Path Line (PV) */}
                 <path 
                   d={plannedPath} 
                   fill="none" 
                   className="stroke-outline/55 stroke-2" 
                   strokeDasharray="5,5" 
                 />

                 {/* Earned Path Line (EV) - Restrict to status date */}
                 <path 
                   d={earnedPath} 
                   fill="none" 
                   className="stroke-primary stroke-2" 
                 />

                 {/* Actual Path Line (AC) - Restrict to status date */}
                 <path 
                   d={actualPath} 
                   fill="none" 
                   className="stroke-error stroke-2" 
                 />

                 {/* Planned Cost Nodes */}
                 {plannedPoints.map((p, idx) => (
                    <circle 
                      key={`planned-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredMonth === idx ? 6 : 3}
                      className="fill-surface stroke-outline stroke-2 transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredMonth(idx)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    />
                 ))}

                 {/* Earned Cost Nodes */}
                 {earnedPoints.map((p, idx) => (
                    <circle 
                      key={`earned-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredMonth === idx ? 6 : 4}
                      className="fill-primary stroke-surface stroke-2 transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredMonth(idx)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    />
                 ))}

                 {/* Actual Cost Nodes */}
                 {actualPoints.map((p, idx) => (
                    <circle 
                      key={`actual-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredMonth === idx ? 6 : 4}
                      className="fill-error stroke-surface stroke-2 transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredMonth(idx)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    />
                 ))}

              </svg>

              {/* Tooltip Overlay */}
              {hoveredMonth !== null && (
                 <div 
                   style={{
                     position: 'absolute',
                     left: `${getSvgCoordinates(hoveredMonth, 0).x / svgWidth * 100}%`,
                     bottom: `${(svgHeight - getSvgCoordinates(hoveredMonth, plannedCum[hoveredMonth]).y) / svgHeight * 100 + 10}%`,
                     transform: 'translateX(-50%)'
                   }}
                   className="bg-inverse-surface text-inverse-on-surface text-[11px] font-bold p-3 rounded-xl border border-outline/30 shadow-md flex flex-col gap-2.5 z-40 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                 >
                    <div className="font-semibold text-outline text-[9.5px] uppercase tracking-wider border-b border-outline-variant/35 pb-1">
                      Tháng {hoveredMonth + 1} Lũy kế
                    </div>
                    <div>
                      Kế hoạch (PV): <span className="font-mono text-outline pl-1">{plannedCum[hoveredMonth]} Tỷ</span>
                    </div>
                    {hoveredMonth < currentMonth && (
                      <>
                        <div>
                          Khối lượng (EV): <span className="font-mono text-primary-fixed pl-1">{earnedCum[hoveredMonth]} Tỷ</span>
                        </div>
                        <div>
                          Chi phí (AC): <span className="font-mono text-error pl-1">{actualCum[hoveredMonth]} Tỷ</span>
                        </div>
                      </>
                    )}
                 </div>
              )}
           </div>
        </section>

      </div>

      {/* Task editor modal dialog */}
      {selectedTask && (
         <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4 animate-in fade-in duration-200">
            <form 
               onSubmit={handleEditTask}
               className="w-full max-w-[400px] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 flex flex-col p-6 overflow-hidden animate-in zoom-in-95 duration-200" 
               onClick={(e) => e.stopPropagation()}
            >
               <h3 className="font-bold text-[16px] text-on-surface tracking-tight mb-4 flex items-center gap-2">
                 <Calendar size={18} className="text-primary" />
                 Thiết lập Hạng mục công việc
               </h3>
               
               <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Tên hạng mục</label>
                     <input 
                       type="text" 
                       value={selectedTask.name}
                       onChange={(e) => setSelectedTask({ ...selectedTask, name: e.target.value })}
                       className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Tiến độ (%)</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={selectedTask.progress}
                          onChange={(e) => setSelectedTask({ ...selectedTask, progress: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Dự toán BAC (Tỷ)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={selectedTask.budget}
                          onChange={(e) => setSelectedTask({ ...selectedTask, budget: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Chi thực tế AC (Tỷ)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={selectedTask.actualCost !== undefined ? selectedTask.actualCost : selectedTask.budget * (selectedTask.progress / 100)}
                          onChange={(e) => setSelectedTask({ ...selectedTask, actualCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Phân lớp liên kết BIM</label>
                        <input 
                          type="text" 
                          disabled
                          value={selectedTask.categories?.join(', ') || 'Không liên kết'}
                          className="w-full px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-outline cursor-not-allowed"
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Bắt đầu (Tháng)</label>
                        <input 
                          type="number" 
                          min="1"
                          max="12"
                          value={selectedTask.startMonth}
                          onChange={(e) => setSelectedTask({ ...selectedTask, startMonth: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-bold text-outline uppercase tracking-wider">Thời lượng (Tháng)</label>
                        <input 
                          type="number" 
                          min="1"
                          value={selectedTask.durationMonths}
                          onChange={(e) => setSelectedTask({ ...selectedTask, durationMonths: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none"
                        />
                     </div>
                  </div>
               </div>

               <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant/20">
                  <button 
                    type="button"
                    onClick={() => setSelectedTask(null)}
                    className="px-4 py-2 border border-outline text-on-surface hover:bg-surface-container rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                     Hủy
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold shadow hover:bg-primary/95 transition-all cursor-pointer active:scale-98"
                  >
                     Lưu thay đổi
                  </button>
               </div>
            </form>
         </div>
      )}

    </div>
  );
}
