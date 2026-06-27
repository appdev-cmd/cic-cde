import { useState, useEffect, Fragment, type ReactNode } from 'react';
import { Calculator, Info, RotateCcw } from 'lucide-react';

// ============================================================================
// FinancialTab — Bảng tài chính nhập tay kiểu Excel
// Ô MÀU XANH = nhập tay (ghi về `inputs`); ô xám = kết quả tính tự động từ `calcs`.
// Một nguồn sự thật duy nhất: mọi ô nhập ghi vào `inputs`, mọi ô kết quả đọc `calcs`.
// ============================================================================

const YEARS = [2026, 2027, 2028, 2029, 2030];

const fmt = (v: number, dec = 2) => {
  if (v === 0) return '—';
  const s = Math.abs(v).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return v < 0 ? `(${s})` : s;
};
const fmtInt = (v: number) => v === 0 ? '—' : Math.round(v).toLocaleString('vi-VN');
// IRR rất cao do chi phí siêu tinh gọn → cap hiển thị ở '>100%'
const fmtIrr = (irr: number | null) => irr == null ? 'Âm' : irr > 1 ? '>100%' : `${(irr * 100).toFixed(0)}%`;

// cell class helpers
const HEAD = 'px-3 py-2 text-on-surface font-medium whitespace-nowrap';
const INPUTCELL = 'px-3 py-1.5 text-center';
const grey = (bold?: boolean, accent?: boolean) =>
  `px-3 py-2 text-center font-mono text-[12px] ${bold ? 'font-bold' : ''} ${accent ? 'text-primary' : 'text-on-surface-variant'}`;

