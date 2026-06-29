import React, { useState, useMemo } from 'react';
import {
  FileText, Plus, Search, BookOpen, Settings, CheckCircle2, AlertTriangle,
  Clock, ArrowRight, Download, Edit3, Trash2, Calendar, Shield, Cpu, Layers,
  RefreshCw, Check, AlertCircle
} from 'lucide-react';

interface EirDocument {
  id: string;
  title: string;
  phase: 'basic' | 'technical' | 'detailed' | 'construction';
  version: string;
  createdDate: string;
  status: 'draft' | 'published';
  author: string;
  goals: string[];
  bimUses: { use: string; requirement: 'B' | 'T' | 'K'; description: string }[];
  lodMatrix: { element: string; lod: string; description: string }[];
  deliverables: { data: string; format: string; target: string }[];
  cdeRequirements: string;
}

const PRESET_EIR_TEMPLATES: Record<EirDocument['phase'], Omit<EirDocument, 'id' | 'title' | 'version' | 'createdDate' | 'status' | 'author'>> = {
  basic: {
    phase: 'basic',
    goals: [
      'Định vị ranh giới, địa hình chính xác dựa trên mô hình bối cảnh hiện trạng dự án.',
      'Thiết lập mô hình thiết kế cơ sở đồng bộ sơ bộ giữa các bộ môn (Kiến trúc, Kết cấu, Cơ điện sơ bộ).',
      'Xác thực giải pháp thiết kế đáp ứng quy chuẩn kỹ thuật xây dựng, an toàn PCCC hiện hành.'
    ],
    bimUses: [
      { use: 'Mô hình hiện trạng', requirement: 'B', description: 'Tạo lập mô hình hiện trạng khu đất dựa trên số liệu khảo sát trắc địa.' },
      { use: 'Lập mô hình thiết kế', requirement: 'B', description: 'Dựng mô hình thiết kế cơ sở chứa các thông số hình học khái quát.' },
      { use: 'Xem xét thiết kế', requirement: 'B', description: 'Đánh giá giải pháp thiết kế kiến trúc và công năng trên mô hình 3D.' },
      { use: 'Phối hợp bộ môn', requirement: 'B', description: 'Kiểm tra xung đột không gian lớn giữa kết cấu và các tuyến ống chính.' },
      { use: 'Bóc tách khối lượng', requirement: 'T', description: 'Khai thác khối lượng bê tông, vật liệu chính để dự toán sơ bộ.' }
    ],
    lodMatrix: [
      { element: 'Địa hình (ifcGeographicElement)', lod: 'LOD 200', description: 'Kích thước hình học tương đối, định vị cao độ cơ bản.' },
      { element: 'Cấu kiện kết cấu (Móng, Cột, Dầm, Sàn)', lod: 'LOD 200', description: 'Tiết diện khái quát dạng hình chữ nhật, gán vật liệu cơ bản.' },
      { element: 'Tường, sàn, trần kiến trúc', lod: 'LOD 200', description: 'Độ dày tương đối, chưa phân chia lớp cấu tạo chi tiết.' },
      { element: 'Đường ống chính (MEP)', lod: 'LOD 200', description: 'Dựng các tuyến ống chính trục đứng và hành lang, bỏ qua độ dốc nhỏ.' }
    ],
    deliverables: [
      { data: 'Mô hình Thiết kế Cơ sở', format: 'RVT / IFC', target: 'Nộp thẩm định giải pháp thiết kế cơ sở' },
      { data: 'Bản vẽ 2D xuất từ mô hình', format: 'PDF / DWG', target: 'Hồ sơ xin phép xây dựng & trình duyệt' },
      { data: 'Báo cáo va chạm sơ bộ', format: 'PDF', target: 'Họp thông qua quy hoạch không gian' }
    ],
    cdeRequirements: 'Mọi tài liệu trao đổi được tải lên thư mục 01_WIP và chia sẻ sang 02_SHARED sau khi kiểm duyệt nội bộ.'
  },
  technical: {
    phase: 'technical',
    goals: [
      'Thiết lập mô hình thiết kế kỹ thuật chính xác về kích thước hình học, tiết diện và chủng loại vật liệu.',
      'Phối hợp xử lý các va chạm kỹ thuật lớn giữa các hệ thống kết cấu, kiến trúc và cơ điện.',
      'Trích xuất khối lượng chi tiết làm cơ sở tính toán tổng dự toán và lập hồ sơ mời thầu.'
    ],
    bimUses: [
      { use: 'Lập mô hình thiết kế', requirement: 'B', description: 'Mô hình hóa chi tiết thiết kế kỹ thuật, gán chính xác các thuộc tính vật liệu.' },
      { use: 'Xem xét thiết kế', requirement: 'B', description: 'Đánh giá các giải pháp kỹ thuật, tính toán kết cấu và hệ thống cơ khí.' },
      { use: 'Phối hợp bộ môn', requirement: 'B', description: 'Kiểm tra va chạm cứng và va chạm khoảng cách thông thủy tối thiểu.' },
      { use: 'Bóc tách khối lượng', requirement: 'B', description: 'Trích xuất khối lượng chi tiết từ mô hình phục vụ lập dự toán.' },
      { use: 'Phân tích thiết kế', requirement: 'T', description: 'Chuyển đổi mô hình sang phần mềm phân tích sơ đồ tính kết cấu và năng lượng.' }
    ],
    lodMatrix: [
      { element: 'Cấu kiện kết cấu (Cột, Dầm, Sàn)', lod: 'LOD 300', description: 'Chính xác về kích thước tiết diện, cao độ, độ dốc, gán mác bê tông thực tế.' },
      { element: 'Tường, sàn, trần kiến trúc', lod: 'LOD 300', description: 'Tách biệt các lớp cấu tạo chính, sàn nâng, vách kính hệ khung đố.' },
      { element: 'Đường ống MEP', lod: 'LOD 300', description: 'Mô hình đầy đủ đường ống, van, phụ kiện với kích thước và độ dốc chính xác.' },
      { element: 'Thiết bị cơ điện chính', lod: 'LOD 300', description: 'Kích thước bao ngoài chính xác để kiểm soát không gian lắp đặt.' }
    ],
    deliverables: [
      { data: 'Mô hình Thiết kế Kỹ thuật', format: 'RVT / IFC', target: 'Thẩm định hồ sơ thiết kế kỹ thuật' },
      { data: 'Bản vẽ chi tiết thiết kế kỹ thuật', format: 'PDF / DWG', target: 'Hồ sơ trình duyệt kỹ thuật' },
      { data: 'Bảng tiên lượng khối lượng BoQ', format: 'xlsx', target: 'Lập dự toán thầu và hồ sơ mời thầu' }
    ],
    cdeRequirements: 'Các mô hình bộ môn phải được đồng bộ hàng tuần lên CDE để chạy báo cáo xung đột va chạm.'
  },
  detailed: {
    phase: 'detailed',
    goals: [
      'Xây dựng mô hình thiết kế bản vẽ thi công (TKBVTC) chi tiết phục vụ lắp dựng ngoài hiện trường.',
      'Giải quyết triệt để 100% va chạm hình học giữa các bộ môn (dung sai va chạm cứng dưới 10mm).',
      'Mô hình hóa chi tiết các liên kết, lỗ mở kỹ thuật xuyên kết cấu phục vụ công tác chế tạo.'
    ],
    bimUses: [
      { use: 'Lập mô hình thiết kế', requirement: 'B', description: 'Mô hình hóa chi tiết đến mức độ bản vẽ thi công và Shop Drawing.' },
      { use: 'Phối hợp bộ môn', requirement: 'B', description: 'Điều phối đa bộ môn chi tiết, xử lý va chạm hành lang ống kỹ thuật.' },
      { use: 'Bóc tách khối lượng', requirement: 'B', description: 'Trích xuất khối lượng chính xác tuyệt đối phục vụ đặt hàng vật tư.' },
      { use: 'Chế tạo (Fabrication)', requirement: 'T', description: 'Xuất dữ liệu mô hình phục vụ gia công cấu kiện thép, cắt ống MEP tự động.' },
      { use: 'Quản lý tiến độ', requirement: 'T', description: 'Liên kết mô hình với tiến độ Microsoft Project để mô phỏng thi công 4D.' }
    ],
    lodMatrix: [
      { element: 'Kết cấu bê tông & Cốt thép', lod: 'LOD 350', description: 'Mô hình lỗ mở kỹ thuật xuyên tường/dầm/sàn, chi tiết thép tăng cường tại nút giao.' },
      { element: 'Khung đố vách kính & Cửa', lod: 'LOD 350', description: 'Tiết diện khung gần chính xác, mô hình phụ kiện cửa (tay nắm, bản lề).' },
      { element: 'Đường ống MEP & Bảo ôn', lod: 'LOD 350', description: 'Đầy đủ co cút, tê thu, mặt bích, giá treo (support) và lớp cách nhiệt.' },
      { element: 'Thiết bị cơ điện đầu cuối', lod: 'LOD 350', description: 'Kích thước chính xác theo catalogue nhà sản xuất được duyệt.' }
    ],
    deliverables: [
      { data: 'Mô hình Thiết kế Bản vẽ Thi công', format: 'RVT / IFC', target: 'Phê duyệt hồ sơ bản vẽ thi công lắp đặt' },
      { data: 'Bản vẽ Shop Drawing trích xuất', format: 'PDF / DWG', target: 'Bản vẽ phát hành thi công tại công trường (AFC)' },
      { data: 'Báo cáo va chạm chi tiết và giải pháp', format: 'PDF / BCF', target: 'Hồ sơ nghiệm thu thiết kế điều phối' }
    ],
    cdeRequirements: 'Mọi bản vẽ thi công được duyệt sẽ được xuất bản vào thư mục 03_PUBLISHED trên CDE để thi công ngoài hiện trường.'
  },
  construction: {
    phase: 'construction',
    goals: [
      'Ứng dụng mô hình phục vụ quản lý mặt bằng công trường, biện pháp thi công và tiến độ thực tế.',
      'Cập nhật chính xác các hiệu chỉnh và sai lệch thi công hiện trường vào mô hình hoàn công.',
      'Tích hợp thông tin phi hình học vận hành bảo trì (LODi/COBie) phục vụ quản lý tài sản tòa nhà.'
    ],
    bimUses: [
      { use: 'Mô hình hoàn công', requirement: 'B', description: 'Dựng mô hình hoàn công phản ánh đúng thực tế xây dựng tại công trường.' },
      { use: 'Quản lý tiến độ (4D)', requirement: 'B', description: 'Theo dõi tiến độ thực tế so với kế hoạch trực quan trên mô hình.' },
      { use: 'Quản lý tài sản (Asset Management)', requirement: 'B', description: 'Nhập thông số vận hành thiết bị phục vụ công tác bàn giao.' },
      { use: 'Lập kế hoạch bảo trì', requirement: 'T', description: 'Thiết lập lịch bảo dưỡng định kỳ tích hợp trên cấu kiện hoàn công.' }
    ],
    lodMatrix: [
      { element: 'Kết cấu hoàn công', lod: 'LOD 500', description: 'Mô hình hình học thực tế lắp dựng, cập nhật các thay đổi thiết kế hiện trường.' },
      { element: 'Thiết bị cơ điện hoàn công', lod: 'LOD 500', description: 'Tích hợp thông số: Số sê-ri, Hãng sản xuất, Ngày lắp đặt, Hạn bảo hành.' },
      { element: 'Không gian / Phòng hoàn công', lod: 'LOD 500', description: 'Cập nhật chính xác diện tích hoàn công, sơ đồ phân bổ vị trí phòng.' }
    ],
    deliverables: [
      { data: 'Mô hình thông tin tài sản (AIM)', format: 'RVT / IFC', target: 'Bàn giao cho Chủ đầu tư phục vụ quản lý vận hành tòa nhà' },
      { data: 'Hồ sơ bản vẽ hoàn công', format: 'PDF', target: 'Nghiệm thu hoàn thành công trình đưa vào sử dụng' },
      { data: 'Bảng thuộc tính thiết bị COBie', format: 'xlsx', target: 'Nhập liệu vào hệ thống quản lý tài sản CMMS/FM' }
    ],
    cdeRequirements: 'Mô hình hoàn công cuối cùng được lưu trữ đóng băng tại thư mục 04_ARCHIVED làm tài sản dữ liệu trọn đời.'
  }
};

