import JSZip from 'jszip'; import { readFileSync } from 'fs';
const ifc = readFileSync('D:/QuocAnh/2026/01.Project/qlda-ddcn-ht/bim-agent-api/expert_kb_files/Duplex_A_20110907.ifc');
const zip = new JSZip();
zip.file('Duplex_A_20110907.ifc', ifc);
const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
const mb = b => (b/1024/1024).toFixed(2);
console.log(`IFC gốc: ${mb(ifc.length)} MB -> .ifczip: ${mb(out.length)} MB (giảm ${(100-out.length/ifc.length*100).toFixed(0)}%)`);
