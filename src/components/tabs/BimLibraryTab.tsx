import React, { useState, useMemo } from 'react';
import {
  Search, BookOpen, Layers, Shield, Cpu, Settings, FileText, Download,
  CheckCircle2, Info, ArrowRight, ChevronRight, ChevronDown, ListFilter,
  ExternalLink, HelpCircle, AlertCircle
} from 'lucide-react';
import lodDataRaw from '../../data/lod_spec_data.json';

interface LodItem {
  level: number | null;
  uniformat: string;
  omniclass: string;
  uniclass: string;
  name: string;
  lod: {
    sd: string;
    dd: string;
    cd: string;
    cost: string;
    bid: string;
    leed: string;
    mep: string;
    ops: string;
  };
}

const lodData = lodDataRaw as LodItem[];

// Dictionary to translate Uniformat terms to Vietnamese
const translateElementName = (name: string): string => {
  const upperName = name.toUpperCase().trim();
  
  // Direct exact matches
  const exactMatches: Record<string, string> = {
    'OFFICE RESOURCES': 'TÀI NGUYÊN VĂN PHÒNG',
    'OFFICE MODEL TEMPLATES': 'Mẫu Mô hình Văn phòng',
    'MODEL CONTENT': 'Nội dung Mô hình',
    'MODEL ANNOTATION CONTENT': 'Nội dung Chú thích Mô hình',
    'PROPERTIES': 'Thuộc tính Thông tin',
    'ZONES/ROOMS/SPACES': 'Phân vùng / Phòng / Không gian',
    'SYMBOLS': 'Ký hiệu / Thư viện ký hiệu',
    'HORIZONTAL GRIDS': 'Hệ lưới trục ngang',
    'VERTICAL LEVELS': 'Hệ cao độ đứng',
    'SUBSTRUCTURE': 'KẾT CẤU MÓNG & PHẦN NGẦM',
    'FOUNDATIONS': 'Hệ thống Móng công trình',
    'STANDARD FOUNDATIONS': 'Móng tiêu chuẩn (Móng đơn/Móng băng)',
    'SPECIAL FOUNDATIONS': 'Móng đặc biệt (Móng cọc/Móng bè)',
    'SLAB ON GRADE': 'Sàn trên nền đất',
    'SHELL': 'KẾT CẤU THÂN & VỎ BAO CHE',
    'SUPERSTRUCTURE': 'Kết cấu phần thân công trình',
    'FLOOR CONSTRUCTION': 'Cấu tạo bản sàn & dầm sàn',
    'ROOF CONSTRUCTION': 'Cấu tạo mái & hệ khung mái',
    'EXTERIOR ENCLOSURE': 'Kết cấu bao che bên ngoài',
    'EXTERIOR WALLS': 'Tường bao che ngoài nhà',
    'EXTERIOR WINDOWS': 'Hệ thống Cửa sổ ngoài nhà',
    'EXTERIOR DOORS': 'Hệ thống Cửa đi ngoài nhà',
    'INTERIORS': 'HỆ THỐNG NỘI THẤT & NGĂN CHIA',
    'INTERIOR CONSTRUCTION': 'Cấu tạo ngăn chia bên trong',
    'INTERIOR WALLS': 'Tường ngăn trong nhà',
    'INTERIOR DOORS': 'Cửa đi trong nhà',
    'FITTINGS': 'Thiết bị cố định & Nội thất',
    'SERVICES': 'HỆ THỐNG KỸ THUẬT TÒA NHÀ (MEP)',
    'CONVEYING': 'Hệ thống Vận chuyển (Thang máy)',
    'PLUMBING': 'Hệ thống Cấp thoát nước',
    'DOMESTIC WATER DISTRIBUTION': 'Hệ thống Cấp nước sinh hoạt',
    'SANITARY WASTE': 'Hệ thống Thoát nước thải',
    'RAIN WATER DRAINAGE': 'Hệ thống Thoát nước mưa',
    'HVAC': 'Hệ thống Điều hòa & Thông gió (HVAC)',
    'FIRE PROTECTION': 'Hệ thống Phòng cháy chữa cháy (PCCC)',
    'FIRE SUPPRESSION': 'Hệ thống Dập lửa (Sprinkler/Vách tường)',
    'ELECTRICAL': 'Hệ thống Điện & Chiếu sáng',
    'ELECTRICAL SERVICE & DISTRIBUTION': 'Trạm biến áp & Tủ điện phân phối',
    'LIGHTING AND BRANCH WIRING': 'Hệ thống Chiếu sáng & Dây dẫn nhánh',
    'COMMUNICATIONS': 'Hệ thống Thông tin liên lạc / Điện nhẹ',
    'SUBSTRUCTURE RELATED ACTIVITIES': 'Công tác chuẩn bị phần ngầm',
    'WATER AND GAS MITIGATION': 'Hệ thống chống thấm & chống khí gas',
    'SUBGRADE ENCLOSURES': 'Tường vây tầng hầm',
    'SLABS-ON-GRADE': 'Bản sàn trên nền đất',
  };

  if (exactMatches[upperName]) {
    return exactMatches[upperName];
  }

  // Fallback translating common words
  let translated = name;
  const wordReplacements: [RegExp, string][] = [
    [/Foundations/gi, 'Hệ móng'],
    [/Foundation/gi, 'Móng'],
    [/Walls/gi, 'Tường'],
    [/Wall/gi, 'Tường'],
    [/Columns/gi, 'Cột'],
    [/Column/gi, 'Cột'],
    [/Beams/gi, 'Dầm'],
    [/Beam/gi, 'Dầm'],
    [/Slabs/gi, 'Sàn'],
    [/Slab/gi, 'Sàn'],
    [/Piping/gi, 'Đường ống'],
    [/Pipe/gi, 'Ống nước'],
    [/Exterior/gi, 'ngoài nhà'],
    [/Interior/gi, 'trong nhà'],
    [/Construction/gi, 'Cấu tạo'],
    [/Electrical/gi, 'Hệ điện'],
    [/Water/gi, 'Nước'],
  ];

  for (const [regex, replacement] of wordReplacements) {
    translated = translated.replace(regex, replacement);
  }

  return translated;
};

// Detailed Vietnamese translations for core elements
interface DetailedLodSpec {
  nameVi: string;
  specs: Record<string, { desc: string; svg: React.ReactNode }>;
}

