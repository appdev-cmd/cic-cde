import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputsPath = path.resolve(__dirname, '../Docs/nghien-cuu-kha-thi/financial_inputs.json');
const mdPath = path.resolve(__dirname, '../Docs/nghien-cuu-kha-thi/bao-cao-nghien-cuu-kha-thi-cde-cic.md');

// Helper to format numbers in billions with 2 decimal places, or as integer if applicable
function fmtVal(val, decimals = 2) {
  if (val === 0 || val === null || val === undefined) return '—';
  const prefix = val < 0 ? '(' : '';
  const suffix = val < 0 ? ')' : '';
  const absVal = Math.abs(val);
  return `${prefix}${absVal.toFixed(decimals).replace('.', ',')}${suffix}`;
}

function fmtPercent(val) {
  if (val === 0 || val === null || val === undefined) return '—';
  return `${(val * 100).toFixed(0)}%`;
}

function calculateNPV(cashFlows, wacc) {
  return cashFlows.reduce((acc, val, t) => acc + val / Math.pow(1 + wacc, t), 0);
}

function calculateIRR(cashFlows) {
  let x0 = 0.1;
  let x1 = 0.2;
  let maxIter = 1000;
  let tolerance = 1e-6;
  
  function npv(r) {
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

function calculatePaybackPeriod(cumulativeFlows, netFlows) {
  // Find the last year where cumulative flow is negative
  let lastNegativeYear = -1;
  for (let t = 0; t < cumulativeFlows.length; t++) {
    if (cumulativeFlows[t] < 0) {
      lastNegativeYear = t;
    }
  }
  if (lastNegativeYear === -1) return 0; // Already paid back in t=0
  if (lastNegativeYear === cumulativeFlows.length - 1) return null; // Not paid back in 5 years
  
  const fraction = -cumulativeFlows[lastNegativeYear] / netFlows[lastNegativeYear + 1];
  return lastNegativeYear + fraction;
}

export function runCalculation(inputs) {
  const years = [2026, 2027, 2028, 2029, 2030];
  const tCount = years.length;
  
  // 1. SaaS Revenues
  const saasRevenues = new Array(tCount).fill(0);
  const saasAvgUsers = new Array(tCount).fill(0);
  for (let t = 1; t < tCount; t++) {
    const prevUsers = inputs.saas.users[t-1];
    const currUsers = inputs.saas.users[t];
    saasAvgUsers[t] = (prevUsers + currUsers) / 2;
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
  
  // COGS
  const cogsRates = [0.0, 0.45, 0.40, 0.39, 0.40];
  const cogs = new Array(tCount).fill(0);
  const grossProfit = new Array(tCount).fill(0);
  for (let t = 0; t < tCount; t++) {
    cogs[t] = totalRevenues[t] * cogsRates[t];
    grossProfit[t] = totalRevenues[t] - cogs[t];
  }
  
  // CAPEX
  const capexRD = inputs.capex.cap01_RD_staff;
  const capexEquip = inputs.capex.cap02_equip;
  const capexLicense = inputs.capex.cap03_license;
  const capexMarketing = inputs.capex.cap04_marketing;
  const capexConsulting = inputs.capex.cap05_consulting;
  const totalCapexVal = capexRD + capexEquip + capexLicense + capexMarketing + capexConsulting;
  
  // Proportional CAPEX distribution over years (2026, 2027, 2028)
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
  
  // OPEX
  const totalOpexYearly = new Array(tCount).fill(0);
  for (let t = 0; t < tCount; t++) {
    totalOpexYearly[t] = inputs.opex.staff[t] + inputs.opex.cloud[t] + inputs.opex.others[t];
  }
  
  // Project Cash Flow (Kịch bản A)
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
  
  // NPV / IRR / Payback (Scenario A)
  const npvProject = calculateNPV(netCashFlow, inputs.fin.wacc);
  const irrProject = calculateIRR(netCashFlow);
  const paybackProject = calculatePaybackPeriod(cumulativeNetCashFlow, netCashFlow);
  
  const npvCic = calculateNPV(cicNetCashFlow, inputs.fin.wacc);
  const irrCic = calculateIRR(cicNetCashFlow);
  const paybackCic = calculatePaybackPeriod(cicCumulativeNetCashFlow, cicNetCashFlow);
  
  // Sensitivity scenarios (Revenue coefficients, OPEX coefficients)
  const scenarios = [
    { name: 'Lạc quan', revCoeff: 1.0, opexCoeff: 1.0 },
    { name: 'Cơ sở', revCoeff: 0.55, opexCoeff: 1.0 },
    { name: 'Bi quan', revCoeff: 0.25, opexCoeff: 1.0 }
  ];
  
  const scenarioResults = scenarios.map(sc => {
    const scRev = totalRevenues.map(r => r * sc.revCoeff);
    const scCogs = scRev.map((r, t) => r * cogsRates[t]);
    const scGp = scRev.map((r, t) => r - scCogs[t]);
    const scOpex = totalOpexYearly.map(o => o * sc.opexCoeff);
    const scNetFlow = new Array(tCount).fill(0);
    const scCumFlow = new Array(tCount).fill(0);
    
    let cum = 0;
    for (let t = 0; t < tCount; t++) {
      const e = scGp[t] - totalCapexYearly[t] - scOpex[t];
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
}

// Generate the markdown table strings
function getTable6_2a(calcs, inputs) {
  return [
    `| Mã | Hạng mục đầu tư | 2026 (Q3-Q4) | 2027 (Full Year) | 2028 (Q1) | Tổng | Giải trình chi tiết hạng mục |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---|`,
    `| CAP-01 | **Nhân sự phát triển lõi** | ${fmtVal(calcs.capexRD_yearly[0])} | ${fmtVal(calcs.capexRD_yearly[1])} | ${fmtVal(calcs.capexRD_yearly[2])} | **${fmtVal(inputs.capex.cap01_RD_staff)}** | Chi phí lương gộp đội ngũ tinh gọn 2 người (CTO và 01 Trợ lý) trong 18 tháng, trích bảo hiểm, phúc lợi, và phí công cụ AI. |`,
    `| CAP-02 | **Trang thiết bị văn phòng** | ${fmtVal(calcs.capexEquip_yearly[0])} | ${fmtVal(calcs.capexEquip_yearly[1])} | ${fmtVal(calcs.capexEquip_yearly[2])} | **${fmtVal(inputs.capex.cap02_equip)}** | Mua sắm 2 bộ máy tính lập trình cấu hình cao, thiết bị mạng cơ bản. |`,
    `| CAP-03 | **Bản quyền & API tích hợp** | ${fmtVal(calcs.capexLicense_yearly[0])} | ${fmtVal(calcs.capexLicense_yearly[1])} | ${fmtVal(calcs.capexLicense_yearly[2])} | **${fmtVal(inputs.capex.cap03_license)}** | Chi phí API AI (Claude, Gemini), GitHub Enterprise, domain, chứng chỉ SSL, và bản quyền CSDL/công cụ. |`,
    `| CAP-04 | **Marketing & Sales ra mắt** | ${fmtVal(calcs.capexMarketing_yearly[0])} | ${fmtVal(calcs.capexMarketing_yearly[1])} | ${fmtVal(calcs.capexMarketing_yearly[2])} | **${fmtVal(inputs.capex.cap04_marketing)}** | PR B2B tối giản, tài liệu hướng dẫn BIM, xây dựng demo và làm việc trực tiếp với một số PMU lớn & Sở Xây dựng. |`,
    `| CAP-05 | **Tư vấn, PM & Pháp lý** | ${fmtVal(calcs.capexConsulting_yearly[0])} | ${fmtVal(calcs.capexConsulting_yearly[1])} | ${fmtVal(calcs.capexConsulting_yearly[2])} | **${fmtVal(inputs.capex.cap05_consulting)}** | Chi phí kiểm định QCVN 12, lập hồ sơ Cấp độ 3, đánh giá ISO 27001 và đăng ký bản quyền tác giả mã nguồn. |`,
    `| | **TỔNG CỘNG CAPEX** | **${fmtVal(calcs.totalCapexYearly[0])}** | **${fmtVal(calcs.totalCapexYearly[1])}** | **${fmtVal(calcs.totalCapexYearly[2])}** | **${fmtVal(inputs.capex.cap01_RD_staff + inputs.capex.cap02_equip + inputs.capex.cap03_license + inputs.capex.cap04_marketing + inputs.capex.cap05_consulting)}** | 100% tự đầu tư bởi CIC (không sử dụng ngân sách nhà nước). |`
  ].join('\n');
}

function getTable6_2c(calcs, inputs) {
  const sumOPEX = calcs.totalOpexYearly.reduce((a, b) => a + b, 0);
  return [
    `| Mã OPEX | Hạng mục chi phí vận hành | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng 5 năm |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
    `| OPX-01 | Nhân sự vận hành (bao gồm overhead) | ${fmtVal(inputs.opex.staff[0])} | ${fmtVal(inputs.opex.staff[1])} | ${fmtVal(inputs.opex.staff[2])} | ${fmtVal(inputs.opex.staff[3])} | ${fmtVal(inputs.opex.staff[4])} | **${fmtVal(inputs.opex.staff.reduce((a, b) => a + b, 0))}** |`,
    `| OPX-02 | Chi phí thuê hạ tầng đám mây (Cloud) | ${fmtVal(inputs.opex.cloud[0])} | ${fmtVal(inputs.opex.cloud[1])} | ${fmtVal(inputs.opex.cloud[2])} | ${fmtVal(inputs.opex.cloud[3])} | ${fmtVal(inputs.opex.cloud[4])} | **${fmtVal(inputs.opex.cloud.reduce((a, b) => a + b, 0))}** |`,
    `| OPX-03 | Các chi phí vận hành thường niên khác | ${fmtVal(inputs.opex.others[0])} | ${fmtVal(inputs.opex.others[1])} | ${fmtVal(inputs.opex.others[2])} | ${fmtVal(inputs.opex.others[3])} | ${fmtVal(inputs.opex.others[4])} | **${fmtVal(inputs.opex.others.reduce((a, b) => a + b, 0))}** |`,
    `| | **TỔNG OPEX TOÀN HỆ THỐNG** | **${fmtVal(calcs.totalOpexYearly[0])}** | **${fmtVal(calcs.totalOpexYearly[1])}** | **${fmtVal(calcs.totalOpexYearly[2])}** | **${fmtVal(calcs.totalOpexYearly[3])}** | **${fmtVal(calcs.totalOpexYearly[4])}** | **${fmtVal(sumOPEX)}** |`
  ].join('\n');
}

function getTable6_4a(inputs) {
  const pmuCum = [0, inputs.onPrem.pmu.newHd[1], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3], inputs.onPrem.pmu.newHd[1]+inputs.onPrem.pmu.newHd[2]+inputs.onPrem.pmu.newHd[3]+inputs.onPrem.pmu.newHd[4]];
  const soXdCum = [0, inputs.onPrem.soXd.newHd[1], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2]+inputs.onPrem.soXd.newHd[3], inputs.onPrem.soXd.newHd[1]+inputs.onPrem.soXd.newHd[2]+inputs.onPrem.soXd.newHd[3]+inputs.onPrem.soXd.newHd[4]];
  const entCum = [0, inputs.onPrem.enterprise.newHd[1], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2]+inputs.onPrem.enterprise.newHd[3], inputs.onPrem.enterprise.newHd[1]+inputs.onPrem.enterprise.newHd[2]+inputs.onPrem.enterprise.newHd[3]+inputs.onPrem.enterprise.newHd[4]];
  
  return [
    `| Phân khúc | Tiêu chí đánh giá số lượng | 2026 | 2027 (H2) | 2028 | 2029 | 2030 |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---:|`,
    `| **1. Kênh SaaS** | Số user đầu kỳ (người) | — | 0 | ${inputs.saas.users[1]} | ${inputs.saas.users[2]} | ${inputs.saas.users[3]} |`,
    `| | Số user cuối kỳ (người) | — | ${inputs.saas.users[1]} | ${inputs.saas.users[2]} | ${inputs.saas.users[3]} | ${inputs.saas.users[4]} |`,
    `| | **Số user hoạt động trung bình (tính DT)**| — | **${(inputs.saas.users[1]/2).toFixed(0)}** | **${((inputs.saas.users[1]+inputs.saas.users[2])/2).toFixed(0)}** | **${((inputs.saas.users[2]+inputs.saas.users[3])/2).toFixed(0)}** | **${((inputs.saas.users[3]+inputs.saas.users[4])/2).toFixed(0)}** |`,
    `| **2. On-Prem PMU** | Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.pmu.newHd[1]} | ${inputs.onPrem.pmu.newHd[2]} | ${inputs.onPrem.pmu.newHd[3]} | ${inputs.onPrem.pmu.newHd[4]} |`,
    `| | Lũy kế số PMU sử dụng hệ thống | 0 | ${pmuCum[1]} | ${pmuCum[2]} | ${pmuCum[3]} | ${pmuCum[4]} |`,
    `| **3. On-Prem Sở XD**| Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.soXd.newHd[1]} | ${inputs.onPrem.soXd.newHd[2]} | ${inputs.onPrem.soXd.newHd[3]} | ${inputs.onPrem.soXd.newHd[4]} |`,
    `| | Lũy kế số Sở Xây dựng sử dụng | 0 | ${soXdCum[1]} | ${soXdCum[2]} | ${soXdCum[3]} | ${soXdCum[4]} |`,
    `| **4. On-Prem DN** | Hợp đồng mới ký trong năm (HĐ) | 0 | ${inputs.onPrem.enterprise.newHd[1]} | ${inputs.onPrem.enterprise.newHd[2]} | ${inputs.onPrem.enterprise.newHd[3]} | ${inputs.onPrem.enterprise.newHd[4]} |`,
    `| | Lũy kế số Doanh nghiệp lớn sử dụng | 0 | ${entCum[1]} | ${entCum[2]} | ${entCum[3]} | ${entCum[4]} |`
  ].join('\n');
}

function getTable6_4b(calcs, inputs) {
  const sumSaaS = calcs.saasRevenues.reduce((a, b) => a + b, 0);
  const sumPMU = calcs.pmuRevenues.reduce((a, b) => a + b, 0);
  const sumSoXd = calcs.soXdRevenues.reduce((a, b) => a + b, 0);
  const sumEnt = calcs.entRevenues.reduce((a, b) => a + b, 0);
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

function getTable6_5_1(calcs) {
  const sumRev = calcs.totalRevenues.reduce((a, b) => a + b, 0);
  const sumCogs = calcs.cogs.reduce((a, b) => a + b, 0);
  const sumGP = calcs.grossProfit.reduce((a, b) => a + b, 0);
  const sumCapex = calcs.totalCapexYearly.reduce((a, b) => a + b, 0);
  const sumOpex = calcs.totalOpexYearly.reduce((a, b) => a + b, 0);
  const sumEbit = calcs.ebit.reduce((a, b) => a + b, 0);
  const sumTax = calcs.tax.reduce((a, b) => a + b, 0);
  const sumNet = calcs.netCashFlow.reduce((a, b) => a + b, 0);
  
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

function getTable6_5_2(calcs) {
  const sumGP = calcs.grossProfit.reduce((a, b) => a + b, 0);
  const sumCapexCIC = calcs.capexCIC.reduce((a, b) => a + b, 0);
  const sumOpex = calcs.totalOpexYearly.reduce((a, b) => a + b, 0);
  const sumNet = calcs.cicNetCashFlow.reduce((a, b) => a + b, 0);
  
  return [
    `| Chỉ tiêu | 2026 | 2027 | 2028 | 2029 | 2030 | Tổng |`,
    `|:---|:---:|:---:|:---:|:---:|:---:|:---:|`,
    `| Lợi nhuận gộp | ${fmtVal(calcs.grossProfit[0])} | ${fmtVal(calcs.grossProfit[1])} | ${fmtVal(calcs.grossProfit[2])} | ${fmtVal(calcs.grossProfit[3])} | ${fmtVal(calcs.grossProfit[4])} | ${fmtVal(sumGP)} |`,
    `| CAPEX của CIC (70%) | ${fmtVal(-calcs.capexCIC[0])} | ${fmtVal(-calcs.capexCIC[1])} | ${fmtVal(-calcs.capexCIC[2])} | — | — | ${fmtVal(-sumCapexCIC)} |`,
    `| OPEX | ${fmtVal(-calcs.totalOpexYearly[0])} | ${fmtVal(-calcs.totalOpexYearly[1])} | ${fmtVal(-calcs.totalOpexYearly[2])} | ${fmtVal(-calcs.totalOpexYearly[3])} | ${fmtVal(-calcs.totalOpexYearly[4])} | ${fmtVal(-sumOpex)} |`,
    `| **Dòng tiền ròng CIC** | **${fmtVal(calcs.cicNetCashFlow[0])}** | **${fmtVal(calcs.cicNetCashFlow[1])}** | **${fmtVal(calcs.cicNetCashFlow[2], 2)}** | **${fmtVal(calcs.cicNetCashFlow[3], 2)}** | **${fmtVal(calcs.cicNetCashFlow[4], 2)}** | **${fmtVal(sumNet, 2)}** |`,
    `| **Tích lũy CIC** | **${fmtVal(calcs.cicCumulativeNetCashFlow[0])}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[1])}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[2], 2)}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[3], 2)}** | **${fmtVal(calcs.cicCumulativeNetCashFlow[4], 2)}** | |`
  ].join('\n');
}

function getTable6_5bis_b(calcs) {
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

function getTable6_5bis_c(calcs) {
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

function getTable6_5bis_d(calcs, inputs) {
  const scBiQuan = calcs.scenarioResults[2];
  const scCoSo = calcs.scenarioResults[1];
  const scLacQuan = calcs.scenarioResults[0];
  
  const minCashBurnA = Math.min(...scLacQuan.cumulativeFlows);
  const minCashBurnB = Math.min(...scCoSo.cumulativeFlows);
  const minCashBurnC = Math.min(...scBiQuan.cumulativeFlows);
  
  const paybackA = scLacQuan.payback ? `Q${Math.ceil((scLacQuan.payback % 1) * 4)}/${Math.floor(2026 + scLacQuan.payback)}` : 'Sau 2031';
  const paybackB = scCoSo.payback ? `Q${Math.ceil((scCoSo.payback % 1) * 4)}/${Math.floor(2026 + scCoSo.payback)}` : 'Sau 2031';
  const paybackC = scBiQuan.payback ? `Q${Math.ceil((scBiQuan.payback % 1) * 4)}/${Math.floor(2026 + scBiQuan.payback)}` : 'Sau 2031';
  
  return [
    `| Chỉ số | **A (Lạc quan)** | **B (Cơ sở)** | **C (Bi quan)** |`,
    `|---|:---:|:---:|:---:|`,
    `| **NPV toàn dự án** | ${fmtVal(scLacQuan.npv)} tỷ | ${fmtVal(scCoSo.npv)} tỷ | ${fmtVal(scBiQuan.npv)} tỷ |`,
    `| **IRR** | ${scLacQuan.irr ? (scLacQuan.irr*100).toFixed(0)+'%' : 'Âm'} | ${scCoSo.irr ? (scCoSo.irr*100).toFixed(0)+'%' : 'Âm'} | ${scBiQuan.irr ? (scBiQuan.irr*100).toFixed(0)+'%' : 'Âm'} |`,
    `| **Thời gian hoàn vốn** | ${paybackA} | ${paybackB} | ${paybackC} |`,
    `| **Cash burn tối đa** | ${fmtVal(minCashBurnA)} tỷ | ${fmtVal(minCashBurnB)} tỷ | ${fmtVal(minCashBurnC)} tỷ |`,
    `| **Vốn lưu động CIC cần chuẩn bị** | ~${Math.abs(minCashBurnA * inputs.fin.cicShare).toFixed(1)} tỷ | ~${Math.abs(minCashBurnB * inputs.fin.cicShare).toFixed(1)} tỷ | ~${Math.abs(minCashBurnC * inputs.fin.cicShare).toFixed(1)} tỷ |`
  ].join('\n');
}

export function main() {
  console.log('Reading inputs from:', inputsPath);
  const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));
  
  console.log('Calculating financial model...');
  const calcs = runCalculation(inputs);
  
  console.log('Reading report markdown...');
  let markdown = fs.readFileSync(mdPath, 'utf8');
  
  // Replace tables wrapped in comment tags
  const replacements = {
    '6_2A': getTable6_2a(calcs, inputs),
    '6_2C': getTable6_2c(calcs, inputs),
    '6_4A': getTable6_4a(inputs),
    '6_4B': getTable6_4b(calcs, inputs),
    '6_5_1': getTable6_5_1(calcs),
    '6_5_2': getTable6_5_2(calcs),
    '6_5BIS_B': getTable6_5bis_b(calcs),
    '6_5BIS_C': getTable6_5bis_c(calcs),
    '6_5BIS_D': getTable6_5bis_d(calcs, inputs)
  };
  
  let modified = false;
  for (const [id, tableMd] of Object.entries(replacements)) {
    const startTag = `<!-- TABLE_${id}_START -->`;
    const endTag = `<!-- TABLE_${id}_END -->`;
    
    const startIdx = markdown.indexOf(startTag);
    const endIdx = markdown.indexOf(endTag);
    
    if (startIdx !== -1 && endIdx !== -1) {
      const before = markdown.slice(0, startIdx + startTag.length);
      const after = markdown.slice(endIdx);
      markdown = before + '\n' + tableMd + '\n' + after;
      modified = true;
      console.log(`Replaced table ${id} in markdown.`);
    } else {
      console.warn(`WARNING: Tags for table ${id} not found in markdown.`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(mdPath, markdown, 'utf8');
    console.log('Markdown report updated successfully.');
    
    // Auto trigger HTML compilation
    exec('node scripts/md_to_html_report.cjs', (error, stdout, stderr) => {
      if (error) {
        console.error('Error generating HTML report:', error);
      } else {
        console.log('HTML report generated:', stdout.trim());
      }
    });
  } else {
    console.log('No modifications made to report.');
  }
}

// Check if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