// Giải thích chi tiết hiển thị khi rê chuột (hover) — căn cứ giải trình trong báo cáo NCKT
const EXPL: Record<string, string> = {
  // Tham số chung
  wacc: 'Tỷ lệ chiết khấu dòng tiền (chi phí vốn bình quân). Dùng để quy đổi dòng tiền tương lai về hiện tại khi tính NPV. Mặc định 12% theo thông lệ dự án CNTT.',
  tax: 'Thuế thu nhập doanh nghiệp áp lên lợi nhuận trước thuế (chỉ tính ở năm có lãi). Giả định 0% nếu đủ điều kiện ưu đãi R&D theo NĐ 353/2025 — cần xác minh với cơ quan thuế.',
  cicShare: 'Tỷ lệ vốn CIC tự bỏ ra. Mặc định 100% (CIC tự đầu tư hoàn toàn, không dùng ngân sách nhà nước).',
  amc: 'Phí bảo trì & vận hành hằng năm (AMC) thu trên giá trị hợp đồng On-Premise lũy kế, bắt đầu từ năm thứ 2 — tạo doanh thu tái diễn (recurring).',
  // SaaS
  saasGrossAdds: 'Số người dùng SaaS MỚI thu được trong năm (gross adds). User cuối kỳ được suy ra theo công thức churn, không nhập trực tiếp.',
  saasChurn: 'Tỷ lệ người dùng rời bỏ mỗi năm. Benchmark ngành 2026: SMB 12-15%, doanh nghiệp/B2G ~5%. Mặc định 10% (pha trộn).',
  saasChurned: 'Số user rời bỏ trong năm = user cuối kỳ năm trước × tỷ lệ churn. Tự tính.',
  saasEndUsers: 'User cuối kỳ = user cuối kỳ năm trước × (1 − churn) + user mới. Đây là số user thực còn lại tạo doanh thu. Tự tính.',
  saasUsers: 'Số người dùng SaaS đăng ký lũy kế đến cuối mỗi năm. Doanh thu tính trên user hoạt động trung bình = (đầu kỳ + cuối kỳ)/2 để thận trọng.',
  saasArpu: 'ARPU — doanh thu bình quân trên mỗi user mỗi tháng (triệu VNĐ). Tăng dần khi bổ sung tính năng 5D/GIS/AI.',
  saasMonths: 'Số tháng thực thu phí trong năm (năm ra mắt 2027 chỉ thu nửa năm = 6 tháng).',
  saasAvg: 'User hoạt động trung bình dùng để tính doanh thu = (user đầu kỳ + user cuối kỳ)/2. Tự tính.',
  saasRev: 'Doanh thu SaaS = User TB × ARPU × Số tháng (quy đổi tỷ VNĐ). Tự tính.',
  // On-Premise
  pmu: 'Ban Quản lý Dự án đầu tư công (B2G). Bán license trọn gói On-Premise + phí AMC 15%/năm từ năm sau. Phân khúc lõi nhờ yêu cầu QCVN 12/VNeID.',
  soXd: 'Sở Xây dựng — giải pháp dùng chung cấp Sở để số hóa thẩm định, cấp phép, liên thông LGSP. License trọn gói + AMC.',
  enterprise: 'Doanh nghiệp/tập đoàn xây dựng lớn cần bảo mật nội bộ cao. License trọn gói On-Premise + AMC.',
  onPremRev: 'Tổng doanh thu On-Premise = HĐ mới ký × đơn giá + AMC 15% trên giá trị HĐ lũy kế các năm trước. Tự tính.',
  // CAPEX
  cap01: 'Lương gộp đội R&D tinh gọn 2 người (CTO 50tr + Trợ lý 30tr) trong 18 tháng, gồm BHXH/BHYT/BHTN 21,5%, phí công cụ AI và quỹ dự phòng/thưởng milestone.',
  cap02: '2 bộ máy tính cấu hình cao (~35tr/bộ) phục vụ render WebGL/3D, thiết bị mạng bảo mật, màn hình phụ và bản quyền hệ điều hành.',
  cap03: 'Phí API dịch vụ AI (Claude/Gemini), GitHub Enterprise, domain, chứng chỉ SSL và bản quyền CSDL/công cụ phát triển.',
  cap04: 'PR B2B tối giản, cẩm nang số hóa BIM, video & tài liệu thuyết trình, demo và làm việc trực tiếp với PMU lớn & Sở Xây dựng.',
  cap05: 'Chi phí kiểm định QCVN 12, lập hồ sơ An toàn thông tin Cấp độ 3, đánh giá ISO 27001 và đăng ký bản quyền tác giả mã nguồn.',
  capexTotal: 'Tổng vốn đầu tư ban đầu (CAPEX), tập trung trong 18 tháng R&D. 100% vốn tự có của CIC.',
  // OPEX
  opxStaff: 'Lương đội vận hành (CTO + Trợ lý) cộng nhân sự CSKH/Sales bổ sung dần (2→4 người đến 2030), đã gồm overhead.',
  opxCloud: 'Thuê hạ tầng đám mây nội địa: lưu trữ đối tượng vStorage/S3, cụm K8s (VKE) xử lý WebGL/compute, tường lửa/Load Balancer, DB HA/SSL/HSM — Viettel Cloud (chính) + VNPT (DR).',
  opxOthers: 'Marketing/BD B2B-B2G, license API định kỳ (AI/bản đồ), pentest 2 lần/năm & đánh giá lại QCVN 12, đào tạo/tuyển dụng và quỹ dự phòng rủi ro công nghệ.',
  opexTotal: 'Tổng chi phí vận hành 5 năm (OPEX), tối ưu theo mô hình AI-Conductor siêu tinh gọn.',
  // Kết quả
  rev: 'Tổng doanh thu 4 kênh: SaaS + On-Prem PMU + Sở XD + Doanh nghiệp.',
  cogs: 'Giá vốn hàng bán: chi phí triển khai On-Premise, đào tạo chuyển giao, customization nghiệp vụ cho từng khách hàng B2G (chiếm 30-40% giá trị HĐ On-Prem).',
  gp: 'Lợi nhuận gộp = Doanh thu − COGS. Biên gộp bình quân ~55-61% (SaaS thuần ~75%, On-Prem thấp hơn do chi phí triển khai).',
  capexRow: 'Vốn đầu tư phân bổ theo năm (chỉ phát sinh trong 18 tháng R&D: 2026-2028).',
  opexRow: 'Chi phí vận hành phát sinh hằng năm.',
  netCash: 'Dòng tiền ròng = Lợi nhuận gộp − CAPEX − OPEX − Thuế. Là dòng tiền thực của dự án mỗi năm.',
  cumCash: 'Dòng tiền ròng cộng dồn qua các năm. Khi chuyển dương = đã hoàn vốn.',
  // KPI
  npv: 'Giá trị hiện tại ròng — tổng dòng tiền ròng 5 năm chiết khấu về hiện tại theo WACC. NPV > 0 nghĩa là dự án tạo giá trị.',
  irr: 'Tỷ suất sinh lời nội bộ — mức chiết khấu làm NPV = 0. Ở đây rất cao (>100%) do chi phí siêu tinh gọn, mang tính lý thuyết, không nên dùng làm chỉ số quyết định chính.',
  payback: 'Thời điểm dòng tiền tích lũy chuyển dương (hoàn vốn).',
  cashburn: 'Mức âm sâu nhất của dòng tiền tích lũy — phản ánh nhu cầu vốn lưu động đỉnh điểm cần chuẩn bị.',
  workingCap: 'Vốn lưu động đối ứng CIC cần chuẩn bị để vượt qua giai đoạn dòng tiền âm (đã gồm biên an toàn).',
};

