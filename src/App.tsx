import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { BimViewerRef } from './components/bim/BimViewer';
import { supabase } from './lib/supabase';
import { LoginScreen } from './components/auth/LoginScreen';
import { getSession, onAuthChange, fetchProfile, signOut, updateMyRole, type Profile } from './lib/api/auth';
import { PROJECT_ROLES, roleLabel } from './lib/roles';
import { fetchProjects, createProject, updateProject } from './lib/api/projects';
import { fetchDocuments } from './lib/api/documents';
import { fetchClashes, fetchApprovals, fetchActivities } from './lib/api/data';
import { AppHeader } from './components/layout/AppHeader';
import { DashboardTab } from './components/tabs/DashboardTab';
import { DocumentsTab } from './components/tabs/DocumentsTab';
import { ViewerTab } from './components/tabs/ViewerTab';
import { ScheduleTab } from './components/tabs/ScheduleTab';
import { FmTab } from './components/tabs/FmTab';
import { TasksTab } from './components/tabs/TasksTab';
import { TeamTab } from './components/tabs/TeamTab';
import { ProjectList, ProjectItem, PROJECTS_LIST } from './components/project/ProjectList';
import { ProjectFormModal } from './components/project/ProjectFormModal';
import { GeoBimMap } from './components/gis/GeoBimMap';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { DocumentItem, ApprovalItem, ClashItem, ActivityItem } from './types';
import { Sun, Moon } from 'lucide-react';

export type TabContext = 'dashboard' | 'documents' | 'viewer' | 'schedule' | 'fm' | 'tasks' | 'team';

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: 'PRJ-ARC-Z01-ZZ-M3-A-0001',
    name: 'Mặt bằng Tầng 1 - Cập nhật MEP',
    folder: '02_SHARED',
    subFolder: 'Bản vẽ thiết kế',
    status: 'S1 - SHARED',
    revision: 'P02.01',
    version: 'V3',
    modifiedDate: '2026-06-08T09:30:00Z',
    size: '1.4 MB',
    creator: 'ARC Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    fileType: 'pdf'
  },
  {
    id: 'PRJ-STR-Z01-ZZ-M3-S-0023',
    name: 'Chi tiết cấu tạo cột C1',
    folder: '01_WIP',
    subFolder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modifiedDate: '2026-06-07T02:15:00Z',
    size: '2.1 MB',
    creator: 'STR Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    fileType: 'pdf'
  },
  {
    id: 'PRJ-ALL-Z00-ZZ-M3-W-0001',
    name: 'Mô hình Liên kết Kiến trúc - Kết cấu',
    folder: '02_SHARED',
    subFolder: 'Mô hình phối hợp',
    status: 'S1 - SHARED',
    revision: 'P02',
    version: 'V2',
    modifiedDate: '2026-06-06T04:20:00Z',
    size: '3.5 MB',
    creator: 'BIM Team',
    classification: 'EF_55_20',
    volume: 'Z00 - All Zones',
    fileType: 'ifc',
    fileUrl: 'https://thatopen.github.io/engine_ui-components/resources/small.ifc'
  },
  {
    id: 'PRJ-MEP-Z01-ZZ-M3-M-0005',
    name: 'Sơ đồ nguyên lý cấp thoát nước Tầng 2',
    folder: '01_WIP',
    subFolder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modifiedDate: '2026-06-05T03:45:00Z',
    size: '3.2 MB',
    creator: 'MEP Studio',
    classification: 'EF_60_40',
    volume: 'Z01 - Zone 1',
    fileType: 'dwg'
  },
  {
    id: 'PRJ-ARC-Z02-ZZ-M3-A-0002',
    name: 'Phối cảnh tổng thể khối tháp chính',
    folder: '03_PUBLISHED',
    subFolder: 'Bản vẽ thiết kế',
    status: 'S2 - PUBLISHED',
    revision: 'C01',
    version: 'V5',
    modifiedDate: '2026-06-04T09:45:00Z',
    size: '18.4 MB',
    creator: 'ARC Studio',
    classification: 'EF_20_10',
    volume: 'Z02 - Zone 2',
    fileType: 'pdf'
  },
  {
    id: 'BAN-VE-TANG-3-FINAL',
    name: 'Mặt bằng kết cấu sàn tầng 3 (Legacy)',
    folder: '01_WIP',
    subFolder: 'Bản vẽ thiết kế',
    status: 'S0 - WIP',
    revision: 'P01',
    version: 'V1',
    modifiedDate: '2026-06-03T08:15:00Z',
    size: '4.8 MB',
    creator: 'STR Studio',
    classification: 'EF_20_10',
    volume: 'Z01 - Zone 1',
    fileType: 'pdf'
  }
];

