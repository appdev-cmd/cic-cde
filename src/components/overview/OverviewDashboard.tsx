import {
  Building2, ArrowRight, FileStack, ShieldCheck, AlertTriangle, Wallet,
  TrendingUp, MapPin, CircleDot, Layers3, ClipboardCheck,
} from 'lucide-react';
import type { ProjectItem } from '../project/ProjectList';
import type { ActivityItem } from '../../types';

interface OverviewDashboardProps {
  projects: ProjectItem[];
  activities: ActivityItem[];
  userName: string;
  onSelectProject: (proj: ProjectItem) => void;
}

const STATUS_STYLE: Record<string, string> = {
  'Thi công': 'bg-primary/10 text-primary border-primary/20',
  'Thi công ngầm': 'bg-tertiary-container/25 text-tertiary border-tertiary/20',
  'Đang hoàn thiện': 'bg-success/12 text-success border-success/25',
  'Chuẩn bị': 'bg-warning/12 text-warning border-warning/25',
};

const progressColor = (p: number) =>
  p >= 90 ? 'bg-success' : p >= 50 ? 'bg-primary' : p >= 25 ? 'bg-warning' : 'bg-error';

const fmtInt = (n: number) => n.toLocaleString('vi-VN');

const ACTIVITY_DOT: Record<ActivityItem['type'], string> = {
  upload: 'bg-primary', approve: 'bg-success', clash: 'bg-error',
  comment: 'bg-tertiary', system: 'bg-outline',
};