function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip align-middle ml-1">
      <Info size={12} className="text-outline hover:text-primary cursor-help shrink-0" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 hidden group-hover/tip:block w-72 bg-inverse-surface text-inverse-on-surface text-[11px] font-normal leading-relaxed rounded-lg px-3 py-2 shadow-xl whitespace-normal text-left normal-case">
        {text}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-inverse-surface" />
      </span>
    </span>
  );
}

// Ô nhãn (cột đầu) kèm icon giải thích hover. Không dùng trong .map cần key.
function LabelCell({ text, tip }: { text: ReactNode; tip?: string }) {
  return (
    <td className={HEAD}>
      <span className="inline-flex items-center">{text}{tip && <HelpTip text={tip} />}</span>
    </td>
  );
}

interface NumCellProps {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  width?: string;
  unit?: string;
}

function NumCell({ value, onCommit, step = 0.01, width = 'w-20', unit }: NumCellProps) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const n = parseFloat(draft.replace(',', '.'));
    if (!isNaN(n) && n >= 0) onCommit(n);
    else setDraft(String(value));
  };

  return (
    <span className="inline-flex items-center gap-1 justify-end">
      <input
        type="number"
        value={draft}
        step={step}
        min={0}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`${width} bg-primary-container/30 border border-primary/40 rounded px-1.5 py-1 text-right font-mono text-[12px] text-on-surface focus:ring-2 focus:ring-primary focus:bg-surface outline-none transition-shadow`}
      />
      {unit && <span className="text-[10px] text-on-surface-variant">{unit}</span>}
    </span>
  );
}

interface FinancialTabProps {
  inputs: any;
  setInputs: (updater: (prev: any) => any) => void;
  calcs: any;
  defaults: any;
}

