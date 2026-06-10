import React, { useState } from 'react';
import { 
  Building2, MapPin, Search, ArrowRight, Folder, 
  CheckCircle2, TrendingUp, AlertTriangle, Filter, Calendar,
  Pencil, Plus
} from 'lucide-react';

export interface ProjectItem {
  id: string;
  name: string;
  location: string;
  status: 'Thi công' | 'Thi công ngầm' | 'Đang hoàn thiện' | 'Chuẩn bị';
  documentsCount: number;
  approvalPercent: number;
  spendingActual: number;
  clashesCount: number;
  progress: number;
  startDate: string;
  client: string;
  description: string;
  lat?: number;
  lng?: number;
  province?: string;
  tilesUrl?: string;
  projectGroup?: string;
  buildingGrade?: string;
  coverImage?: string;
}

export const PROJECTS_LIST: ProjectItem[] = [
  {
    id: 'fpt-arch',
    name: 'FPT Arch Tower',
    location: 'Khu công nghệ cao Hòa Lạc, Hà Nội',
    status: 'Thi công',
    documentsCount: 1248,
    approvalPercent: 84,
    spendingActual: 82.1,
    clashesCount: 5,
    progress: 72,
    startDate: '01/2025',
    client: 'FPT Group',
    description: 'Tháp văn phòng tích hợp trung tâm nghiên cứu AI và thiết kế kiến trúc thông minh.'
  },
  {
    id: 'complex-a',
    name: 'Dự án Tòa nhà Complex A',
    location: 'Quận 1, TP. Hồ Chí Minh',
    status: 'Thi công ngầm',
    documentsCount: 512,
    approvalPercent: 76,
    spendingActual: 45.0,
    clashesCount: 12,
    progress: 35,
    startDate: '08/2025',
    client: 'Complex Land',
    description: 'Tòa nhà hỗn hợp thương mại dịch vụ cao 45 tầng với 5 tầng hầm đỗ xe thông minh.'
  },
  {
    id: 'fpt-uni',
    name: 'FPT University Campus',
    location: 'Khu công nghệ cao Hòa Lạc, Hà Nội',
    status: 'Đang hoàn thiện',
    documentsCount: 840,
    approvalPercent: 90,
    spendingActual: 120.0,
    clashesCount: 3,
    progress: 92,
    startDate: '03/2024',
    client: 'FPT Education',
    description: 'Phân khu giảng đường H4 và H5 kiến trúc xanh tự cấp năng lượng mặt trời.'
  },
  {
    id: 'vp-hang-a',
    name: 'Tòa nhà VP Hạng A - Quận 1',
    location: 'Quận 1, TP. Hồ Chí Minh',
    status: 'Chuẩn bị',
    documentsCount: 320,
    approvalPercent: 92,
    spendingActual: 10.4,
    clashesCount: 0,
    progress: 8,
    startDate: '12/2025',
    client: 'Vanguard Holdings',
    description: 'Văn phòng Hạng A đạt chứng chỉ LEED Gold tối ưu hóa năng lượng.'
  }
];

const FALLBACK_PROJECT_IMAGES: Record<string, string> = {
  'fpt-arch': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop',
  'complex-a': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=600&auto=format&fit=crop',
  'fpt-uni': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=600&auto=format&fit=crop',
  'vp-hang-a': 'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?q=80&w=600&auto=format&fit=crop',
  'default': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop'
};

function getProjectImage(proj: ProjectItem): string {
  if (proj.coverImage && proj.coverImage.trim() !== '') {
    return proj.coverImage;
  }
  return FALLBACK_PROJECT_IMAGES[proj.id] || FALLBACK_PROJECT_IMAGES['default'];
}

interface ProjectListProps {
  onSelectProject: (project: ProjectItem) => void;
  projects?: ProjectItem[];
  onAddProject?: () => void;
  onEditProject?: (project: ProjectItem) => void;
}

