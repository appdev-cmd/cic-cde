import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Save, Download, Info, TrendingUp, Percent, Settings,
  DollarSign, FileText, Activity, AlertCircle, ArrowUpRight,
  HelpCircle, CheckCircle, RefreshCw, Calculator, ArrowRight
} from 'lucide-react';
import reportMarkdown from '../../../Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.md?raw';
import { FinancialTab } from './FinancialTab';
import { wrapGlossaryTerms } from './glossary';

const STORAGE_KEY = 'cic_cde_feasibility_inputs';

// Finance table placeholder ids — render as callout in Report tab (chi tiết ở tab Tài chính)
const FINANCE_TABLE_IDS = new Set(['6_2A', '6_2C', '6_4A', '6_4B', '6_5_1', '6_5_2', '6_5_3', '6_5BIS_B', '6_5BIS_C', '6_5BIS_D']);
const FINANCE_CALLOUT_ANCHOR_IDS = new Set(['6_2A', '6_4A']);

// Formula Tooltip Component
interface FormulaInfoProps {
  formula: string;
  calcDetail: string;
}

export function FormulaInfo({ formula, calcDetail }: FormulaInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <span className="relative inline-flex items-center ml-1 group shrink-0">
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-primary/50 hover:text-primary transition-colors cursor-help p-0.5 rounded-full hover:bg-primary-container/20"
      >
        <Info size={11} />
      </button>
      {isOpen && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-surface-container-high border border-outline-variant rounded-xl shadow-xl z-[999] text-left text-[11px] font-sans normal-case text-on-surface-variant font-normal leading-relaxed pointer-events-none">
          <span className="block font-bold text-[12px] text-primary mb-1">Công thức:</span>
          <code className="block bg-surface-container-lowest p-1.5 rounded font-mono text-[10px] text-accent mb-2 break-words whitespace-pre-wrap">{formula}</code>
          <span className="block font-semibold text-[11px] text-on-surface">Giá trị:</span>
          <span className="block italic text-[11px] text-on-surface-variant break-words">{calcDetail}</span>
        </span>
      )}
    </span>
  );
}

// Financial Math Helpers
function calculateNPV(cashFlows: number[], wacc: number) {
  return cashFlows.reduce((acc, val, t) => acc + val / Math.pow(1 + wacc, t), 0);
}

function calculateIRR(cashFlows: number[]) {
  let x0 = 0.1;
  let x1 = 0.2;
  let maxIter = 1000;
  let tolerance = 1e-6;
  
  function npv(r: number) {
    return cashFlows.reduce((acc, val, t) => acc + val / Math.pow(1 + r, t), 0);
  }
  
  for (let i = 0; i < maxIter; i++) {
    let f0 = npv(x0);
    let f1 = npv(x1);
    if (Math.abs(f1 - f0) < 1e-12) break;
    let x_next = x1 - f1 * (x1 - x0) / (f1 - f0);
    if (Math.abs(x_next - x1) < tolerance) {
      return x_next;
    }
    x0 = x1;
    x1 = x_next;
  }
  return null;
}

function calculatePaybackPeriod(cumulativeFlows: number[], netFlows: number[]) {
  let lastNegativeYear = -1;
  for (let t = 0; t < cumulativeFlows.length; t++) {
    if (cumulativeFlows[t] < 0) {
      lastNegativeYear = t;
    }
  }
  if (lastNegativeYear === -1) return 0;
  if (lastNegativeYear === cumulativeFlows.length - 1) return null;
  
  const fraction = -cumulativeFlows[lastNegativeYear] / netFlows[lastNegativeYear + 1];
  return lastNegativeYear + fraction;
}

const fmtVal = (v: number, dec = 2) => {
  if (v === 0 || v === null || v === undefined) return '—';
  const prefix = v < 0 ? '(' : '';
  const suffix = v < 0 ? ')' : '';
  const absVal = Math.abs(v);
  return `${prefix}${absVal.toFixed(dec).replace('.', ',')}${suffix}`;
};

const fmtPercent = (v: number) => {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(0)}%`;
};

function getTable6_4a(inputs: any, calcs: any) {
  const pmuCum = [0, inputs.onPrem.pmu.newHd[1], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3]+inputs.onPrem.pmu.newHd[4]];
  const soXdCum = [0, inputs.onPrem.soXd.newHd[1], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2]+inputs.onPrem.soXd.newHd[3], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2]+inputs.onPrem.soXd.newHd[3]+inputs.onPrem.soXd.newHd[4]];
  const entCum = [0, inputs.onPrem.enterprise.newHd[1], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2]+inputs.onPrem.enterprise.newHd[3], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2]+inputs.onPrem.enterprise.newHd[3]+inputs.onPrem.enterprise.newHd[4]];
  const u = calcs.saasUsers;
  const r = (x: number) => Math.round(x);

  return [
    `| Phân khúc | Tiêu chí đánh giá số lượng | 2026 | 2027 (H2) | 2028 | 2029 | 2030 |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---:|`,
    `| **1. Kênh SaaS** | User mới (gross adds) | — | ${inputs.saas.grossAdds[1]} | ${inputs.saas.grossAdds[2]} | ${inputs.saas.grossAdds[3]} | ${inputs.saas.grossAdds[4]} |`,
    `| | User rời bỏ (churn ${(inputs.saas.churn*100).toFixed(0)}%) | — | ${r(calcs.saasChurnedUsers[1])} | ${r(calcs.saasChurnedUsers[2])} | ${r(calcs.saasChurnedUsers[3])} | ${r(calcs.saasChurnedUsers[4])} |`,
    `| | Số user cuối kỳ (người) | — | ${r(u[1])} | ${r(u[2])} | ${r(u[3])} | ${r(u[4])} |`,
    `| | **Số user hoạt động trung bình (tính DT)**| — | **${r(calcs.saasAvgUsers[1])}** | **${r(calcs.saasAvgUsers[2])}** | **${r(calcs.saasAvgUsers[3])}** | **${r(calcs.saasAvgUsers[4])}** |`,
    `| **2. On-Prem PMU** | Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.pmu.newHd[1]} | ${inputs.onPrem.pmu.newHd[2]} | ${inputs.onPrem.pmu.newHd[3]} | ${inputs.onPrem.pmu.newHd[4]} |`,
    `| | Lũy kế số PMU sử dụng hệ thống | 0 | ${pmuCum[1]} | ${pmuCum[2]} | ${pmuCum[3]} | ${pmuCum[4]} |`,
    `| **3. On-Prem Sở XD**| Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.soXd.newHd[1]} | ${inputs.onPrem.soXd.newHd[2]} | ${inputs.onPrem.soXd.newHd[3]} | ${inputs.onPrem.soXd.newHd[4]} |`,
    `| | Lũy kế số Sở Xây dựng sử dụng | 0 | ${soXdCum[1]} | ${soXdCum[2]} | ${soXdCum[3]} | ${soXdCum[4]} |`,
    `| **4. On-Prem DN** | Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.enterprise.newHd[1]} | ${inputs.onPrem.enterprise.newHd[2]} | ${inputs.onPrem.enterprise.newHd[3]} | ${inputs.onPrem.enterprise.newHd[4]} |`,
    `| | Lũy kế số Doanh nghiệp lớn sử dụng | 0 | ${entCum[1]} | ${entCum[2]} | ${entCum[3]} | ${entCum[4]} |`
  ].join('\n');
}

function getTable6_4b(calcs: any, inputs: any) {
  const sumSaaS = calcs.saasRevenues.reduce((a: number, b: number) => a + b, 0);
  const sumPMU = calcs.pmuRevenues.reduce((a: number, b: number) => a + b, 0);
  const sumSoXd = calcs.soXdRevenues.reduce((a: number, b: number) => a + b, 0);
  const sumEnt = calcs.entRevenues.reduce((a: number, b: number) => a + b, 0);
  const totalSum = sumSaaS + sumPMU + sumSoXd + sumEnt;
  
  return [
    `| Phân khúc kênh | Công thức tính toán | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
    `| **1. Kênh SaaS** | User TB × ARPU × Số tháng | — | ${fmtVal(calcs.saasRevenues[1])} | ${fmtVal(calcs.saasRevenues[2])} | ${fmtVal(calcs.saasRevenues[3])} | ${fmtVal(calcs.saasRevenues[4])} | **${fmtVal(sumSaaS)}** |`,
    `| **2. On-Prem PMU** | HĐ mới + Lũy kế HĐ cũ × AMC (15%) | — | ${fmtVal(calcs.pmuRevenues[1])} | ${fmtVal(calcs.pmuRevenues[2])} | ${fmtVal(calcs.pmuRevenues[3])} | ${fmtVal(calcs.pmuRevenues[4])} | **${fmtVal(sumPMU)}** |`,
    `| **3. On-Prem Sở XD** | HĐ mới + Lũy kế HĐ cũ × AMC (15%) | — | ${fmtVal(calcs.soXdRevenues[1])} | ${fmtVal(calcs.soXdRevenues[2])} | ${fmtVal(calcs.soXdRevenues[3])} | ${fmtVal(calcs.soXdRevenues[4])} | **${fmtVal(sumSoXd)}** |`,
    `| **4. On-Prem Doanh nghiệp** | HĐ mới + Lũy kế HĐ cũ × AMC (15%) | — | ${fmtVal(calcs.entRevenues[1])} | ${fmtVal(calcs.entRevenues[2])} | ${fmtVal(calcs.entRevenues[3])} | ${fmtVal(calcs.entRevenues[4])} | **${fmtVal(sumEnt)}** |`,
    `| **TỔNG CỘNG DOANH THU** | **Tổng cộng 4 kênh** | **${fmtVal(calcs.totalRevenues[0])}** | **${fmtVal(calcs.totalRevenues[1])}** | **${fmtVal(calcs.totalRevenues[2])}** | **${fmtVal(calcs.totalRevenues[3])}** | **${fmtVal(calcs.totalRevenues[4])}** | **${fmtVal(totalSum)}** |`
  ].join('\n');
}

function getTable6_5_1(calcs: any) {
  const sumRev = calcs.totalRevenues.reduce((a: number, b: number) => a + b, 0);
  const sumCogs = calcs.cogs.reduce((a: number, b: number) => a + b, 0);
  const sumGP = calcs.grossProfit.reduce((a: number, b: number) => a + b, 0);
  const sumCapex = calcs.totalCapexYearly.reduce((a: number, b: number) => a + b, 0);
  const sumOpex = calcs.totalOpexYearly.reduce((a: number, b: number) => a + b, 0);
  const sumEbit = calcs.ebit.reduce((a: number, b: number) => a + b, 0);
  const sumNet = calcs.netCashFlow.reduce((a: number, b: number) => a + b, 0);
  
  return [
    `| Chỉ tiêu | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng |`,
    `|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
    `| **Doanh thu** | **${fmtVal(calcs.totalRevenues[0])}** | **${fmtVal(calcs.totalRevenues[1])}** | **${fmtVal(calcs.totalRevenues[2])}** | **${fmtVal(calcs.totalRevenues[3])}** | **${fmtVal(calcs.totalRevenues[4])}** | **${fmtVal(sumRev)}** |`,
    `| Giá vốn hàng bán (COGS) | ${fmtVal(-calcs.cogs[0])} | ${fmtVal(-calcs.cogs[1])} | ${fmtVal(-calcs.cogs[2])} | ${fmtVal(-calcs.cogs[3])} | ${fmtVal(-calcs.cogs[4])} | ${fmtVal(-sumCogs)} |`,
    `| **Lợi nhuận gộp** | **${fmtVal(calcs.grossProfit[0])}** | **${fmtVal(calcs.grossProfit[1])}** | **${fmtVal(calcs.grossProfit[2])}** | **${fmtVal(calcs.grossProfit[3])}** | **${fmtVal(calcs.grossProfit[4])}** | **${fmtVal(sumGP)}** |`,
    `| *Biên lợi nhuận gộp* | — | *55%* | *60%* | *61%* | *60%* | *60%* |`,
    `| Chi phí đầu tư CAPEX | ${fmtVal(-calcs.totalCapexYearly[0])} | ${fmtVal(-calcs.totalCapexYearly[1])} | ${fmtVal(-calcs.totalCapexYearly[2])} | — | — | ${fmtVal(-sumCapex)} |`,
    `| Chi phí vận hành OPEX | ${fmtVal(-calcs.totalOpexYearly[0])} | ${fmtVal(-calcs.totalOpexYearly[1])} | ${fmtVal(-calcs.totalOpexYearly[2])} | ${fmtVal(-calcs.totalOpexYearly[3])} | ${fmtVal(-calcs.totalOpexYearly[4])} | ${fmtVal(-sumOpex)} |`,
    `| **Lợi nhuận trước thuế (EBIT)** | **${fmtVal(calcs.ebit[0])}** | **${fmtVal(calcs.ebit[1])}** | **${fmtVal(calcs.ebit[2], 2)}** | **${fmtVal(calcs.ebit[3], 2)}** | **${fmtVal(calcs.ebit[4], 2)}** | **${fmtVal(sumEbit, 2)}** |`,
    `| Thuếu TNDN (*)| — | — | — | — | — | — |`,
    `| **Dòng tiền ròng dự án** | **${fmtVal(calcs.netCashFlow[0])}** | **${fmtVal(calcs.netCashFlow[1])}** | **${fmtVal(calcs.netCashFlow[2], 2)}** | **${fmtVal(calcs.netCashFlow[3], 2)}** | **${fmtVal(calcs.netCashFlow[4], 2)}** | **${fmtVal(sumNet, 2)}** |`,
    `| **Dòng tiền ròng tích lũy** | **${fmtVal(calcs.cumulativeNetCashFlow[0])}** | **${fmtVal(calcs.cumulativeNetCashFlow[1])}** | **${fmtVal(calcs.cumulativeNetCashFlow[2], 2)}** | **${fmtVal(calcs.cumulativeNetCashFlow[3], 2)}** | **${fmtVal(calcs.cumulativeNetCashFlow[4], 2)}** | |`
  ].join('\n');
}

function getTable6_5_2(calcs: any, inputs: any) {
  const sumGP = calcs.grossProfit.reduce((a: number, b: number) => a + b, 0);
  const sumCapexCIC = calcs.capexCIC.reduce((a: number, b: number) => a + b, 0);
  const sumOpex = calcs.totalOpexYearly.reduce((a: number, b: number) => a + b, 0);
  const sumNet = calcs.cicNetCashFlow.reduce((a: number, b: number) => a + b, 0);
  
  return [
    `| Chỉ tiêu | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng |`,
    `|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
    `| Lợi nhuận gộp | ${fmtVal(calcs.grossProfit[0])} | ${fmtVal(calcs.grossProfit[1])} | ${fmtVal(calcs.grossProfit[2])} | ${fmtVal(calcs.grossProfit[3])} | ${fmtVal(calcs.grossProfit[4])} | ${fmtVal(sumGP)} |`,
    `| CAPEX của CIC (${fmtPercent(inputs.fin.cicShare)}) | ${fmtVal(-calcs.capexCIC[0])} | ${fmtVal(-calcs.capexCIC[1])} | ${fmtVal(-calcs.capexCIC[2])} | — | — | ${fmtVal(-sumCapexCIC)} |`,
    `| OPEX | ${fmtVal(-calcs.totalOpexYearly[0])} | ${fmtVal(-calcs.totalOpexYearly[1])} | ${fmtVal(-calcs.totalOpexYearly[2])} | ${fmtVal(-calcs.totalOpexYearly[3])} | ${fmtVal(-calcs.totalOpexYearly[4])} | ${fmtVal(-sumOpex)} |`,
    `| **Dòng tiền ròng CIC** | **${fmtVal(calcs.cicNetCashFlow[0])}** | **${fmtVal(calcs.cicNetCashFlow[1])}** | **${fmtVal(calcs.cicNetCashFlow[2], 2)}** | **${fmtVal(calcs.cicNetCashFlow[3], 2)}** | **${fmtVal(calcs.cicNetCashFlow[4], 2)}** | **${fmtVal(sumNet, 2)}** |`,
    `| **Tích lũy CIC** | **${fmtVal(calcs.cicCumulativeNetCashFlow[0])}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[1])}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[2], 2)}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[3], 2)}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[4], 2)}** | |`
  ].join('\n');
}

