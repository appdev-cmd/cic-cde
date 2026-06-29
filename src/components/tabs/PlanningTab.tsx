import React, { useState, useMemo } from 'react';
import {
  FileText, ClipboardList, CheckCircle2, AlertTriangle, Clock, Play,
  Plus, Search, Filter, Info, Users, BookOpen, Layers, Settings,
  Calendar, Check, ArrowRight, Download, Eye, ExternalLink, RefreshCw
} from 'lucide-react';

// Interfaces
interface MidpItem {
  id: string; // File name / code (e.g. NO-11_CIC_STRU_CC_BAS_ZZ_M3_0001)
  name: string; // Document description
  discipline: string; // e.g. STRU, ARCH, HVAC
  dataType: string; // e.g. Mô hình 3D, Bản vẽ 2D, Báo cáo
  fileType: string; // e.g. RVT, IFC, PDF, xlsx
  originator: string; // e.g. CIC, PAY, LID
  plannedDate: string;
  actualDateFirst: string;
  actualDateLatest: string;
  version: string;
  status: 'completed' | 'delayed' | 'pending';
}

interface BepStaff {
  id: number;
  name: string;
  role: string;
  email: string;
}

export function PlanningTab() {
  const [activeSubTab, setActiveSubTab] = useState<'bep' | 'midp'>('bep');
  const [bepSection, setBepSection] = useState<'overview' | 'goals' | 'raci' | 'team' | 'software' | 'standards' | 'cde'>('overview');
  const [lodCategory, setLodCategory] = useState<'architecture' | 'structure' | 'mep'>('architecture');

  // --- MIDP State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Initial MIDP Data from the excel template
  const [midpData, setMidpData] = useState<MidpItem[]>([
    {
      id: 'NO-11_PAY_XXXX_XX_XXX_XX_RP_0001',
      name: 'Khảo sát địa hình',
      discipline: 'XXXX',
      dataType: 'Báo cáo',
      fileType: 'PDF',
      originator: 'PAY',
      plannedDate: '15/01/2026',
      actualDateFirst: '14/01/2026',
      actualDateLatest: '14/01/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_PAY_XXXX_XX_XXX_XX_RP_0002',
      name: 'Khảo sát địa chất',
      discipline: 'XXXX',
      dataType: 'Báo cáo',
      fileType: 'PDF',
      originator: 'PAY',
      plannedDate: '15/01/2026',
      actualDateFirst: '15/01/2026',
      actualDateLatest: '15/01/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_PAY_XXXX_XX_XXX_XX_RP_0003',
      name: 'Thuyết minh thiết kế',
      discipline: 'XXXX',
      dataType: 'Báo cáo',
      fileType: 'PDF',
      originator: 'PAY',
      plannedDate: '20/01/2026',
      actualDateFirst: '19/01/2026',
      actualDateLatest: '19/01/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_PAY_STRU_XX_XXX_XX_RP_0001',
      name: 'Bảng tính kết cấu',
      discipline: 'STRU',
      dataType: 'Báo cáo',
      fileType: 'PDF',
      originator: 'PAY',
      plannedDate: '25/01/2026',
      actualDateFirst: '27/01/2026',
      actualDateLatest: '27/01/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_PAY_FEDE_XX_XXX_XX_M2_0001',
      name: 'Bản vẽ thiết kế thi công',
      discipline: 'FEDE',
      dataType: 'Bản vẽ 2D',
      fileType: 'PDF',
      originator: 'PAY',
      plannedDate: '30/01/2026',
      actualDateFirst: '31/01/2026',
      actualDateLatest: '31/01/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_PAY_STAR_ZZ_ZZZ_ZZ_BQ_0001',
      name: 'Form BoQ KTKC',
      discipline: 'STAR',
      dataType: 'Báo cáo',
      fileType: 'xlsx',
      originator: 'PAY',
      plannedDate: '15/04/2026',
      actualDateFirst: '21/04/2026',
      actualDateLatest: '21/04/2026',
      version: 'P01',
      status: 'delayed'
    },
    {
      id: 'NO-11_PAY_MEPF_ZZ_ZZZ_ZZ_BQ_0001',
      name: 'Form BoQ Cơ điện (Không gồm PCCC)',
      discipline: 'MEPF',
      dataType: 'Báo cáo',
      fileType: 'xlsx',
      originator: 'PAY',
      plannedDate: '15/04/2026',
      actualDateFirst: '17/04/2026',
      actualDateLatest: '17/04/2026',
      version: 'P01',
      status: 'delayed'
    },
    {
      id: 'NO-11_CIC_XXXX_XX_XXX_XX_PL_0001',
      name: 'Kế hoạch triển khai BIM (BEP)',
      discipline: 'XXXX',
      dataType: 'Kế hoạch',
      fileType: 'PDF',
      originator: 'CIC',
      plannedDate: '27/01/2026',
      actualDateFirst: '10/03/2026',
      actualDateLatest: '10/03/2026',
      version: 'P01',
      status: 'completed'
    },
    {
      id: 'NO-11_CIC_XXXX_XX_XXX_XX_PL_0003',
      name: 'Phụ lục MIDP',
      discipline: 'XXXX',
      dataType: 'Kế hoạch',
      fileType: 'PDF',
      originator: 'CIC',
      plannedDate: '27/01/2026',
      actualDateFirst: '13/03/2026',
      actualDateLatest: '13/03/2026',
      version: 'P02',
      status: 'completed'
    },
    {
      id: 'NO-11_CIC_STRU_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình kết cấu phần hầm',
      discipline: 'STRU',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '03/03/2026',
      actualDateLatest: '08/04/2026',
      version: 'P04',
      status: 'completed'
    },
    {
      id: 'NO-11_CIC_ARCH_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình kiến trúc phần hầm',
      discipline: 'ARCH',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '03/03/2026',
      actualDateLatest: '08/04/2026',
      version: 'P03',
      status: 'completed'
    },
    {
      id: 'NO-11_CIC_HVAC_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình ĐHKK thông gió phần hầm',
      discipline: 'HVAC',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_PLUM_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình Cấp thoát nước phần hầm',
      discipline: 'PLUM',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_ELEC_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình Điện phần hầm',
      discipline: 'ELEC',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_FIRE_CC_BAS_ZZ_M3_0001',
      name: 'Mô hình PCCC phần hầm',
      discipline: 'FIRE',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '07/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_STRU_CC_POD_ZZ_M3_0001',
      name: 'Mô hình kết cấu khu Podium',
      discipline: 'STRU',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '13/02/2026',
      actualDateFirst: '06/03/2026',
      actualDateLatest: '08/04/2026',
      version: 'P04',
      status: 'completed'
    },
    {
      id: 'NO-11_CIC_ARCH_CC_POD_ZZ_M3_0001',
      name: 'Mô hình kiến trúc khu Podium',
      discipline: 'ARCH',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '13/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_HVAC_CC_POD_ZZ_M3_0001',
      name: 'Mô hình ĐHKK thông gió khu Podium',
      discipline: 'HVAC',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '13/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_PLUM_CC_POD_ZZ_M3_0001',
      name: 'Mô hình Cấp thoát nước khu Podium',
      discipline: 'PLUM',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '13/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    },
    {
      id: 'NO-11_CIC_FIRE_CC_POD_ZZ_M3_0001',
      name: 'Mô hình PCCC khu Podium',
      discipline: 'FIRE',
      dataType: 'Mô hình 3D',
      fileType: 'RVT, IFC',
      originator: 'CIC',
      plannedDate: '13/02/2026',
      actualDateFirst: '',
      actualDateLatest: '',
      version: '',
      status: 'pending'
    }
  ]);

  // Add Item Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocPlannedDate, setNewDocPlannedDate] = useState('2026-07-30');

  // Naming Generator Fields
  const [namingProject, setNamingProject] = useState('NO-11');
  const [namingOriginator, setNamingOriginator] = useState('CIC');
  const [namingDiscipline, setNamingDiscipline] = useState('STRU');
  const [namingVolume, setNamingVolume] = useState('CC');
  const [namingLevelGroup, setNamingLevelGroup] = useState('BAS');
  const [namingLevel, setNamingLevel] = useState('ZZ');
  const [namingType, setNamingType] = useState('M3');
  const [namingNumber, setNamingNumber] = useState('0002');

  // Derived Naming Code
  const generatedCode = useMemo(() => {
    return `${namingProject}_${namingOriginator}_${namingDiscipline}_${namingVolume}_${namingLevelGroup}_${namingLevel}_${namingType}_${namingNumber}`;
  }, [namingProject, namingOriginator, namingDiscipline, namingVolume, namingLevelGroup, namingLevel, namingType, namingNumber]);

  // Statistics
  const stats = useMemo(() => {
    const total = midpData.length;
    const completed = midpData.filter(item => item.status === 'completed').length;
    const delayed = midpData.filter(item => item.status === 'delayed').length;
    const pending = midpData.filter(item => item.status === 'pending').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, delayed, pending, pct };
  }, [midpData]);

  // Filtered MIDP List
  const filteredMidp = useMemo(() => {
    return midpData.filter(item => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDiscipline = disciplineFilter === 'ALL' || item.discipline === disciplineFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchesSearch && matchesDiscipline && matchesStatus;
    });
  }, [midpData, searchQuery, disciplineFilter, statusFilter]);

  // Handle adding new MIDP document
  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    // Map naming fields to dataType and fileType
    let dataType = 'Tài liệu';
    let fileType = 'PDF';
    if (namingType === 'M3') {
      dataType = 'Mô hình 3D';
      fileType = 'RVT, IFC';
    } else if (namingType === 'DR') {
      dataType = 'Bản vẽ 2D';
      fileType = 'PDF, DWG';
    } else if (namingType === 'BQ') {
      dataType = 'Bảng tiên lượng';
      fileType = 'xlsx';
    } else if (namingType === 'RP') {
      dataType = 'Báo cáo';
      fileType = 'PDF';
    }

    const newItem: MidpItem = {
      id: generatedCode,
      name: newDocName,
      discipline: namingDiscipline,
      dataType,
      fileType,
      originator: namingOriginator,
      plannedDate: newDocPlannedDate.split('-').reverse().join('/'),
      actualDateFirst: '',
      actualDateLatest: '',
      version: 'P01',
      status: 'pending'
    };

    setMidpData(prev => [newItem, ...prev]);
    setIsAddModalOpen(false);
    setNewDocName('');
    // Auto increment number
    const nextNum = String(parseInt(namingNumber, 10) + 1).padStart(4, '0');
    setNamingNumber(nextNum);
  };

  // Staff list from BEP
  const staffList: BepStaff[] = [
    { id: 1, name: 'Trần Hữu Hải', role: 'Quản lý BIM (TVBIM)', email: 'haith@cic.com.vn' },
    { id: 2, name: 'Nguyễn Quốc Anh', role: 'Điều phối BIM (Chủ trì TVBIM)', email: 'annhq@cic.com.vn' },
    { id: 3, name: 'Nguyễn Huỳnh Huy', role: 'Điều phối BIM (Khối đế TVBIM)', email: 'huynguyen@cic.com.vn' },
    { id: 4, name: 'Vũ Văn Hòa', role: 'Điều phối BIM (Hầm & Ngoài nhà TVBIM)', email: 'vanhoa@cic.com.vn' },
    { id: 5, name: 'Vũ Ngọc Thủy', role: 'Họa viên BIM (Kết cấu)', email: 'ngocthuy@cic.com.vn' },
    { id: 6, name: 'Vũ Hương Thảo', role: 'Họa viên BIM (Kiến trúc)', email: 'huongthao@cic.com.vn' },
    { id: 7, name: 'Nhữ Thị Thu Hiền', role: 'Họa viên BIM (Kiến trúc)', email: 'thuhien@cic.com.vn' },
    { id: 8, name: 'Đặng Trung Hiếu', role: 'Họa viên BIM (Kết cấu)', email: 'trunghieu@cic.com.vn' },
    { id: 9, name: 'Hà Văn Đức', role: 'Họa viên BIM (ĐHKK)', email: 'vanduc@cic.com.vn' },
    { id: 10, name: 'Đặng Văn Quang', role: 'Họa viên BIM (Cấp thoát nước)', email: 'vanquang@cic.com.vn' },
    { id: 11, name: 'Trần Văn Nghĩa', role: 'Họa viên BIM (Điện)', email: 'vannghia@cic.com.vn' },
    { id: 12, name: 'Nguyễn Đức Thành', role: 'Họa viên BIM (PCCC)', email: 'ducthanh@cic.com.vn' }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface text-on-surface">
      {/* Tab bar header */}
      <div className="border-b border-outline-variant bg-surface-container-low px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/60">
          <button
            onClick={() => setActiveSubTab('bep')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-bold text-[13px] transition-colors cursor-pointer ${
              activeSubTab === 'bep'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <BookOpen size={16} />
            Kế hoạch triển khai (BEP)
          </button>
          <button
            onClick={() => setActiveSubTab('midp')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-bold text-[13px] transition-colors cursor-pointer ${
              activeSubTab === 'midp'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <ClipboardList size={16} />
            Kế hoạch chuyển giao Thông tin tổng thể (MIDP)
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-outline">Phiên bản hiện tại:</span>
          <span className="bg-primary-container text-primary px-2 py-0.5 rounded-full text-xs font-bold font-mono">P02.03</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* --- 1. BEP SUB TAB --- */}
        {activeSubTab === 'bep' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Outline */}
            <aside className="w-[240px] border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-y-auto">
              <div className="p-4 border-b border-outline-variant">
                <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Mục lục tài liệu BEP</h3>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                <OutlineButton active={bepSection === 'overview'} onClick={() => setBepSection('overview')} label="1. Tổng quan Dự án" />
                <OutlineButton active={bepSection === 'goals'} onClick={() => setBepSection('goals')} label="2. Mục tiêu & Ứng dụng BIM" />
                <OutlineButton active={bepSection === 'raci'} onClick={() => setBepSection('raci')} label="3. Vai trò & Trách nhiệm (RACI)" />
                <OutlineButton active={bepSection === 'team'} onClick={() => setBepSection('team')} label="4. Danh sách Nhân sự" />
                <OutlineButton active={bepSection === 'software'} onClick={() => setBepSection('software')} label="5. Phần mềm & Phiên bản" />
                <OutlineButton active={bepSection === 'standards'} onClick={() => setBepSection('standards')} label="6. Quy chuẩn Kỹ thuật & Tọa độ" />
                <OutlineButton active={bepSection === 'cde'} onClick={() => setBepSection('cde')} label="7. Môi trường CDE dự án" />
              </nav>
            </aside>

            {/* Document Content */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest/20">
              <div className="max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-8">
                {bepSection === 'overview' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 1</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Tổng quan Dự án</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-on-surface-variant">
                      Kế hoạch thực hiện BIM này được biên soạn để nêu lên phương pháp đề xuất, năng lực của Công ty CP Công nghệ và Tư vấn CIC đáp ứng những yêu cầu thông tin của Chủ đầu tư (LIDECO) đối với dự án Nhà ở chung cư cao tầng tại ô đất ký hiệu NO-11. Tài liệu được phát triển dựa trên bộ tiêu chuẩn ISO 19650:2018 và tiêu chuẩn BIM/EIR của Ban quản lý.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/30">
                      <InfoRow label="Tên dự án" value="Nhà ở chung cư cao tầng tại ô đất ký hiệu NO-11" />
                      <InfoRow label="Mã dự án" value="NO-11" />
                      <InfoRow label="Địa điểm" value="Phường Cầu Giấy, Thành phố Hà Nội" />
                      <InfoRow label="Chủ đầu tư (Bên giao thầu)" value="Công ty Cổ phần phát triển đô thị Từ Liêm - LIDECO" />
                      <InfoRow label="Tư vấn thiết kế" value="Công ty TNHH Paysart Hà Nội" />
                      <InfoRow label="Tư vấn BIM (Bên nhận thầu chính)" value="Công ty CP Công nghệ & Tư vấn CIC" />
                      <InfoRow label="Quy mô" value="32 tầng nổi, 02 tầng hầm, Chiều cao 114m" />
                      <InfoRow label="Diện tích sàn" value="53.965 m²" />
                    </div>
                  </div>
                )}

                {bepSection === 'goals' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 2</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Mục tiêu & Ma trận Ứng dụng BIM</h2>
                    </div>
                    
                    <h3 className="font-bold text-sm text-on-surface">Mục tiêu áp dụng</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <GoalCard num="1" text="Kiểm soát và tối ưu hóa tiến độ: Phát hiện xung đột sớm trên mô hình thông tin." />
                      <GoalCard num="2" text="Kiểm soát và minh bạch hóa chi phí: Trích xuất khối lượng dự toán trực tiếp phục vụ thẩm tra." />
                      <GoalCard num="3" text="Nâng cao chất lượng thiết kế: Đồng bộ thông tin hình học & phi hình học đa bộ môn." />
                      <GoalCard num="4" text="Bàn giao mô hình hoàn công chuẩn hóa để phục vụ số hóa tài sản, vận hành bảo trì (FM)." />
                    </div>

                    <h3 className="font-bold text-sm text-on-surface mt-6">Ma trận Lựa chọn Ứng dụng BIM theo Giai đoạn (EIR Standard)</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Ký hiệu: <strong className="text-primary font-bold">B</strong>: Bắt buộc áp dụng | <strong className="text-outline font-bold">K</strong>: Khuyến khích áp dụng.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                            <th className="p-2.5">Tên Ứng dụng BIM</th>
                            <th className="p-2.5 text-center w-20">Ý tưởng</th>
                            <th className="p-2.5 text-center w-20">Cơ sở (TKCS)</th>
                            <th className="p-2.5 text-center w-20">Kỹ thuật (TKKT)</th>
                            <th className="p-2.5 text-center w-20">BV thi công</th>
                            <th className="p-2.5 text-center w-20">Hoàn công</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                          <tr>
                            <td className="p-2.5 text-on-surface font-semibold">Mô hình hiện trạng</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">-</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 text-on-surface font-semibold">Lập mô hình thiết kế (3D Model)</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-outline">K</td>
                            <td className="p-2.5 text-center">-</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 text-on-surface font-semibold">Phối hợp 3D (Kiểm va chạm)</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center">-</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 text-on-surface font-semibold">Bóc tách khối lượng và dự toán (QTO)</td>
                            <td className="p-2.5 text-center font-bold text-outline">K</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 text-on-surface font-semibold">Mô hình hóa thông tin hoàn công</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center font-bold text-outline">K</td>
                            <td className="p-2.5 text-center font-bold text-primary">B</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {bepSection === 'raci' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 3</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Vai trò & Ma trận trách nhiệm (RACI) chuẩn EIR</h2>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                      Giải thích vai trò chuẩn của BDD: <strong className="text-primary font-bold">Định hướng BIM</strong> (Ban Giám đốc BDD) | <strong className="text-primary font-bold">Thẩm định BIM</strong> (Cán bộ BDD) | <strong className="text-primary font-bold">Quản lý BIM</strong> (Trưởng nhóm TVBIM) | <strong className="text-primary font-bold">Điều phối BIM</strong> (Chủ trì bộ môn TVBIM) | <strong className="text-primary font-bold">Họa viên BIM</strong> (Kỹ thuật viên).
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                            <th className="p-2.5">Tác vụ cốt lõi</th>
                            <th className="p-2.5 text-center w-24">Định hướng (BDD)</th>
                            <th className="p-2.5 text-center w-24">Thẩm định (BDD)</th>
                            <th className="p-2.5 text-center w-24">Quản lý (TV)</th>
                            <th className="p-2.5 text-center w-24">Điều phối (TV)</th>
                            <th className="p-2.5 text-center w-24">Họa viên (TV)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Khởi tạo, phê duyệt EIR và Tiêu chuẩn BIM</td>
                            <td className="p-2.5 text-center font-bold text-tertiary">A</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center">I</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Lập và hoàn thiện hồ sơ BEP chính thức (Post-BEP)</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center">C</td>
                            <td className="p-2.5 text-center font-bold text-primary">A / R</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                            <td className="p-2.5 text-center">-</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Thẩm định và phê duyệt kỹ thuật hồ sơ BEP</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center font-bold text-tertiary">A / R</td>
                            <td className="p-2.5 text-center">C</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center">-</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Tạo lập mô hình thiết kế bộ môn</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center font-bold text-tertiary">A</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Tạo lập mô hình phối hợp & chạy kiểm va chạm</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center">I</td>
                            <td className="p-2.5 text-center font-bold text-tertiary">A / R</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                            <td className="p-2.5 text-center">C</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-semibold text-on-surface">Thẩm định, phê duyệt chất lượng dữ liệu mô hình</td>
                            <td className="p-2.5 text-center">-</td>
                            <td className="p-2.5 text-center font-bold text-tertiary">A / R</td>
                            <td className="p-2.5 text-center font-bold text-primary">R</td>
                            <td className="p-2.5 text-center">C</td>
                            <td className="p-2.5 text-center">I</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {bepSection === 'team' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 4</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Ban chỉ đạo & Nhân sự triển khai BIM</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {staffList.map(staff => (
                        <div key={staff.id} className="flex items-center gap-3 p-4 bg-surface-container-low border border-outline-variant/40 rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {staff.name.split(' ').pop()?.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-on-surface truncate">{staff.name}</h4>
                            <p className="text-xs text-on-surface-variant font-medium">{staff.role}</p>
                            <p className="text-[11px] text-outline font-mono mt-0.5 truncate">{staff.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bepSection === 'software' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 5</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Danh mục Phần mềm & Phiên bản</h2>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      Để tránh xung đột dữ liệu và phiên bản tập tin, tất cả các bên tham gia bắt buộc phải sử dụng các phần mềm có phiên bản thống nhất dưới đây:
                    </p>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                          <th className="p-3">Công tác</th>
                          <th className="p-3">Tên phần mềm</th>
                          <th className="p-3">Hãng sản xuất</th>
                          <th className="p-3 font-mono">Phiên bản</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                        <tr>
                          <td className="p-3 text-on-surface">Mô hình hóa (BIM Authoring)</td>
                          <td className="p-3 font-bold">Revit</td>
                          <td className="p-3">Autodesk</td>
                          <td className="p-3 font-mono text-primary font-bold">2024</td>
                        </tr>
                        <tr>
                          <td className="p-3 text-on-surface">Tổng hợp mô hình & Kiểm va chạm</td>
                          <td className="p-3 font-bold">Navisworks Manage</td>
                          <td className="p-3">Autodesk</td>
                          <td className="p-3 font-mono text-primary font-bold">2024</td>
                        </tr>
                        <tr>
                          <td className="p-3 text-on-surface">Kiểm tra thuộc tính & Va chạm nhanh</td>
                          <td className="p-3 font-bold">BIMcollab ZOOM</td>
                          <td className="p-3">Kubus</td>
                          <td className="p-3 font-mono">9.0</td>
                        </tr>
                        <tr>
                          <td className="p-3 text-on-surface">Quản lý vấn đề (Issue Tracker)</td>
                          <td className="p-3 font-bold">BIMcollab Cloud</td>
                          <td className="p-3">Kubus</td>
                          <td className="p-3 font-mono">N/A (SaaS)</td>
                        </tr>
                        <tr>
                          <td className="p-3 text-on-surface">Môi trường dữ liệu chung (CDE)</td>
                          <td className="p-3 font-bold">Autodesk Docs</td>
                          <td className="p-3">Autodesk</td>
                          <td className="p-3 font-mono">N/A (SaaS)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {bepSection === 'standards' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 6</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Quy chuẩn Mô hình & Ma trận Yêu cầu Thông tin (LOD/LOIN)</h2>
                    </div>

                    {/* LOD/LOIN sub tabs */}
                    <div className="space-y-4">
                      <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/60 max-w-md">
                        <button
                          onClick={() => setLodCategory('architecture')}
                          className={`flex-1 text-center py-1 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                            lodCategory === 'architecture' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          Kiến trúc (Architectural)
                        </button>
                        <button
                          onClick={() => setLodCategory('structure')}
                          className={`flex-1 text-center py-1 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                            lodCategory === 'structure' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          Kết cấu (Structural)
                        </button>
                        <button
                          onClick={() => setLodCategory('mep')}
                          className={`flex-1 text-center py-1 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                            lodCategory === 'mep' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                          }`}
                        >
                          Cơ điện (MEP)
                        </button>
                      </div>

                      {lodCategory === 'architecture' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                          <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Tiêu chuẩn Cấu kiện Kiến trúc (LODg & LODi)</h3>
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                                <th className="p-2.5">Lớp IFC</th>
                                <th className="p-2.5">LODg (Mô hình 3D hình học)</th>
                                <th className="p-2.5">LODi (Thuộc tính phi hình học bắt buộc)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant">
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Không gian / Phòng (ifcSpace)</td>
                                <td className="p-2.5">Ranh giới mặt bằng thực tế, diện tích thông thủy.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">SpaceID, SpaceName, Area, CeilingHeight, OccupancyType</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Tường và vách (ifcWall)</td>
                                <td className="p-2.5">Độ dày thực tế, các lớp cấu tạo chính tách biệt.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">WallType, FireRating, AcousticRating, ThermalTransmittance</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Cửa đi (ifcDoor)</td>
                                <td className="p-2.5">Khung cửa, cánh cửa mô hình đúng hướng mở, phụ kiện (tay nắm).</td>
                                <td className="p-2.5 font-mono text-[10.5px]">DoorCode, FireRating, Width, Height, MaterialFrame, GlazingType</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {lodCategory === 'structure' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                          <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Tiêu chuẩn Cấu kiện Kết cấu (LODg & LODi)</h3>
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                                <th className="p-2.5">Lớp IFC</th>
                                <th className="p-2.5">LODg (Mô hình 3D hình học)</th>
                                <th className="p-2.5">LODi (Thuộc tính phi hình học bắt buộc)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant">
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Móng / Đài móng (ifcFooting)</td>
                                <td className="p-2.5">Đúng kích thước hình học, cao độ đỉnh móng, lớp lót.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">FootingMark, ConcreteGrade, SoilBearingCapacity, ReinforcementRatio</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Cột (ifcColumn)</td>
                                <td className="p-2.5">Chính xác về tiết diện, phân tầng tại sàn dầm, vai cột đỡ.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">ColumnMark, ConcreteGrade, FireRating, StructuralRole</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Dầm (ifcBeam)</td>
                                <td className="p-2.5">Tiết diện dầm chính xác, độ dốc dầm (nếu có), phân đoạn tại nút giao cột.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">BeamMark, ConcreteGrade, StructuralType, SpanLength</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {lodCategory === 'mep' && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                          <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Tiêu chuẩn Cấu kiện Cơ điện (LODg & LODi)</h3>
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                                <th className="p-2.5">Lớp IFC</th>
                                <th className="p-2.5">LODg (Mô hình 3D hình học)</th>
                                <th className="p-2.5">LODi (Thuộc tính phi hình học bắt buộc)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant">
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Hệ thống cơ điện (ifcDistributionSystem)</td>
                                <td className="p-2.5">Các đường ống, tuyến máng cáp đi đúng cao độ, độ dốc và định vị.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">SystemType, FlowRate, OperatingPressure, PipeDiameter, InsulationThickness</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Thiết bị chính, đầu cuối</td>
                                <td className="p-2.5">Thiết bị (Bơm, AHU, Chiller...) có hình dáng, kích thước tổng thể chính xác.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">EquipmentID, ModelNumber, ElectricalPower, Capacity, Weight</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold text-on-surface">Thông tin vận hành (Hoàn công)</td>
                                <td className="p-2.5">Cập nhật toàn bộ thuộc tính thiết bị đã lắp đặt thực tế.</td>
                                <td className="p-2.5 font-mono text-[10.5px]">SerialNumber, Manufacturer, InstallationDate, WarrantyPeriod, AssetTag</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {bepSection === 'cde' && (
                  <div className="space-y-6">
                    <div className="border-b border-outline-variant/55 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Mục 7</span>
                      <h2 className="text-2xl font-bold text-on-surface tracking-tight mt-0.5">Môi trường dữ liệu chung (CDE) dự án</h2>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      Autodesk Docs được sử dụng làm giải pháp CDE chính thức của dự án. Mọi trao đổi tài liệu, kiểm duyệt và quản lý phiên bản được thực hiện qua các trạng thái ISO 19650 dưới đây:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-outline-variant/50 rounded-xl p-4 space-y-2 bg-surface-container-low/25">
                        <h4 className="font-bold text-xs text-outline uppercase tracking-wider">Mã trạng thái chia sẻ (Shared)</h4>
                        <ul className="text-xs space-y-1.5 text-on-surface-variant font-medium">
                          <li><strong className="text-primary font-mono bg-primary-container px-1 py-0.5 rounded text-[10px]">S1</strong> Phù hợp để phối hợp (coordination)</li>
                          <li><strong className="text-primary font-mono bg-primary-container px-1 py-0.5 rounded text-[10px]">S2</strong> Phù hợp để tham khảo thông tin</li>
                          <li><strong className="text-primary font-mono bg-primary-container px-1 py-0.5 rounded text-[10px]">S3</strong> Phù hợp để xem xét nội bộ Tư vấn BIM</li>
                          <li><strong className="text-primary font-mono bg-primary-container px-1 py-0.5 rounded text-[10px]">S4</strong> Phù hợp để Chủ đầu tư duyệt</li>
                        </ul>
                      </div>
                      <div className="border border-outline-variant/50 rounded-xl p-4 space-y-2 bg-surface-container-low/25">
                        <h4 className="font-bold text-xs text-outline uppercase tracking-wider">Mã trạng thái xuất bản (Published)</h4>
                        <ul className="text-xs space-y-1.5 text-on-surface-variant font-medium">
                          <li><strong className="text-tertiary font-mono bg-tertiary-container px-1 py-0.5 rounded text-[10px]">A1</strong> Đã duyệt PIM tại Thiết kế cơ sở</li>
                          <li><strong className="text-tertiary font-mono bg-tertiary-container px-1 py-0.5 rounded text-[10px]">A2</strong> Đã duyệt PIM tại Thiết kế thi công</li>
                          <li><strong className="text-tertiary font-mono bg-tertiary-container px-1 py-0.5 rounded text-[10px]">CR</strong> Đã duyệt chính thức làm AIM vận hành</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* --- 2. MIDP SUB TAB --- */}
        {activeSubTab === 'midp' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
            {/* KPI Cards (Bento style) */}
            <section className="grid grid-cols-1 md:grid-cols-5 gap-4 shrink-0">
              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <span className="text-xs font-bold text-on-surface-variant">Tổng số tài liệu</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-on-surface font-mono">{stats.total}</span>
                  <span className="text-[10px] text-outline font-bold">tệp tin</span>
                </div>
                <div className="absolute right-3 bottom-3 text-outline/25"><FileText size={48} /></div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <span className="text-xs font-bold text-success">Đã chuyển giao</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-success font-mono">{stats.completed}</span>
                  <span className="text-[10px] text-success/85 font-bold font-mono">({stats.pct}%)</span>
                </div>
                <div className="absolute right-3 bottom-3 text-success/15"><CheckCircle2 size={48} /></div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <span className="text-xs font-bold text-error">Trễ hạn</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-error font-mono">{stats.delayed}</span>
                  <span className="text-[10px] text-error/85 font-bold">cần xử lý</span>
                </div>
                <div className="absolute right-3 bottom-3 text-error/15"><AlertTriangle size={48} /></div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                <span className="text-xs font-bold text-on-surface-variant">Đang chờ / Chưa đến hạn</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-black text-on-surface-variant font-mono">{stats.pending}</span>
                  <span className="text-[10px] text-outline font-bold">tài liệu</span>
                </div>
                <div className="absolute right-3 bottom-3 text-outline/25"><Clock size={48} /></div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden col-span-1">
                <span className="text-xs font-bold text-primary">Tiến độ tổng thể</span>
                <div className="w-full bg-surface-container-high h-2.5 rounded-full mt-3 overflow-hidden border border-outline-variant/20">
                  <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${stats.pct}%` }}></div>
                </div>
                <span className="text-[10.5px] font-bold text-primary mt-2">Mốc tiếp theo: Khối tháp (TOW)</span>
              </div>
            </section>

            {/* Filter and Search Bar */}
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm shrink-0">
              <div className="flex flex-1 w-full gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm mã tệp, mô tả tài liệu..."
                    className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-medium"
                  />
                </div>
                {/* Discipline Filter */}
                <div className="relative">
                  <select
                    value={disciplineFilter}
                    onChange={e => setDisciplineFilter(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-bold text-on-surface-variant focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    <option value="ALL">Bộ môn: Tất cả</option>
                    <option value="STRU">STRU - Kết cấu</option>
                    <option value="ARCH">ARCH - Kiến trúc</option>
                    <option value="HVAC">HVAC - Cơ điện ĐHKK</option>
                    <option value="PLUM">PLUM - Cấp thoát nước</option>
                    <option value="ELEC">ELEC - Điện</option>
                    <option value="FIRE">FIRE - Phòng cháy CC</option>
                    <option value="XXXX">XXXX - Tài liệu chung</option>
                  </select>
                  <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                </div>
                {/* Status Filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="pl-3 pr-8 py-2 bg-surface border border-outline-variant rounded-lg text-xs font-bold text-on-surface-variant focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    <option value="ALL">Trạng thái: Tất cả</option>
                    <option value="completed">Đã chuyển giao</option>
                    <option value="delayed">Trễ hạn</option>
                    <option value="pending">Chưa đến hạn</option>
                  </select>
                  <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm w-full md:w-auto justify-center"
              >
                <Plus size={16} />
                Thêm tài liệu bàn giao (MIDP)
              </button>
            </div>

            {/* MIDP Data Table */}
            <div className="flex-1 min-h-0 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse relative">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold sticky top-0 z-10">
                      <th className="p-3 w-64">Mã tài liệu (ISO 19650)</th>
                      <th className="p-3">Mô tả tài liệu</th>
                      <th className="p-3 w-28">Bộ môn</th>
                      <th className="p-3 w-28">Loại dữ liệu</th>
                      <th className="p-3 w-24">Bên khởi tạo</th>
                      <th className="p-3 w-28">Hạn giao</th>
                      <th className="p-3 w-28">Thực tế</th>
                      <th className="p-3 w-20">Phiên bản</th>
                      <th className="p-3 w-28 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                    {filteredMidp.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-outline">Không tìm thấy tài liệu phù hợp.</td>
                      </tr>
                    ) : (
                      filteredMidp.map(item => (
                        <tr key={item.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-on-surface select-all">{item.id}</td>
                          <td className="p-3 font-semibold text-on-surface">{item.name}</td>
                          <td className="p-3">
                            <span className="bg-surface-container-high text-on-surface px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                              {item.discipline}
                            </span>
                          </td>
                          <td className="p-3">{item.dataType}</td>
                          <td className="p-3 font-bold">{item.originator}</td>
                          <td className="p-3 font-mono">{item.plannedDate}</td>
                          <td className="p-3 font-mono">{item.actualDateLatest || '-'}</td>
                          <td className="p-3 font-mono font-bold">{item.version || '-'}</td>
                          <td className="p-3">
                            <div className="flex justify-center">
                              {item.status === 'completed' && (
                                <span className="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <Check size={10} /> Đã nộp
                                </span>
                              )}
                              {item.status === 'delayed' && (
                                <span className="bg-error/10 text-error border border-error/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <AlertTriangle size={10} /> Trễ hạn
                                </span>
                              )}
                              {item.status === 'pending' && (
                                <span className="bg-outline/10 text-outline border border-outline/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <Clock size={10} /> Chờ nộp
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- ADD DOCUMENT MODAL & NAMING GENERATOR --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[110] p-6 text-on-surface">
          <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" />
                <h3 className="font-bold text-[15px] text-on-surface">Thêm tài liệu chuyển giao mới (MIDP)</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded-full cursor-pointer text-on-surface-variant hover:text-on-surface"
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              {/* Document Description */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Mô tả tài liệu / Tên bản vẽ</label>
                <input
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  placeholder="Ví dụ: Mô hình kết cấu phần thân khối tháp, Bản vẽ MB móng hầm..."
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-medium"
                  required
                />
              </div>

              {/* Naming Generator Section */}
              <div className="border border-outline-variant/60 rounded-xl p-4 bg-surface-container-low/30 space-y-3">
                <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <Settings size={13} />
                  Bộ tạo mã đặt tên tự động (ISO 19650)
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Project */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Mã dự án</label>
                    <select
                      value={namingProject}
                      onChange={e => setNamingProject(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="NO-11">NO-11</option>
                      <option value="25080_NOXH">25080_NOXH</option>
                    </select>
                  </div>
                  {/* Originator */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Bên khởi tạo</label>
                    <select
                      value={namingOriginator}
                      onChange={e => setNamingOriginator(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="CIC">CIC (Tư vấn BIM)</option>
                      <option value="PAY">PAY (Tư vấn thiết kế)</option>
                      <option value="LID">LID (Chủ đầu tư)</option>
                      <option value="FIR">FIR (Phòng cháy)</option>
                    </select>
                  </div>
                  {/* Discipline */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Bộ môn</label>
                    <select
                      value={namingDiscipline}
                      onChange={e => setNamingDiscipline(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="STRU">STRU - Kết cấu</option>
                      <option value="ARCH">ARCH - Kiến trúc</option>
                      <option value="HVAC">HVAC - Thông gió</option>
                      <option value="PLUM">PLUM - Cấp thoát nước</option>
                      <option value="ELEC">ELEC - Điện</option>
                      <option value="FIRE">FIRE - Phòng cháy</option>
                      <option value="FEDE">FEDE - Tổng hợp</option>
                      <option value="XXXX">XXXX - Chung</option>
                    </select>
                  </div>
                  {/* Volume / Building */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Tòa nhà / Hạng mục</label>
                    <select
                      value={namingVolume}
                      onChange={e => setNamingVolume(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="ZZ">ZZ - Tất cả các tòa</option>
                      <option value="CC">CC - Chung cư</option>
                      <option value="NN">NN - Ngoài nhà</option>
                      <option value="XX">XX - Không áp dụng</option>
                    </select>
                  </div>

                  {/* Level Group */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Nhóm tầng</label>
                    <select
                      value={namingLevelGroup}
                      onChange={e => setNamingLevelGroup(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="BAS">BAS - Hầm</option>
                      <option value="POD">POD - Khối đế</option>
                      <option value="TOW">TOW - Khối tháp</option>
                      <option value="ZZZ">ZZZ - Tất cả</option>
                      <option value="XXX">XXX - Không áp dụng</option>
                    </select>
                  </div>

                  {/* Level */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Tầng chi tiết</label>
                    <select
                      value={namingLevel}
                      onChange={e => setNamingLevel(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="ZZ">ZZ - Nhiều tầng</option>
                      <option value="01">01 - Tầng 1</option>
                      <option value="02">02 - Tầng 2</option>
                      <option value="B01">B01 - Hầm 1</option>
                      <option value="B02">B02 - Hầm 2</option>
                      <option value="RO">RO - Mái</option>
                      <option value="XX">XX - Không áp dụng</option>
                    </select>
                  </div>

                  {/* Document Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Loại tài liệu</label>
                    <select
                      value={namingType}
                      onChange={e => setNamingType(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold"
                    >
                      <option value="M3">M3 - Mô hình 3D</option>
                      <option value="DR">DR - Bản vẽ 2D</option>
                      <option value="BQ">BQ - BoQ khối lượng</option>
                      <option value="RP">RP - Báo cáo</option>
                      <option value="PL">PL - Kế hoạch</option>
                      <option value="SP">SP - Chỉ dẫn kỹ thuật</option>
                    </select>
                  </div>

                  {/* Number */}
                  <div>
                    <label className="block text-[10px] font-bold text-outline mb-1">Số thứ tự</label>
                    <input
                      value={namingNumber}
                      onChange={e => setNamingNumber(e.target.value)}
                      className="w-full px-2 py-1 bg-surface border border-outline-variant rounded text-[11px] focus:outline-none focus:border-primary font-semibold font-mono"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                {/* Live Naming Preview */}
                <div className="mt-3 p-3 bg-surface-container-highest rounded-lg border border-outline-variant/60 flex flex-col gap-1 select-all">
                  <span className="text-[9.5px] font-bold text-primary uppercase tracking-wider">Tên tệp tin tự động sinh ra:</span>
                  <span className="font-mono text-[12.5px] font-black text-on-surface select-all">{generatedCode}</span>
                </div>
              </div>

              {/* Planned Date */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Ngày chuyển giao dự kiến (Baseline)</label>
                <input
                  type="date"
                  value={newDocPlannedDate}
                  onChange={e => setNewDocPlannedDate(e.target.value)}
                  className="px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-semibold"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-surface border border-outline-variant hover:bg-surface-container text-on-surface-variant font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Lưu tài liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function OutlineButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
        active
          ? 'bg-primary/10 text-primary font-extrabold shadow-sm'
          : 'text-on-surface-variant hover:bg-surface-container/50 hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );
}

// Helper components
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-outline uppercase tracking-wider">{label}</span>
      <span className="text-xs font-semibold text-on-surface">{value}</span>
    </div>
  );
}

function GoalCard({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-surface-container-low border border-outline-variant/40 rounded-xl">
      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
        {num}
      </div>
      <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">{text}</p>
    </div>
  );
}