export function EirTab() {
  const [eirList, setEirList] = useState<EirDocument[]>([
    {
      id: 'EIR-NO11-001',
      title: 'Yêu cầu trao đổi thông tin Giai đoạn Thiết kế Cơ sở (TKCS)',
      phase: 'basic',
      version: 'V1.0',
      createdDate: '12/03/2026',
      status: 'published',
      author: 'Ban QLDA LIDECO',
      ...PRESET_EIR_TEMPLATES.basic
    },
    {
      id: 'EIR-NO11-002',
      title: 'Yêu cầu trao đổi thông tin Giai đoạn Thiết kế Kỹ thuật (TKKT)',
      phase: 'technical',
      version: 'V1.0',
      createdDate: '25/03/2026',
      status: 'published',
      author: 'Ban QLDA LIDECO',
      ...PRESET_EIR_TEMPLATES.technical
    },
    {
      id: 'EIR-NO11-003',
      title: 'Yêu cầu trao đổi thông tin Giai đoạn Thiết kế Bản vẽ Thi công (TKBVTC)',
      phase: 'detailed',
      version: 'V1.0',
      createdDate: '08/04/2026',
      status: 'published',
      author: 'Ban QLDA LIDECO',
      ...PRESET_EIR_TEMPLATES.detailed
    },
    {
      id: 'EIR-NO11-004',
      title: 'Yêu cầu trao đổi thông tin Giai đoạn Thi công & Hoàn công (Thi công)',
      phase: 'construction',
      version: 'V1.0',
      createdDate: '28/04/2026',
      status: 'published',
      author: 'Ban QLDA LIDECO',
      ...PRESET_EIR_TEMPLATES.construction
    }
  ]);

  const [activeEirId, setActiveEirId] = useState<string>('EIR-NO11-003');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for creating new EIR
  const [formTitle, setFormTitle] = useState('');
  const [formPhase, setFormPhase] = useState<EirDocument['phase']>('detailed');
  const [formVersion, setFormVersion] = useState('V1.0');

  const selectedEir = useMemo(() => {
    return eirList.find(e => e.id === activeEirId) || eirList[0];
  }, [eirList, activeEirId]);

  const filteredEirList = useMemo(() => {
    return eirList.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [eirList, searchQuery]);

  const handleCreateEir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const presetData = PRESET_EIR_TEMPLATES[formPhase];
    const newEir: EirDocument = {
      id: `EIR-NO11-${String(eirList.length + 1).padStart(3, '0')}`,
      title: formTitle,
      phase: formPhase,
      version: formVersion,
      createdDate: new Date().toLocaleDateString('vi-VN'),
      status: 'draft',
      author: 'Ban QLDA LIDECO (Chủ đầu tư)',
      ...presetData
    };

    setEirList(prev => [newEir, ...prev]);
    setActiveEirId(newEir.id);
    setIsCreateModalOpen(false);
    setFormTitle('');
  };

  const handlePublishEir = (id: string) => {
    setEirList(prev => prev.map(e => e.id === id ? { ...e, status: 'published' } : e));
  };

  const handleDeleteEir = (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản yêu cầu thông tin EIR này?')) return;
    setEirList(prev => prev.filter(e => e.id !== id));
    if (activeEirId === id && eirList.length > 1) {
      setActiveEirId(eirList.filter(e => e.id !== id)[0].id);
    }
  };

  const phaseLabel = (phase: EirDocument['phase']) => {
    switch (phase) {
      case 'basic': return 'Thiết kế Cơ sở (TKCS)';
      case 'technical': return 'Thiết kế Kỹ thuật (TKKT)';
      case 'detailed': return 'Thiết kế Bản vẽ Thi công (TKBVTC)';
      case 'construction': return 'Giai đoạn Thi công & Hoàn công';
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface text-on-surface">
      {/* Left Sidebar: EIR List */}
      <aside className="w-[300px] border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Danh sách EIR</h3>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/95 text-on-primary font-bold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
            >
              <Plus size={14} />
              Tạo mới EIR
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm EIR..."
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-medium"
            />
          </div>
        </div>

        {/* Sidebar List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredEirList.map(e => (
            <div
              key={e.id}
              onClick={() => setActiveEirId(e.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                selectedEir?.id === e.id
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-surface hover:bg-surface-container/40 border-outline-variant/60 text-on-surface-variant'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-bold text-xs leading-tight line-clamp-2">{e.title}</span>
                {e.status === 'published' ? (
                  <span className="bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                    Đã ban hành
                  </span>
                ) : (
                  <span className="bg-outline/10 text-outline border border-outline/20 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0">
                    Bản nháp
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-outline font-medium mt-1">
                <span className="font-semibold text-primary">{phaseLabel(e.phase)}</span>
                <span className="font-mono">{e.createdDate}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right Content Area: Detailed EIR Document */}
      {selectedEir ? (
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest/20">
          <div className="max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-8 space-y-6">
            
            {/* Document Header */}
            <div className="border-b border-outline-variant/60 pb-5 flex justify-between items-start gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-primary-container text-primary px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                    {selectedEir.id}
                  </span>
                  <span className="bg-surface-container-high text-on-surface-variant px-2.5 py-0.5 rounded-full text-xs font-bold">
                    Mã phiên bản: {selectedEir.version}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-on-surface tracking-tight leading-tight">
                  {selectedEir.title}
                </h1>
                <p className="text-xs text-outline font-medium">
                  Người lập: <span className="text-on-surface-variant font-bold">{selectedEir.author}</span> • Ngày ban hành: <span className="text-on-surface-variant font-bold">{selectedEir.createdDate}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {selectedEir.status === 'draft' && (
                  <button
                    onClick={() => handlePublishEir(selectedEir.id)}
                    className="bg-success hover:bg-success/95 text-on-success font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Check size={14} /> Ban hành
                  </button>
                )}
                <button
                  onClick={() => handleDeleteEir(selectedEir.id)}
                  className="p-2 hover:bg-error-container/20 border border-outline-variant hover:border-error/30 text-outline hover:text-error rounded-lg transition-colors cursor-pointer"
                  title="Xóa EIR này"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Section 1: Goals */}
            <div className="space-y-3">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                I. Mục đích & Mục tiêu quản lý thông tin
              </h3>
              <ul className="list-disc list-inside text-xs leading-relaxed text-on-surface-variant space-y-2 pl-2">
                {selectedEir.goals.map((g, i) => (
                  <li key={i} className="font-medium">{g}</li>
                ))}
              </ul>
            </div>

            {/* Section 2: BIM Uses */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-2">
                <Cpu size={16} className="text-primary" />
                II. Danh mục Ứng dụng BIM yêu cầu
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                      <th className="p-2.5">Tên Ứng dụng</th>
                      <th className="p-2.5 text-center w-24">Yêu cầu</th>
                      <th className="p-2.5">Mô tả mục tiêu chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                    {selectedEir.bimUses.map((use, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/15 transition-colors">
                        <td className="p-2.5 text-on-surface font-semibold">{use.use}</td>
                        <td className="p-2.5 text-center">
                          {use.requirement === 'B' && (
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] font-black">
                              BẮT BUỘC
                            </span>
                          )}
                          {use.requirement === 'T' && (
                            <span className="bg-outline/10 text-outline border border-outline/20 px-2 py-0.5 rounded text-[10px] font-black">
                              TÙY CHỌN
                            </span>
                          )}
                          {use.requirement === 'K' && (
                            <span className="bg-error/10 text-error border border-error/20 px-2 py-0.5 rounded text-[10px] font-black">
                              KHÔNG ÁP DỤNG
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11.5px] leading-relaxed">{use.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: LOD Matrix */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                III. Mức độ chi tiết thông tin yêu cầu (LOD/LOIN)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                      <th className="p-2.5">Tên Cấu kiện</th>
                      <th className="p-2.5 text-center w-28">Mức độ LOD</th>
                      <th className="p-2.5">Yêu cầu chi tiết hình học & phi hình học</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                    {selectedEir.lodMatrix.map((lod, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/15 transition-colors">
                        <td className="p-2.5 text-on-surface font-semibold">{lod.element}</td>
                        <td className="p-2.5 text-center">
                          <span className="bg-primary-container text-primary px-2.5 py-0.5 rounded-full text-[10.5px] font-black font-mono">
                            {lod.lod}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11.5px] leading-relaxed">{lod.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Deliverables */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                IV. Định dạng dữ liệu và Sản phẩm bàn giao
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                      <th className="p-2.5">Sản phẩm bàn giao</th>
                      <th className="p-2.5 w-32">Định dạng tệp</th>
                      <th className="p-2.5">Mục đích bàn giao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                    {selectedEir.deliverables.map((d, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/15 transition-colors">
                        <td className="p-2.5 text-on-surface font-semibold">{d.data}</td>
                        <td className="p-2.5 font-mono text-primary font-bold text-[11px]">{d.format}</td>
                        <td className="p-2.5 text-[11.5px] leading-relaxed">{d.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 5: CDE Requirements */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-[14px] text-on-surface flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                V. Yêu cầu về môi trường trao đổi dữ liệu CDE
              </h3>
              <p className="text-xs leading-relaxed text-on-surface-variant bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/30 font-medium">
                {selectedEir.cdeRequirements}
              </p>
            </div>

          </div>
        </main>
      ) : (
        <div className="flex-1 flex items-center justify-center text-outline font-medium text-xs">
          Không có tài liệu EIR nào được chọn hoặc khởi tạo.
        </div>
      )}

      {/* CREATE NEW EIR MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[110] p-6 text-on-surface">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                <h3 className="font-bold text-[15px] text-on-surface">Tạo Yêu cầu thông tin mới (EIR)</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded-full cursor-pointer text-on-surface-variant hover:text-on-surface"
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateEir} className="p-5 space-y-4">
              {/* EIR Title */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Tên tài liệu EIR</label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Yêu cầu trao đổi thông tin Giai đoạn Thiết kế Kỹ thuật"
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-medium"
                  required
                />
              </div>

              {/* Phase Selection */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Giai đoạn dự án (Mốc EIR)</label>
                <select
                  value={formPhase}
                  onChange={e => setFormPhase(e.target.value as EirDocument['phase'])}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-semibold text-on-surface-variant appearance-none cursor-pointer"
                >
                  <option value="basic">Thiết kế Cơ sở (TKCS)</option>
                  <option value="technical">Thiết kế Kỹ thuật (TKKT)</option>
                  <option value="detailed">Thiết kế Bản vẽ Thi công (TKBVTC)</option>
                  <option value="construction">Thi công & Hoàn công (Thi công)</option>
                </select>
              </div>

              {/* Version */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Mã phiên bản (Version)</label>
                <input
                  value={formVersion}
                  onChange={e => setFormVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-semibold font-mono"
                  required
                />
              </div>

              {/* Alert note */}
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <AlertCircle size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10.5px] leading-relaxed text-on-surface-variant font-medium">
                  Hệ thống sẽ tự động điền các thông số kỹ thuật, ứng dụng BIM và ma trận LOD mẫu chuẩn dựa trên giai đoạn bạn đã chọn, làm cơ sở pháp lý để bên Tư vấn thiết kế lập BEP.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-surface border border-outline-variant hover:bg-surface-container text-on-surface-variant font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Tạo tài liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