function getTable6_5bis_b(calcs: any) {
  const scBiQuan = calcs.scenarioResults[2];
  const scCoSo = calcs.scenarioResults[1];
  const scLacQuan = calcs.scenarioResults[0];
  
  return [
    `| Năm | **A (Lạc quan)** | **B (Cơ sở - 55%)** | **C (Bi quan - 25%)** |`,
    `|:---:|:---:|:---:|:---:|`,
    `| 2026 | ${fmtVal(scLacQuan.revenues[0])} | ${fmtVal(scCoSo.revenues[0])} | ${fmtVal(scBiQuan.revenues[0])} |`,
    `| 2027 | ${fmtVal(scLacQuan.revenues[1])} | ${fmtVal(scCoSo.revenues[1])} | ${fmtVal(scBiQuan.revenues[1])} |`,
    `| 2028 | ${fmtVal(scLacQuan.revenues[2])} | ${fmtVal(scCoSo.revenues[2])} | ${fmtVal(scBiQuan.revenues[2])} |`,
    `| 2029 | ${fmtVal(scLacQuan.revenues[3])} | ${fmtVal(scCoSo.revenues[3])} | ${fmtVal(scBiQuan.revenues[3])} |`,
    `| 2030 | ${fmtVal(scLacQuan.revenues[4])} | ${fmtVal(scCoSo.revenues[4])} | ${fmtVal(scBiQuan.revenues[4])} |`,
    `| **Tổng 5 năm** | **${fmtVal(scLacQuan.revenues.reduce((a,b)=>a+b,0))}** | **${fmtVal(scCoSo.revenues.reduce((a,b)=>a+b,0))}** | **${fmtVal(scBiQuan.revenues.reduce((a,b)=>a+b,0))}** |`
  ].join('\n');
}

function getTable6_5bis_c(calcs: any) {
  const scBiQuan = calcs.scenarioResults[2];
  const scCoSo = calcs.scenarioResults[1];
  const scLacQuan = calcs.scenarioResults[0];
  
  return [
    `| Năm | **A (Lạc quan)** | **B (Cơ sở)** | **C (Bi quan)** |`,
    `|:---:|:---:|:---:|:---:|`,
    `| 2026 | ${fmtVal(scLacQuan.cumulativeFlows[0])} | ${fmtVal(scCoSo.cumulativeFlows[0])} | ${fmtVal(scBiQuan.cumulativeFlows[0])} |`,
    `| 2027 | ${fmtVal(scLacQuan.cumulativeFlows[1])} | ${fmtVal(scCoSo.cumulativeFlows[1])} | ${fmtVal(scBiQuan.cumulativeFlows[1])} |`,
    `| 2028 | ${fmtVal(scLacQuan.cumulativeFlows[2])} | ${fmtVal(scCoSo.cumulativeFlows[2])} | ${fmtVal(scBiQuan.cumulativeFlows[2])} |`,
    `| 2029 | ${fmtVal(scLacQuan.cumulativeFlows[3])} | ${fmtVal(scCoSo.cumulativeFlows[3])} | ${fmtVal(scBiQuan.cumulativeFlows[3])} |`,
    `| 2030 | ${fmtVal(scLacQuan.cumulativeFlows[4])} | ${fmtVal(scCoSo.cumulativeFlows[4])} | ${fmtVal(scBiQuan.cumulativeFlows[4])} |`
  ].join('\n');
}

function getTable6_5bis_d(calcs: any, inputs: any) {
  const scBiQuan = calcs.scenarioResults[2];
  const scCoSo = calcs.scenarioResults[1];
  const scLacQuan = calcs.scenarioResults[0];
  
  const minCashBurnA = Math.min(...scLacQuan.cumulativeFlows);
  const minCashBurnB = Math.min(...scCoSo.cumulativeFlows);
  const minCashBurnC = Math.min(...scBiQuan.cumulativeFlows);
  
  const paybackA = scLacQuan.payback ? `Q${Math.ceil((scLacQuan.payback % 1) * 4)}/${Math.floor(2026 + scLacQuan.payback)}` : 'Sau 2031';
  const paybackB = scCoSo.payback ? `Q${Math.ceil((scCoSo.payback % 1) * 4)}/${Math.floor(2026 + scCoSo.payback)}` : 'Sau 2031';
  
  return [
    `| Chỉ số | **A (Lạc quan)** | **B (Cơ sở)** | **C (Bi quan)** |`,
    `|---|:---:|:---:|:---:|`,
    `| **NPV toàn dự án** | ${fmtVal(scLacQuan.npv)} tỷ | ${fmtVal(scCoSo.npv)} tỷ | ${fmtVal(scBiQuan.npv)} tỷ |`,
    `| **IRR** | ${scLacQuan.irr ? (scLacQuan.irr*100).toFixed(0)+'%' : 'Âm'} | ${scCoSo.irr ? (scCoSo.irr*100).toFixed(0)+'%' : 'Âm'} | ${scBiQuan.irr ? (scBiQuan.irr*100).toFixed(0)+'%' : 'Âm'} |`,
    `| **Thời gian hoàn vốn** | ${paybackA} | ${paybackB} | Sau 2031 |`,
    `| **Cash burn tối đa** | ${fmtVal(minCashBurnA)} tỷ | ${fmtVal(minCashBurnB)} tỷ | ${fmtVal(minCashBurnC)} tỷ |`,
    `| **Vốn lưu động CIC cần chuẩn bị** | ~${Math.abs(minCashBurnA * inputs.fin.cicShare).toFixed(1)} tỷ | ~${Math.abs(minCashBurnB * inputs.fin.cicShare).toFixed(1)} tỷ | ~${Math.abs(minCashBurnC * inputs.fin.cicShare).toFixed(1)} tỷ |`
  ].join('\n');
}

// Default inputs representing the baseline financial model
const DEFAULT_INPUTS = {
  fin: {
    wacc: 0.12,
    taxRate: 0.0,
    cicShare: 1.00
  },
  saas: {
    arpu: [0, 0.40, 0.45, 0.50, 0.60],
    months: [0, 6, 12, 12, 12],
    // User MỚI (gross adds) mỗi năm — user cuối kỳ được suy ra theo churn
    grossAdds: [0, 500, 2550, 4800, 7250],
    churn: 0.10 // tỷ lệ rời bỏ/năm (mặc định 10% — pha trộn SMB/B2G)
  },
  onPrem: {
    pmu: {
      newHd: [0, 1, 5, 8, 12],
      price: [0, 2.0, 2.3, 2.6, 3.0]
    },
    soXd: {
      newHd: [0, 0, 2, 4, 6],
      price: [0, 1.8, 2.0, 2.2, 2.5]
    },
    enterprise: {
      newHd: [0, 1, 2, 3, 5],
      price: [0, 3.0, 3.4, 3.8, 4.2]
    },
    amcRate: 0.15
  },
  capex: {
    cap01_RD_staff: 2.00,
    cap02_equip: 0.10,
    cap03_license: 0.30,
    cap04_marketing: 0.50,
    cap05_consulting: 0.60
  },
  opex: {
    staff: [0.0, 1.40, 2.00, 2.80, 3.00],
    cloud: [0.20, 0.60, 2.50, 4.00, 5.80],
    others: [0.0, 1.00, 2.50, 3.50, 4.00]
  },
  // Chế độ nhập chi phí: 'value' = giá trị tuyệt đối (tỷ); 'pct' = % doanh thu
  costMode: 'value' as 'value' | 'pct',
  // COGS luôn là % doanh thu theo năm (giá vốn)
  cogsPct: [0.0, 0.45, 0.40, 0.39, 0.40],
  // OPEX theo % doanh thu từng năm (dùng khi costMode === 'pct'); 2026 doanh thu ≈ 0
  opexPct: {
    staff: [0.0, 0.2500, 0.0614, 0.0366, 0.0188],
    cloud: [0.0, 0.1071, 0.0768, 0.0522, 0.0363],
    others: [0.0, 0.1786, 0.0768, 0.0457, 0.0251]
  },
  // CAPEX theo % TỔNG doanh thu 5 năm (đầu tư trả trước — không dùng % doanh thu từng năm)
  capexPct: {
    cap01_RD_staff: 0.00729,
    cap02_equip: 0.000365,
    cap03_license: 0.001093,
    cap04_marketing: 0.001823,
    cap05_consulting: 0.002187
  }
};