export function OverviewDashboard({ projects, activities, userName, onSelectProject }: OverviewDashboardProps) {
  // ---- KPI tổng hợp từ dữ liệu thật ----
  const totalProjects = projects.length;
  const totalDocs = projects.reduce((s, p) => s + (p.documentsCount || 0), 0);
  const totalClashes = projects.reduce((s, p) => s + (p.clashesCount || 0), 0);
  const totalSpending = projects.reduce((s, p) => s + (p.spendingActual || 0), 0);
  const avgApproval = totalProjects ? Math.round(projects.reduce((s, p) => s + (p.approvalPercent || 0), 0) / totalProjects) : 0;
  const avgProgress = totalProjects ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / totalProjects) : 0;

  // ---- Phân bố theo trạng thái ----
  const statusCounts = projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  // ---- Cảnh báo điều phối (suy từ dữ liệu) ----
  const clashAlerts = projects.filter(p => p.clashesCount > 0).sort((a, b) => b.clashesCount - a.clashesCount).slice(0, 3);
  const approvalAlerts = projects.filter(p => p.approvalPercent < 80).sort((a, b) => a.approvalPercent - b.approvalPercent).slice(0, 3);

  const kpis = [
    { label: 'Dự án đang quản lý', value: fmtInt(totalProjects), unit: 'dự án', icon: Building2, tone: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Hồ sơ CDE (ISO 19650)', value: fmtInt(totalDocs), unit: 'tệp', icon: FileStack, tone: 'text-tertiary', bg: 'bg-tertiary-container/25' },
    { label: 'Tỷ lệ phê duyệt bình quân', value: `${avgApproval}%`, unit: '', icon: ShieldCheck, tone: 'text-success', bg: 'bg-success/12' },
    { label: 'Xung đột chưa xử lý', value: fmtInt(totalClashes), unit: 'điểm', icon: AlertTriangle, tone: totalClashes > 0 ? 'text-error' : 'text-success', bg: totalClashes > 0 ? 'bg-error/10' : 'bg-success/12' },
    { label: 'Giá trị thực hiện luỹ kế', value: fmtInt(Math.round(totalSpending)), unit: 'tỷ đ', icon: Wallet, tone: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Tiến độ bình quân', value: `${avgProgress}%`, unit: '', icon: TrendingUp, tone: 'text-tertiary', bg: 'bg-tertiary-container/25' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-surface-container-lowest space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-1 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="text-primary" size={20} /></span>
            Trung tâm Điều hành Dự án
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Theo dõi tổng hợp tiến độ, hồ sơ ISO 19650, phê duyệt và xung đột trên toàn bộ dự án của đơn vị.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold text-outline uppercase tracking-wider">Cán bộ điều hành</div>
          <div className="text-sm font-bold text-on-surface">{userName}</div>
          <div className="text-[11px] text-on-surface-variant">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface border border-outline-variant/60 p-4 rounded-2xl shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center`}><k.icon size={17} className={k.tone} /></span>
            </div>
            <div>
              <div className={`text-2xl font-extrabold leading-none ${k.label.includes('Xung đột') && totalClashes > 0 ? 'text-error' : 'text-on-surface'}`}>
                {k.value} {k.unit && <span className="text-xs text-outline font-medium">{k.unit}</span>}
              </div>
              <div className="text-[11px] font-bold text-outline uppercase tracking-wide mt-1.5 leading-tight">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Phân bố trạng thái */}
      {totalProjects > 0 && (
        <div className="bg-surface border border-outline-variant/50 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1.5"><Layers3 size={14} className="text-primary" /> Phân bố trạng thái</span>
          {Object.entries(statusCounts).map(([st, n]) => (
            <span key={st} className="flex items-center gap-1.5 text-[12px] font-semibold text-on-surface">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[st] || 'bg-surface-container text-on-surface-variant border-outline-variant/40'}`}>{st}</span>
              <span className="text-on-surface-variant">{n} dự án</span>
            </span>
          ))}
        </div>
      )}

      {/* Danh mục dự án + Cảnh báo điều phối */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Danh mục dự án */}
        <div className="lg:col-span-2 bg-surface border border-outline-variant/50 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-[15px] text-on-surface tracking-tight border-b border-outline-variant/30 pb-3 mb-3 flex items-center gap-2">
            <Building2 size={16} className="text-primary" /> Danh mục Dự án ({totalProjects})
          </h3>
          {totalProjects === 0 ? (
            <div className="py-10 text-center text-sm text-outline">Chưa có dự án nào. Hãy tạo dự án ở mục “Dự án”.</div>
          ) : (
            <div className="space-y-2.5">
              {projects.map(proj => (
                <button
                  key={proj.id}
                  onClick={() => onSelectProject(proj)}
                  className="w-full text-left flex items-center gap-4 p-3.5 hover:bg-surface-container rounded-xl cursor-pointer border border-outline-variant/30 hover:border-primary/40 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate">{proj.name}</span>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[proj.status] || 'bg-surface-container text-on-surface-variant border-outline-variant/40'}`}>{proj.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-medium mb-2">
                      <span className="flex items-center gap-1 truncate"><MapPin size={11} className="text-outline shrink-0" />{proj.location}</span>
                    </div>
                    {/* Thanh tiến độ */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${progressColor(proj.progress)}`} style={{ width: `${proj.progress}%` }} />
                      </div>
                      <span className="text-[10.5px] font-mono font-bold text-on-surface-variant w-9 text-right">{proj.progress}%</span>
                    </div>
                  </div>
                  {/* Chỉ số phụ */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-1 text-[12px] font-bold text-on-surface"><ClipboardCheck size={12} className="text-success" />{proj.approvalPercent}%</div>
                      <div className="text-[9px] text-outline uppercase font-bold">Duyệt</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className={`flex items-center gap-1 text-[12px] font-bold ${proj.clashesCount > 0 ? 'text-error' : 'text-success'}`}><AlertTriangle size={12} />{proj.clashesCount}</div>
                      <div className="text-[9px] text-outline uppercase font-bold">Xung đột</div>
                    </div>
                    <ArrowRight size={16} className="text-outline group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cảnh báo & điều phối */}
        <div className="space-y-6">
          <div className="bg-surface border border-outline-variant/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-[15px] text-on-surface tracking-tight border-b border-outline-variant/30 pb-3 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-error" /> Cảnh báo điều phối
            </h3>
            {clashAlerts.length === 0 && approvalAlerts.length === 0 ? (
              <div className="py-6 text-center text-[12px] text-success font-medium flex flex-col items-center gap-1">
                <ShieldCheck size={22} /> Không có cảnh báo. Các dự án đang trong ngưỡng kiểm soát.
              </div>
            ) : (
              <div className="space-y-3">
                {clashAlerts.map(p => (
                  <button key={`c-${p.id}`} onClick={() => onSelectProject(p)} className="w-full text-left flex items-start gap-2.5 group">
                    <CircleDot size={14} className="text-error mt-0.5 shrink-0" />
                    <div className="text-[12px] leading-snug">
                      <span className="font-bold text-on-surface group-hover:text-primary transition-colors">{p.name}</span> còn{' '}
                      <span className="font-bold text-error">{p.clashesCount} xung đột</span> chưa xử lý.
                    </div>
                  </button>
                ))}
                {approvalAlerts.map(p => (
                  <button key={`a-${p.id}`} onClick={() => onSelectProject(p)} className="w-full text-left flex items-start gap-2.5 group">
                    <CircleDot size={14} className="text-warning mt-0.5 shrink-0" />
                    <div className="text-[12px] leading-snug">
                      <span className="font-bold text-on-surface group-hover:text-primary transition-colors">{p.name}</span> phê duyệt mới đạt{' '}
                      <span className="font-bold text-warning">{p.approvalPercent}%</span>, cần đẩy nhanh.
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hoạt động gần đây (dữ liệu thật nếu có) */}
          {activities.length > 0 && (
            <div className="bg-surface border border-outline-variant/50 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-[15px] text-on-surface tracking-tight border-b border-outline-variant/30 pb-3 mb-3 flex items-center gap-2">
                <ClipboardCheck size={16} className="text-primary" /> Hoạt động gần đây
              </h3>
              <div className="space-y-3.5">
                {activities.slice(0, 6).map(a => (
                  <div key={a.id} className="flex gap-2.5 text-[12px] leading-snug">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACTIVITY_DOT[a.type]}`} />
                    <div>
                      <span className="font-semibold text-on-surface">{a.user}</span> {a.action}{' '}
                      <span className="font-semibold text-primary">{a.target}</span>
                      <div className="text-[10px] text-outline mt-0.5 font-mono">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