const CORE_LOD_SPECS: Record<string, DetailedLodSpec> = {
  'A1010': {
    nameVi: 'Móng đơn giản (Móng đơn/Móng băng)',
    specs: {
      '100': {
        desc: 'Mô tả dạng khối (massing) sơ bộ thể hiện vị trí chung và khu vực chiếm đất của hệ móng. Chưa xác định chiều sâu chôn móng hay kích thước cụ thể.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 100: Translucent 3D massing box */}
            <polygon points="100,40 150,65 100,90 50,65" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3" />
            <polygon points="50,65 100,90 100,150 50,125" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3" />
            <polygon points="100,90 150,65 150,125 100,150" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Khối chiếm chỗ sơ bộ (3D Massing)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô tả hình học thô của móng (đế móng dạng hộp chữ nhật). Thể hiện kích thước rộng/dài sơ bộ, cao độ đặt móng khái quát. Vật liệu giả định là Bê tông.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: Solid 3D Footing block with shading */}
            <polygon points="100,70 160,95 100,120 40,95" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="40,95 100,120 100,150 40,125" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="100,120 160,95 160,125 100,150" fill="currentColor" fillOpacity="0.65" stroke="currentColor" strokeWidth="1.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Hình khối 3D đế móng thô</text>
          </svg>
        )
      },
      '300': {
        desc: 'Mô hình hóa kích thước chính xác đài móng và cổ cột kết nối. Xác định đúng cao độ đỉnh móng, chiều sâu chôn móng thực tế và mác bê tông thiết kế.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Pedestal + 3D Footing block */}
            {/* Pedestal (Cổ cột) */}
            <polygon points="100,30 125,42 100,55 75,42" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="75,42 100,55 100,90 75,77" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="100,55 125,42 125,77 100,90" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.2" />
            {/* Footing (Đế móng) */}
            <polygon points="100,90 165,115 100,140 35,115" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="35,115 100,140 100,165 35,140" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="100,140 165,115 165,140 100,165" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )
      },
      '350': {
        desc: 'Đầy đủ kích thước đài móng, cổ cột. Mô hình hóa thêm các lỗ mở kỹ thuật xuyên móng, chi tiết thép neo chờ nhô lên cổ cột và bản mã thép liên kết dầm giằng móng.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: 3D Pedestal + Footing + Rebar Starters + 3D Pipe Sleeve */}
            {/* Rebar Starters (Thép chờ nhô lên cổ cột) */}
            <line x1="88" y1="36" x2="88" y2="20" stroke="#ef4444" strokeWidth="2" />
            <line x1="97" y1="41" x2="97" y2="25" stroke="#ef4444" strokeWidth="2" />
            <line x1="103" y1="41" x2="103" y2="25" stroke="#ef4444" strokeWidth="2" />
            <line x1="112" y1="36" x2="112" y2="20" stroke="#ef4444" strokeWidth="2" />
            {/* Pedestal */}
            <polygon points="100,40 125,52 100,65 75,52" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="75,52 100,65 100,100 75,87" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="100,65 125,52 125,87 100,100" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.2" />
            {/* Footing */}
            <polygon points="100,100 165,125 100,150 35,125" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="35,125 100,150 100,175 35,150" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="100,150 165,125 165,150 100,175" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.5" />
            {/* 3D Pipe Sleeve (Lỗ mở kỹ thuật 3D xuyên móng) */}
            <path d="M 50,138 L 50,144 A 6,3 0 0 0 60,144 L 60,138 A 6,3 0 0 0 50,138 Z" fill="#1e293b" stroke="currentColor" strokeWidth="1" />
            <ellipse cx="55" cy="138" rx="5" ry="2.5" fill="#334155" />
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết cốt thép đan bên trong đài móng (thép lớp dưới, thép lớp trên), lồng thép cổ cột, thép đai cổ móng và các cấu kiện chôn sẵn phục vụ đổ bê tông.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: Transparent 3D Concrete Wireframe + Internal 3D Rebar Cage */}
            {/* Pedestal wireframe */}
            <polygon points="100,40 125,52 100,65 75,52" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="75,52 100,65 100,100 75,87" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="100,65 125,52 125,87 100,100" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            {/* Footing wireframe */}
            <polygon points="100,100 165,125 100,150 35,125" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="35,125 100,150 100,175 35,150" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="100,150 165,125 165,150 100,175" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            {/* 3D Rebars */}
            <line x1="85" y1="30" x2="85" y2="130" stroke="#ef4444" strokeWidth="1.5" />
            <line x1="95" y1="35" x2="95" y2="135" stroke="#ef4444" strokeWidth="1.5" />
            <line x1="105" y1="35" x2="105" y2="135" stroke="#ef4444" strokeWidth="1.5" />
            <line x1="115" y1="30" x2="115" y2="130" stroke="#ef4444" strokeWidth="1.5" />
            {/* 3D Stirrups (Thép đai 3D) */}
            <polygon points="85,60 115,60 108,68 78,68" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <polygon points="85,85 115,85 108,93 78,93" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            {/* Bottom 3D Mesh */}
            <line x1="45" y1="138" x2="155" y2="138" stroke="#ef4444" strokeWidth="1" />
            <line x1="50" y1="144" x2="150" y2="144" stroke="#ef4444" strokeWidth="1" />
            <line x1="55" y1="150" x2="145" y2="150" stroke="#ef4444" strokeWidth="1" />
            <line x1="60" y1="156" x2="140" y2="156" stroke="#ef4444" strokeWidth="1" />
            {/* Cross mesh lines */}
            <line x1="60" y1="125" x2="110" y2="165" stroke="#ef4444" strokeWidth="1" />
            <line x1="80" y1="125" x2="130" y2="165" stroke="#ef4444" strokeWidth="1" />
            <line x1="100" y1="125" x2="150" y2="165" stroke="#ef4444" strokeWidth="1" />
          </svg>
        )
      }
    }
  },
  'A2010': {
    nameVi: 'Tường vây tầng hầm (Subgrade Enclosures)',
    specs: {
      '100': {
        desc: 'Mô tả dạng tấm phẳng sơ bộ định vị ranh giới ngoài của tầng hầm. Chưa có chi tiết chiều dày hay liên kết.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 100: 3D perspective line wall */}
            <polygon points="30,80 170,50 170,120 30,150" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Đường biên hầm 3D sơ bộ (LOD 100)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô hình hóa tường vây dạng khối phẳng 3D có chiều dày sơ bộ, xác định chiều sâu đào hầm và cao độ đáy hầm khái quát.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: Solid 3D Wall with thickness */}
            {/* Top Face (Mặt trên thể hiện chiều dày) */}
            <polygon points="30,75 160,50 170,53 40,78" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            {/* Front Face (Mặt trước tường) */}
            <polygon points="30,75 40,78 40,148 30,145" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1" />
            {/* Right Face (Mặt bên phải tường vây nghiêng) */}
            <polygon points="40,78 170,53 170,123 40,148" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Tường vây 3D (Độ dày sơ bộ)</text>
          </svg>
        )
      },
      '300': {
        desc: 'Chiều dày tường vây chính xác. Xác định đúng cao độ đỉnh tường, đáy tường vây thực tế, vị trí các mạch ngừng thi công phân đoạn.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Wall with exact thickness and a joint line */}
            <polygon points="30,70 160,45 170,48 40,73" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            <polygon points="30,70 40,73 40,143 30,140" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1" />
            <polygon points="40,73 170,48 170,118 40,143" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
            {/* 3D Joint Line (Đường mạch ngừng 3D) */}
            <line x1="105" y1="60" x2="105" y2="130" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Kích thước 3D chuẩn xác + Mạch ngừng</text>
          </svg>
        )
      },
      '350': {
        desc: 'Mô hình hóa hệ dầm mũ tường vây (capping beam), băng cản nước (waterstop) tại mạch ngừng, và các lỗ mở kỹ thuật xuyên tường hầm cho ống MEP thoát nước.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: 3D Wall with Capping beam (Dầm mũ 3D) and 3D Pipe sleeve */}
            {/* Wall */}
            <polygon points="40,80 170,55 170,125 40,150" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
            {/* Capping Beam (Khối dầm mũ 3D nhô ra ở đỉnh) */}
            <polygon points="35,65 165,40 175,43 45,68" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            <polygon points="35,65 45,68 45,83 35,80" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1" />
            <polygon points="45,68 175,43 175,58 45,83" fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.5" />
            {/* Waterstop (Băng cản nước màu đỏ) */}
            <line x1="105" y1="80" x2="105" y2="148" stroke="#ef4444" strokeWidth="2.5" />
            {/* 3D Pipe Sleeve (Lỗ mở kỹ thuật 3D) */}
            <ellipse cx="80" cy="115" rx="5" ry="8" fill="#1e293b" stroke="currentColor" strokeWidth="1" />
            <path d="M 80,107 Q 87,112 80,117" fill="none" stroke="currentColor" strokeWidth="1" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Dầm mũ 3D + Băng cản nước + Lỗ mở</text>
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết lồng cốt thép tường vây, thép dầm đỉnh và hệ thống neo đất (ground anchors) hoặc hệ shoring thép hình chống đỡ tạm thời.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: Wireframe Wall + 3D Rebar Cage + 3D Ground Anchor */}
            {/* Wireframe Wall */}
            <polygon points="30,70 160,45 170,48 40,73" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="30,70 40,73 40,143 30,140" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="40,73 170,48 170,118 40,143" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            {/* Rebar Grid */}
            <line x1="50" y1="71" x2="50" y2="141" stroke="#ef4444" strokeWidth="1.2" />
            <line x1="80" y1="65" x2="80" y2="135" stroke="#ef4444" strokeWidth="1.2" />
            <line x1="110" y1="59" x2="110" y2="129" stroke="#ef4444" strokeWidth="1.2" />
            <line x1="140" y1="53" x2="140" y2="123" stroke="#ef4444" strokeWidth="1.2" />
            {/* Horizontal Rebars */}
            <line x1="40" y1="85" x2="160" y2="60" stroke="#ef4444" strokeWidth="1" />
            <line x1="40" y1="110" x2="160" y2="85" stroke="#ef4444" strokeWidth="1" />
            {/* Ground Anchor 3D (Neo đất 3D xuyên tường vây) */}
            {/* Anchor Head */}
            <polygon points="90,92 100,94 98,102 88,100" fill="#f59e0b" stroke="currentColor" strokeWidth="1" />
            {/* Anchor Free Length (Cáp neo đất kéo dài ra sau) */}
            <line x1="94" y1="96" x2="180" y2="135" stroke="#f59e0b" strokeWidth="2.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Lưới thép 3D & Neo đất phụ trợ</text>
          </svg>
        )
      }
    }
  },
  'A4010': {
    nameVi: 'Bản sàn trên nền đất (Slabs-on-Grade)',
    specs: {
      '100': {
        desc: 'Mô tả diện tích sàn nền dưới dạng mặt phẳng phẳng 2D định vị ranh giới đổ sàn.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 100: Perspective flat outline */}
            <polygon points="30,70 170,70 140,140 60,140" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Diện tích sàn 3D sơ bộ (LOD 100)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô hình hóa bản sàn dạng tấm 3D có chiều dày sơ bộ, cao độ hoàn thiện sàn giả định.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: Truly 3D Volumetric Slab Block */}
            {/* Top Face */}
            <polygon points="30,75 170,75 140,125 60,125" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.2" />
            {/* Front Face (Shows thickness) */}
            <polygon points="60,125 140,125 140,145 60,145" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.2" />
            {/* Right Face (Shows thickness) */}
            <polygon points="140,125 170,75 170,95 140,145" fill="currentColor" fillOpacity="0.65" stroke="currentColor" strokeWidth="1.2" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Tấm sàn 3D (Chiều dày thô 150mm)</text>
          </svg>
        )
      },
      '300': {
        desc: 'Chiều dày bản sàn chính xác. Cao độ hoàn thiện thực tế, định vị chính xác các khe co giãn nhiệt (control joints) và khe lún.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Volumetric Slab with thickness and joint cuts */}
            {/* Top Face */}
            <polygon points="30,75 170,75 140,125 60,125" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            {/* Front Face */}
            <polygon points="60,125 140,125 140,143 60,143" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.2" />
            {/* Right Face */}
            <polygon points="140,125 170,75 170,93 140,143" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.2" />
            {/* Joint Grooves on Top Face */}
            <line x1="100" y1="75" x2="100" y2="125" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.75" />
            <line x1="45" y1="100" x2="155" y2="100" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.75" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Độ dày chính xác + Rãnh khe co giãn 3D</text>
          </svg>
        )
      },
      '350': {
        desc: 'Mô hình hóa chi tiết giật cấp hạ sàn nhà vệ sinh, phễu thu sàn, ống MEP đi âm dưới sàn, chi tiết khe co giãn có thanh truyền lực thép trơn (dowels) và lớp nilon chống thấm bên dưới sàn.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: Truly 3D Volumetric Slab Cut in Half to show internal Dowel bars & 3D Drain */}
            {/* Left Slab Segment (Bản sàn bên trái) */}
            <polygon points="25,75 95,75 80,125 10,125" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="10,125 80,125 80,135 10,135" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
            
            {/* Right Slab Segment (Bản sàn bên phải) */}
            <polygon points="105,75 175,75 160,125 90,125" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="90,125 160,125 160,135 90,135" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="160,125 175,75 175,85 160,135" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.2" />

            {/* Vapor Barrier underneath (Lớp nilon chống thấm 3D phía dưới) */}
            <polygon points="5,137 165,137 180,87 20,87" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3" />

            {/* 3D Dowel Bars (Thanh thép truyền lực 3D - dạng hình trụ tròn đâm xuyên qua khe nối) */}
            {/* Dowel 1 */}
            <polygon points="82,102 98,102 98,105 82,105" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
            <ellipse cx="98" cy="103.5" rx="1" ry="1.5" fill="#ef4444" />
            {/* Dowel 2 */}
            <polygon points="85,115 101,115 101,118 85,118" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.8" />
            <ellipse cx="101" cy="116.5" rx="1" ry="1.5" fill="#ef4444" />

            {/* 3D Floor Drain sinking into Left Slab (Phễu thu nước 3D dạng hình phễu chìm) */}
            {/* Inner depth */}
            <ellipse cx="45" cy="98" rx="6" ry="3" fill="#1e293b" stroke="currentColor" strokeWidth="1" />
            {/* Grate top */}
            <ellipse cx="45" cy="97" rx="6" ry="3" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <line x1="45" y1="94" x2="45" y2="100" stroke="currentColor" strokeWidth="0.8" />
            <line x1="39" y1="97" x2="51" y2="97" stroke="currentColor" strokeWidth="0.8" />
            {/* Drain pipe */}
            <path d="M 42,100 L 42,112 A 3,1.5 0 0 0 48,112 L 48,100" fill="none" stroke="currentColor" strokeWidth="1" />

            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Mặt cắt 3D khe co giãn: Dowel & Lớp chống thấm</text>
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết lưới thép hàn (welded wire mesh) hoặc cốt thép đan chịu lực của sàn nền, thép tăng cường gia cường xung quanh các góc cột và phễu thu sàn.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: Semi-Transparent 3D Volumetric Slab with internal 3D Rebar Grid */}
            {/* Concrete Slab outer wireframe / volume outline */}
            {/* Top Face */}
            <polygon points="30,75 170,75 140,125 60,125" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            {/* Front Face */}
            <polygon points="60,125 140,125 140,145 60,145" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            {/* Right Face */}
            <polygon points="140,125 170,75 170,95 140,145" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />

            {/* Inner Rebar Grid - suspended in 3D space inside the concrete thickness */}
            {/* Longitudinal Rebars (Thép chạy ngang 3D phối cảnh) */}
            <line x1="42" y1="95" x2="158" y2="95" stroke="#ef4444" strokeWidth="2.2" />
            <line x1="48" y1="108" x2="152" y2="108" stroke="#ef4444" strokeWidth="2.2" />
            <line x1="54" y1="121" x2="146" y2="121" stroke="#ef4444" strokeWidth="2.2" />
            {/* Transverse Rebars (Thép chạy dọc 3D phối cảnh) */}
            <line x1="58" y1="85" x2="78" y2="135" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="100" y1="85" x2="100" y2="135" stroke="#ef4444" strokeWidth="1.8" />
            <line x1="142" y1="85" x2="122" y2="135" stroke="#ef4444" strokeWidth="1.8" />

            {/* Support spacer (Con kê bê tông hoặc thép chân chó 3D nâng đỡ lưới thép) */}
            <path d="M 75,121 L 78,135 M 78,135 L 81,121" stroke="#64748b" strokeWidth="1.2" />
            <path d="M 125,121 L 122,135 M 122,135 L 119,121" stroke="#64748b" strokeWidth="1.2" />

            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Lưới cốt thép 3D đặt trong lòng sàn bê tông</text>
          </svg>
        )
      }
    }
  },
  'B1010': {
    nameVi: 'Cột bê tông cốt thép (Columns) & Dầm sàn',
    specs: {
      '100': {
        desc: 'Định vị vị trí tâm cột dưới dạng đường thẳng đứng (line) hoặc khối hộp ảo đại diện cho không gian cột chiếm dụng để quy hoạch mặt bằng sơ bộ.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            <line x1="100" y1="30" x2="100" y2="160" stroke="currentColor" strokeWidth="2" strokeDasharray="6" />
            <circle cx="100" cy="30" r="4" fill="currentColor" />
            <circle cx="100" cy="160" r="4" fill="currentColor" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Đường định vị cột (Center Line)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô tả hình học dạng khối hộp chữ nhật hoặc hình trụ tròn thô. Thể hiện tiết diện sơ bộ (ví dụ: 400x400mm) và chiều cao tầng khái quát.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: 3D Column block */}
            <polygon points="100,30 130,45 100,60 70,45" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="70,45 100,60 100,150 70,135" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="100,60 130,45 130,135 100,150" fill="currentColor" fillOpacity="0.65" stroke="currentColor" strokeWidth="1.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Khối cột 3D tiết diện thô</text>
          </svg>
        )
      },
      '300': {
        desc: 'Kích thước tiết diện và chiều cao thông thủy chính xác tuyệt đối. Định vị đúng lưới trục tọa độ. Gán mác bê tông thiết kế chính xác.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Column with grid lines */}
            <line x1="20" y1="140" x2="180" y2="140" stroke="currentColor" strokeWidth="1" strokeDasharray="2" strokeOpacity="0.5" />
            <line x1="100" y1="20" x2="100" y2="170" stroke="currentColor" strokeWidth="1" strokeDasharray="2" strokeOpacity="0.5" />
            <polygon points="100,40 125,52 100,65 75,52" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="75,52 100,65 100,140 75,128" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="100,65 125,52 125,128 100,140" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )
      },
      '350': {
        desc: 'Mô hình hóa cột chính xác kèm theo các chi tiết liên kết: Vai cột đỡ dầm, bản mã liên kết đầu cột thép, thép chờ nhô ra và các lỗ mở cho đường ống cơ điện xuyên qua.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: 3D Column with Corbel (Vai cột 3D) */}
            <polygon points="100,30 125,42 100,55 75,42" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
            {/* Left Corbel (Vai cột 3D bên trái) */}
            <polygon points="75,70 75,80 60,88 60,78" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1" />
            <polygon points="60,78 75,70 75,72 60,80" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            {/* Main body */}
            <path d="M 75,42 L 100,55 L 100,150 L 75,138 Z" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 100,55 L 125,42 L 125,138 L 100,150 Z" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
            {/* Rebar starters */}
            <line x1="85" y1="35" x2="85" y2="20" stroke="#ef4444" strokeWidth="2" />
            <line x1="115" y1="35" x2="115" y2="20" stroke="#ef4444" strokeWidth="2" />
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết cốt thép dọc chịu lực, hệ thép đai (stirrups) đan xen quanh cột với bước đai chính xác (khu vực gia cường nút dầm cột), thép chờ liên kết tầng trên.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: Rebar cage inside 3D Column */}
            <polygon points="100,30 125,42 100,55 75,42" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            <polygon points="75,42 100,55 100,150 75,138" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
            {/* Vertical Rebars */}
            <line x1="82" y1="20" x2="82" y2="145" stroke="#ef4444" strokeWidth="2" />
            <line x1="92" y1="23" x2="92" y2="148" stroke="#ef4444" strokeWidth="2" />
            <line x1="108" y1="23" x2="108" y2="148" stroke="#ef4444" strokeWidth="2" />
            <line x1="118" y1="20" x2="118" y2="145" stroke="#ef4444" strokeWidth="2" />
            {/* 3D Stirrups */}
            <polygon points="80,50 120,50 115,58 75,58" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <polygon points="80,70 120,70 115,78 75,78" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <polygon points="80,90 120,90 115,98 75,98" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <polygon points="80,110 120,110 115,118 75,118" fill="none" stroke="#ef4444" strokeWidth="1.2" />
            <polygon points="80,130 120,130 115,138 75,138" fill="none" stroke="#ef4444" strokeWidth="1.2" />
          </svg>
        )
      }
    }
  },
  'B2010': {
    nameVi: 'Tường gạch xây (Exterior Walls)',
    specs: {
      '100': {
        desc: 'Định vị trục tường dưới dạng nét vẽ 2D trên mặt bằng, thể hiện sơ bộ ranh giới ngăn chia các khu vực phòng chức năng.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            <line x1="30" y1="100" x2="170" y2="100" stroke="currentColor" strokeWidth="2" />
            <line x1="100" y1="100" x2="100" y2="160" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Nét vẽ định vị trục tường (2D)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô hình hóa tường dưới dạng tấm 3D phẳng có chiều dày tương đối. Chưa phân tách các lớp trát hoàn thiện hay định vị cửa chính xác.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: 3D Wall slab */}
            <polygon points="30,70 160,45 170,48 40,73" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="30,70 40,73 40,133 30,130" fill="currentColor" fillOpacity="0.55" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="40,73 170,48 170,108 40,133" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Tấm tường phẳng 3D (Độ dày thô)</text>
          </svg>
        )
      },
      '300': {
        desc: 'Độ dày tường chính xác. Mô hình hóa vị trí các ô cửa sổ, cửa đi (dạng lỗ mở thô). Gán chính xác vật liệu gạch xây hoặc bê tông tường vây.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Wall with a window opening */}
            <polygon points="30,70 160,45 170,48 40,73" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            {/* Front Wall face with cut-out */}
            <path d="M 40,73 L 90,63 L 90,93 L 120,87 L 120,57 L 170,48 L 170,118 L 40,143 Z" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.5" />
            {/* Thickness of the window cut-out */}
            <polygon points="90,63 90,93 94,94 94,64" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Tường 3D có định vị lỗ mở cửa</text>
          </svg>
        )
      },
      '350': {
        desc: 'Mô hình hóa chi tiết cấu tạo tường: Tách biệt rõ lớp gạch xây bên trong và các lớp vữa trát, sơn bả hoàn thiện hai bên mặt tường. Mô hình hóa lanh-tô đỡ phía trên cửa.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: 3D Multi-layered wall */}
            {/* Brick Core 3D */}
            <polygon points="50,60 140,42 150,45 60,63" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
            <polygon points="50,60 60,63 60,133 50,130" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1" />
            <polygon points="60,63 150,45 150,115 60,133" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1" />
            {/* Plaster Layer 3D (Lớp trát mặt trước) */}
            <polygon points="44,61 50,62 50,132 44,131" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2" />
            {/* Lintel 3D (Lanh tô 3D màu đỏ) */}
            <polygon points="70,80 120,70 125,72 75,82" fill="#ef4444" stroke="currentColor" strokeWidth="1" />
            <polygon points="70,80 75,82 75,92 70,90" fill="#ef4444" stroke="currentColor" strokeWidth="1" />
            <polygon points="75,82 125,72 125,82 75,92" fill="#ef4444" fillOpacity="0.8" stroke="currentColor" strokeWidth="1" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Phân tách các lớp hoàn thiện + Lanh-tô 3D</text>
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết liên kết: Thép râu tường neo vào cột, các mạch vữa xây, thép giằng tường (nếu có) và liên kết chống nứt tại các góc tường.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: 3D Wall + 3D Column + Tie Rebars */}
            {/* Column 3D */}
            <polygon points="30,40 55,48 45,50 20,42" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" />
            <polygon points="20,42 45,50 45,150 20,142" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
            {/* Wall 3D */}
            <polygon points="45,65 145,45 155,48 55,68" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1" />
            <polygon points="45,65 55,68 55,138 45,135" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1" />
            <polygon points="55,68 155,48 155,118 55,138" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1" />
            {/* Tie Rebars 3D (Thép râu neo 3D) */}
            <line x1="35" y1="85" x2="95" y2="73" stroke="#ef4444" strokeWidth="2.5" />
            <line x1="35" y1="115" x2="95" y2="103" stroke="#ef4444" strokeWidth="2.5" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Thép râu tường neo cột 3D</text>
          </svg>
        )
      }
    }
  },
  'D2010': {
    nameVi: 'Đường ống nước / MEP (Domestic Water Piping)',
    specs: {
      '100': {
        desc: 'Định vị tuyến ống dưới dạng sơ đồ tuyến đơn nét (single-line) thể hiện hướng đi chung của hệ thống ống nước trong tòa nhà.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            <path d="M 30,50 L 120,50 L 120,130 L 170,130" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="30" cy="50" r="3" fill="currentColor" />
            <circle cx="170" cy="130" r="3" fill="currentColor" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Sơ đồ tuyến đơn nét (Single-Line)</text>
          </svg>
        )
      },
      '200': {
        desc: 'Mô hình hóa ống dạng hình trụ tròn 3D sơ bộ. Đường kính ngoài mang tính khái quát, chưa có phụ kiện co cút nối hay độ dốc chính xác.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 200: 3D Cylinder pipe representation */}
            <path d="M 30,60 C 60,60 100,50 140,50" fill="none" stroke="currentColor" strokeWidth="8" strokeOpacity="0.4" />
            {/* Cylinder ridges */}
            <ellipse cx="30" cy="60" rx="3" ry="6" fill="currentColor" fillOpacity="0.7" />
            <ellipse cx="140" cy="50" rx="3" ry="6" fill="currentColor" fillOpacity="0.7" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Ống hình trụ 3D sơ bộ</text>
          </svg>
        )
      },
      '300': {
        desc: 'Đường kính ống chính xác. Mô hình hóa đúng cao độ và độ dốc thiết kế (đối với ống thoát nước). Xác định chính xác vị trí trục đứng ống kỹ thuật.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 300: 3D Pipe with 3D Elbows (Co nối 3D) */}
            <path d="M 30,60 L 110,60 A 10,10 0 0 1 120,70 L 120,120 A 10,10 0 0 0 130,130 L 170,130" fill="none" stroke="currentColor" strokeWidth="6" />
            <ellipse cx="30" cy="60" rx="2" ry="5" fill="white" />
            <ellipse cx="170" cy="130" rx="2" ry="5" fill="white" />
            {/* 3D joint rings */}
            <ellipse cx="110" cy="60" rx="2" ry="5" fill="currentColor" />
            <ellipse cx="130" cy="130" rx="2" ry="5" fill="currentColor" />
          </svg>
        )
      },
      '350': {
        desc: 'Đầy đủ ống, phụ kiện co cút nối. Mô hình hóa thêm hệ thống giá treo đỡ ống (piping hangers/supports), các van chặn kỹ thuật và lớp bảo ôn cách nhiệt bao ngoài ống.',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 350: 3D Pipe with 3D Hanger and Valve */}
            <path d="M 30,60 L 110,60 A 10,10 0 0 1 120,70 L 120,120 A 10,10 0 0 0 130,130 L 170,130" fill="none" stroke="currentColor" strokeWidth="6" />
            {/* 3D Insulation (Lớp bảo ôn 3D mờ ngoài) */}
            <path d="M 30,60 L 110,60 A 10,10 0 0 1 120,70 L 120,120 A 10,10 0 0 0 130,130 L 170,130" fill="none" stroke="currentColor" strokeWidth="12" strokeOpacity="0.2" />
            {/* 3D Hanger (Giá treo ống 3D) */}
            <line x1="70" y1="20" x2="70" y2="54" stroke="currentColor" strokeWidth="1.5" />
            <rect x="62" y="54" width="16" height="3" fill="currentColor" />
            {/* 3D Valve (Van 3D màu đỏ) */}
            <polygon points="140,125 150,135 140,135 150,125" fill="#ef4444" stroke="currentColor" strokeWidth="1" />
            <circle cx="145" cy="120" r="4" fill="none" stroke="#ef4444" strokeWidth="1.5" />
          </svg>
        )
      },
      '400': {
        desc: 'Mô hình hóa chi tiết các mối nối ren, mối nối hàn mặt bích, chi tiết các gioăng đệm cao su bên trong phụ kiện đầu nối để phục vụ gia công chế tạo sẵn ngoài nhà xưởng (Prefabrication).',
        svg: (
          <svg viewBox="0 0 200 200" className="w-full h-48 text-primary">
            {/* LOD 400: 3D Flange joints and bolts */}
            <path d="M 30,60 L 170,60" fill="none" stroke="currentColor" strokeWidth="8" />
            {/* 3D Flange rings (Mặt bích 3D) */}
            <ellipse cx="80" cy="60" rx="3" ry="12" fill="#ef4444" stroke="currentColor" strokeWidth="1" />
            <ellipse cx="90" cy="60" rx="3" ry="12" fill="#ef4444" stroke="currentColor" strokeWidth="1" />
            {/* 3D Bolts (Bu lông 3D liên kết) */}
            <rect x="76" y="50" width="18" height="3" fill="#1e293b" />
            <rect x="76" y="67" width="18" height="3" fill="#1e293b" />
            <text x="100" y="180" textAnchor="middle" className="fill-on-surface text-[10px] font-bold">Mối nối mặt bích & Bu-lông 3D</text>
          </svg>
        )
      }
    }
  }
};