export function FeasibilityStudyTab() {
  const [inputs, setInputs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        const merged: any = { ...DEFAULT_INPUTS, ...p };
        // Deep-merge các nhánh có thể thiếu ở dữ liệu cũ (tránh undefined)
        merged.saas = { ...DEFAULT_INPUTS.saas, ...(p.saas || {}) };
        merged.opex = { ...DEFAULT_INPUTS.opex, ...(p.opex || {}) };
        merged.opexPct = { ...DEFAULT_INPUTS.opexPct, ...(p.opexPct || {}) };
        merged.capexPct = { ...DEFAULT_INPUTS.capexPct, ...(p.capexPct || {}) };
        merged.cogsPct = p.cogsPct ?? DEFAULT_INPUTS.cogsPct;
        merged.costMode = p.costMode ?? DEFAULT_INPUTS.costMode;
        // Di trú: dữ liệu cũ chỉ có `users` (cuối kỳ) → suy ra `grossAdds` theo churn
        if (!merged.saas.grossAdds && p.saas?.users) {
          const u = p.saas.users; const ch = merged.saas.churn ?? 0;
          merged.saas.grossAdds = u.map((v: number, t: number) => t === 0 ? 0 : v - (u[t - 1] * (1 - ch)));
        }
        return merged;
      }
    } catch { /* ignore corrupt storage */ }
    return DEFAULT_INPUTS;
  });
  const [activeTab, setActiveTab] = useState<'report' | 'financial' | 'analysis'>('report');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [activeId, setActiveId] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  // Persist manual edits to localStorage (Excel-like adjustments survive reload)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* quota */ }
  }, [inputs]);

  // Extract report headings for Table of Contents
  const tocItems = useMemo(() => {
    const lines = reportMarkdown.split('\n');
    const items: { id: string; text: string; level: number }[] = [];
    let headingCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        const level = trimmed.startsWith('## ') ? 2 : 3;
        const text = trimmed.slice(level === 2 ? 3 : 4).trim()
          .replace(/\*\*/g, '')
          .replace(/\*/g, '');
        const id = `heading-${headingCount++}`;
        items.push({ id, text, level });
      }
    }
    return items;
  }, []);

  // Scroll-spy: tô sáng mục lục theo phần đang xem trong báo cáo
  useEffect(() => {
    if (activeTab !== 'report') return;
    const root = contentRef.current;
    if (!root) return;
    const headings: HTMLElement[] = Array.from(root.querySelectorAll('[id^="heading-"]'));
    if (headings.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const firstVisible = headings.find((h) => visible.has(h.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { root, rootMargin: '-24px 0px -78% 0px', threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [activeTab, tocItems]);

  // Financial model calculations
  const calcs = useMemo(() => {
    const years = [2026, 2027, 2028, 2029, 2030];
    const tCount = years.length;
    
    // 1. SaaS Revenues — mô hình churn tường minh:
    //    User_cuối_kỳ(t) = User_cuối_kỳ(t-1) × (1 − churn) + User_mới(t)
    const churn = typeof inputs.saas.churn === 'number' ? inputs.saas.churn : 0;
    const grossAdds: number[] | undefined = inputs.saas.grossAdds;
    const saasUsers = new Array(tCount).fill(0);      // user cuối kỳ (đã trừ rời bỏ)
    const saasChurnedUsers = new Array(tCount).fill(0); // user rời bỏ trong năm
    for (let t = 1; t < tCount; t++) {
      if (grossAdds) {
        saasChurnedUsers[t] = saasUsers[t - 1] * churn;
        saasUsers[t] = saasUsers[t - 1] - saasChurnedUsers[t] + (grossAdds[t] || 0);
      } else {
        // Tương thích dữ liệu cũ: nếu chưa có grossAdds thì dùng user cuối kỳ trực tiếp
        saasUsers[t] = inputs.saas.users ? inputs.saas.users[t] : 0;
        saasChurnedUsers[t] = (inputs.saas.users ? inputs.saas.users[t - 1] : 0) * churn;
      }
    }
    const saasRevenues = new Array(tCount).fill(0);
    const saasAvgUsers = new Array(tCount).fill(0);
    for (let t = 1; t < tCount; t++) {
      saasAvgUsers[t] = (saasUsers[t - 1] + saasUsers[t]) / 2;
      saasRevenues[t] = saasAvgUsers[t] * inputs.saas.arpu[t] * inputs.saas.months[t] / 1000;
    }
    
    // 2. On-Premise PMU Revenues
    const pmuRevenues = new Array(tCount).fill(0);
    const pmuNewRevenues = new Array(tCount).fill(0);
    const pmuCumulativeOld = new Array(tCount).fill(0);
    const pmuAMC = new Array(tCount).fill(0);
    
    let pmuCumulativeContractsVal = 0;
    for (let t = 1; t < tCount; t++) {
      pmuNewRevenues[t] = inputs.onPrem.pmu.newHd[t] * inputs.onPrem.pmu.price[t];
      pmuAMC[t] = pmuCumulativeContractsVal * inputs.onPrem.amcRate;
      pmuRevenues[t] = pmuNewRevenues[t] + pmuAMC[t];
      pmuCumulativeOld[t] = pmuCumulativeContractsVal;
      pmuCumulativeContractsVal += pmuNewRevenues[t];
    }
    
    // 3. On-Premise So XD Revenues
    const soXdRevenues = new Array(tCount).fill(0);
    const soXdNewRevenues = new Array(tCount).fill(0);
    const soXdCumulativeOld = new Array(tCount).fill(0);
    const soXdAMC = new Array(tCount).fill(0);
    
    let soXdCumulativeContractsVal = 0;
    for (let t = 1; t < tCount; t++) {
      soXdNewRevenues[t] = inputs.onPrem.soXd.newHd[t] * inputs.onPrem.soXd.price[t];
      soXdAMC[t] = soXdCumulativeContractsVal * inputs.onPrem.amcRate;
      soXdRevenues[t] = soXdNewRevenues[t] + soXdAMC[t];
      soXdCumulativeOld[t] = soXdCumulativeContractsVal;
      soXdCumulativeContractsVal += soXdNewRevenues[t];
    }
    
    // 4. On-Premise Enterprise Revenues
    const entRevenues = new Array(tCount).fill(0);
    const entNewRevenues = new Array(tCount).fill(0);
    const entCumulativeOld = new Array(tCount).fill(0);
    const entAMC = new Array(tCount).fill(0);
    
    let entCumulativeContractsVal = 0;
    for (let t = 1; t < tCount; t++) {
      entNewRevenues[t] = inputs.onPrem.enterprise.newHd[t] * inputs.onPrem.enterprise.price[t];
      entAMC[t] = entCumulativeContractsVal * inputs.onPrem.amcRate;
      entRevenues[t] = entNewRevenues[t] + entAMC[t];
      entCumulativeOld[t] = entCumulativeContractsVal;
      entCumulativeContractsVal += entNewRevenues[t];
    }
    
    // Total Revenues
    const totalRevenues = new Array(tCount).fill(0);
    for (let t = 0; t < tCount; t++) {
      totalRevenues[t] = saasRevenues[t] + pmuRevenues[t] + soXdRevenues[t] + entRevenues[t];
    }
    
    // COGS & GP — giá vốn luôn theo % doanh thu (cogsPct)
    const cogsRates = inputs.cogsPct;
    const cogs = new Array(tCount).fill(0);
    const grossProfit = new Array(tCount).fill(0);
    for (let t = 0; t < tCount; t++) {
      cogs[t] = totalRevenues[t] * cogsRates[t];
      grossProfit[t] = totalRevenues[t] - cogs[t];
    }

    const total5yrRev = totalRevenues.reduce((a, b) => a + b, 0);
    const capPct = inputs.costMode === 'pct';
    const opPct = inputs.costMode === 'pct';

    // CAPEX — chế độ 'pct': % TỔNG doanh thu 5 năm (đầu tư trả trước)
    const capexRD = capPct ? inputs.capexPct.cap01_RD_staff * total5yrRev : inputs.capex.cap01_RD_staff;
    const capexEquip = capPct ? inputs.capexPct.cap02_equip * total5yrRev : inputs.capex.cap02_equip;
    const capexLicense = capPct ? inputs.capexPct.cap03_license * total5yrRev : inputs.capex.cap03_license;
    const capexMarketing = capPct ? inputs.capexPct.cap04_marketing * total5yrRev : inputs.capex.cap04_marketing;
    const capexConsulting = capPct ? inputs.capexPct.cap05_consulting * total5yrRev : inputs.capex.cap05_consulting;
    const totalCapexVal = capexRD + capexEquip + capexLicense + capexMarketing + capexConsulting;
    
    const capexRD_dist = [0.60/2.00, 1.10/2.00, 0.30/2.00];
    const capexEquip_dist = [0.08/0.10, 0.02/0.10, 0];
    const capexLicense_dist = [0.08/0.30, 0.18/0.30, 0.04/0.30];
    const capexMarketing_dist = [0.10/0.50, 0.35/0.50, 0.05/0.50];
    const capexConsulting_dist = [0.14/0.60, 0.45/0.60, 0.01/0.60];
    
    const capexRD_yearly = [capexRD * capexRD_dist[0], capexRD * capexRD_dist[1], capexRD * capexRD_dist[2], 0, 0];
    const capexEquip_yearly = [capexEquip * capexEquip_dist[0], capexEquip * capexEquip_dist[1], capexEquip * capexEquip_dist[2], 0, 0];
    const capexLicense_yearly = [capexLicense * capexLicense_dist[0], capexLicense * capexLicense_dist[1], capexLicense * capexLicense_dist[2], 0, 0];
    const capexMarketing_yearly = [capexMarketing * capexMarketing_dist[0], capexMarketing * capexMarketing_dist[1], capexMarketing * capexMarketing_dist[2], 0, 0];
    const capexConsulting_yearly = [capexConsulting * capexConsulting_dist[0], capexConsulting * capexConsulting_dist[1], capexConsulting * capexConsulting_dist[2], 0, 0];
    
    const totalCapexYearly = new Array(tCount).fill(0);
    for (let t = 0; t < tCount; t++) {
      totalCapexYearly[t] = capexRD_yearly[t] + capexEquip_yearly[t] + capexLicense_yearly[t] + capexMarketing_yearly[t] + capexConsulting_yearly[t];
    }
    
    // OPEX — chế độ 'pct': % doanh thu TỪNG NĂM; chế độ 'value': giá trị tuyệt đối
    const opexStaff = totalRevenues.map((r, t) => opPct ? inputs.opexPct.staff[t] * r : inputs.opex.staff[t]);
    const opexCloud = totalRevenues.map((r, t) => opPct ? inputs.opexPct.cloud[t] * r : inputs.opex.cloud[t]);
    const opexOthers = totalRevenues.map((r, t) => opPct ? inputs.opexPct.others[t] * r : inputs.opex.others[t]);
    const opexEffective = { staff: opexStaff, cloud: opexCloud, others: opexOthers };
    const totalOpexYearly = new Array(tCount).fill(0);
    for (let t = 0; t < tCount; t++) {
      totalOpexYearly[t] = opexStaff[t] + opexCloud[t] + opexOthers[t];
    }
    
    // Project Cash Flow (Kịch bản A - Lạc quan)
    const ebit = new Array(tCount).fill(0);
    const tax = new Array(tCount).fill(0);
    const netCashFlow = new Array(tCount).fill(0);
    const cumulativeNetCashFlow = new Array(tCount).fill(0);
    
    let cumFlow = 0;
    for (let t = 0; t < tCount; t++) {
      ebit[t] = grossProfit[t] - totalCapexYearly[t] - totalOpexYearly[t];
      tax[t] = ebit[t] > 0 ? ebit[t] * inputs.fin.taxRate : 0;
      netCashFlow[t] = ebit[t] - tax[t];
      cumFlow += netCashFlow[t];
      cumulativeNetCashFlow[t] = cumFlow;
    }
    
    // CIC Cash Flow
    const capexCIC = totalCapexYearly.map(v => v * inputs.fin.cicShare);
    const cicNetCashFlow = new Array(tCount).fill(0);
    const cicCumulativeNetCashFlow = new Array(tCount).fill(0);
    
    let cicCumFlow = 0;
    for (let t = 0; t < tCount; t++) {
      const cicEbit = grossProfit[t] - capexCIC[t] - totalOpexYearly[t];
      const cicTax = cicEbit > 0 ? cicEbit * inputs.fin.taxRate : 0;
      cicNetCashFlow[t] = cicEbit - cicTax;
      cicCumFlow += cicNetCashFlow[t];
      cicCumulativeNetCashFlow[t] = cicCumFlow;
    }
    
    // NPV / IRR / Payback (Project & CIC)
    const npvProject = calculateNPV(netCashFlow, inputs.fin.wacc);
    const irrProject = calculateIRR(netCashFlow);
    const paybackProject = calculatePaybackPeriod(cumulativeNetCashFlow, netCashFlow);
    
    const npvCic = calculateNPV(cicNetCashFlow, inputs.fin.wacc);
    const irrCic = calculateIRR(cicNetCashFlow);
    const paybackCic = calculatePaybackPeriod(cicCumulativeNetCashFlow, cicNetCashFlow);
    
    // Sensitivity scenarios
    const scenarios = [
      { name: 'Lạc quan', revCoeff: 1.0, opexCoeff: 1.0 },
      { name: 'Cơ sở', revCoeff: 0.55, opexCoeff: 1.0 },
      { name: 'Bi quan', revCoeff: 0.25, opexCoeff: 1.0 }
    ];
    
    const opexPctSum = totalRevenues.map((_, t) => inputs.opexPct.staff[t] + inputs.opexPct.cloud[t] + inputs.opexPct.others[t]);
    const capexPctSum = inputs.capexPct.cap01_RD_staff + inputs.capexPct.cap02_equip + inputs.capexPct.cap03_license + inputs.capexPct.cap04_marketing + inputs.capexPct.cap05_consulting;

    const scenarioResults = scenarios.map(sc => {
      const scRev = totalRevenues.map(r => r * sc.revCoeff);
      const scCogs = scRev.map((r, t) => r * cogsRates[t]);
      const scGp = scRev.map((r, t) => r - scCogs[t]);
      // Ở chế độ %, OPEX & CAPEX co giãn theo doanh thu của kịch bản; ở chế độ giá trị thì giữ cố định
      const scOpex = opPct
        ? scRev.map((r, t) => opexPctSum[t] * r)
        : totalOpexYearly.map(o => o * sc.opexCoeff);
      const scTotal5 = scRev.reduce((a, b) => a + b, 0);
      const scCapexTotal = capPct ? capexPctSum * scTotal5 : totalCapexVal;
      const scCapexYearly = totalCapexYearly.map(v => totalCapexVal > 0 ? (v / totalCapexVal) * scCapexTotal : 0);
      const scNetFlow = new Array(tCount).fill(0);
      const scCumFlow = new Array(tCount).fill(0);

      let cum = 0;
      for (let t = 0; t < tCount; t++) {
        const e = scGp[t] - scCapexYearly[t] - scOpex[t];
        const tx = e > 0 ? e * inputs.fin.taxRate : 0;
        scNetFlow[t] = e - tx;
        cum += scNetFlow[t];
        scCumFlow[t] = cum;
      }
      
      const npv = calculateNPV(scNetFlow, inputs.fin.wacc);
      const irr = calculateIRR(scNetFlow);
      const payback = calculatePaybackPeriod(scCumFlow, scNetFlow);
      
      return {
        name: sc.name,
        revenues: scRev,
        netFlows: scNetFlow,
        cumulativeFlows: scCumFlow,
        npv,
        irr,
        payback
      };
    });
    
    return {
      saasAvgUsers,
      saasUsers,
      saasChurnedUsers,
      saasRevenues,
      pmuRevenues,
      pmuNewRevenues,
      pmuCumulativeOld,
      pmuAMC,
      soXdRevenues,
      soXdNewRevenues,
      soXdCumulativeOld,
      soXdAMC,
      entRevenues,
      entNewRevenues,
      entCumulativeOld,
      entAMC,
      totalRevenues,
      cogs,
      grossProfit,
      capexRD_yearly,
      capexEquip_yearly,
      capexLicense_yearly,
      capexMarketing_yearly,
      capexConsulting_yearly,
      totalCapexYearly,
      totalOpexYearly,
      opexEffective,
      total5yrRev,
      capexEffective: { cap01: capexRD, cap02: capexEquip, cap03: capexLicense, cap04: capexMarketing, cap05: capexConsulting },
      ebit,
      tax,
      netCashFlow,
      cumulativeNetCashFlow,
      capexCIC,
      cicNetCashFlow,
      cicCumulativeNetCashFlow,
      npvProject,
      irrProject,
      paybackProject,
      npvCic,
      irrCic,
      paybackCic,
      scenarioResults
    };
  }, [inputs]);

  // Helpers for inputs change
  const handleInputChange = (category: string, field: string, index: number | null, value: number) => {
    setInputs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (index === null) {
        next[category][field] = value;
      } else {
        next[category][field][index] = value;
      }
      return next;
    });
  };

  const handleNestedInputChange = (category: string, subCategory: string, index: number, value: number) => {
    setInputs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[category][subCategory][index] = value;
      return next;
    });
  };

  // Save to Workspace via API
  const handleSaveToWorkspace = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/save-feasibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus({ success: true, message: 'Đã lưu cấu hình tài chính mới và tạo lại tệp báo cáo thành công!' });
      } else {
        setSaveStatus({ success: false, message: `Lỗi: ${data.error}` });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: `Lỗi mạng: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Helper to format currency
  const fNum = (v: number, dec = 2) => {
    if (v === 0 || v === null || v === undefined) return '—';
    const prefix = v < 0 ? '(' : '';
    const suffix = v < 0 ? ')' : '';
    const absVal = Math.abs(v);
    return `${prefix}${absVal.toFixed(dec).replace('.', ',')}${suffix}`;
  };

  const fPct = (v: number) => {
    if (v === null || v === undefined) return '—';
    return `${(v * 100).toFixed(0)}%`;
  };

  // ── Flowchart Renderers ──
  const renderAiConductorFlowchart = (key: number) => {
    return (
      <div key={`ai-conductor-flow-${key}`} className="my-6 border border-outline-variant bg-surface rounded-3xl p-6 shadow-sm flex flex-col items-center">
        <h5 className="font-bold text-xs uppercase tracking-wider text-primary mb-6 flex items-center gap-1.5">
          <Activity size={12} />
          Sơ đồ cấu trúc Mô hình Nhân sự AI-Conductor (02 người + AI)
        </h5>
        <div className="w-full max-w-[600px] aspect-[600/280] bg-surface-container-lowest/40 rounded-2xl p-2 border border-outline-variant/30">
          <svg viewBox="0 0 600 280" className="w-full h-full">
            <defs>
              <marker id="arrow-gray" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-outline" />
              </marker>
              <marker id="arrow-purple" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
              </marker>
            </defs>

            {/* Connectors */}
            <g>
              <line x1={255} y1={60} x2={345} y2={60} className="stroke-outline/60 stroke-2" strokeDasharray="3 3" markerStart="url(#arrow-gray)" markerEnd="url(#arrow-gray)" />
              <text x={300} y={50} className="text-[9px] fill-on-surface-variant font-medium text-center" textAnchor="middle">Hợp tác & Kiểm soát chéo</text>
            </g>

            <g>
              <line x1={200} y1={95} x2={250} y2={175} className="stroke-primary stroke-2" strokeDasharray="4 3" markerEnd="url(#arrow-purple)" />
              <rect x={125} y={122} width={105} height={16} rx={4} className="fill-surface stroke stroke-outline-variant/30" />
              <text x={177} y={133} className="text-[9px] fill-primary font-bold text-center" textAnchor="middle">Điều khiển & Code gen</text>
            </g>

            <g>
              <line x1={400} y1={95} x2={350} y2={175} className="stroke-primary stroke-2" strokeDasharray="4 3" markerEnd="url(#arrow-purple)" />
              <rect x={370} y={122} width={105} height={16} rx={4} className="fill-surface stroke stroke-outline-variant/30" />
              <text x={422} y={133} className="text-[9px] fill-primary font-bold text-center" textAnchor="middle">Tạo unit test & QC</text>
            </g>

            {/* Node 1: Lead CTO */}
            <g className="cursor-pointer group">
              <rect x={30} y={25} width={220} height={70} rx={12} className="fill-error-container/10 stroke-error/50 stroke-2 transition-all group-hover:fill-error-container/20 group-hover:stroke-error" />
              <circle cx={60} cy={60} r={18} className="fill-error/10 stroke-error/30" />
              <text x={60} y={65} className="text-sm fill-error text-center" textAnchor="middle">👤</text>
              <text x={90} y={50} className="text-xs font-bold fill-on-surface">Lead CTO / Full-stack Dev</text>
              <text x={90} y={65} className="text-[9px] fill-on-surface-variant">Kiến trúc sư & Code Backend chính</text>
              <text x={90} y={78} className="text-[9px] font-bold fill-error/80">01 người - Lương: 50tr/tháng</text>
            </g>

            {/* Node 2: Assistant Dev / QA */}
            <g className="cursor-pointer group">
              <rect x={350} y={25} width={220} height={70} rx={12} className="fill-success-container/10 stroke-success/50 stroke-2 transition-all group-hover:fill-success-container/20 group-hover:stroke-success" />
              <circle cx={380} cy={60} r={18} className="fill-success/10 stroke-success/30" />
              <text x={380} y={65} className="text-sm fill-success text-center" textAnchor="middle">👤</text>
              <text x={410} y={50} className="text-xs font-bold fill-on-surface">Trợ lý Dev / QA / BA</text>
              <text x={410} y={65} className="text-[9px] fill-on-surface-variant">Unit test, Data & Technical Support</text>
              <text x={410} y={78} className="text-[9px] font-bold fill-success/80">01 người - Lương: 30tr/tháng</text>
            </g>

            {/* Node 3: AI Co-Pilot */}
            <g className="cursor-pointer group">
              <rect x={170} y={175} width={260} height={80} rx={16} className="fill-primary-container/10 stroke-primary/70 stroke-2.5 transition-all group-hover:fill-primary-container/20 group-hover:stroke-primary" />
              <circle cx={210} cy={215} r={20} className="fill-primary/10 stroke-primary/30" />
              <text x={210} y={220} className="text-lg fill-primary text-center" textAnchor="middle">🤖</text>
              <text x={245} y={203} className="text-xs font-black fill-primary uppercase tracking-wider">AI Claude Code / Cursor</text>
              <text x={245} y={220} className="text-[9px] fill-on-surface-variant font-medium">Viết mã, sinh test và dò lỗi tự động 24/7</text>
              <text x={245} y={235} className="text-[9px] fill-primary font-bold">Trợ lý ảo tăng 3-5x hiệu suất làm việc</text>
            </g>
          </svg>
        </div>
      </div>
    );
  };

  const renderNovaCdeFlowchart = (key: number) => {
    return (
      <div key={`novacde-flow-${key}`} className="my-6 border border-outline-variant bg-surface rounded-3xl p-6 shadow-sm flex flex-col items-center">
        <h5 className="font-bold text-xs uppercase tracking-wider text-primary mb-6 flex items-center gap-1.5">
          <Activity size={12} />
          Sơ đồ Kiến trúc Hệ thống đối thủ NovaCDE (Suy luận)
        </h5>
        <div className="w-full max-w-[600px] aspect-[600/280] bg-surface-container-lowest/40 rounded-2xl p-2 border border-outline-variant/30">
          <svg viewBox="0 0 600 280" className="w-full h-full">
            <defs>
              <marker id="arrow-gray-novacde" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-outline" />
              </marker>
            </defs>

            {/* Connectors */}
            <line x1={300} y1={50} x2={300} y2={75} className="stroke-outline/60 stroke-2" markerEnd="url(#arrow-gray-novacde)" />
            <line x1={300} y1={120} x2={90} y2={175} className="stroke-outline/40 stroke-1.5" markerEnd="url(#arrow-gray-novacde)" />
            <line x1={300} y1={120} x2={210} y2={175} className="stroke-outline/40 stroke-1.5" markerEnd="url(#arrow-gray-novacde)" />
            <line x1={300} y1={120} x2={330} y2={175} className="stroke-outline/40 stroke-1.5" markerEnd="url(#arrow-gray-novacde)" />
            <line x1={300} y1={120} x2={450} y2={175} className="stroke-outline/40 stroke-1.5" markerEnd="url(#arrow-gray-novacde)" />
            <line x1={450} y1={220} x2={450} y2={238} className="stroke-outline/60 stroke-2" markerEnd="url(#arrow-gray-novacde)" />

            {/* Node FE */}
            <g className="cursor-pointer group">
              <rect x={200} y={15} width={200} height={35} rx={8} className="fill-primary-container/10 stroke-primary/50 stroke-2 transition-all group-hover:fill-primary-container/20 group-hover:stroke-primary" />
              <text x={300} y={37} className="text-[11px] font-bold fill-primary text-center" textAnchor="middle">Frontend: React/Angular SPA</text>
            </g>

            {/* Node BE */}
            <g className="cursor-pointer group">
              <rect x={190} y={75} width={220} height={45} rx={10} className="fill-secondary-container/10 stroke-secondary/50 stroke-2 transition-all group-hover:fill-secondary-container/20 group-hover:stroke-secondary" />
              <text x={300} y={102} className="text-xs font-bold fill-secondary text-center" textAnchor="middle">Backend: .NET/Java Microservices</text>
            </g>

            {/* Sub-node ODA */}
            <g className="cursor-pointer group">
              <rect x={30} y={175} width={120} height={45} rx={8} className="fill-surface-container/20 stroke-outline/40 stroke-1.5 transition-all group-hover:fill-surface-container/40 group-hover:stroke-outline" />
              <text x={90} y={193} className="text-[10px] font-bold fill-on-surface text-center" textAnchor="middle">ODA SDK Library</text>
              <text x={90} y={207} className="text-[8px] fill-on-surface-variant text-center" textAnchor="middle">Đọc native RVT, DWG</text>
            </g>

            {/* Sub-node GIS */}
            <g className="cursor-pointer group">
              <rect x={160} y={175} width={100} height={45} rx={8} className="fill-surface-container/20 stroke-outline/40 stroke-1.5 transition-all group-hover:fill-surface-container/40 group-hover:stroke-outline" />
              <text x={210} y={193} className="text-[10px] font-bold fill-on-surface text-center" textAnchor="middle">GIS 3D Maps</text>
              <text x={210} y={207} className="text-[8px] fill-on-surface-variant text-center" textAnchor="middle">Hạ tầng giao thông</text>
            </g>

            {/* Sub-node AI */}
            <g className="cursor-pointer group">
              <rect x={280} y={175} width={100} height={45} rx={8} className="fill-surface-container/20 stroke-outline/40 stroke-1.5 transition-all group-hover:fill-surface-container/40 group-hover:stroke-outline" />
              <text x={330} y={193} className="text-[10px] font-bold fill-on-surface text-center" textAnchor="middle">AI/ML Module</text>
              <text x={330} y={207} className="text-[8px] fill-on-surface-variant text-center" textAnchor="middle">Phân loại & dự báo</text>
            </g>

            {/* Sub-node DB */}
            <g className="cursor-pointer group">
              <rect x={400} y={175} width={100} height={45} rx={8} className="fill-success-container/10 stroke-success/50 stroke-1.5 transition-all group-hover:fill-success-container/20 group-hover:stroke-success" />
              <text x={450} y={193} className="text-[10px] font-bold fill-success text-center" textAnchor="middle">Database</text>
              <text x={450} y={207} className="text-[8px] fill-on-surface-variant text-center" textAnchor="middle">PostgreSQL / SQL Server</text>
            </g>

            {/* Node CLOUD */}
            <g className="cursor-pointer group">
              <rect x={390} y={238} width={120} height={32} rx={6} className="fill-primary-container/5 stroke-primary/30 stroke-1.5 transition-all group-hover:fill-primary-container/15 group-hover:stroke-primary/50" />
              <text x={450} y={258} className="text-[9px] font-bold fill-on-surface-variant text-center" textAnchor="middle">Viettel / VNPT Cloud</text>
            </g>
          </svg>
        </div>
      </div>
    );
  };

  // Renders simple markdown string parts into JSX, including table and code block support
  // Inline formatting (bold/italic/code) applied PER-LINE so it never corrupts ``` code fences.
  const inlineFmt = (s: string) =>
    s
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-on-surface-variant italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-surface-container-high px-1.5 py-0.5 rounded font-mono text-[12px] text-primary">$1</code>');

  const renderMarkdownText = (text: string, glossaryUsed?: Set<string>, headingRef?: { n: number }) => {
    // Wrap technical terms with a hover-tooltip (first occurrence only) inside prose.
    const fmtProse = (s: string) => glossaryUsed ? wrapGlossaryTerms(inlineFmt(s), glossaryUsed) : inlineFmt(s);
    // Only HTML-escape globally; inline formatting is applied per-line below.
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = html.split('\n');
    const elements: (React.ReactNode)[] = [];
    let headingCount = 0;
    
    let inTable = false;
    let tableRows: string[] = [];
    
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeBlockLang = '';
    
    const flushTable = (key: number) => {
      if (tableRows.length === 0) return null;
      
      const rawHeader = tableRows[0];
      const headerCols = rawHeader
        .split('|')
        .map(s => s.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      const bodyRows = tableRows.slice(2).map(r => 
        r.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      );
      
      tableRows = [];
      
      return (
        <div key={`table-${key}`} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="bg-primary text-on-primary">
                {headerCols.map((col, idx) => (
                  <th key={idx} className="px-4 py-3 font-semibold border-r border-on-primary/10 last:border-0" dangerouslySetInnerHTML={{ __html: inlineFmt(col) }} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {bodyRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-surface-container-low transition-colors odd:bg-surface-container-lowest/30">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-2.5 text-on-surface border-r border-outline-variant/30 last:border-0" dangerouslySetInnerHTML={{ __html: inlineFmt(cell) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = trimmed.slice(3).trim();
          codeBlockLines = [];
          continue;
        } else {
          inCodeBlock = false;
          const blockText = codeBlockLines.join('\n');
          
          if (codeBlockLang === 'mermaid' && blockText.includes('Mô hình Nhân sự siêu tinh gọn')) {
            elements.push(renderAiConductorFlowchart(i));
          } else if (codeBlockLang === 'mermaid' && blockText.includes('NovaCDE Architecture')) {
            elements.push(renderNovaCdeFlowchart(i));
          } else {
            elements.push(
              <div key={`code-${i}`} className="my-6 border border-outline-variant rounded-2xl overflow-hidden shadow-sm bg-[#1e1e2e] text-[#cdd6f4] font-mono text-xs">
                <div className="bg-[#181825] px-4 py-2 border-b border-[#313244] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
                  </div>
                  <span className="text-[10px] text-outline uppercase tracking-wider">{codeBlockLang || 'terminal'}</span>
                </div>
                <pre className="p-4 overflow-x-auto leading-relaxed">
                  <code>{blockText}</code>
                </pre>
              </div>
            );
          }
          continue;
        }
      }
      
      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }
      
      if (trimmed.startsWith('|')) {
        inTable = true;
        tableRows.push(trimmed);
        continue;
      } else {
        if (inTable) {
          const tbl = flushTable(i);
          if (tbl) elements.push(tbl);
          inTable = false;
        }
      }

      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-2xl font-extrabold text-primary tracking-tight mt-8 mb-4 border-b border-outline-variant pb-2" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(2)) }} />);
      } else if (trimmed.startsWith('## ')) {
        const id = `heading-${headingRef ? headingRef.n++ : headingCount++}`;
        elements.push(<h2 id={id} key={i} className="text-xl font-bold text-on-surface tracking-tight mt-8 mb-4 pb-1 border-b border-outline-variant/30 scroll-mt-24" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(3)) }} />);
      } else if (trimmed.startsWith('### ')) {
        const id = `heading-${headingRef ? headingRef.n++ : headingCount++}`;
        elements.push(<h3 id={id} key={i} className="text-lg font-bold text-primary mt-6 mb-3 scroll-mt-24" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(4)) }} />);
      } else if (trimmed.startsWith('#### ')) {
        elements.push(<h4 key={i} className="text-md font-bold text-secondary mt-5 mb-2" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(5)) }} />);
      } else if (trimmed.startsWith('##### ')) {
        elements.push(<h5 key={i} className="text-xs font-bold text-tertiary uppercase tracking-wider mt-4 mb-2" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(6)) }} />);
      } else if (trimmed.startsWith('&gt; ')) {
        elements.push(<blockquote key={i} className="border-l-4 border-primary bg-primary-container/10 px-4 py-3 my-4 rounded-r-xl text-on-surface-variant text-[13px] italic" dangerouslySetInnerHTML={{ __html: inlineFmt(trimmed.slice(5)) }} />);
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        elements.push(<li key={i} className="ml-6 list-disc text-sm text-on-surface-variant mb-1.5" dangerouslySetInnerHTML={{ __html: fmtProse(trimmed.slice(2)) }} />);
      } else if (trimmed === '---') {
        elements.push(<hr key={i} className="border-outline-variant/30 my-8" />);
      } else if (trimmed === '') {
        elements.push(null);
      } else {
        elements.push(<p key={i} className="text-sm text-on-surface-variant leading-relaxed mb-4 text-justify" dangerouslySetInnerHTML={{ __html: fmtProse(trimmed) }} />);
      }
    }

    if (inTable) {
      const tbl = flushTable(lines.length);
      if (tbl) elements.push(tbl);
    }

    return elements;
  };

  // Segment Markdown text from imports by table identifiers
  const parsedReportJSX = useMemo(() => {
    const regex = /(<!-- TABLE_[A-Z0-9_]+_START -->[\s\S]*?<!-- TABLE_[A-Z0-9_]+_END -->)/g;
    const parts = reportMarkdown.split(regex);
    const glossaryUsed = new Set<string>(); // gắn tooltip thuật ngữ chỉ ở lần xuất hiện đầu tiên
    const headingRef = { n: 0 }; // bộ đếm heading TOÀN CỤC để id khớp với Mục lục (tocItems)

    return parts.map((part, index) => {
      if (part.startsWith('<!-- TABLE_')) {
        const idMatch = part.match(/<!-- TABLE_([A-Z0-9_]+)_START -->/);
        const id = idMatch ? idMatch[1] : '';

        // Financial tables live in the dedicated "Tài chính" tab — show a callout here.
        if (FINANCE_TABLE_IDS.has(id)) {
          if (!FINANCE_CALLOUT_ANCHOR_IDS.has(id)) return null;
          return (
            <button
              key={index}
              onClick={() => setActiveTab('financial')}
              className="group my-5 w-full flex items-center gap-3 text-left bg-primary-container/15 hover:bg-primary-container/30 border border-primary/30 rounded-xl px-5 py-4 transition-colors cursor-pointer"
            >
              <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Calculator size={18} /></span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-on-surface">Bảng số liệu tài chính có thể điều chỉnh</span>
                <span className="block text-xs text-on-surface-variant">Xem chi tiết & nhập tay điều chỉnh giả định (CAPEX, OPEX, doanh thu, NPV/IRR) tại tab <b>Tài chính</b>.</span>
              </span>
              <ArrowRight size={18} className="text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          );
        }

        switch (id) {
          case '6_2A':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Mã</th>
                      <th className="px-4 py-3 font-semibold">Hạng mục đầu tư</th>
                      <th className="px-4 py-3 font-semibold text-center">2026 (Q3-Q4)</th>
                      <th className="px-4 py-3 font-semibold text-center">2027 (Full Year)</th>
                      <th className="px-4 py-3 font-semibold text-center">2028 (Q1)</th>
                      <th className="px-4 py-3 font-semibold text-center">Tổng</th>
                      <th className="px-4 py-3 font-semibold">Giải trình</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5 font-mono">CAP-01</td>
                      <td className="px-4 py-2.5 font-semibold">Nhân sự phát triển lõi</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexRD_yearly[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexRD_yearly[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexRD_yearly[2])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.capex.cap01_RD_staff)}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">Lương gộp R&D & AI tools.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">CAP-02</td>
                      <td className="px-4 py-2.5 font-semibold">Trang thiết bị văn phòng</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexEquip_yearly[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexEquip_yearly[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexEquip_yearly[2])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.capex.cap02_equip)}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">Workstations R&D đồ họa.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">CAP-03</td>
                      <td className="px-4 py-2.5 font-semibold">Bản quyền & API tích hợp</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexLicense_yearly[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexLicense_yearly[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexLicense_yearly[2])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.capex.cap03_license)}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">API AI, hạ tầng GIS (MapBox).</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">CAP-04</td>
                      <td className="px-4 py-2.5 font-semibold">Marketing & Sales ra mắt</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexMarketing_yearly[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexMarketing_yearly[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexMarketing_yearly[2])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.capex.cap04_marketing)}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">Khảo sát Sở XD/PMU, hội thảo.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">CAP-05</td>
                      <td className="px-4 py-2.5 font-semibold">Tư vấn, PM & Pháp lý</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexConsulting_yearly[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexConsulting_yearly[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.capexConsulting_yearly[2])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.capex.cap05_consulting)}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant">Kiểm định QCVN 12, bản quyền.</td>
                    </tr>
                    <tr className="bg-surface-container-low font-bold">
                      <td className="px-4 py-3" colSpan={2}>TỔNG CỘNG CAPEX</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalCapexYearly[0])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalCapexYearly[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalCapexYearly[2])}</td>
                      <td className="px-4 py-3 text-center text-primary">{fNum(calcs.totalCapexYearly.reduce((a,b)=>a+b, 0))}</td>
                      <td className="px-4 py-3 text-[11px] text-on-surface-variant">
                        100% tự đầu tư bởi CIC (không sử dụng ngân sách nhà nước).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_2C':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Mã</th>
                      <th className="px-4 py-3 font-semibold">Hạng mục chi phí vận hành</th>
                      <th className="px-4 py-3 font-semibold text-center">2026</th>
                      <th className="px-4 py-3 font-semibold text-center">2027</th>
                      <th className="px-4 py-3 font-semibold text-center">2028</th>
                      <th className="px-4 py-3 font-semibold text-center">2029</th>
                      <th className="px-4 py-3 font-semibold text-center">2030</th>
                      <th className="px-4 py-3 font-semibold text-center">Tổng 5 năm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5 font-mono">OPX-01</td>
                      <td className="px-4 py-2.5 font-semibold">Nhân sự vận hành (gồm overhead)</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.staff[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.staff[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.staff[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.staff[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.staff[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.opex.staff.reduce((a,b)=>a+b, 0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">OPX-02</td>
                      <td className="px-4 py-2.5 font-semibold">Chi phí thuê hạ tầng đám mây (Cloud)</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.cloud[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.cloud[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.cloud[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.cloud[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.cloud[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.opex.cloud.reduce((a,b)=>a+b, 0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono">OPX-03</td>
                      <td className="px-4 py-2.5 font-semibold">Các chi phí vận hành khác</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.others[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.others[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.others[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.others[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(inputs.opex.others[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(inputs.opex.others.reduce((a,b)=>a+b, 0))}</td>
                    </tr>
                    <tr className="bg-surface-container-low font-bold">
                      <td className="px-4 py-3" colSpan={2}>TỔNG OPEX TOÀN HỆ THỐNG</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalOpexYearly[0])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalOpexYearly[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalOpexYearly[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalOpexYearly[3])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalOpexYearly[4])}</td>
                      <td className="px-4 py-3 text-center text-primary">{fNum(calcs.totalOpexYearly.reduce((a,b)=>a+b, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_4A':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Phân khúc</th>
                      <th className="px-4 py-3 font-semibold">Tiêu chí đánh giá số lượng</th>
                      <th className="px-4 py-3 font-semibold text-center">2026</th>
                      <th className="px-4 py-3 font-semibold text-center">2027 (H2)</th>
                      <th className="px-4 py-3 font-semibold text-center">2028</th>
                      <th className="px-4 py-3 font-semibold text-center">2029</th>
                      <th className="px-4 py-3 font-semibold text-center">2030</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5 font-bold" rowSpan={3}>1. Kênh SaaS</td>
                      <td className="px-4 py-2.5">Số user đầu kỳ</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">0</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[1]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[2]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[3]}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Số user cuối kỳ</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[1]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[2]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[3]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.saas.users[4]}</td>
                    </tr>
                    <tr className="bg-surface-container-low font-bold">
                      <td className="px-4 py-2.5">Số user hoạt động trung bình (tính DT)</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">{(inputs.saas.users[1]/2).toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-center">{((inputs.saas.users[1]+inputs.saas.users[2])/2).toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-center">{((inputs.saas.users[2]+inputs.saas.users[3])/2).toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-center">{((inputs.saas.users[3]+inputs.saas.users[4])/2).toFixed(0)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-bold" rowSpan={2}>2. On-Prem PMU</td>
                      <td className="px-4 py-2.5">Hợp đồng mới ký trong năm (HĐ)</td>
                      <td className="px-4 py-2.5 text-center">0</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[1]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[2]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[3]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[4]}</td>
                    </tr>
                    <tr className="bg-surface-container-low">
                      <td className="px-4 py-2.5">Lũy kế số PMU sử dụng hệ thống</td>
                      <td className="px-4 py-2.5 text-center">0</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[1]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]}</td>
                      <td className="px-4 py-2.5 text-center">{inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3]}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-primary">{inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3]+inputs.onPrem.pmu.newHd[4]}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_4B':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Phân khúc kênh</th>
                      <th className="px-4 py-3 font-semibold">Công thức tính toán</th>
                      <th className="px-4 py-3 font-semibold text-center">2026</th>
                      <th className="px-4 py-3 font-semibold text-center">2027</th>
                      <th className="px-4 py-3 font-semibold text-center">2028</th>
                      <th className="px-4 py-3 font-semibold text-center">2029</th>
                      <th className="px-4 py-3 font-semibold text-center">2030</th>
                      <th className="px-4 py-3 font-semibold text-center">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">1. Kênh SaaS</td>
                      <td className="px-4 py-2.5">User TB × ARPU × Số tháng</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">
                        {fNum(calcs.saasRevenues[1])}
                        <FormulaInfo 
                          formula="DT_SaaS = (Users[t-1] + Users[t]) / 2 * ARPU * Months / 1000" 
                          calcDetail={`2027: (${inputs.saas.users[0]} + ${inputs.saas.users[1]}) / 2 = ${calcs.saasAvgUsers[1]} users × ${inputs.saas.arpu[1]} tr × ${inputs.saas.months[1]} th = ${fNum(calcs.saasRevenues[1])} tỷ`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.saasRevenues[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.saasRevenues[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.saasRevenues[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.saasRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">2. On-Prem PMU</td>
                      <td className="px-4 py-2.5">HĐ mới + Lũy kế HĐ cũ × AMC (15%)</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">
                        {fNum(calcs.pmuRevenues[1])}
                        <FormulaInfo 
                          formula="DT_PMU = (New_HĐ * Price) + (Lũy_Kế_HĐ_Cũ_Value * 15%)" 
                          calcDetail={`2027: (${inputs.onPrem.pmu.newHd[1]} * ${inputs.onPrem.pmu.price[1]}) + (${calcs.pmuCumulativeOld[1]} * 15%) = ${fNum(calcs.pmuRevenues[1])} tỷ`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {fNum(calcs.pmuRevenues[2])}
                        <FormulaInfo 
                          formula="DT_PMU = (New_HĐ * Price) + (Lũy_Kế_HĐ_Cũ_Value * 15%)" 
                          calcDetail={`2028: (${inputs.onPrem.pmu.newHd[2]} * ${inputs.onPrem.pmu.price[2]}) + (${calcs.pmuCumulativeOld[2]} * 15%) = ${inputs.onPrem.pmu.newHd[2] * inputs.onPrem.pmu.price[2]} + ${fNum(calcs.pmuAMC[2])} = ${fNum(calcs.pmuRevenues[2])} tỷ`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.pmuRevenues[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.pmuRevenues[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.pmuRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">3. On-Prem Sở XD</td>
                      <td className="px-4 py-2.5">HĐ mới + Lũy kế HĐ cũ × AMC (15%)</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.soXdRevenues[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.soXdRevenues[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.soXdRevenues[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.soXdRevenues[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.soXdRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">4. On-Prem Doanh nghiệp</td>
                      <td className="px-4 py-2.5">HĐ mới + Lũy kế HĐ cũ × AMC (15%)</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.entRevenues[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.entRevenues[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.entRevenues[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.entRevenues[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.entRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container-low font-bold text-primary">
                      <td className="px-4 py-3">TỔNG DOANH THU</td>
                      <td className="px-4 py-3">Tổng cộng 4 kênh</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues[0])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues[3])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues[4])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.totalRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_5_1':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Chỉ tiêu</th>
                      <th className="px-4 py-3 font-semibold text-center">2026</th>
                      <th className="px-4 py-3 font-semibold text-center">2027</th>
                      <th className="px-4 py-3 font-semibold text-center">2028</th>
                      <th className="px-4 py-3 font-semibold text-center">2029</th>
                      <th className="px-4 py-3 font-semibold text-center">2030</th>
                      <th className="px-4 py-3 font-semibold text-center">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr className="font-semibold">
                      <td className="px-4 py-2.5">Doanh thu</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.totalRevenues[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.totalRevenues[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.totalRevenues[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.totalRevenues[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.totalRevenues[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.totalRevenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Giá vốn hàng bán (COGS)</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.cogs[0])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.cogs[1])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.cogs[2])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.cogs[3])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.cogs[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-error">{fNum(-calcs.cogs.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container-low font-bold">
                      <td className="px-4 py-2.5">Lợi nhuận gộp</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[4])}</td>
                      <td className="px-4 py-2.5 text-center text-primary">{fNum(calcs.grossProfit.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Chi chi đầu tư CAPEX</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalCapexYearly[0])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalCapexYearly[1])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalCapexYearly[2])}</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center font-bold text-error">{fNum(-calcs.totalCapexYearly.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Chi phí vận hành OPEX</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[0])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[1])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[2])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[3])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-error">{fNum(-calcs.totalOpexYearly.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container font-bold text-primary">
                      <td className="px-4 py-3">Dòng tiền ròng dự án (EBIT)</td>
                      <td className="px-4 py-3 text-center">
                        {fNum(calcs.ebit[0])}
                        <FormulaInfo 
                          formula="EBIT = Lợi nhuận gộp - CAPEX - OPEX" 
                          calcDetail={`2026: ${fNum(calcs.grossProfit[0])} - ${fNum(calcs.totalCapexYearly[0])} - ${fNum(calcs.totalOpexYearly[0])} = ${fNum(calcs.ebit[0])} tỷ`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.ebit[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.ebit[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.ebit[3])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.ebit[4])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.ebit.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container font-bold">
                      <td className="px-4 py-3">Dòng tiền ròng tích lũy</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cumulativeNetCashFlow[0])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cumulativeNetCashFlow[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cumulativeNetCashFlow[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cumulativeNetCashFlow[3])}</td>
                      <td className="px-4 py-3 text-center text-success">{fNum(calcs.cumulativeNetCashFlow[4])}</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_5_2':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Chỉ tiêu</th>
                      <th className="px-4 py-3 font-semibold text-center">2026</th>
                      <th className="px-4 py-3 font-semibold text-center">2027</th>
                      <th className="px-4 py-3 font-semibold text-center">2028</th>
                      <th className="px-4 py-3 font-semibold text-center">2029</th>
                      <th className="px-4 py-3 font-semibold text-center">2030</th>
                      <th className="px-4 py-3 font-semibold text-center">Tổng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5">Lợi nhuận gộp</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[0])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[1])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[2])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[3])}</td>
                      <td className="px-4 py-2.5 text-center">{fNum(calcs.grossProfit[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{fNum(calcs.grossProfit.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">CAPEX của CIC ({fPct(inputs.fin.cicShare)})</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.capexCIC[0])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.capexCIC[1])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.capexCIC[2])}</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center">—</td>
                      <td className="px-4 py-2.5 text-center font-bold text-error">{fNum(-calcs.capexCIC.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">OPEX</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[0])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[1])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[2])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[3])}</td>
                      <td className="px-4 py-2.5 text-center text-error">{fNum(-calcs.totalOpexYearly[4])}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-error">{fNum(-calcs.totalOpexYearly.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container font-bold text-primary">
                      <td className="px-4 py-3">Dòng tiền ròng CIC</td>
                      <td className="px-4 py-3 text-center">
                        {fNum(calcs.cicNetCashFlow[0])}
                        <FormulaInfo 
                          formula="CF_CIC = Lợi nhuận gộp - (CAPEX * 70%) - OPEX" 
                          calcDetail={`2026: ${fNum(calcs.grossProfit[0])} - ${fNum(calcs.capexCIC[0])} - ${fNum(calcs.totalOpexYearly[0])} = ${fNum(calcs.cicNetCashFlow[0])} tỷ`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicNetCashFlow[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicNetCashFlow[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicNetCashFlow[3])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicNetCashFlow[4])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicNetCashFlow.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                    <tr className="bg-surface-container font-bold">
                      <td className="px-4 py-3">Tích lũy CIC</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicCumulativeNetCashFlow[0])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicCumulativeNetCashFlow[1])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicCumulativeNetCashFlow[2])}</td>
                      <td className="px-4 py-3 text-center">{fNum(calcs.cicCumulativeNetCashFlow[3])}</td>
                      <td className="px-4 py-3 text-center text-success">{fNum(calcs.cicCumulativeNetCashFlow[4])}</td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_5BIS_B':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Năm</th>
                      <th className="px-4 py-3 font-semibold text-center">A (Lạc quan)</th>
                      <th className="px-4 py-3 font-semibold text-center">B (Cơ sở - 55%)</th>
                      <th className="px-4 py-3 font-semibold text-center">C (Bi quan - 25%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 text-center">
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2026</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues[0])}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues[0])}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues[0])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2027</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues[1])}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues[1])}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues[1])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2028</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues[2])}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues[2])}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues[2])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2029</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues[3])}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues[3])}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues[3])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2030</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues[4])}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues[4])}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues[4])}</td>
                    </tr>
                    <tr className="bg-surface-container font-bold text-primary">
                      <td className="px-4 py-3 text-left">Tổng 5 năm</td>
                      <td>{fNum(calcs.scenarioResults[0].revenues.reduce((a,b)=>a+b,0))}</td>
                      <td>{fNum(calcs.scenarioResults[1].revenues.reduce((a,b)=>a+b,0))}</td>
                      <td>{fNum(calcs.scenarioResults[2].revenues.reduce((a,b)=>a+b,0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_5BIS_C':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Năm</th>
                      <th className="px-4 py-3 font-semibold text-center">A (Lạc quan)</th>
                      <th className="px-4 py-3 font-semibold text-center">B (Cơ sở)</th>
                      <th className="px-4 py-3 font-semibold text-center">C (Bi quan)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 text-center">
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2026</td>
                      <td>{fNum(calcs.scenarioResults[0].cumulativeFlows[0])}</td>
                      <td>{fNum(calcs.scenarioResults[1].cumulativeFlows[0])}</td>
                      <td>{fNum(calcs.scenarioResults[2].cumulativeFlows[0])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2027</td>
                      <td>{fNum(calcs.scenarioResults[0].cumulativeFlows[1])}</td>
                      <td>{fNum(calcs.scenarioResults[1].cumulativeFlows[1])}</td>
                      <td>{fNum(calcs.scenarioResults[2].cumulativeFlows[1])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2028</td>
                      <td>{fNum(calcs.scenarioResults[0].cumulativeFlows[2])}</td>
                      <td>{fNum(calcs.scenarioResults[1].cumulativeFlows[2])}</td>
                      <td>{fNum(calcs.scenarioResults[2].cumulativeFlows[2])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2029</td>
                      <td>{fNum(calcs.scenarioResults[0].cumulativeFlows[3])}</td>
                      <td>{fNum(calcs.scenarioResults[1].cumulativeFlows[3])}</td>
                      <td>{fNum(calcs.scenarioResults[2].cumulativeFlows[3])}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-left font-semibold">2030</td>
                      <td className="text-success">{fNum(calcs.scenarioResults[0].cumulativeFlows[4])}</td>
                      <td className="text-success">{fNum(calcs.scenarioResults[1].cumulativeFlows[4])}</td>
                      <td className="text-error">{fNum(calcs.scenarioResults[2].cumulativeFlows[4])}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          case '6_5BIS_D':
            return (
              <div key={index} className="my-6 overflow-x-auto border border-outline-variant rounded-xl bg-surface">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-primary text-on-primary">
                      <th className="px-4 py-3 font-semibold">Chỉ số tài chính</th>
                      <th className="px-4 py-3 font-semibold text-center">A (Lạc quan)</th>
                      <th className="px-4 py-3 font-semibold text-center">B (Cơ sở)</th>
                      <th className="px-4 py-3 font-semibold text-center">C (Bi quan)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">NPV toàn dự án (5 năm)</td>
                      <td className="text-center font-bold text-success">
                        {fNum(calcs.scenarioResults[0].npv)} tỷ
                        <FormulaInfo 
                          formula="NPV = ∑ [CF(t) / (1 + WACC)^t]" 
                          calcDetail={`Chiết khấu dòng tiền 5 năm với WACC = ${fPct(inputs.fin.wacc)}`}
                        />
                      </td>
                      <td className="text-center font-bold text-success">{fNum(calcs.scenarioResults[1].npv)} tỷ</td>
                      <td className="text-center font-bold text-error">{fNum(calcs.scenarioResults[2].npv)} tỷ</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">Tỷ suất sinh lời nội bộ (IRR)</td>
                      <td className="text-center font-bold">
                        {calcs.scenarioResults[0].irr ? (calcs.scenarioResults[0].irr*100).toFixed(0)+'%' : 'Âm'}
                        <FormulaInfo 
                          formula="IRR = Rate r where NPV(r) = 0" 
                          calcDetail="Giải thuật tính toán số học trên chuỗi dòng tiền ròng"
                        />
                      </td>
                      <td className="text-center font-bold">{calcs.scenarioResults[1].irr ? (calcs.scenarioResults[1].irr*100).toFixed(0)+'%' : 'Âm'}</td>
                      <td className="text-center font-bold text-error">{calcs.scenarioResults[2].irr ? (calcs.scenarioResults[2].irr*100).toFixed(0)+'%' : 'Âm'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">Thời gian hoàn vốn</td>
                      <td className="text-center">
                        {calcs.scenarioResults[0].payback ? `Q${Math.ceil((calcs.scenarioResults[0].payback % 1) * 4)}/${Math.floor(2026 + calcs.scenarioResults[0].payback)}` : 'Sau 2031'}
                        <FormulaInfo 
                          formula="Hoàn vốn = năm_cuối_âm + (dòng_tích_lũy_âm / dòng_tiền_năm_sau)" 
                          calcDetail={`Kịch bản A: ${(calcs.scenarioResults[0].payback || 0).toFixed(2)} năm kể từ đầu 2026`}
                        />
                      </td>
                      <td className="text-center">{calcs.scenarioResults[1].payback ? `Q${Math.ceil((calcs.scenarioResults[1].payback % 1) * 4)}/${Math.floor(2026 + calcs.scenarioResults[1].payback)}` : 'Sau 2031'}</td>
                      <td className="text-center text-error">{calcs.scenarioResults[2].payback ? `Sau 2031` : 'Sau 2031'}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-semibold">Cash burn tối đa (vốn lưu động)</td>
                      <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[0].cumulativeFlows))} tỷ</td>
                      <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[1].cumulativeFlows))} tỷ</td>
                      <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[2].cumulativeFlows))} tỷ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          default:
            return <div key={index} className="bg-error/15 border border-error/30 text-error p-3 rounded-lg text-xs my-3">Bảng {id} đang tải…</div>;
        }
      }
      return <div key={index}>{renderMarkdownText(part, glossaryUsed, headingRef)}</div>;
    });
  }, [reportMarkdown, calcs, inputs]);

  // Export report to markdown file download
  const handleDownloadMarkdown = () => {
    // Generate Markdown dynamically
    let md = reportMarkdown;
    
    const replacements = {
      '6_2A': [
        `| Mã | Hạng mục đầu tư | 2026 (Q3-Q4) | 2027 (Full Year) | 2028 (Q1) | Tổng | Giải trình chi tiết hạng mục |`,
        `|:---|:---|:---:|:---:|:---:|:---:|:---|`,
        `| CAP-01 | **Nhân sự phát triển lõi** | ${fNum(calcs.capexRD_yearly[0])} | ${fNum(calcs.capexRD_yearly[1])} | ${fNum(calcs.capexRD_yearly[2])} | **${fNum(calcs.capexEffective.cap01)}** | Lương R&D. |`,
        `| CAP-02 | **Trang thiết bị văn phòng** | ${fNum(calcs.capexEquip_yearly[0])} | ${fNum(calcs.capexEquip_yearly[1])} | ${fNum(calcs.capexEquip_yearly[2])} | **${fNum(calcs.capexEffective.cap02)}** | Thiết bị. |`,
        `| CAP-03 | **Bản quyền & API tích hợp** | ${fNum(calcs.capexLicense_yearly[0])} | ${fNum(calcs.capexLicense_yearly[1])} | ${fNum(calcs.capexLicense_yearly[2])} | **${fNum(calcs.capexEffective.cap03)}** | API, MapBox. |`,
        `| CAP-04 | **Marketing & Sales ra mắt** | ${fNum(calcs.capexMarketing_yearly[0])} | ${fNum(calcs.capexMarketing_yearly[1])} | ${fNum(calcs.capexMarketing_yearly[2])} | **${fNum(calcs.capexEffective.cap04)}** | Marketing B2B. |`,
        `| CAP-05 | **Tư vấn, PM & Pháp lý** | ${fNum(calcs.capexConsulting_yearly[0])} | ${fNum(calcs.capexConsulting_yearly[1])} | ${fNum(calcs.capexConsulting_yearly[2])} | **${fNum(calcs.capexEffective.cap05)}** | QCVN 12, ISO. |`,
        `| | **TỔNG CỘNG CAPEX** | **${fNum(calcs.totalCapexYearly[0])}** | **${fNum(calcs.totalCapexYearly[1])}** | **${fNum(calcs.totalCapexYearly[2])}** | **${fNum(calcs.totalCapexYearly.reduce((a,b)=>a+b, 0))}** | 100% vốn CIC |`
      ].join('\n'),
      
      '6_2C': [
        `| Mã OPEX | Hạng mục chi phí vận hành | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng 5 năm |`,
        `|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
        `| OPX-01 | Nhân sự vận hành | ${fNum(calcs.opexEffective.staff[0])} | ${fNum(calcs.opexEffective.staff[1])} | ${fNum(calcs.opexEffective.staff[2])} | ${fNum(calcs.opexEffective.staff[3])} | ${fNum(calcs.opexEffective.staff[4])} | **${fNum(calcs.opexEffective.staff.reduce((a: number, b: number) => a + b, 0))}** |`,
        `| OPX-02 | Hạ tầng Cloud | ${fNum(calcs.opexEffective.cloud[0])} | ${fNum(calcs.opexEffective.cloud[1])} | ${fNum(calcs.opexEffective.cloud[2])} | ${fNum(calcs.opexEffective.cloud[3])} | ${fNum(calcs.opexEffective.cloud[4])} | **${fNum(calcs.opexEffective.cloud.reduce((a: number, b: number) => a + b, 0))}** |`,
        `| OPX-03 | Chi phí vận hành khác | ${fNum(calcs.opexEffective.others[0])} | ${fNum(calcs.opexEffective.others[1])} | ${fNum(calcs.opexEffective.others[2])} | ${fNum(calcs.opexEffective.others[3])} | ${fNum(calcs.opexEffective.others[4])} | **${fNum(calcs.opexEffective.others.reduce((a: number, b: number) => a + b, 0))}** |`,
        `| | **TỔNG OPEX** | **${fNum(calcs.totalOpexYearly[0])}** | **${fNum(calcs.totalOpexYearly[1])}** | **${fNum(calcs.totalOpexYearly[2])}** | **${fNum(calcs.totalOpexYearly[3])}** | **${fNum(calcs.totalOpexYearly[4])}** | **${fNum(calcs.totalOpexYearly.reduce((a,b)=>a+b,0))}** |`
      ].join('\n'),
      
      '6_4A': getTable6_4a(inputs, calcs),
      '6_4B': getTable6_4b(calcs, inputs),
      '6_5_1': getTable6_5_1(calcs),
      '6_5_2': getTable6_5_2(calcs, inputs),
      '6_5_3': [
        `| Chỉ số (Kịch bản A) | Giá trị | Ghi chú |`,
        `|:---|:---:|:---|`,
        `| **NPV toàn dự án (= riêng CIC)** | ${fmtVal(calcs.npvProject)} tỷ | Chiết khấu WACC ${(inputs.fin.wacc * 100).toFixed(0)}%, năm gốc 2026 |`,
        `| **IRR** | ${calcs.irrProject == null ? 'Âm' : calcs.irrProject > 1 ? '>100% (lý thuyết)' : (calcs.irrProject * 100).toFixed(0) + '%'} | Rất cao do chi phí siêu tinh gọn — không dùng làm chỉ số quyết định chính |`,
        `| **Thời gian hoàn vốn lũy kế** | ${calcs.paybackProject ? 'trong năm ' + Math.floor(2026 + calcs.paybackProject) : 'Sau 2031'} | |`,
        `| **Đỉnh điểm dòng tiền âm** | ${fmtVal(Math.min(...calcs.cumulativeNetCashFlow))} tỷ | Vốn lưu động cần chuẩn bị (gồm biên an toàn) |`
      ].join('\n'),
      '6_5BIS_B': getTable6_5bis_b(calcs),
      '6_5BIS_C': getTable6_5bis_c(calcs),
      '6_5BIS_D': getTable6_5bis_d(calcs, inputs)
    };
    
    for (const [id, tableMd] of Object.entries(replacements)) {
      const startTag = `<!-- TABLE_${id}_START -->`;
      const endTag = `<!-- TABLE_${id}_END -->`;
      const startIdx = md.indexOf(startTag);
      const endIdx = md.indexOf(endTag);
      if (startIdx !== -1 && endIdx !== -1) {
        const before = md.slice(0, startIdx + startTag.length);
        const after = md.slice(endIdx);
        md = before + '\n' + tableMd + '\n' + after;
      }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bao-cao-nghien-cuu-kha-thi-cde-cic.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  // SVG Chart drawing metrics
  const chartHeight = 220;
  const chartWidth = 520;
  const padding = 40;

  // 1. Stacked Bar Chart (Revenue 2027-2030)
  const revenueChartJSX = useMemo(() => {
    const years_labels = ['2027', '2028', '2029', '2030'];
    const maxVal = Math.max(...calcs.totalRevenues) * 1.1 || 10;
    
    const colors = [
      'fill-primary', // SaaS
      'fill-secondary', // PMU
      'fill-tertiary', // Sở XD
      'fill-error' // Doanh nghiệp
    ];
    
    const colWidth = 50;
    const spacing = 70;
    const startX = padding + 20;
    
    return (
      <svg className="w-full h-72 border border-outline-variant bg-surface-container-lowest rounded-2xl p-4">
        {/* Y Axis Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = chartHeight - padding - ratio * (chartHeight - 2 * padding);
          const gridValue = (ratio * maxVal).toFixed(0);
          return (
            <g key={i} className="opacity-30">
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} className="stroke-outline stroke-1 stroke-dasharray" strokeDasharray="3 3" />
              <text x={padding - 10} y={y + 4} className="text-[10px] text-right font-mono fill-on-surface-variant" textAnchor="end">{gridValue}B</text>
            </g>
          );
        })}
        
        {/* Bars */}
        {years_labels.map((year, i) => {
          const t = i + 1; // 2027 is t=1
          const x = startX + i * (colWidth + spacing);
          
          const valSaaS = calcs.saasRevenues[t];
          const valPMU = calcs.pmuRevenues[t];
          const valSoXd = calcs.soXdRevenues[t];
          const valEnt = calcs.entRevenues[t];
          const total = valSaaS + valPMU + valSoXd + valEnt;
          
          const hSaaS = (valSaaS / maxVal) * (chartHeight - 2 * padding);
          const hPMU = (valPMU / maxVal) * (chartHeight - 2 * padding);
          const hSoXd = (valSoXd / maxVal) * (chartHeight - 2 * padding);
          const hEnt = (valEnt / maxVal) * (chartHeight - 2 * padding);
          
          const yEnt = chartHeight - padding - hEnt;
          const ySoXd = yEnt - hSoXd;
          const yPMU = ySoXd - hPMU;
          const ySaaS = yPMU - hSaaS;
          
          return (
            <g key={i} className="group cursor-pointer">
              {/* Stacked rects */}
              {valEnt > 0 && <rect x={x} y={yEnt} width={colWidth} height={hEnt} className={`${colors[3]} opacity-80 hover:opacity-100 transition-opacity rounded-b-sm`} />}
              {valSoXd > 0 && <rect x={x} y={ySoXd} width={colWidth} height={hSoXd} className={`${colors[2]} opacity-80 hover:opacity-100 transition-opacity`} />}
              {valPMU > 0 && <rect x={x} y={yPMU} width={colWidth} height={hPMU} className={`${colors[1]} opacity-80 hover:opacity-100 transition-opacity`} />}
              {valSaaS > 0 && <rect x={x} y={ySaaS} width={colWidth} height={hSaaS} className={`${colors[0]} opacity-80 hover:opacity-100 transition-opacity rounded-t-sm`} />}
              
              {/* Year Label */}
              <text x={x + colWidth / 2} y={chartHeight - padding + 18} className="text-[11px] font-semibold fill-on-surface text-center" textAnchor="middle">{year}</text>
              {/* Total Label */}
              <text x={x + colWidth / 2} y={ySaaS - 6} className="text-[10px] font-bold font-mono fill-primary text-center hidden group-hover:block" textAnchor="middle">{total.toFixed(1)}B</text>
            </g>
          );
        })}
        
        {/* Baseline X Axis */}
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} className="stroke-outline stroke-1" />
      </svg>
    );
  }, [calcs]);

  // 2. Cumulative Cash Flow (Line chart 2026-2030)
  const cashFlowChartJSX = useMemo(() => {
    const scBiQuan = calcs.scenarioResults[2];
    const scCoSo = calcs.scenarioResults[1];
    const scLacQuan = calcs.scenarioResults[0];
    
    // Find min and max for y-scaling
    const allVals = [...scBiQuan.cumulativeFlows, ...scCoSo.cumulativeFlows, ...scLacQuan.cumulativeFlows];
    const minVal = Math.min(...allVals) * 1.1 || -20;
    const maxVal = Math.max(...allVals) * 1.1 || 100;
    const range = maxVal - minVal;
    
    const getCoordinates = (flows: number[]) => {
      const spacing = (chartWidth - 2 * padding) / (flows.length - 1);
      return flows.map((val, t) => {
        const x = padding + t * spacing;
        const y = chartHeight - padding - ((val - minVal) / range) * (chartHeight - 2 * padding);
        return { x, y, val };
      });
    };
    
    const coordsA = getCoordinates(scLacQuan.cumulativeFlows);
    const coordsB = getCoordinates(scCoSo.cumulativeFlows);
    const coordsC = getCoordinates(scBiQuan.cumulativeFlows);
    
    const getPathD = (coords: { x: number; y: number }[]) => {
      return `M ${coords.map(c => `${c.x} ${c.y}`).join(' L ')}`;
    };
    
    return (
      <svg className="w-full h-72 border border-outline-variant bg-surface-container-lowest rounded-2xl p-4">
        {/* Y Axis Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = chartHeight - padding - ratio * (chartHeight - 2 * padding);
          const gridValue = (minVal + ratio * range).toFixed(0);
          return (
            <g key={i} className="opacity-30">
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} className="stroke-outline stroke-1 stroke-dasharray" strokeDasharray="3 3" />
              <text x={padding - 10} y={y + 4} className="text-[10px] text-right font-mono fill-on-surface-variant" textAnchor="end">{gridValue}B</text>
            </g>
          );
        })}
        
        {/* Zero baseline */}
        {minVal < 0 && (
          <line 
            x1={padding} 
            y1={chartHeight - padding - ((0 - minVal) / range) * (chartHeight - 2 * padding)} 
            x2={chartWidth - padding} 
            y2={chartHeight - padding - ((0 - minVal) / range) * (chartHeight - 2 * padding)} 
            className="stroke-outline stroke-2 opacity-50" 
          />
        )}
        
        {/* Lines */}
        <path d={getPathD(coordsC)} fill="none" className="stroke-error stroke-2" />
        <path d={getPathD(coordsB)} fill="none" className="stroke-secondary stroke-2" />
        <path d={getPathD(coordsA)} fill="none" className="stroke-success stroke-2" />
        
        {/* Interactive Dots */}
        {coordsB.map((c, t) => {
          const year = 2026 + t;
          return (
            <g key={t} className="group cursor-pointer">
              {/* Scenario A (Lạc quan) */}
              <circle cx={coordsA[t].x} cy={coordsA[t].y} r="4" className="fill-success hover:r-6 transition-all" />
              <text x={coordsA[t].x} y={coordsA[t].y - 8} className="text-[9px] font-mono fill-success hidden group-hover:block" textAnchor="middle">{coordsA[t].val.toFixed(1)}B</text>
              
              {/* Scenario B (Cơ sở) */}
              <circle cx={c.x} cy={c.y} r="4" className="fill-secondary hover:r-6 transition-all" />
              <text x={c.x} y={c.y - 8} className="text-[9px] font-mono fill-secondary hidden group-hover:block" textAnchor="middle">{c.val.toFixed(1)}B</text>
              
              {/* Scenario C (Bi quan) */}
              <circle cx={coordsC[t].x} cy={coordsC[t].y} r="4" className="fill-error hover:r-6 transition-all" />
              <text x={coordsC[t].x} y={coordsC[t].y - 8} className="text-[9px] font-mono fill-error hidden group-hover:block" textAnchor="middle">{coordsC[t].val.toFixed(1)}B</text>
              
              {/* Year label on X axis */}
              <text x={c.x} y={chartHeight - padding + 18} className="text-[10px] font-semibold fill-on-surface text-center" textAnchor="middle">{year}</text>
            </g>
          );
        })}
      </svg>
    );
  }, [calcs]);

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-surface-container-low">
      
      {/* 1. LEFT ASSUMPTIONS SIDE PANEL — chỉ hiển thị ở tab Tài chính (slider nhanh) */}
      {activeTab === 'financial' && (
      <aside className="w-[340px] border-r border-outline-variant bg-surface flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-5 space-y-6">
        
        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
          <div className="flex items-center gap-2 text-primary">
            <Settings size={18} />
            <h3 className="font-bold text-sm uppercase tracking-wider">Giả định tài chính</h3>
          </div>
          <button 
            onClick={() => setInputs(DEFAULT_INPUTS)}
            title="Khôi phục mặc định" 
            className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-primary transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Global parameter inputs */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-l-2 border-primary pl-2">1. Tham số chung</h4>
          
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>WACC (Tỷ lệ chiết khấu)</span>
              <span className="text-primary font-mono">{fPct(inputs.fin.wacc)}</span>
            </label>
            <input 
              type="range" min="0.05" max="0.25" step="0.01" 
              value={inputs.fin.wacc} 
              onChange={(e) => handleInputChange('fin', 'wacc', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Thuế suất TNDN (%)</span>
              <span className="text-primary font-mono">{fPct(inputs.fin.taxRate)}</span>
            </label>
            <input 
              type="range" min="0.0" max="0.25" step="0.05" 
              value={inputs.fin.taxRate} 
              onChange={(e) => handleInputChange('fin', 'taxRate', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Tỷ lệ vốn tự có CIC đối ứng (%)</span>
              <span className="text-primary font-mono">{fPct(inputs.fin.cicShare)}</span>
            </label>
            <input 
              type="range" min="0.5" max="1.0" step="0.05" 
              value={inputs.fin.cicShare} 
              onChange={(e) => handleInputChange('fin', 'cicShare', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>
        </div>

        {/* SaaS parameters */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-l-2 border-primary pl-2">2. Kênh thuê bao SaaS</h4>
          
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>ARPU (giá TB/user/tháng - năm 2030)</span>
              <span className="text-primary font-mono">{inputs.saas.arpu[4]} tr</span>
            </label>
            <input 
              type="range" min="0.3" max="1.0" step="0.05" 
              value={inputs.saas.arpu[4]} 
              onChange={(e) => handleInputChange('saas', 'arpu', 4, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>User mới SaaS năm 2030 (gross adds)</span>
              <span className="text-primary font-mono">{inputs.saas.grossAdds[4].toLocaleString()} users</span>
            </label>
            <input
              type="range" min="1000" max="20000" step="500"
              value={inputs.saas.grossAdds[4]}
              onChange={(e) => handleInputChange('saas', 'grossAdds', 4, parseInt(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Tỷ lệ rời bỏ SaaS (churn/năm)</span>
              <span className="text-primary font-mono">{(inputs.saas.churn * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range" min="0" max="0.30" step="0.01"
              value={inputs.saas.churn}
              onChange={(e) => handleInputChange('saas', 'churn', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer"
            />
          </div>
        </div>

        {/* On-Premise prices */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-l-2 border-primary pl-2">3. Đơn giá License On-Premise</h4>
          
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Giá License PMU (Tỷ/HĐ - 2030)</span>
              <span className="text-primary font-mono">{inputs.onPrem.pmu.price[4]} tỷ</span>
            </label>
            <input 
              type="range" min="2.0" max="5.0" step="0.1" 
              value={inputs.onPrem.pmu.price[4]} 
              onChange={(e) => handleNestedInputChange('onPrem', 'pmu', 4, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Giá License Sở XD (Tỷ/HĐ - 2030)</span>
              <span className="text-primary font-mono">{inputs.onPrem.soXd.price[4]} tỷ</span>
            </label>
            <input 
              type="range" min="1.5" max="4.0" step="0.1" 
              value={inputs.onPrem.soXd.price[4]} 
              onChange={(e) => handleNestedInputChange('onPrem', 'soXd', 4, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>
          
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Giá License DN Lớn (Tỷ/HĐ - 2030)</span>
              <span className="text-primary font-mono">{inputs.onPrem.enterprise.price[4]} tỷ</span>
            </label>
            <input 
              type="range" min="3.0" max="6.0" step="0.1" 
              value={inputs.onPrem.enterprise.price[4]} 
              onChange={(e) => handleNestedInputChange('onPrem', 'enterprise', 4, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer" 
            />
          </div>
        </div>

        {/* CAPEX raw budgets */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-l-2 border-primary pl-2">4. Chi phí CAPEX R&D (Tỷ VNĐ)</h4>
          
          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Nhân sự R&D (CAP-01)</span>
              <span className="text-primary font-mono">{inputs.capex.cap01_RD_staff} tỷ</span>
            </label>
            <input
              type="range" min="0.5" max="5.0" step="0.1"
              value={inputs.capex.cap01_RD_staff}
              onChange={(e) => handleInputChange('capex', 'cap01_RD_staff', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant flex justify-between">
              <span>Marketing ra mắt (CAP-04)</span>
              <span className="text-primary font-mono">{inputs.capex.cap04_marketing} tỷ</span>
            </label>
            <input
              type="range" min="0.1" max="2.0" step="0.05"
              value={inputs.capex.cap04_marketing}
              onChange={(e) => handleInputChange('capex', 'cap04_marketing', null, parseFloat(e.target.value))}
              className="w-full mt-1 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </aside>
      )}

      {/* 2. MAIN REPORT AND CHARTS PANEL */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header Toolbar */}
        <div className="h-14 bg-surface border-b border-outline-variant flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          {/* Module switching */}
          <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/60 shadow-inner">
            <button 
              onClick={() => setActiveTab('report')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'report' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <FileText size={14} />
              Báo cáo khả thi
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'financial' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <Calculator size={14} />
              Tài chính
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'analysis' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <Activity size={14} />
              Phân tích & Biểu đồ
            </button>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSaveToWorkspace}
              disabled={saving}
              className="bg-primary hover:bg-primary-hover text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              {saving ? 'Đang lưu…' : 'Lưu vào Workspace'}
            </button>
            <button 
              onClick={handleDownloadMarkdown}
              className="bg-surface hover:bg-surface-container border border-outline-variant/60 text-on-surface px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              Tải file MD
            </button>
          </div>
        </div>

        {/* Content area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-container-lowest">
          
          {/* Saving Status Notification overlay */}
          {saveStatus && (
            <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-300 ${saveStatus.success ? 'bg-success/10 border-success/30 text-success' : 'bg-error/10 border-error/30 text-error'}`}>
              {saveStatus.success ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
              <div className="text-xs font-medium">
                <span className="font-bold">{saveStatus.success ? 'Thành công: ' : 'Thất bại: '}</span>
                {saveStatus.message}
              </div>
              <button 
                onClick={() => setSaveStatus(null)} 
                className="ml-auto hover:bg-surface-container-high p-1 rounded transition-colors text-outline hover:text-on-surface"
              >
                ×
              </button>
            </div>
          )}

          {/* TAB 1: Markdown Report Viewer with Reactive Inline Tables */}
          {activeTab === 'report' && (
            <div className="max-w-7xl mx-auto flex items-start gap-10 px-4 relative">
              
              {/* Sticky Table of Contents Navigation Panel */}
              <nav className="w-72 shrink-0 sticky top-6 hidden xl:block max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar bg-surface/90 backdrop-blur-sm border border-outline-variant/60 shadow-md rounded-2xl p-5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-4 pb-2 border-b border-outline-variant/50 flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  Mục lục báo cáo
                </h4>
                <ul className="space-y-1">
                  {tocItems.map((item) => {
                    const isChapter = item.level === 2;
                    const isActive = item.id === activeId;
                    return (
                      <li
                        key={item.id}
                        style={{ paddingLeft: `${(item.level - 2) * 10}px` }}
                      >
                        <a
                          href={`#${item.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(item.id);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setActiveId(item.id);
                            }
                          }}
                          className={`flex items-start gap-2 py-1.5 px-2.5 -mx-2.5 rounded-lg transition-all group ${
                            isActive ? 'bg-primary-container/40' : 'hover:bg-primary-container/10'
                          } ${
                            isChapter
                              ? `text-sm font-bold ${isActive ? 'text-primary' : 'text-on-surface'}`
                              : `text-[13px] font-medium ${isActive ? 'text-primary' : 'text-on-surface-variant'}`
                          }`}
                        >
                          <span className={`rounded-full shrink-0 transition-transform group-hover:scale-125 ${
                            isChapter 
                              ? 'w-2 h-2 mt-1.5 bg-primary' 
                              : 'w-1.5 h-1.5 mt-1.5 bg-outline/40 group-hover:bg-primary/50'
                          }`} />
                          <span 
                            className="transition-colors group-hover:text-primary"
                            dangerouslySetInnerHTML={{ __html: item.text }}
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Main Document Paper */}
              <article className="flex-1 max-w-4xl bg-surface border border-outline-variant/60 shadow-lg rounded-3xl p-10 md:p-12 relative overflow-hidden">
                {/* Document Header Mock */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-accent" />
                <div className="flex justify-between items-center text-[10px] font-mono text-outline uppercase tracking-widest mb-6">
                  <span>CIC Feasibility Study Report</span>
                  <span>Version 1.0 (Dynamic)</span>
                </div>
                
                {/* Rendered JSX content */}
                <div className="prose max-w-none text-justify">
                  {parsedReportJSX}
                </div>
              </article>
            </div>
          )}

          {/* TAB 2: Financial Charts and Core Indicators Dashboard */}
          {/* TAB 2: Editable financial model (Excel-like) */}
          {activeTab === 'financial' && (
            <FinancialTab inputs={inputs} setInputs={setInputs} calcs={calcs} defaults={DEFAULT_INPUTS} />
          )}

          {activeTab === 'analysis' && (
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Key indicators row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* NPV indicator card */}
                <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-success" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">NPV toàn dự án (5 năm)</span>
                    <h3 className="text-2xl font-black text-success tracking-tight flex items-baseline gap-1">
                      {fNum(calcs.scenarioResults[0].npv)}
                      <span className="text-xs font-bold font-sans">tỷ VNĐ</span>
                    </h3>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-medium mt-3 pt-2 border-t border-outline-variant/30 flex justify-between">
                    <span>CIC (70%): <b className="text-on-surface">{fNum(calcs.npvCic)} tỷ</b></span>
                    <span className="text-success flex items-center font-bold">WACC: {fPct(inputs.fin.wacc)}</span>
                  </div>
                </div>

                {/* IRR indicator card */}
                <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">IRR toàn dự án (5 năm)</span>
                    <h3 className="text-2xl font-black text-primary tracking-tight">
                      {calcs.scenarioResults[0].irr ? (calcs.scenarioResults[0].irr*100).toFixed(1)+'%' : 'Âm'}
                    </h3>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-medium mt-3 pt-2 border-t border-outline-variant/30 flex justify-between">
                    <span>IRR đầu tư CIC: <b className="text-on-surface">{calcs.irrCic ? (calcs.irrCic*100).toFixed(1)+'%' : 'Âm'}</b></span>
                    <span className="text-primary flex items-center font-bold">WACC: {fPct(inputs.fin.wacc)}</span>
                  </div>
                </div>

                {/* Payback period card */}
                <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-tertiary" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Thời gian hoàn vốn</span>
                    <h3 className="text-2xl font-black text-tertiary tracking-tight">
                      {calcs.scenarioResults[0].payback ? `${calcs.scenarioResults[0].payback.toFixed(1)} năm` : 'Sau 2031'}
                    </h3>
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-medium mt-3 pt-2 border-t border-outline-variant/30 flex justify-between">
                    <span>Hoàn vốn đầu tư CIC: <b className="text-on-surface">{calcs.paybackCic ? `${calcs.paybackCic.toFixed(1)} năm` : 'Sau 2031'}</b></span>
                    <span className="text-tertiary flex items-center font-bold">Năm gốc: 2026</span>
                  </div>
                </div>

              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Stacked Revenue Chart Card */}
                <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-3xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <TrendingUp size={16} />
                      Cơ cấu Doanh thu qua các năm (tỷ VNĐ)
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-1">
                      Biểu đồ cột chồng biểu thị doanh số tích lũy của 4 kênh phân phối (2027 - 2030).
                    </p>
                  </div>
                  {revenueChartJSX}
                  
                  {/* Legend */}
                  <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-primary rounded-sm" /> SaaS</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-secondary rounded-sm" /> On-Prem PMU</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-tertiary rounded-sm" /> On-Prem Sở XD</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-error rounded-sm" /> On-Prem DN</span>
                  </div>
                </div>

                {/* Scenario comparison line chart card */}
                <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-3xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                      <Activity size={16} />
                      So sánh Dòng tiền ròng tích lũy theo Kịch bản
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-1">
                      Biểu thị điểm hòa vốn (Cash burn tối đa) và sự phục hồi tài chính của 3 kịch bản.
                    </p>
                  </div>
                  {cashFlowChartJSX}
                  
                  {/* Legend */}
                  <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-success rounded-full" /> Lạc quan (100% DT)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-secondary rounded-full" /> Cơ sở (55% DT)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-error rounded-full" /> Bi quan (25% DT)</span>
                  </div>
                </div>

              </div>

              {/* Sensitivities table */}
              <div className="bg-surface border border-outline-variant/60 shadow-sm rounded-3xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">Ma trận phân tích nhạy cảm & kịch bản tài chính</h3>
                <div className="overflow-x-auto border border-outline-variant rounded-2xl">
                  <table className="min-w-full text-xs text-left">
                    <thead>
                      <tr className="bg-surface-container-high text-on-surface">
                        <th className="px-4 py-3 font-bold">Kịch bản tài chính</th>
                        <th className="px-4 py-3 font-bold text-center">Doanh thu lũy kế 5 năm</th>
                        <th className="px-4 py-3 font-bold text-center">NPV toàn dự án (5 năm)</th>
                        <th className="px-4 py-3 font-bold text-center">IRR toàn dự án (%)</th>
                        <th className="px-4 py-3 font-bold text-center">Thời gian hoàn vốn</th>
                        <th className="px-4 py-3 font-bold text-center">Vốn lưu động cần chuẩn bị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-success flex items-center gap-2">
                          <CheckCircle size={14} />
                          A. Lạc quan (100% DT)
                        </td>
                        <td className="text-center font-semibold">{fNum(calcs.scenarioResults[0].revenues.reduce((a,b)=>a+b,0))} tỷ</td>
                        <td className="text-center font-bold text-success">{fNum(calcs.scenarioResults[0].npv)} tỷ</td>
                        <td className="text-center font-bold">{calcs.scenarioResults[0].irr ? (calcs.scenarioResults[0].irr*100).toFixed(0)+'%' : 'Âm'}</td>
                        <td className="text-center">
                          {calcs.scenarioResults[0].payback ? `Q${Math.ceil((calcs.scenarioResults[0].payback % 1) * 4)}/${Math.floor(2026 + calcs.scenarioResults[0].payback)}` : 'Sau 2031'}
                        </td>
                        <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[0].cumulativeFlows))} tỷ</td>
                      </tr>
                      <tr className="bg-primary/5">
                        <td className="px-4 py-3 font-semibold text-primary flex items-center gap-2">
                          <CheckCircle size={14} />
                          B. Cơ sở (55% DT) - Khuyến nghị
                        </td>
                        <td className="text-center font-semibold">{fNum(calcs.scenarioResults[1].revenues.reduce((a,b)=>a+b,0))} tỷ</td>
                        <td className="text-center font-bold text-success">{fNum(calcs.scenarioResults[1].npv)} tỷ</td>
                        <td className="text-center font-bold">{calcs.scenarioResults[1].irr ? (calcs.scenarioResults[1].irr*100).toFixed(0)+'%' : 'Âm'}</td>
                        <td className="text-center">
                          {calcs.scenarioResults[1].payback ? `Q${Math.ceil((calcs.scenarioResults[1].payback % 1) * 4)}/${Math.floor(2026 + calcs.scenarioResults[1].payback)}` : 'Sau 2031'}
                        </td>
                        <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[1].cumulativeFlows))} tỷ</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-error flex items-center gap-2">
                          <AlertCircle size={14} />
                          C. Bi quan (25% DT)
                        </td>
                        <td className="text-center font-semibold">{fNum(calcs.scenarioResults[2].revenues.reduce((a,b)=>a+b,0))} tỷ</td>
                        <td className="text-center font-bold text-error">{fNum(calcs.scenarioResults[2].npv)} tỷ</td>
                        <td className="text-center font-bold">{calcs.scenarioResults[2].irr ? (calcs.scenarioResults[2].irr*100).toFixed(0)+'%' : 'Âm'}</td>
                        <td className="text-center">Sau 2031</td>
                        <td className="text-center text-error">{fNum(Math.min(...calcs.scenarioResults[2].cumulativeFlows))} tỷ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      </section>

    </div>
  );
}