export function FinancialTab({ inputs, setInputs, calcs, defaults }: FinancialTabProps) {
  // Deep, immutable updater — mọi ô nhập đi qua đây để ghi về `inputs`
  const update = (mutator: (draft: any) => void) => {
    setInputs((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      mutator(next);
      return next;
    });
  };

  const reset = () => {
    if (confirm('Khôi phục toàn bộ giả định tài chính về mặc định?')) {
      setInputs(() => JSON.parse(JSON.stringify(defaults)));
    }
  };

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const pct = inputs.costMode === 'pct'; // chế độ nhập theo % doanh thu
  const setMode = (m: 'value' | 'pct') => update((n) => { n.costMode = m; });
  const totalCapex = sum(calcs.totalCapexYearly); // tổng CAPEX hiệu dụng theo chế độ hiện tại

  const scA = calcs.scenarioResults[0];
  const scB = calcs.scenarioResults[1];
  const scC = calcs.scenarioResults[2];
  const cashBurn = (sc: any) => Math.min(...sc.cumulativeFlows);
  const paybackLabel = (sc: any) => sc.payback ? `Q${Math.ceil((sc.payback % 1) * 4) || 4}/${Math.floor(2026 + sc.payback)}` : 'Sau 2031';

  const resultRow = (label: string, arr: number[], opts?: { bold?: boolean; accent?: boolean; tip?: string }) => {
    const { bold, accent, tip } = opts ?? {};
    return (
      <tr className={bold ? 'font-bold' : ''}>
        <td className={HEAD}><span className="inline-flex items-center">{label}{tip && <HelpTip text={tip} />}</span></td>
        {arr.map((v, t) => <td key={t} className={grey(bold, accent)}>{fmt(v)}</td>)}
        <td className={grey(true, accent)}>{fmt(sum(arr))}</td>
      </tr>
    );
  };

  // Ô OPEX theo chế độ: % doanh thu năm t hoặc giá trị tuyệt đối
  const opexCell = (key: string, t: number) => pct
    ? <NumCell step={0.5} unit="%" value={+(inputs.opexPct[key][t] * 100).toFixed(2)} onCommit={(v) => update(n => { n.opexPct[key][t] = v / 100; })} />
    : <NumCell step={0.1} value={inputs.opex[key][t]} onCommit={(v) => update(n => { n.opex[key][t] = v; })} />;

  // Ô CAPEX theo chế độ: % tổng DT 5 năm (kèm giá trị quy đổi) hoặc giá trị tuyệt đối
  const capexCell = (key: string, effKey: string) => pct
    ? (
      <span className="inline-flex items-center gap-2 justify-end">
        <NumCell step={0.05} unit="%" value={+(inputs.capexPct[key] * 100).toFixed(3)} onCommit={(v) => update(n => { n.capexPct[key] = v / 100; })} />
        <span className="text-[11px] text-on-surface-variant font-mono whitespace-nowrap">= {fmt(calcs.capexEffective[effKey])} tỷ</span>
      </span>
    )
    : <NumCell step={0.05} unit="tỷ" value={inputs.capex[key]} onCommit={(v) => update(n => { n.capex[key] = v; })} />;

  return (
    <div className="max-w-7xl mx-auto px-2 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary-container/40 text-primary"><Calculator size={20} /></div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">Mô hình Tài chính (nhập tay điều chỉnh)</h2>
            <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
              <Info size={13} className="text-primary shrink-0" />
              Ô <span className="px-1 rounded bg-primary-container/40 border border-primary/40 font-mono">xanh</span> cho phép nhập tay như Excel; ô xám là kết quả tính tự động. Đơn vị tiền: <b>tỷ VNĐ</b>.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {/* Toggle chế độ nhập chi phí */}
          <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-outline-variant/60">
            <button
              onClick={() => setMode('value')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${!pct ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Giá trị (tỷ)
            </button>
            <button
              onClick={() => setMode('pct')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${pct ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              % Doanh thu
            </button>
          </div>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary border border-outline-variant/60 rounded-lg px-3 py-1.5 hover:bg-surface-container transition-colors cursor-pointer">
            <RotateCcw size={13} /> Mặc định
          </button>
        </div>
      </div>

      {pct && (
        <div className="bg-primary-container/15 border border-primary/30 rounded-xl px-4 py-3 text-[12px] text-on-surface-variant leading-relaxed">
          <b className="text-primary">Chế độ % Doanh thu đang bật.</b> Chi phí được tính = % × doanh thu. <b>COGS</b> và <b>OPEX</b> theo % doanh thu <b>từng năm</b>; <b>CAPEX</b> theo <b>% tổng doanh thu 5 năm</b> (vì là đầu tư trả trước). Lưu ý: năm 2026 doanh thu ≈ 0 nên chi phí theo % sẽ ≈ 0 — nếu cần giữ chi phí chuẩn bị ban đầu, dùng chế độ <b>Giá trị (tỷ)</b>.
        </div>
      )}

      {/* 0. Cơ sở & Công thức (tham chiếu) */}
      <details className="bg-surface border border-outline-variant/60 rounded-2xl shadow-sm overflow-hidden">
        <summary className="cursor-pointer select-none px-5 py-3.5 font-bold text-sm text-primary flex items-center gap-2 hover:bg-surface-container-low transition-colors">
          <Info size={15} /> Cơ sở, công thức tính toán &amp; đối chiếu benchmark ngành (bấm để xem)
        </summary>
        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-outline-variant/40">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant mb-2">Công thức cốt lõi</h4>
            <div className="overflow-x-auto">
              <table className="text-[12px] border-collapse">
                <tbody className="divide-y divide-outline-variant/30">
                  {[
                    ['User cuối kỳ', 'User đầu kỳ × (1 − churn) + User mới'],
                    ['Doanh thu SaaS', 'User_TB × ARPU × Số tháng thu phí'],
                    ['User TB (năm)', '(User đầu kỳ + User cuối kỳ) / 2'],
                    ['Doanh thu On-Prem', 'HĐ mới × Giá/HĐ + AMC'],
                    ['AMC', 'Σ giá trị HĐ lũy kế trước × 15%/năm'],
                    ['Giá vốn (COGS)', 'Doanh thu × tỷ lệ giá vốn (%)'],
                    ['Lợi nhuận gộp', 'Doanh thu − COGS'],
                    ['Dòng tiền ròng', 'LN gộp − CAPEX − OPEX − Thuế'],
                    ['NPV', 'Σ [ CF(t) / (1+WACC)^t ], năm gốc 2026'],
                    ['IRR', 'mức r sao cho NPV(r) = 0'],
                    ['Hoàn vốn', 'năm mà dòng tiền tích lũy ≥ 0'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-1.5 pr-5 font-semibold text-on-surface whitespace-nowrap align-top">{k}</td>
                      <td className="py-1.5 font-mono text-on-surface-variant">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface-variant mb-2">Đối chiếu benchmark ngành 2026 (cơ sở giả định)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-primary text-on-primary">
                    <th className="px-3 py-2 text-left font-semibold">Chỉ số</th>
                    <th className="px-3 py-2 text-center font-semibold">CDE CIC</th>
                    <th className="px-3 py-2 text-left font-semibold">Benchmark ngành</th>
                    <th className="px-3 py-2 text-center font-semibold">Đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {[
                    ['Biên LN gộp', '~60%', 'SaaS+Services ~65%; thuần SaaS 75-82%', '✅ Thận trọng'],
                    ['AMC bảo trì', '15%', 'On-Prem 15-25% (vendor nhỏ 12-18%)', '✅ Thận trọng'],
                    ['WACC', '12%', 'IT Việt Nam 8-12% (FPT 11,2%)', '✅ Hợp lý'],
                    ['ARPU SaaS', '$16-24', 'Autodesk $45-120/user/th', '✅ Cạnh tranh'],
                    ['Churn SaaS', '10% (chỉnh được)', 'SMB 12-15%; Enterprise 5%', '✅ Đã mô hình hóa'],
                  ].map((r) => (
                    <tr key={r[0]} className="odd:bg-surface-container-lowest/40">
                      <td className="px-3 py-1.5 font-semibold text-on-surface">{r[0]}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-primary font-bold">{r[1]}</td>
                      <td className="px-3 py-1.5 text-on-surface-variant">{r[2]}</td>
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant italic leading-relaxed">
            Nguồn: SaaSRise/Benchmarkit 2026, KeyBanc 2024-25, Forrester &amp; The Negotiation Experts (bảo trì phần mềm), valueinvesting.io (WACC FPT/CMC). Dữ liệu kinh doanh CDE CIC: hệ thống CIC-ERP (6/2026). Chi tiết đầy đủ tại §5.1bis của Báo cáo khả thi. <b>Lưu ý:</b> IRR rất cao (&gt;100%) ở kịch bản lạc quan là chỉ số lý thuyết — ưu tiên quyết định theo NPV (Kịch bản B) &amp; nhu cầu vốn lưu động.
          </p>
        </div>
      </details>

      {/* 1. Tham số chung */}
      <Section title="1. Tham số chung">
        <table className="text-sm border-collapse">
          <tbody>
            <Row label="WACC (tỷ lệ chiết khấu)" tip={EXPL.wacc}>
              <NumCell value={+(inputs.fin.wacc * 100).toFixed(2)} step={0.5} unit="%" onCommit={(v) => update(n => { n.fin.wacc = v / 100; })} />
            </Row>
            <Row label="Thuế suất TNDN" tip={EXPL.tax}>
              <NumCell value={+(inputs.fin.taxRate * 100).toFixed(2)} step={1} unit="%" onCommit={(v) => update(n => { n.fin.taxRate = v / 100; })} />
            </Row>
            <Row label="Tỷ lệ vốn tự có CIC đối ứng" tip={EXPL.cicShare}>
              <NumCell value={+(inputs.fin.cicShare * 100).toFixed(0)} step={5} unit="%" onCommit={(v) => update(n => { n.fin.cicShare = v / 100; })} />
            </Row>
            <Row label="Tỷ lệ phí bảo trì AMC/năm" tip={EXPL.amc}>
              <NumCell value={+(inputs.onPrem.amcRate * 100).toFixed(0)} step={1} unit="%" onCommit={(v) => update(n => { n.onPrem.amcRate = v / 100; })} />
            </Row>
            <Row label="Tỷ lệ rời bỏ SaaS (churn)/năm" tip={EXPL.saasChurn}>
              <NumCell value={+(inputs.saas.churn * 100).toFixed(0)} step={1} unit="%" onCommit={(v) => update(n => { n.saas.churn = v / 100; })} />
            </Row>
          </tbody>
        </table>
      </Section>

      {/* 2. SaaS */}
      <Section title="2. Giả định kênh SaaS (theo năm)">
        <Grid headers={['Chỉ tiêu', ...YEARS.map(String)]}>
          <tr>
            <LabelCell text="User mới / năm (gross adds)" tip={EXPL.saasGrossAdds} />
            <td className={grey()}>—</td>
            {[1, 2, 3, 4].map(t => (
              <td key={t} className={INPUTCELL}><NumCell width="w-24" step={100} value={inputs.saas.grossAdds[t]} onCommit={(v) => update(n => { n.saas.grossAdds[t] = Math.round(v); })} /></td>
            ))}
          </tr>
          <tr>
            <LabelCell text="ARPU (tr/user/tháng)" tip={EXPL.saasArpu} />
            <td className={grey()}>—</td>
            {[1, 2, 3, 4].map(t => (
              <td key={t} className={INPUTCELL}><NumCell step={0.05} value={inputs.saas.arpu[t]} onCommit={(v) => update(n => { n.saas.arpu[t] = v; })} /></td>
            ))}
          </tr>
          <tr>
            <LabelCell text="Số tháng thu phí" tip={EXPL.saasMonths} />
            <td className={grey()}>—</td>
            {[1, 2, 3, 4].map(t => (
              <td key={t} className={INPUTCELL}><NumCell width="w-16" step={1} value={inputs.saas.months[t]} onCommit={(v) => update(n => { n.saas.months[t] = Math.round(v); })} /></td>
            ))}
          </tr>
          <tr className="bg-surface-container-low">
            <LabelCell text={`User rời bỏ (churn ${(inputs.saas.churn * 100).toFixed(0)}%)`} tip={EXPL.saasChurned} />
            {YEARS.map((_, t) => <td key={t} className={grey()}>{t === 0 ? '—' : fmtInt(calcs.saasChurnedUsers[t])}</td>)}
          </tr>
          <tr className="bg-surface-container-low font-bold">
            <LabelCell text="User cuối kỳ (suy ra)" tip={EXPL.saasEndUsers} />
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{t === 0 ? '—' : fmtInt(calcs.saasUsers[t])}</td>)}
          </tr>
          <tr className="bg-surface-container-low">
            <LabelCell text="User hoạt động TB (tính DT)" tip={EXPL.saasAvg} />
            {YEARS.map((_, t) => <td key={t} className={grey()}>{fmtInt(calcs.saasAvgUsers[t])}</td>)}
          </tr>
          <tr className="bg-surface-container-low font-bold">
            <LabelCell text="→ Doanh thu SaaS (tỷ)" tip={EXPL.saasRev} />
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{fmt(calcs.saasRevenues[t])}</td>)}
          </tr>
        </Grid>
      </Section>

      {/* 3. On-Premise */}
      <Section title="3. Giả định On-Premise (HĐ mới & đơn giá theo năm)">
        <Grid headers={['Phân khúc', ...YEARS.map(String)]}>
          {([
            ['pmu', 'PMU', EXPL.pmu],
            ['soXd', 'Sở Xây dựng', EXPL.soXd],
            ['enterprise', 'Doanh nghiệp', EXPL.enterprise],
          ] as const).map(([key, name, tip]) => (
            <Fragment key={key}>
              <tr>
                <LabelCell text={`${name} — HĐ mới/năm`} tip={tip} />
                <td className={grey()}>—</td>
                {[1, 2, 3, 4].map(t => (
                  <td key={t} className={INPUTCELL}><NumCell width="w-16" step={1} value={inputs.onPrem[key].newHd[t]} onCommit={(v) => update(n => { n.onPrem[key].newHd[t] = Math.round(v); })} /></td>
                ))}
              </tr>
              <tr>
                <LabelCell text={`${name} — Giá/HĐ (tỷ)`} tip={tip} />
                <td className={grey()}>—</td>
                {[1, 2, 3, 4].map(t => (
                  <td key={t} className={INPUTCELL}><NumCell step={0.1} value={inputs.onPrem[key].price[t]} onCommit={(v) => update(n => { n.onPrem[key].price[t] = v; })} /></td>
                ))}
              </tr>
            </Fragment>
          ))}
          <tr className="bg-surface-container-low font-bold">
            <LabelCell text="→ Doanh thu On-Prem (tỷ)" tip={EXPL.onPremRev} />
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{fmt(calcs.pmuRevenues[t] + calcs.soXdRevenues[t] + calcs.entRevenues[t])}</td>)}
          </tr>
        </Grid>
      </Section>

      {/* 4. COGS — luôn theo % doanh thu */}
      <Section title="4. Giá vốn (COGS) — % doanh thu từng năm">
        <Grid headers={['Chỉ tiêu', ...YEARS.map(String)]}>
          <tr>
            <LabelCell text="Tỷ lệ giá vốn (% DT)" tip={EXPL.cogs} />
            <td className={grey()}>—</td>
            {[1, 2, 3, 4].map(t => (
              <td key={t} className={INPUTCELL}><NumCell step={1} unit="%" value={+(inputs.cogsPct[t] * 100).toFixed(1)} onCommit={(v) => update(n => { n.cogsPct[t] = v / 100; })} /></td>
            ))}
          </tr>
          <tr className="bg-surface-container-low font-bold">
            <LabelCell text="→ Giá vốn (tỷ)" />
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{fmt(calcs.cogs[t])}</td>)}
          </tr>
        </Grid>
      </Section>

      {/* 5. CAPEX */}
      <Section title={pct ? '5. Chi phí đầu tư CAPEX (% tổng doanh thu 5 năm)' : '5. Chi phí đầu tư CAPEX (tổng từng hạng mục, tỷ VNĐ)'}>
        <table className="text-sm border-collapse">
          <tbody>
            <Row label="CAP-01 — Nhân sự phát triển lõi" tip={EXPL.cap01}>{capexCell('cap01_RD_staff', 'cap01')}</Row>
            <Row label="CAP-02 — Trang thiết bị" tip={EXPL.cap02}>{capexCell('cap02_equip', 'cap02')}</Row>
            <Row label="CAP-03 — Bản quyền & API" tip={EXPL.cap03}>{capexCell('cap03_license', 'cap03')}</Row>
            <Row label="CAP-04 — Marketing ra mắt" tip={EXPL.cap04}>{capexCell('cap04_marketing', 'cap04')}</Row>
            <Row label="CAP-05 — Tư vấn, PM & Pháp lý" tip={EXPL.cap05}>{capexCell('cap05_consulting', 'cap05')}</Row>
            <tr className="border-t-2 border-primary/30 font-bold">
              <td className="py-2 pr-6 text-on-surface"><span className="inline-flex items-center">TỔNG CAPEX<HelpTip text={EXPL.capexTotal} /></span></td>
              <td className="py-2 text-right font-mono text-primary">{fmt(totalCapex)} tỷ</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* 6. OPEX */}
      <Section title={pct ? '6. Chi phí vận hành OPEX (% doanh thu từng năm)' : '6. Chi phí vận hành OPEX (theo năm, tỷ VNĐ)'}>
        <Grid headers={['Hạng mục', ...YEARS.map(String), 'Tổng (tỷ)']}>
          {([
            ['staff', 'OPX-01 — Nhân sự vận hành', EXPL.opxStaff],
            ['cloud', 'OPX-02 — Hạ tầng Cloud', EXPL.opxCloud],
            ['others', 'OPX-03 — Vận hành khác', EXPL.opxOthers],
          ] as const).map(([key, name, tip]) => (
            <tr key={key}>
              <LabelCell text={name} tip={tip} />
              {YEARS.map((_, t) => (
                <td key={t} className={INPUTCELL}>{opexCell(key, t)}</td>
              ))}
              <td className={grey(true)}>{fmt(sum(calcs.opexEffective[key]))}</td>
            </tr>
          ))}
          <tr className="bg-surface-container-low font-bold">
            <LabelCell text="TỔNG OPEX (tỷ)" tip={EXPL.opexTotal} />
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{fmt(calcs.totalOpexYearly[t])}</td>)}
            <td className={grey(true)}>{fmt(sum(calcs.totalOpexYearly))}</td>
          </tr>
        </Grid>
      </Section>

      {/* 7. Kết quả — Dòng tiền (read-only) */}
      <Section title="7. Kết quả — Dòng tiền dự án (Kịch bản A, tự tính)">
        <Grid headers={['Chỉ tiêu', ...YEARS.map(String), 'Tổng']}>
          {resultRow('Doanh thu', calcs.totalRevenues, { tip: EXPL.rev })}
          {resultRow('Giá vốn (COGS)', calcs.cogs.map((v: number) => -v), { tip: EXPL.cogs })}
          {resultRow('Lợi nhuận gộp', calcs.grossProfit, { bold: true, tip: EXPL.gp })}
          {resultRow('CAPEX', calcs.totalCapexYearly.map((v: number) => -v), { tip: EXPL.capexRow })}
          {resultRow('OPEX', calcs.totalOpexYearly.map((v: number) => -v), { tip: EXPL.opexRow })}
          {resultRow('Dòng tiền ròng', calcs.netCashFlow, { bold: true, accent: true, tip: EXPL.netCash })}
          <tr className="font-bold bg-surface-container-low">
            <td className={HEAD}><span className="inline-flex items-center">Dòng tiền tích lũy<HelpTip text={EXPL.cumCash} /></span></td>
            {YEARS.map((_, t) => <td key={t} className={grey(true)}>{fmt(calcs.cumulativeNetCashFlow[t])}</td>)}
            <td className={grey()} />
          </tr>
        </Grid>
      </Section>

      {/* 8. KPI theo kịch bản (read-only) */}
      <Section title="8. Chỉ số hiệu quả theo kịch bản (WACC động)">
        <Grid headers={['Chỉ số', 'A (Lạc quan)', 'B (Cơ sở 55%)', 'C (Bi quan 25%)']}>
          <tr>
            <LabelCell text="NPV toàn dự án (tỷ)" tip={EXPL.npv} />
            <td className={grey(true)}>{fmt(scA.npv)}</td>
            <td className={grey(true, true)}>{fmt(scB.npv)}</td>
            <td className={grey()}>{fmt(scC.npv)}</td>
          </tr>
          <tr>
            <LabelCell text="IRR" tip={EXPL.irr} />
            <td className={grey()}>{fmtIrr(scA.irr)}</td>
            <td className={grey()}>{fmtIrr(scB.irr)}</td>
            <td className={grey()}>{fmtIrr(scC.irr)}</td>
          </tr>
          <tr>
            <LabelCell text="Thời gian hoàn vốn" tip={EXPL.payback} />
            <td className={grey()}>{paybackLabel(scA)}</td>
            <td className={grey()}>{paybackLabel(scB)}</td>
            <td className={grey()}>{paybackLabel(scC)}</td>
          </tr>
          <tr>
            <LabelCell text="Cash burn tối đa (tỷ)" tip={EXPL.cashburn} />
            <td className={grey()}>{fmt(cashBurn(scA))}</td>
            <td className={grey()}>{fmt(cashBurn(scB))}</td>
            <td className={grey()}>{fmt(cashBurn(scC))}</td>
          </tr>
          <tr>
            <LabelCell text="Vốn lưu động cần (tỷ)" tip={EXPL.workingCap} />
            <td className={grey()}>~{Math.abs(cashBurn(scA) * inputs.fin.cicShare).toFixed(1)}</td>
            <td className={grey()}>~{Math.abs(cashBurn(scB) * inputs.fin.cicShare).toFixed(1)}</td>
            <td className={grey()}>~{Math.abs(cashBurn(scC) * inputs.fin.cicShare).toFixed(1)}</td>
          </tr>
        </Grid>
        <p className="text-[11px] text-on-surface-variant italic mt-3 leading-relaxed">
          ⚠️ IRR ở Kịch bản A/B rất cao (&gt;100%) do cơ cấu chi phí siêu tinh gọn (CAPEX {fmt(totalCapex)} + OPEX {fmt(sum(calcs.totalOpexYearly))} tỷ nhỏ so với doanh thu) — không nên dùng làm chỉ số quyết định chính. Quyết định nên dựa trên <b>NPV Kịch bản B</b>, nhu cầu vốn lưu động đỉnh điểm và lợi thế tuân thủ QCVN 12/VNeID.
        </p>
      </Section>
    </div>
  );
}

// ---- small presentational helpers (không nhận key — chỉ dùng đơn lẻ) ----
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-outline-variant/60 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-sm text-primary border-l-4 border-primary pl-2.5 mb-4">{title}</h3>
      {/* overflow-visible để tooltip giải thích không bị cắt */}
      <div className="max-w-full">{children}</div>
    </div>
  );
}

function Grid({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table className="min-w-full text-sm border-collapse">
      <thead>
        <tr className="bg-primary text-on-primary text-xs">
          {headers.map((h, i) => (
            <th key={i} className={`px-3 py-2.5 font-semibold ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-outline-variant/40">{children}</tbody>
    </table>
  );
}

function Row({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <tr className="border-b border-outline-variant/30">
      <td className="py-2 pr-8 text-on-surface">
        <span className="inline-flex items-center">{label}{tip && <HelpTip text={tip} />}</span>
      </td>
      <td className="py-2 text-right">{children}</td>
    </tr>
  );
}