// Map parent codes to children specs
const getCoreSpecByCode = (code: string): DetailedLodSpec | null => {
  const cleanCode = code.toUpperCase().trim();
  
  if (CORE_LOD_SPECS[cleanCode]) return CORE_LOD_SPECS[cleanCode];
  
  // Parent mapping
  if (cleanCode === 'A10') return CORE_LOD_SPECS['A1010']; // Foundations -> Standard Foundations
  if (cleanCode === 'A20') return CORE_LOD_SPECS['A2010']; // Subgrade Enclosures -> Basement Walls
  if (cleanCode === 'A40') return CORE_LOD_SPECS['A4010']; // Slabs-on-grade -> Slabs on grade
  if (cleanCode === 'B10') return CORE_LOD_SPECS['B1010']; // Superstructure -> Columns
  if (cleanCode === 'B20') return CORE_LOD_SPECS['B2010']; // Exterior Walls -> Exterior Walls
  if (cleanCode === 'D20') return CORE_LOD_SPECS['D2010']; // Domestic Water -> Piping
  
  return null;
};

export function BimLibraryTab() {
  const [activeTab, setActiveTab] = useState<'lod' | 'vietnam' | 'iso'>('lod');
  const [lodSearch, setLodSearch] = useState('');
  const [selectedLodItem, setSelectedLodItem] = useState<LodItem | null>(null);
  const [lodTab, setLodTab] = useState<'part1' | 'part2'>('part1');
  const [selectedCoreLevel, setSelectedCoreLevel] = useState<string>('400');

  // National Guidelines State
  const [vnSection, setVnSection] = useState<'intro' | 'qd348' | 'qd347' | 'workflow'>('intro');

  // ISO 19650 State
  const [isoSection, setIsoSection] = useState<'lifecycle' | 'cde'>('lifecycle');
  const [activeCdeZone, setActiveCdeZone] = useState<'wip' | 'shared' | 'published' | 'archived'>('wip');

  // Filtered LOD list (showing main items first or matching search)
  const filteredLodItems = useMemo(() => {
    if (!lodSearch.trim()) {
      // Default show level 1 and 2 items
      return lodData.filter(item => item.level !== null && item.level <= 2).slice(0, 50);
    }
    return lodData.filter(item =>
      item.name.toLowerCase().includes(lodSearch.toLowerCase()) ||
      item.uniformat.toLowerCase().includes(lodSearch.toLowerCase())
    ).slice(0, 50);
  }, [lodSearch]);

  // Set default selected item
  React.useEffect(() => {
    if (!selectedLodItem && filteredLodItems.length > 0) {
      const defaultItem = lodData.find(item => item.uniformat === 'A10') || filteredLodItems[0];
      setSelectedLodItem(defaultItem);
    }
  }, [filteredLodItems, selectedLodItem]);

  const activeCoreSpec = useMemo(() => {
    if (!selectedLodItem) return null;
    return getCoreSpecByCode(selectedLodItem.uniformat);
  }, [selectedLodItem]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface text-on-surface">
      {/* Tab Navigation Header */}
      <div className="border-b border-outline-variant bg-surface-container-low px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/60">
          <button
            onClick={() => setActiveTab('lod')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-bold text-[13px] transition-colors cursor-pointer ${
              activeTab === 'lod' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Layers size={16} />
            Tiêu chuẩn LOD Spec 2025 (BIMForum)
          </button>
          <button
            onClick={() => setActiveTab('vietnam')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-bold text-[13px] transition-colors cursor-pointer ${
              activeTab === 'vietnam' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Shield size={16} />
            Tiêu chuẩn BIM Quốc gia (Bộ Xây dựng)
          </button>
          <button
            onClick={() => setActiveTab('iso')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md font-bold text-[13px] transition-colors cursor-pointer ${
              activeTab === 'iso' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Cpu size={16} />
            Tiêu chuẩn Quốc tế ISO 19650
          </button>
        </div>

        {/* Download original files */}
        <div className="flex items-center gap-2">
          <a
            href="file:///d:/01_Projects/cic-cde/Docs/Template/LOD Spec 2025 Part I Official.pdf"
            download
            className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-primary bg-surface border border-outline-variant px-3 py-1.5 rounded-lg transition-all"
          >
            <Download size={13} />
            Tải LOD Part I (PDF)
          </a>
          <a
            href="file:///d:/01_Projects/cic-cde/Docs/Template/LOD Spec 2025 Part II Official.xlsx"
            download
            className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-primary bg-surface border border-outline-variant px-3 py-1.5 rounded-lg transition-all"
          >
            <Download size={13} />
            Tải LOD Part II (Excel)
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        
        {/* --- 1. LOD SPEC TAB --- */}
        {activeTab === 'lod' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Element list */}
            <aside className="w-[320px] border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-hidden">
              <div className="p-4 border-b border-outline-variant space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Cấu kiện Uniformat</h3>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[9px] font-black">
                    LOD 2025
                  </span>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    value={lodSearch}
                    onChange={e => setLodSearch(e.target.value)}
                    placeholder="Tìm kiếm bằng Tiếng Việt hoặc Mã..."
                    className="w-full pl-8 pr-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary font-medium"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {filteredLodItems.map((item, idx) => {
                  const hasSpec = !!getCoreSpecByCode(item.uniformat);
                  const vnName = translateElementName(item.name);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedLodItem(item);
                        setSelectedCoreLevel('400');
                      }}
                      className={`w-full text-left p-2.5 rounded-lg transition-all flex flex-col gap-1 cursor-pointer ${
                        selectedLodItem?.uniformat === item.uniformat
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'hover:bg-surface-container/50 text-on-surface-variant'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-outline">
                        <span>{item.uniformat || 'CHƯA PHÂN LOẠI'}</span>
                        {hasSpec ? (
                          <span className="bg-success/15 text-success px-1.5 py-0.5 rounded text-[9px] font-black">
                            ĐÃ SỐ HÓA
                          </span>
                        ) : (
                          <span className="bg-surface-container px-1 rounded">Cấp {item.level}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-2">{vnName}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Panel: Detail View */}
            {selectedLodItem ? (
              <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest/20">
                <div className="max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-8 space-y-6">
                  
                  {/* Header */}
                  <div className="border-b border-outline-variant/60 pb-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedLodItem.uniformat && (
                        <span className="bg-primary-container text-primary px-2.5 py-0.5 rounded text-xs font-bold font-mono">
                          Uniformat: {selectedLodItem.uniformat}
                        </span>
                      )}
                      {selectedLodItem.omniclass && (
                        <span className="bg-surface-container-high text-on-surface-variant px-2.5 py-0.5 rounded text-xs font-bold font-mono">
                          Omniclass: {selectedLodItem.omniclass}
                        </span>
                      )}
                      {activeCoreSpec && (
                        <span className="bg-success/10 text-success border border-success/20 px-2.5 py-0.5 rounded text-xs font-bold">
                          Đặc tả 3D Isometric + Dịch nghĩa Tiếng Việt
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-on-surface tracking-tight">
                      {activeCoreSpec ? activeCoreSpec.nameVi : translateElementName(selectedLodItem.name)}
                    </h2>
                  </div>

                  {/* Tab toggles */}
                  <div className="flex border-b border-outline-variant/60 shrink-0">
                    <button
                      onClick={() => setLodTab('part1')}
                      className={`pb-2.5 font-bold text-xs transition-colors relative mr-6 cursor-pointer ${
                        lodTab === 'part1' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Đặc tả Hình học (Part I)
                      {lodTab === 'part1' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
                    </button>
                    <button
                      onClick={() => setLodTab('part2')}
                      className={`pb-2.5 font-bold text-xs transition-colors relative cursor-pointer ${
                        lodTab === 'part2' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Ma trận Yêu cầu Thông tin (Part II)
                      {lodTab === 'part2' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
                    </button>
                  </div>

                  {/* Tab 1: Geometry Spec (Part I) */}
                  {lodTab === 'part1' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                      {activeCoreSpec ? (
                        // Render Core Digitized Specs with Interactive SVG
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* LOD Level Selector & Description */}
                          <div className="lg:col-span-7 space-y-4">
                            <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Chọn mức độ LOD</h3>
                            <div className="flex flex-wrap gap-2">
                              {['100', '200', '300', '350', '400'].map((lvl) => (
                                <button
                                  key={lvl}
                                  onClick={() => setSelectedCoreLevel(lvl)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black font-mono transition-all cursor-pointer border ${
                                    selectedCoreLevel === lvl
                                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                                      : 'bg-surface hover:bg-surface-container border-outline-variant text-on-surface-variant'
                                  }`}
                                >
                                  LOD {lvl}
                                </button>
                              ))}
                            </div>

                            <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 space-y-3">
                              <h4 className="font-bold text-sm text-primary">
                                Yêu cầu hình học LOD {selectedCoreLevel}:
                              </h4>
                              <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                                {activeCoreSpec.specs[selectedCoreLevel].desc}
                              </p>
                            </div>
                          </div>

                          {/* SVG 3D Visualization */}
                          <div className="lg:col-span-5 flex flex-col items-center justify-center border border-outline-variant/60 rounded-xl p-4 bg-surface-container-low/30">
                            <span className="text-[10px] font-bold text-outline uppercase mb-2">Mô phỏng hình học 3D Isometric</span>
                            <div className="w-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-2 shadow-inner">
                              {activeCoreSpec.specs[selectedCoreLevel].svg}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Placeholder for other elements
                        <div className="p-8 border border-dashed border-outline-variant rounded-2xl text-center space-y-4">
                          <AlertCircle className="mx-auto text-outline" size={32} />
                          <div className="space-y-1.5">
                            <h4 className="font-bold text-sm text-on-surface">Nội dung đang được dịch & số hóa</h4>
                            <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                              Hiện tại hệ thống mới số hóa chi tiết và cung cấp ảnh 3D cho các cấu kiện cốt lõi của phần ngầm (Móng, Tường vây, Sàn nền) và phần thân (Cột, Dầm sàn, Tường, Đường ống).
                            </p>
                          </div>
                          <div className="pt-2">
                            <a
                              href="file:///d:/01_Projects/cic-cde/Docs/Template/LOD Spec 2025 Part I Official.pdf"
                              download
                              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-on-primary text-xs font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                              <Download size={14} />
                              Tải về PDF gốc để tra cứu nhanh
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Attribute Matrix (Part II) */}
                  {lodTab === 'part2' && (
                    <div className="space-y-5 animate-in fade-in duration-150">
                      <div className="flex items-start gap-2.5 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <Info size={16} className="text-primary shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed text-on-surface-variant font-medium">
                          Bảng ma trận chỉ rõ mức **LOD tối thiểu** yêu cầu cho cấu kiện này qua từng mốc cột mốc/giai đoạn thiết kế và bàn giao dữ liệu theo tiêu chuẩn dự án.
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-outline-variant/60 rounded-xl shadow-sm">
                        <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                          <thead>
                            <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface font-bold">
                              <th className="p-3">Mốc trao đổi thông tin</th>
                              <th className="p-3">Giai đoạn tương ứng</th>
                              <th className="p-3 text-center w-28">Yêu cầu LOD</th>
                              <th className="p-3">Ghi chú yêu cầu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/40 text-on-surface-variant font-medium">
                            <MilestoneRow milestone="SD (Schematic Design)" phase="Thiết kế Ý tưởng" lod={selectedLodItem.lod.sd} />
                            <MilestoneRow milestone="DD (Design Development)" phase="Thiết kế Cơ sở (TKCS)" lod={selectedLodItem.lod.dd} />
                            <MilestoneRow milestone="CD (Construction Documents)" phase="Thiết kế Kỹ thuật (TKKT)" lod={selectedLodItem.lod.cd} />
                            <MilestoneRow milestone="Cost Est. #1" phase="Ước tính Chi phí sơ bộ" lod={selectedLodItem.lod.cost} />
                            <MilestoneRow milestone="Bid Pkg. (Bidding)" phase="Thiết kế Bản vẽ Thi công" lod={selectedLodItem.lod.bid} />
                            <MilestoneRow milestone="Const. MEP Coord." phase="Giai đoạn Thi công" lod={selectedLodItem.lod.mep} />
                            <MilestoneRow milestone="Ops - Maint. Mgt." phase="Bàn giao & Vận hành (FM)" lod={selectedLodItem.lod.ops} />
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              </main>
            ) : (
              <div className="flex-1 flex items-center justify-center text-outline font-medium text-xs">
                Vui lòng chọn một cấu kiện ở danh sách bên trái để tra cứu.
              </div>
            )}
          </div>
        )}

        {/* --- 2. VIETNAMESE STANDARDS TAB --- */}
        {activeTab === 'vietnam' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Outline Menu */}
            <aside className="w-[240px] border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-y-auto">
              <div className="p-4 border-b border-outline-variant">
                <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Tiêu chuẩn Việt Nam</h3>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                <OutlineButton active={vnSection === 'intro'} onClick={() => setVnSection('intro')} label="Giới thiệu chung" />
                <OutlineButton active={vnSection === 'qd348'} onClick={() => setVnSection('qd348')} label="Quyết định 348/QĐ-BXD" />
                <OutlineButton active={vnSection === 'qd347'} onClick={() => setVnSection('qd347')} label="Quyết định 347/QĐ-BXD" />
                <OutlineButton active={vnSection === 'workflow'} onClick={() => setVnSection('workflow')} label="Quy trình áp dụng chuẩn" />
              </nav>
            </aside>

            {/* Document Content */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest/20">
              <div className="max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-8 space-y-6">
                
                {vnSection === 'intro' && (
                  <div className="space-y-4">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Bộ Xây dựng</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Tổng quan Tiêu chuẩn BIM Quốc gia</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Chính phủ và Bộ Xây dựng Việt Nam đã ban hành hệ thống văn bản pháp lý và hướng dẫn kỹ thuật nhằm thúc đẩy, bắt buộc áp dụng Mô hình thông tin công trình (BIM) trong hoạt động xây dựng theo lộ trình quy định.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="border border-outline-variant/60 rounded-xl p-4 space-y-2 bg-surface-container-low/20">
                        <h4 className="font-bold text-xs text-primary">Quyết định 348/QĐ-BXD</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">Hướng dẫn chung áp dụng Mô hình thông tin công trình (BIM), quy định các khái niệm, quy trình và khung hướng dẫn cơ bản cho Chủ đầu tư và các bên liên quan.</p>
                      </div>
                      <div className="border border-outline-variant/60 rounded-xl p-4 space-y-2 bg-surface-container-low/20">
                        <h4 className="font-bold text-xs text-primary">Quyết định 347/QĐ-BXD</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">Hướng dẫn chi tiết áp dụng BIM đối với công trình xây dựng, đặc tả các yêu cầu kỹ thuật, mức độ chi tiết thông tin và quy trình kiểm soát mô hình.</p>
                      </div>
                    </div>
                  </div>
                )}

                {vnSection === 'qd348' && (
                  <div className="space-y-4">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Quyết định 348/QĐ-BXD</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Hướng dẫn chung áp dụng BIM</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Ban hành ngày 02/04/2021, Quyết định 348 là cẩm nang pháp lý và kỹ thuật nền tảng của Bộ Xây dựng, xác định rõ:
                    </p>
                    <div className="space-y-3 pt-2">
                      <VnBullet title="1. Vai trò của các chủ thể" desc="Định nghĩa trách nhiệm cụ thể của Chủ đầu tư (Bên giao thầu), Nhà thầu thiết kế, Nhà thầu thi công và Tư vấn quản lý dự án trong việc tạo lập và chuyển giao thông tin." />
                      <VnBullet title="2. Môi trường CDE" desc="Yêu cầu thiết lập Môi trường dữ liệu chung (CDE) để thu thập, quản lý và chia sẻ toàn bộ tệp tin, mô hình, bản vẽ của dự án một cách đồng bộ, bảo mật." />
                      <VnBullet title="3. Kế hoạch thực hiện BIM (BEP)" desc="Hướng dẫn cấu trúc tài liệu BEP (BIM Execution Plan) nhằm thống nhất phương án phối hợp, phần mềm áp dụng, quy chuẩn tọa độ và nhân sự giữa các bên." />
                    </div>
                  </div>
                )}

                {vnSection === 'qd347' && (
                  <div className="space-y-4">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Quyết định 347/QĐ-BXD</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Hướng dẫn chi tiết áp dụng BIM</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Quyết định 347 đi sâu vào các khía cạnh kỹ thuật chi tiết phục vụ thiết kế, phối hợp và kiểm soát chất lượng mô hình:
                    </p>
                    <div className="space-y-3 pt-2">
                      <VnBullet title="1. Phân chia mức độ LOD" desc="Định nghĩa chi tiết yêu cầu thông tin hình học và phi hình học cho các loại cấu kiện chính tương tự chuẩn quốc tế (LOD 100, 200, 300, 350, 400)." />
                      <VnBullet title="2. Kiểm soát xung đột va chạm" desc="Quy định quy trình chạy kiểm tra va chạm giữa các bộ môn, định nghĩa khoảng dung sai cho phép (tolerance) và lập báo cáo xử lý xung đột kỹ thuật." />
                      <VnBullet title="3. Công tác nghiệm thu mô hình" desc="Thiết lập danh mục kiểm tra chất lượng (Checklist) và tiêu chí nghiệm thu mô hình thông tin qua từng giai đoạn bàn giao." />
                    </div>
                  </div>
                )}

                {vnSection === 'workflow' && (
                  <div className="space-y-4">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Quy trình</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Quy trình áp dụng BIM trong Dự án Đầu tư</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Luồng công việc chuẩn hóa từ khâu chuẩn bị đến khâu bàn giao vận hành công trình theo hướng dẫn của Bộ Xây dựng:
                    </p>
                    <div className="relative border-l border-outline-variant/60 ml-3 pl-6 space-y-6 pt-2">
                      <WorkflowStep step="1" title="Xác định EIR (Chủ đầu tư)" desc="Chủ đầu tư lập và ban hành Yêu cầu trao đổi thông tin (EIR) đính kèm hồ sơ mời thầu." />
                      <WorkflowStep step="2" title="Lập Pre-BEP (Nhà thầu đấu thầu)" desc="Các đơn vị tham gia đấu thầu lập Kế hoạch thực hiện BIM sơ bộ để chứng minh năng lực đáp ứng EIR." />
                      <WorkflowStep step="3" title="Lập Post-BEP (Nhà thầu trúng thầu)" desc="Nhà thầu trúng thầu hoàn thiện BEP chính thức phối hợp với Chủ đầu tư để thống nhất phương án triển khai." />
                      <WorkflowStep step="4" title="Tạo lập & Phối hợp thông tin" desc="Thực hiện dựng mô hình, kiểm tra va chạm hàng tuần trên CDE và cập nhật thiết kế." />
                      <WorkflowStep step="5" title="Nghiệm thu & Bàn giao AIM" desc="Hoàn thiện mô hình hoàn công tích hợp thông tin tài sản để chuyển giao sang giai đoạn FM." />
                    </div>
                  </div>
                )}

              </div>
            </main>
          </div>
        )}

        {/* --- 3. ISO 19650 TAB --- */}
        {activeTab === 'iso' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Outline Menu */}
            <aside className="w-[240px] border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 overflow-y-auto">
              <div className="p-4 border-b border-outline-variant">
                <h3 className="font-bold text-xs text-outline uppercase tracking-wider">Tiêu chuẩn ISO 19650</h3>
              </div>
              <nav className="flex-1 p-2 space-y-0.5">
                <OutlineButton active={isoSection === 'lifecycle'} onClick={() => setIsoSection('lifecycle')} label="Vòng đời quản lý thông tin" />
                <OutlineButton active={isoSection === 'cde'} onClick={() => setIsoSection('cde')} label="Luồng dữ liệu CDE tương tác" />
              </nav>
            </aside>

            {/* Document Content */}
            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest/20">
              <div className="max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-sm p-8 space-y-6">
                
                {isoSection === 'lifecycle' && (
                  <div className="space-y-4">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">ISO 19650-1 & 2</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Vòng đời quản lý thông tin dự án</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Tiêu chuẩn ISO 19650 quy định việc quản lý thông tin bằng cách sử dụng Mô hình thông tin công trình (BIM). Chu kỳ thông tin được định nghĩa đi từ yêu cầu chiến lược đến sản phẩm bàn giao cuối cùng:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <IsoTermCard term="OIR (Organization Information Requirements)" desc="Yêu cầu thông tin của tổ chức: Các thông tin cần thiết phục vụ cho mục tiêu chiến lược và quản trị doanh nghiệp của Chủ đầu tư." />
                      <IsoTermCard term="PIR (Project Information Requirements)" desc="Yêu cầu thông tin dự án: Các thông tin cần thiết phục vụ cho việc quản lý dự án xây dựng cụ thể qua các giai đoạn." />
                      <IsoTermCard term="AIR (Asset Information Requirements)" desc="Yêu cầu thông tin tài sản: Yêu cầu về các thông số vận hành kỹ thuật của cấu kiện thiết bị phục vụ công tác bảo trì." />
                      <IsoTermCard term="EIR (Exchange Information Requirements)" desc="Yêu cầu trao đổi thông tin: Tài liệu pháp lý đi kèm hợp đồng quy định cụ thể sản phẩm thông tin cần bàn giao giữa các bên." />
                    </div>
                  </div>
                )}

                {isoSection === 'cde' && (
                  <div className="space-y-6 animate-in fade-in duration-150">
                    <div className="border-b border-outline-variant/60 pb-4">
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">Quy trình</span>
                      <h2 className="text-2xl font-black text-on-surface tracking-tight mt-0.5">Sơ đồ luồng dữ liệu CDE tương tác</h2>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface-variant">
                      Bấm vào từng vùng dữ liệu dưới đây để xem giải thích chi tiết về quy định quyền hạn và mục đích sử dụng theo chuẩn ISO 19650.
                    </p>

                    {/* CDE Interactive Diagram */}
                    <div className="grid grid-cols-4 gap-3 bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/30">
                      <CdeTabButton active={activeCdeZone === 'wip'} onClick={() => setActiveCdeZone('wip')} label="WIP (Work in Progress)" sub="Đang thực hiện" color="border-primary" />
                      <CdeTabButton active={activeCdeZone === 'shared'} onClick={() => setActiveCdeZone('shared')} label="SHARED" sub="Chia sẻ bộ môn" color="border-success" />
                      <CdeTabButton active={activeCdeZone === 'published'} onClick={() => setActiveCdeZone('published')} label="PUBLISHED" sub="Xuất bản chính thức" color="border-tertiary" />
                      <CdeTabButton active={activeCdeZone === 'archived'} onClick={() => setActiveCdeZone('archived')} label="ARCHIVED" sub="Lưu trữ lịch sử" color="border-outline" />
                    </div>

                    {/* CDE Zone Detail Box */}
                    <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                      {activeCdeZone === 'wip' && (
                        <>
                          <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                            Work in Progress (WIP) - Vùng làm việc nội bộ
                          </h4>
                          <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                            Đây là không gian lưu trữ các thông tin, mô hình đang trong quá trình tạo lập bởi từng bộ phận chuyên môn riêng biệt (chưa được kiểm duyệt).
                          </p>
                          <ul className="text-xs space-y-1 text-on-surface-variant font-medium list-disc list-inside pl-2">
                            <li><strong>Quyền truy cập:</strong> Chỉ các thành viên của nhóm tạo lập (Modeler) mới có quyền chỉnh sửa. Các bộ môn khác không thể xem.</li>
                            <li><strong>Mục đích:</strong> Thực hiện công việc dựng hình hàng ngày, tự kiểm tra chất lượng nội bộ.</li>
                          </ul>
                        </>
                      )}

                      {activeCdeZone === 'shared' && (
                        <>
                          <h4 className="font-bold text-sm text-success flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-success" />
                            Shared - Vùng chia sẻ thông tin phối hợp
                          </h4>
                          <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                            Nơi chứa các thông tin, mô hình đã được kiểm duyệt nội bộ bộ môn và chia sẻ cho các bộ môn khác để thực hiện công tác phối hợp đa bộ môn và kiểm tra va chạm.
                          </p>
                          <ul className="text-xs space-y-1 text-on-surface-variant font-medium list-disc list-inside pl-2">
                            <li><strong>Quyền truy cập:</strong> Các bộ môn khác có quyền xem và tải về làm tệp liên kết (link), không có quyền chỉnh sửa.</li>
                            <li><strong>Mục đích:</strong> Phối hợp thiết kế, kiểm tra va chạm trên mô hình liên hợp.</li>
                          </ul>
                        </>
                      )}

                      {activeCdeZone === 'published' && (
                        <>
                          <h4 className="font-bold text-sm text-tertiary flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                            Published - Vùng xuất bản thông tin chính thức
                          </h4>
                          <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                            Nơi lưu trữ các tài liệu, bản vẽ và mô hình đã được Chủ đầu tư phê duyệt kỹ thuật chính thức.
                          </p>
                          <ul className="text-xs space-y-1 text-on-surface-variant font-medium list-disc list-inside pl-2">
                            <li><strong>Quyền truy cập:</strong> Đọc và sử dụng cho toàn bộ dự án. Đóng băng chỉnh sửa.</li>
                            <li><strong>Mục đích:</strong> Làm căn cứ thi công ngoài công trường (Bản vẽ phát hành thi công AFC) hoặc làm hồ sơ pháp lý.</li>
                          </ul>
                        </>
                      )}

                      {activeCdeZone === 'archived' && (
                        <>
                          <h4 className="font-bold text-sm text-outline flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-outline" />
                            Archived - Vùng lưu trữ lịch sử
                          </h4>
                          <p className="text-xs leading-relaxed text-on-surface-variant font-medium">
                            Nơi lưu trữ toàn bộ lịch sử các phân bản cũ của tài liệu và mô hình đã qua sử dụng, phục vụ công tác đối chiếu hoặc truy vết pháp lý sau này.
                          </p>
                          <ul className="text-xs space-y-1 text-on-surface-variant font-medium list-disc list-inside pl-2">
                            <li><strong>Quyền truy cập:</strong> Chỉ quản trị viên hệ thống có quyền truy cập xem lịch sử.</li>
                            <li><strong>Mục đích:</strong> Lưu vết lịch sử thay đổi thông tin (Audit Trail) xuyên suốt vòng đời công trình.</li>
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </main>
          </div>
        )}

      </div>
    </div>
  );
}

// Sub-components
function LodCard({ level, title, desc }: { level: string; title: string; desc: string }) {
  return (
    <div className="border border-outline-variant/60 rounded-xl p-4 space-y-2 bg-surface-container-low/20">
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10.5px] font-black font-mono">LOD {level}</span>
        <h4 className="font-bold text-xs text-on-surface">{title}</h4>
      </div>
      <p className="text-xs leading-relaxed text-on-surface-variant font-medium">{desc}</p>
    </div>
  );
}

function MilestoneRow({ milestone, phase, lod }: { milestone: string; phase: string; lod: string }) {
  return (
    <tr className="hover:bg-surface-container-low/15 transition-colors">
      <td className="p-3 font-bold text-on-surface">{milestone}</td>
      <td className="p-3 font-semibold text-on-surface-variant">{phase}</td>
      <td className="p-3 text-center">
        {lod ? (
          <span className="bg-primary-container text-primary px-2.5 py-0.5 rounded-full text-[10.5px] font-black font-mono">LOD {lod}</span>
        ) : (
          <span className="text-outline text-[11px] font-semibold">-</span>
        )}
      </td>
      <td className="p-3 text-[11.5px] leading-relaxed">
        {lod ? `Mô hình bắt buộc đạt mức độ chi tiết hình học & thông tin tối thiểu LOD ${lod} để phục vụ mốc này.` : 'Không yêu cầu thông tin cấu kiện tại mốc này.'}
      </td>
    </tr>
  );
}

// Helper components
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

// Custom bullet component
function VnBullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-1">
      <h4 className="font-bold text-xs text-on-surface">{title}</h4>
      <p className="text-xs leading-relaxed text-on-surface-variant font-medium pl-3 border-l-2 border-outline-variant">{desc}</p>
    </div>
  );
}

// Workflow step component
function WorkflowStep({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="relative">
      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center font-black text-[9px]">
        {step}
      </div>
      <h4 className="font-black text-xs text-on-surface leading-none mb-1.5">{title}</h4>
      <p className="text-xs leading-relaxed text-on-surface-variant font-medium">{desc}</p>
    </div>
  );
}

// ISO Term Card component
function IsoTermCard({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="border border-outline-variant/60 rounded-xl p-4 space-y-2 bg-surface-container-low/20">
      <h4 className="font-bold text-xs text-primary font-mono">{term}</h4>
      <p className="text-xs leading-relaxed text-on-surface-variant font-medium">{desc}</p>
    </div>
  );
}

// CDE Tab Button component
function CdeTabButton({ active, onClick, label, sub, color }: { active: boolean; onClick: () => void; label: string; sub: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col gap-1 ${color} ${
        active ? 'bg-surface shadow-md scale-105' : 'bg-surface-container-low/50 hover:bg-surface opacity-75'
      }`}
    >
      <span className="font-black text-[11px] tracking-wide leading-none text-on-surface">{label}</span>
      <span className="text-[9.5px] font-bold text-outline leading-none">{sub}</span>
    </button>
  );
}