const DEFAULT_APPROVALS: ApprovalItem[] = [
  { id: 'RFI-0042', type: 'Vật liệu Sàn', deadline: 'Hôm nay', requester: 'KTS. Lê Minh Hoàng', description: 'Đề xuất thay đổi kết cấu hoàn thiện lớp bê tông đá mài granito sảnh chính.', file: 'RFI-0042-Slab-Material.pdf', createdDate: '2026-06-06' },
  { id: 'SUB-018', type: 'Bản vẽ Cốp pha', deadline: '24/06/2026', requester: 'KS. Nguyễn Văn Hải', description: 'Trình duyệt bản vẽ biện pháp thi công cốp pha tầng điển hình khối B.', file: 'SUB-018-Formwork-Rev2.dwg', createdDate: '2026-06-07' },
  { id: 'RFI-0043', type: 'Kích thước Dầm', deadline: '26/06/2026', requester: 'KS. Trần Thu Thảo', description: 'Yêu cầu làm rõ xung đột kích thước dầm phụ trục D-7 với đường ống cứu hỏa.', file: 'RFI-0043-Beam-Dim.pdf', createdDate: '2026-06-07' },
  { id: 'SUB-019', type: 'Cơ điện (MEP) Phòng Cháy', deadline: '28/06/2026', requester: 'KS. Vũ Quốc Huy', description: 'Hồ sơ thiết bị bơm phòng cháy chữa cháy phòng kỹ thuật tầng hầm.', file: 'SUB-019-MEP-Pumps.pdf', createdDate: '2026-06-08' },
  { id: 'RFI-0044', type: 'Định vị Cọc khoan nhồi', deadline: '30/06/2026', requester: 'KS. Đỗ Hải Nam', description: 'Báo cáo siêu âm và thí nghiệm nén tĩnh cọc thử khối tháp chính.', file: 'RFI-0044-Pile-Testing.pdf', createdDate: '2026-06-08' }
];

const DEFAULT_CLASHES: ClashItem[] = [
  { id: 'CL-01', elements: 'Dầm trục 3-C với Ống gió tầng 2', discipline: 'ST-MEP', severity: 'Cao', status: 'Chưa xử lý', description: 'Ống cấp khí tươi chính xuyên qua dầm kết cấu trục C phụ tải.' },
  { id: 'CL-02', elements: 'Cột bê tông tầng 1 với Cáp cứu hỏa', discipline: 'ST-MEP', severity: 'Cao', status: 'Chưa xử lý', description: 'Đường cáp động lực phòng cháy đi xuyên qua khối thép chờ cột sảnh.' },
  { id: 'CL-03', elements: 'Ống nước thải thoát sàn với Khung trần thạch cao', discipline: 'MEP-ARCH', severity: 'Trung bình', status: 'Chưa xử lý', description: 'Độ dốc đường ống thoát nước sảnh chính chạm mặt xương trần giật cấp.' },
  { id: 'CL-04', elements: 'Cửa thoát hiểm khối B với Vách bê tông', discipline: 'AR-ST', severity: 'Trung bình', status: 'Chưa xử lý', description: 'Vị trí trích ô chờ cửa lệch 150mm so với bản vẽ dầm chuyển vách.' },
  { id: 'CL-05', elements: 'Thang máng cáp điện vs Ống sprinkler hành lang', discipline: 'MEP-MEP', severity: 'Thấp', status: 'Chưa xử lý', description: 'Khoảng cách lắp đặt giữa máng điện động lực và ống chữa cháy chưa đạt 150mm.' }
];

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  { id: 'act-1', user: 'Nguyen Van A', action: 'đã tải lên', target: 'STR-PLAN-L02-v3.pdf', time: '10 phút trước', type: 'upload' },
  { id: 'act-2', user: 'Le Thi B', action: 'đã bình luận về', target: 'MEP-CLASH-045', time: '1 giờ trước', type: 'comment' },
  { id: 'act-3', user: 'Hệ thống', action: 'đã cập nhật trạng thái', target: 'mô hình liên kết', time: 'Hôm qua, 14:30', type: 'system' }
];