export function ProjectList({ onSelectProject, projects, onAddProject, onEditProject }: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const sourceProjects = projects && projects.length > 0 ? projects : PROJECTS_LIST;

  const filteredProjects = sourceProjects.filter(proj => {
    const matchesSearch = proj.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          proj.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: ProjectItem['status']) => {
    switch (status) {
      case 'Thi công':
        return 'bg-emerald-700 text-white border-emerald-600/30 shadow-sm';
      case 'Thi công ngầm':
        return 'bg-amber-700 text-white border-amber-600/30 shadow-sm';
      case 'Đang hoàn thiện':
        return 'bg-blue-700 text-white border-blue-600/30 shadow-sm';
      case 'Chuẩn bị':
        return 'bg-slate-700 text-white border-slate-600/30 shadow-sm';
      default:
        return 'bg-slate-700 text-white border-slate-600/30 shadow-sm';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-surface-container-lowest custom-scrollbar">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-1 flex items-center gap-2">
            <Building2 size={24} className="text-primary" />
            Hệ thống Quản lý Dự án CDE
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Chọn một dự án hoạt động để truy cập kho dữ liệu mô hình 3D, tiến độ và tài liệu chuẩn ISO 19650.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-surface px-3 py-2 rounded-xl border border-outline-variant text-[13px] text-outline font-bold">
            Tổng số: <span className="text-primary font-extrabold">{sourceProjects.length}</span> Dự án
          </div>
          {onAddProject && (
            <button
              onClick={onAddProject}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-on-primary px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={15} />
              Tạo dự án mới
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-low border border-outline-variant/50 p-4 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm dự án theo tên, vị trí hoặc mã..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-surface border border-outline-variant/60 rounded-xl text-[14px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/80 font-medium"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={16} className="text-outline" />
          <span className="text-[13px] font-bold text-on-surface-variant whitespace-nowrap">Trạng thái:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface border border-outline-variant/60 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Thi công">Đang thi công</option>
            <option value="Thi công ngầm">Thi công ngầm</option>
            <option value="Đang hoàn thiện">Đang hoàn thiện</option>
            <option value="Chuẩn bị">Chuẩn bị thi công</option>
          </select>
        </div>

      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map(proj => (
            <div 
              key={proj.id}
              onClick={() => onSelectProject(proj)}
              className="bg-surface border border-outline-variant/50 hover:border-primary/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              {/* Highlight line on hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-primary transition-colors duration-300 z-10"></div>

              {/* Ảnh đại diện dự án (BIM render hoặc ảnh phối cảnh) */}
              <div className="relative -mx-5 -mt-5 mb-4 h-48 overflow-hidden bg-surface-container rounded-t-2xl group/img border-b border-outline-variant/20">
                <img 
                  src={getProjectImage(proj)} 
                  alt={proj.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  loading="lazy"
                />
                
                {/* Lớp phủ Gradient mượt mà */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/35 opacity-90 group-hover:opacity-85 transition-opacity duration-300"></div>

                {/* Mã dự án và Nhãn trạng thái overlay trên ảnh */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                  <span className="font-mono text-[10px] font-extrabold px-2 py-1 bg-black/75 backdrop-blur-md text-slate-100 rounded-md border border-white/10 tracking-wider uppercase">
                    #{proj.id.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${getStatusColor(proj.status)}`}>
                    {proj.status}
                  </span>
                </div>

                {/* Nút chỉnh sửa nổi ở góc dưới bên phải ảnh */}
                {onEditProject && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject(proj);
                    }}
                    className="absolute bottom-3 right-3 p-2 text-slate-200 hover:text-primary hover:bg-white bg-black/45 backdrop-blur-sm rounded-full border border-white/10 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer z-20"
                    title="Chỉnh sửa thông tin dự án"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>

              <div>
                {/* Name */}
                <h3 className="font-bold text-[18px] text-on-surface mb-1.5 group-hover:text-primary transition-colors tracking-tight leading-snug line-clamp-1">
                  {proj.name}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-on-surface-variant font-medium text-[12.5px] mb-3">
                  <MapPin size={14} className="text-outline shrink-0" />
                  <span className="truncate">{proj.location}</span>
                </div>

                {/* Description */}
                <p className="text-[12px] text-outline font-medium leading-relaxed mb-4 line-clamp-2">
                  {proj.description}
                </p>

                {/* Progress bar */}
                <div className="space-y-1 mb-5">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-on-surface-variant">Tiến độ tổng thể</span>
                    <span className="text-primary">{proj.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-500" 
                      style={{ width: `${proj.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* KPI stats Grid */}
              <div className="border-t border-outline-variant/30 pt-4 mt-auto">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Folder size={15} className="text-outline" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Tài liệu</div>
                      <div className="text-[13px] font-bold text-on-surface truncate">{proj.documentsCount} tệp</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-outline" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Đồng thuận</div>
                      <div className="text-[13px] font-bold text-on-surface truncate">{proj.approvalPercent}%</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-outline" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Chi phí</div>
                      <div className="text-[13px] font-bold text-on-surface truncate">{proj.spendingActual} Tỷ</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-outline" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-outline uppercase tracking-wider">Xung đột</div>
                      <div className="text-[13px] font-bold text-on-surface truncate">{proj.clashesCount} Clash</div>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-1.5 transition-transform duration-300 pt-1">
                  <span>TRUY CẬP CDE DỰ ÁN</span>
                  <ArrowRight size={14} />
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-outline-variant/60 rounded-2xl text-center p-6 gap-3">
          <Building2 size={40} className="text-outline/40" />
          <p className="font-semibold text-sm text-on-surface-variant">Không tìm thấy dự án nào khớp với điều kiện lọc</p>
          <button 
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="text-xs bg-primary text-on-primary px-4 py-2 rounded-lg font-bold"
          >
            Thiết lập lại bộ lọc
          </button>
        </div>
      )}

    </div>
  );
}
