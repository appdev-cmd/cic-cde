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

const flows = [-2.58, -11.93, 0.82, 24.83, 68.56];
console.log('Project flows:', flows);
console.log('NPV (12%):', calculateNPV(flows, 0.12));
console.log('IRR:', calculateIRR(flows) * 100);

const cicFlows = [-1.87, -8.90, 1.43, 24.83, 68.56];
console.log('CIC flows:', cicFlows);
console.log('CIC NPV (12%):', calculateNPV(cicFlows, 0.12));
console.log('CIC IRR:', calculateIRR(cicFlows) * 100);
