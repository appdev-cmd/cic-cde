// Verify QTO extraction logic against a real quantity-bearing IFC using web-ifc.
// This validates: (a) IFC has quantity sets, (b) classify by *Value field suffix.
import { IfcAPI } from 'web-ifc';
import { readFileSync } from 'fs';

const IFC = process.argv[2];
if (!IFC) { console.error('usage: node verify-qto.mjs <file.ifc>'); process.exit(1); }

const api = new IfcAPI();
api.SetWasmPath('./node_modules/web-ifc/', true);
await api.Init();

const data = new Uint8Array(readFileSync(IFC));
const modelID = api.OpenModel(data);

// IFCELEMENTQUANTITY = 1883228015 ; iterate all and read quantities
const IFCELEMENTQUANTITY = 1883228015;
const ids = api.GetLineIDsWithType(modelID, IFCELEMENTQUANTITY);

let area = 0, volume = 0, length = 0, count = 0, qtyCount = 0;
const dims = {};

for (let i = 0; i < ids.size(); i++) {
  const set = api.GetLine(modelID, ids.get(i), true);
  count++;
  const quantities = set.Quantities || [];
  for (const q of quantities) {
    if (!q) continue;
    qtyCount++;
    for (const key of Object.keys(q)) {
      const v = q[key] && q[key].value !== undefined ? q[key].value : q[key];
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (key.endsWith('VolumeValue')) { volume += n; dims[key] = (dims[key]||0)+1; }
      else if (key.endsWith('AreaValue')) { area += n; dims[key] = (dims[key]||0)+1; }
      else if (key.endsWith('LengthValue')) { length += n; dims[key] = (dims[key]||0)+1; }
    }
  }
}

console.log('Element quantity sets:', count);
console.log('Total quantities:', qtyCount);
console.log('Value fields seen:', JSON.stringify(dims));
console.log('TOTAL Area (m2):', area.toFixed(2));
console.log('TOTAL Volume (m3):', volume.toFixed(2));
console.log('TOTAL Length (m):', length.toFixed(2));
api.CloseModel(modelID);