export default function App() {
  // ---- Auth ----
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    getSession().then(async (session) => {
      if (!active) return;
      setSignedIn(!!session);
      if (session) setProfile(await fetchProfile(session.user.id));
      setAuthReady(true);
    });
    const unsub = onAuthChange(async (session) => {
      setSignedIn(!!session);
      setProfile(session ? await fetchProfile(session.user.id) : null);
    });
    return () => { active = false; unsub(); };
  }, []);

  const handleSignOut = async () => { await signOut(); };

  const [activeModule, setActiveModule] = useState<'overview' | 'projects' | 'gis' | 'settings'>('projects');
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabContext>('dashboard');
  
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('cic_cde_theme') === 'dark';
  });

  const toggleTheme = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('cic_cde_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  const [selectedModelUrl, setSelectedModelUrl] = useState<string | null>(null);
  const [viewerProperties, setViewerProperties] = useState<any>(null);
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<number[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const viewerRef = useRef<BimViewerRef>(null);

  // Dữ liệu nạp từ Supabase (thay localStorage). Fallback DEFAULT_* khi lỗi mạng.
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [clashes, setClashes] = useState<ClashItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal configuration for creating & editing projects
  const [projectModalConfig, setProjectModalConfig] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    project?: ProjectItem;
  }>({ isOpen: false, mode: 'create' });

  const handleAddProject = () => {
    setProjectModalConfig({ isOpen: true, mode: 'create' });
  };

  const handleEditProject = (proj: ProjectItem) => {
    setProjectModalConfig({ isOpen: true, mode: 'edit', project: proj });
  };

  const handleProjectFormSubmit = async (projectData: any) => {
    if (projectModalConfig.mode === 'create') {
      try {
        const newProj = await createProject(projectData);
        setProjects(prev => [...prev, newProj]);
        
        // Ghi nhận hoạt động hệ thống
        const newAct: ActivityItem = {
          id: String(Date.now()),
          user: profile?.fullName || 'Người dùng',
          action: 'đã tạo mới dự án CDE',
          target: newProj.name,
          time: 'Vừa xong',
          type: 'system'
        };
        setActivities(prev => [newAct, ...prev]);
      } catch (err) {
        console.error('Không lưu được dự án mới lên Supabase, lưu cục bộ làm fallback:', err);
        const newProj: ProjectItem = {
          ...projectData,
          documentsCount: 0,
          approvalPercent: 0,
          spendingActual: 0,
          clashesCount: 0
        };
        setProjects(prev => [...prev, newProj]);
      }
    } else if (projectModalConfig.mode === 'edit' && projectModalConfig.project) {
      const originalId = projectModalConfig.project.id;
      try {
        const updatedProj = await updateProject(originalId, projectData);
        setProjects(prev => prev.map(p => p.id === originalId ? updatedProj : p));
        if (selectedProject?.id === originalId) {
          setSelectedProject(updatedProj);
        }
        
        // Ghi nhận hoạt động hệ thống
        const newAct: ActivityItem = {
          id: String(Date.now()),
          user: profile?.fullName || 'Người dùng',
          action: 'đã cập nhật thông tin dự án',
          target: updatedProj.name,
          time: 'Vừa xong',
          type: 'system'
        };
        setActivities(prev => [newAct, ...prev]);
      } catch (err) {
        console.error('Không cập nhật được dự án lên Supabase, lưu cục bộ làm fallback:', err);
        const updatedProj: ProjectItem = {
          ...projectModalConfig.project,
          ...projectData
        };
        setProjects(prev => prev.map(p => p.id === originalId ? updatedProj : p));
        if (selectedProject?.id === originalId) {
          setSelectedProject(updatedProj);
        }
      }
    }
  };

  // Nạp danh sách dự án từ Supabase khi khởi động
  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(err => {
        console.error('Không tải được danh sách dự án từ Supabase:', err);
        setProjects(PROJECTS_LIST); // fallback
      });
  }, []);

  // Realtime: lắng nghe hoạt động mới của dự án đang mở và cập nhật nhật ký tức thì
  useEffect(() => {
    if (!selectedProject) return;
    const channel = supabase
      .channel(`activities-${selectedProject.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities', filter: `project_id=eq.${selectedProject.id}` },
        (payload) => {
          const r: any = payload.new;
          const item: ActivityItem = {
            id: r.id,
            user: r.user_name ?? 'Hệ thống',
            action: r.action ?? '',
            target: r.target ?? '',
            time: 'Vừa xong',
            type: r.activity_type ?? 'system',
          };
          // Tránh trùng với bản ghi đã thêm lạc quan vào state
          setActivities(prev => prev.some(a => a.id === item.id) ? prev : [item, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedProject]);

  const isViewer = activeModule === 'projects' && selectedProject !== null && activeTab === 'viewer';

  const handleOpenModel = (url: string) => {
    setSelectedModelUrl(url);
    setActiveTab('viewer');
  };

  const handleSelectProject = async (proj: ProjectItem) => {
    setSelectedProject(proj);
    setActiveTab('dashboard');
    if (proj.id === 'fpt-arch') {
      setSelectedModelUrl('https://thatopen.github.io/engine_ui-components/resources/small.ifc');
    } else {
      setSelectedModelUrl(null);
    }

    // Nạp dữ liệu của dự án từ Supabase
    setDataLoading(true);
    try {
      const [docs, apps, cls, acts] = await Promise.all([
        fetchDocuments(proj.id),
        fetchApprovals(proj.id),
        fetchClashes(proj.id),
        fetchActivities(proj.id),
      ]);
      setDocuments(docs);
      setApprovals(apps);
      setClashes(cls);
      setActivities(acts);
    } catch (err) {
      console.error('Không tải được dữ liệu dự án từ Supabase:', err);
      // Fallback dữ liệu mẫu để app vẫn dùng được khi offline
      setDocuments(DEFAULT_DOCUMENTS);
      setApprovals(DEFAULT_APPROVALS);
      setClashes(DEFAULT_CLASHES);
      setActivities(DEFAULT_ACTIVITIES);
    } finally {
      setDataLoading(false);
    }
  };

  // Auth gate: chờ kiểm tra phiên, hiện màn đăng nhập nếu chưa đăng nhập
  if (!authReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface-container-low">
        <div className="animate-pulse text-primary font-bold text-lg">CDE CIC…</div>
      </div>
    );
  }
  if (!signedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen w-screen flex bg-background text-on-background overflow-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Global Sidebar Application Drawer */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        isCollapsed={isViewer}
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        userName={profile?.fullName || 'Người dùng'}
        userRole={profile?.role || 'Architect'}
        onSignOut={handleSignOut}
      />
      
      {/* Main Column */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AppHeader
          activeModule={activeModule}
          selectedProject={selectedProject}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onBackToProjectList={() => setSelectedProject(null)}
          activities={activities}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          onZoomIn={() => viewerRef.current?.zoomIn()}
          onZoomOut={() => viewerRef.current?.zoomOut()}
        />
        
        {/* Dynamic Route/Tab Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* Module 1: Overview */}
          {activeModule === 'overview' && (
            <OverviewDashboard
              projects={projects}
              activities={activities}
              userName={profile?.fullName || 'Người dùng'}
              onSelectProject={handleSelectProject}
            />
          )}

          {/* Module 2: GIS/GeoBIM */}
          {activeModule === 'gis' && (
            <div className="flex-1 min-h-0 relative flex flex-col p-6 bg-surface-container-low overflow-y-auto custom-scrollbar">
              <GeoBimMap />
            </div>
          )}

          {/* Module 3: Settings */}
          {activeModule === 'settings' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-surface-container-lowest max-w-4xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-1">Cấu hình Hệ thống CDE</h2>
                <p className="text-sm text-on-surface-variant font-medium">Tùy chỉnh tiêu chuẩn tài liệu ISO 19650 và kết nối dữ liệu GIS/GeoBIM.</p>
              </div>

              {/* Vai trò người dùng (RBAC) */}
              <div className="bg-surface border border-outline-variant/60 rounded-2xl p-6 shadow-sm space-y-2">
                <h3 className="font-bold text-sm text-on-surface uppercase tracking-wider text-primary">Vai trò của bạn (phân quyền)</h3>
                <p className="text-[12px] text-on-surface-variant leading-relaxed">
                  Vai trò quyết định quyền hạn: chỉ <b>Người kiểm / Người phê duyệt / Quản trị</b> mới được phê duyệt & phát hành tài liệu.
                  <span className="text-warning"> (Pilot: tự chọn để thử; bản chính thức do Quản trị gán.)</span>
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <select
                    value={PROJECT_ROLES.includes((profile?.role as any)) ? profile?.role : 'Author'}
                    onChange={async (e) => { await updateMyRole(e.target.value); const s = await getSession(); if (s) setProfile(await fetchProfile(s.user.id)); }}
                    className="bg-surface-container border border-outline-variant/60 rounded-lg px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {PROJECT_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                  <span className="text-[12px] text-on-surface-variant">Hiện tại: <b className="text-on-surface">{roleLabel(profile?.role)}</b></span>
                </div>
              </div>

              <div className="bg-surface border border-outline-variant/60 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-on-surface uppercase tracking-wider text-primary">Quy tắc đặt tên tài liệu (ISO 19650)</h3>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">Định dạng tiêu chuẩn: <code>[Dự án]-[Bên yêu cầu]-[Phân khu]-[Tầng]-[Loại]-[Kỷ luật]-[Mã số]</code></p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-outline uppercase">Mã Dự án mặc định</label>
                      <input type="text" value="PRJ" disabled className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface-variant cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-outline uppercase">Ký tự phân tách</label>
                      <input type="text" value="-" disabled className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface-variant cursor-not-allowed" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-outline-variant/30 pt-6 space-y-2">
                  <h3 className="font-bold text-sm text-on-surface uppercase tracking-wider text-primary">Giao diện hiển thị</h3>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">Chọn chế độ màu sắc hiển thị phù hợp với môi trường làm việc của bạn.</p>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setDarkMode(false)}
                      className={`flex-1 p-4 border rounded-xl flex flex-col items-center gap-2 transition-all cursor-pointer ${!darkMode ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm' : 'border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant bg-surface'}`}
                    >
                      <Sun size={20} className={!darkMode ? "text-primary" : "text-outline"} />
                      <span className="text-xs">Chế độ Sáng</span>
                    </button>
                    <button 
                      onClick={() => setDarkMode(true)}
                      className={`flex-1 p-4 border rounded-xl flex flex-col items-center gap-2 transition-all cursor-pointer ${darkMode ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm' : 'border-outline-variant/60 hover:bg-surface-container-low text-on-surface-variant bg-surface'}`}
                    >
                      <Moon size={20} className={darkMode ? "text-primary animate-pulse" : "text-outline"} />
                      <span className="text-xs">Chế độ Tối</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-outline-variant/30 pt-6 space-y-2">
                  <h3 className="font-bold text-sm text-on-surface uppercase tracking-wider text-primary">Cấu hình Bản đồ GeoBIM</h3>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed">Thiết lập kết nối với máy chủ OGC 3D Tiles và bản đồ nền GIS.</p>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center p-3 bg-surface-container rounded-xl">
                      <span className="text-xs font-semibold text-on-surface">Bản đồ nền vệ tinh (CartoDB Dark)</span>
                      <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded">ĐANG HOẠT ĐỘNG</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-container rounded-xl">
                      <span className="text-xs font-semibold text-on-surface">Máy chủ 3D Tiles (b3dm format)</span>
                      <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded">ĐỒNG BỘ ỔN ĐỊNH</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module 4: Projects */}
          {activeModule === 'projects' && (
            <>
              {selectedProject === null ? (
                <ProjectList
                  onSelectProject={handleSelectProject}
                  projects={projects}
                  onAddProject={handleAddProject}
                  onEditProject={handleEditProject}
                />
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {activeTab === 'dashboard' && (
                    <DashboardTab
                      project={selectedProject}
                      onEditProject={() => handleEditProject(selectedProject)}
                      documents={documents}
                      setDocuments={setDocuments}
                      approvals={approvals}
                      setApprovals={setApprovals}
                      clashes={clashes}
                      setClashes={setClashes}
                      activities={activities}
                      setActivities={setActivities}
                      projectId={selectedProject.id}
                      userRole={profile?.role}
                    />
                  )}
                  {activeTab === 'documents' && (
                    <DocumentsTab
                      documents={documents}
                      setDocuments={setDocuments}
                      approvals={approvals}
                      setApprovals={setApprovals}
                      activities={activities}
                      setActivities={setActivities}
                      onOpenModel={handleOpenModel}
                      globalSearch={globalSearch}
                      projectId={selectedProject.id}
                      userRole={profile?.role}
                    />
                  )}
                  {/* Viewer luôn mounted (ẩn/hiện bằng CSS) để không mất mô hình khi đổi tab */}
                  <div className={activeTab === 'viewer' ? 'flex-1 flex overflow-hidden min-h-0' : 'hidden'}>
                    <ViewerTab
                      selectedModelUrl={selectedModelUrl}
                      setSelectedModelUrl={setSelectedModelUrl}
                      onModelLoaded={(spatial, props) => {
                        setViewerProperties(props);
                      }}
                      selectedHighlightIds={selectedHighlightIds}
                      setSelectedHighlightIds={setSelectedHighlightIds}
                      viewerRef={viewerRef}
                      projectId={selectedProject.id}
                      documents={documents}
                      isActive={activeTab === 'viewer'}
                      onRemoveDocument={(code) => setDocuments(prev => prev.filter(d => d.id !== code))}
                      onProjectCoverChanged={(pid, url) => setProjects(prev => prev.map(p => p.id === pid ? { ...p, coverImage: url } : p))}
                      onDocFragCached={(code, fragUrl) => setDocuments(prev => prev.map(d => d.id === code ? { ...d, fragUrl } : d))}
                    />
                  </div>
                  {activeTab === 'schedule' && (
                    <ScheduleTab
                      viewerProperties={viewerProperties}
                      setSelectedHighlightIds={setSelectedHighlightIds}
                      setActiveTab={setActiveTab}
                      projectId={selectedProject.id}
                      getQto={() => viewerRef.current?.getQuantityTakeoff() ?? Promise.resolve(null)}
                    />
                  )}
                  {activeTab === 'fm' && (
                    <FmTab projectId={selectedProject.id} />
                  )}
                  {activeTab === 'tasks' && (
                    <TasksTab projectId={selectedProject.id} />
                  )}
                  {activeTab === 'team' && (
                    <TeamTab projectId={selectedProject.id} />
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      <ProjectFormModal
        isOpen={projectModalConfig.isOpen}
        mode={projectModalConfig.mode}
        project={projectModalConfig.project}
        onClose={() => setProjectModalConfig(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleProjectFormSubmit}
        existingProjectIds={projects.map(p => p.id)}
      />
    </div>
  );
}
