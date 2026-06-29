import React, { useEffect, useState } from 'react';
import { Plus, X, Download, Calculator, Search, Box, RefreshCw } from 'lucide-react';
import {
  searchNorms, fetchBoq, addBoqItem, updateBoqQuantity, updateBoqUnitPrice, deleteBoqItem,
  type CostNorm, type BoqItem,
} from '../../lib/api/cost';
import type { QtoResult, QtoRow } from '../bim/BimViewer';
import { ifcClassLabel } from '../../lib/ifcLabels';

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';
const lineTotal = (i: BoqItem) => i.quantity * i.materialUnit; // đơn giá gộp lưu ở materialUnit

interface Cost5DPanelProps {
  projectId?: string;
  getQto?: () => Promise<QtoResult | null>;
}

export function Cost5DPanel({ projectId, getQto }: Cost5DPanelProps) {
  const [boq, setBoq] = useState<BoqItem[]>([]);
  const [tab, setTab] = useState<'boq' | 'catalog'>('boq');

  // Tìm & thêm công tác
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CostNorm[]>([]);
  const [picked, setPicked] = useState<CostNorm | null>(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  // QTO từ mô hình
  const [qtoRows, setQtoRows] = useState<QtoRow[] | null>(null);
  const [qtoLoading, setQtoLoading] = useState(false);
  const [showQto, setShowQto] = useState(false);

  const handleLoadQto = async () => {
    if (!getQto) return;
    setQtoLoading(true);
    setShowQto(true);
    try {
      const res = await getQto();
      setQtoRows(res?.rows.filter(r => r.area > 0 || r.volume > 0 || r.length > 0) ?? []);
    } catch {
      setQtoRows([]);
    } finally {
      setQtoLoading(false);
    }
  };

  // Lấy 1 giá trị khối lượng từ QTO đổ vào ô khối lượng đang nhập
  const useQtoValue = (val: number) => {
    setQty(String(Number(val.toFixed(3))));
    setShowQto(false);
  };

  // Catalog viewer
  const [catSearch, setCatSearch] = useState('');
  const [catResults, setCatResults] = useState<CostNorm[]>([]);

  useEffect(() => {
    if (projectId) fetchBoq(projectId).then(setBoq).catch(e => console.error(e));
  }, [projectId]);

  // Tìm công tác (debounce nhẹ)
  useEffect(() => {
    if (picked) return; // đang chọn rồi
    const t = setTimeout(() => {
      if (search.trim().length < 2) { setResults([]); return; }
      searchNorms(search, 30).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, picked]);

  // Catalog tab search
  useEffect(() => {
    if (tab !== 'catalog') return;
    const t = setTimeout(() => searchNorms(catSearch, 100).then(setCatResults).catch(() => setCatResults([])), 250);
    return () => clearTimeout(t);
  }, [catSearch, tab]);

  const handleAdd = async () => {
    if (!projectId || !picked) { alert('Hãy tìm và chọn một công tác.'); return; }
    const item = await addBoqItem(projectId, {
      normCode: picked.code, name: picked.name, unit: picked.unit, quantity: Number(qty) || 0,
      materialUnit: Number(price) || 0, laborUnit: 0, machineUnit: 0,
    });
    if (item) setBoq(prev => [...prev, item]);
    setPicked(null); setSearch(''); setResults([]); setQty(''); setPrice('');
  };

  const handleQty = (id: string, v: string) => {
    const q = Number(v) || 0;
    setBoq(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
    updateBoqQuantity(id, q);
  };
  const handlePrice = (id: string, v: string) => {
    const p = Number(v) || 0;
    setBoq(prev => prev.map(i => i.id === id ? { ...i, materialUnit: p } : i));
    updateBoqUnitPrice(id, p);
  };
  const handleDel = async (id: string) => { await deleteBoqItem(id); setBoq(prev => prev.filter(i => i.id !== id)); };

  const grand = boq.reduce((s, i) => s + lineTotal(i), 0);

  const handleExport = () => {
    const header = 'Ma,Cong tac,Don vi,Khoi luong,Don gia,Thanh tien';
    const lines = boq.map(i => `${i.normCode || ''},"${i.name}",${i.unit},${i.quantity},${i.materialUnit},${lineTotal(i)}`);
    lines.push(`,,,,TONG CONG,${grand}`);
    const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `DuToan5D_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Dự toán Chi phí 5D</h2>
            <span className="text-[11px] text-on-surface-variant">— Định mức TT12/2021/BXD</span>
          </div>
          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant/60">
            <button onClick={() => setTab('boq')} className={`px-3 py-1.5 rounded-md text-[12px] font-bold ${tab === 'boq' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}>Bảng dự toán</button>
            <button onClick={() => setTab('catalog')} className={`px-3 py-1.5 rounded-md text-[12px] font-bold ${tab === 'catalog' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}>Tra cứu định mức</button>
          </div>
        </div>

        {tab === 'boq' ? (
          <>
            {/* Tổng */}
            <div className="bg-surface border border-outline-variant/50 rounded-xl p-4 flex items-center justify-between">
              <span className="text-[11px] font-bold text-outline uppercase tracking-wider">Tổng dự toán ({boq.length} công tác)</span>
              <span className="text-2xl font-extrabold text-success">{vnd(grand)}</span>
            </div>

            {/* Thêm công tác */}
            <div className="bg-surface border border-outline-variant/50 rounded-xl p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={15} />
                <input value={picked ? `${picked.code} — ${picked.name}` : search}
                  onChange={e => { setPicked(null); setSearch(e.target.value); }}
                  placeholder="Tìm công tác theo mã (AF.11110) hoặc tên (bê tông, xây tường...)"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-medium focus:outline-none focus:border-primary" />
                {!picked && results.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {results.map(n => (
                      <button key={n.id} onClick={() => { setPicked(n); setResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-surface-container border-b border-outline-variant/20 last:border-0">
                        <span className="font-mono text-[11px] font-bold text-primary">{n.code}</span>
                        <span className="text-[11px] text-on-surface ml-2">{n.name}</span>
                        <span className="text-[10px] text-outline ml-1">({n.unit})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-28">
                  <label className="text-[10px] font-bold text-outline uppercase">Khối lượng</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0"
                    className="w-full mt-1 bg-surface-container border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold focus:outline-none focus:border-primary" />
                </div>
                <div className="w-40">
                  <label className="text-[10px] font-bold text-outline uppercase">Đơn giá (₫)</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                    className="w-full mt-1 bg-surface-container border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold focus:outline-none focus:border-primary" />
                </div>
                {getQto && (
                  <button onClick={handleLoadQto} className="border border-primary/40 text-primary font-bold text-xs px-3 py-2 rounded-lg hover:bg-primary/5 flex items-center gap-1.5" title="Lấy khối lượng từ mô hình BIM (bóc tách QTO)">
                    <Box size={14} /> Lấy KL từ mô hình
                  </button>
                )}
                <button onClick={handleAdd} disabled={!picked} className="bg-primary text-on-primary font-bold text-xs px-4 py-2 rounded-lg hover:bg-primary/95 disabled:opacity-40 flex items-center gap-1.5">
                  <Plus size={14} /> Thêm vào dự toán
                </button>
                <button onClick={handleExport} disabled={boq.length === 0} className="ml-auto border border-outline-variant text-on-surface-variant font-bold text-xs px-3 py-2 rounded-lg hover:bg-surface-container disabled:opacity-40 flex items-center gap-1.5">
                  <Download size={14} /> Xuất CSV
                </button>
              </div>

              {/* Bảng QTO từ mô hình — chọn 1 giá trị để đổ vào ô khối lượng */}
              {showQto && (
                <div className="border border-outline-variant/50 rounded-lg bg-surface-container-low p-2 mt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Khối lượng từ mô hình (QTO) — bấm để dùng</span>
                    <button onClick={() => setShowQto(false)} className="text-on-surface-variant hover:text-error"><X size={13} /></button>
                  </div>
                  {qtoLoading ? (
                    <div className="py-3 flex items-center justify-center gap-2 text-on-surface-variant text-[11px]"><RefreshCw size={13} className="animate-spin" /> Đang bóc tách...</div>
                  ) : !qtoRows || qtoRows.length === 0 ? (
                    <div className="py-2 text-center text-[11px] text-outline">Chưa có dữ liệu khối lượng. Hãy mở 1 mô hình IFC có Qto ở tab Mô hình 3D.</div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                      {qtoRows.map(r => (
                        <div key={r.category} className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-surface-container">
                          <span className="text-[11px] font-semibold text-on-surface truncate flex-1">
                            {r.category}{ifcClassLabel(r.category) && <span className="text-outline font-normal"> ({ifcClassLabel(r.category)})</span>}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            {r.volume > 0 && <button onClick={() => useQtoValue(r.volume)} className="text-[10px] font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded">{r.volume.toFixed(2)} m³</button>}
                            {r.area > 0 && <button onClick={() => useQtoValue(r.area)} className="text-[10px] font-mono font-bold text-tertiary bg-tertiary-container/15 hover:bg-tertiary-container/30 px-1.5 py-0.5 rounded">{r.area.toFixed(2)} m²</button>}
                            {r.length > 0 && <button onClick={() => useQtoValue(r.length)} className="text-[10px] font-mono font-bold text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">{r.length.toFixed(2)} m</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bảng BOQ */}
            <div className="bg-surface border border-outline-variant/50 rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-surface-container">
                  <tr className="text-[10px] uppercase tracking-wider text-outline">
                    <th className="text-left font-bold py-2.5 px-3">Mã</th>
                    <th className="text-left font-bold py-2.5 px-3">Công tác</th>
                    <th className="text-center font-bold py-2.5 px-2">ĐV</th>
                    <th className="text-right font-bold py-2.5 px-2">Khối lượng</th>
                    <th className="text-right font-bold py-2.5 px-2">Đơn giá (₫)</th>
                    <th className="text-right font-bold py-2.5 px-3">Thành tiền</th>
                    <th className="py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {boq.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-on-surface-variant text-xs">Chưa có dòng dự toán. Tìm công tác, nhập khối lượng + đơn giá rồi "Thêm".</td></tr>
                  ) : boq.map(i => (
                    <tr key={i.id} className="border-t border-outline-variant/30 hover:bg-surface-container/30">
                      <td className="py-2 px-3 font-mono text-[11px] text-primary">{i.normCode}</td>
                      <td className="py-2 px-3 font-semibold text-on-surface">{i.name}</td>
                      <td className="py-2 px-2 text-center text-on-surface-variant">{i.unit}</td>
                      <td className="py-2 px-2 text-right">
                        <input type="number" value={i.quantity} onChange={e => handleQty(i.id, e.target.value)}
                          className="w-20 bg-surface-container border border-outline-variant/50 rounded px-1.5 py-1 text-right text-[11px] font-mono focus:outline-none focus:border-primary" />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input type="number" value={i.materialUnit} onChange={e => handlePrice(i.id, e.target.value)}
                          className="w-28 bg-surface-container border border-outline-variant/50 rounded px-1.5 py-1 text-right text-[11px] font-mono focus:outline-none focus:border-primary" />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">{vnd(lineTotal(i))}</td>
                      <td className="py-2 px-2 text-right"><button onClick={() => handleDel(i.id)} className="text-on-surface-variant hover:text-error"><X size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
                {boq.length > 0 && (
                  <tfoot><tr className="border-t-2 border-outline-variant font-bold bg-surface-container/40">
                    <td colSpan={5} className="py-2.5 px-3 text-right text-on-surface">TỔNG CỘNG</td>
                    <td className="py-2.5 px-3 text-right font-mono text-success">{vnd(grand)}</td><td></td>
                  </tr></tfoot>
                )}
              </table>
            </div>
            <p className="text-[10.5px] text-outline leading-relaxed">
              * Danh mục công tác lấy từ Định mức TT12/2021/BXD (13.806 mã). Đơn giá nhập theo công bố giá địa phương.
              Liên kết khối lượng tự động từ QTO (bóc tách mô hình) sẽ bổ sung ở bước sau.
            </p>
          </>
        ) : (
          /* Tra cứu định mức */
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)}
                placeholder="Tra cứu mã hoặc tên công tác trong Định mức TT12/2021..."
                className="w-full pl-10 pr-3 py-2.5 bg-surface border border-outline-variant/60 rounded-xl text-[13px] focus:outline-none focus:border-primary" />
            </div>
            <div className="bg-surface border border-outline-variant/50 rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-surface-container"><tr className="text-[10px] uppercase tracking-wider text-outline">
                  <th className="text-left font-bold py-2.5 px-3">Mã hiệu</th>
                  <th className="text-left font-bold py-2.5 px-3">Tên công tác</th>
                  <th className="text-center font-bold py-2.5 px-2">Đơn vị</th>
                </tr></thead>
                <tbody>
                  {catResults.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-on-surface-variant text-xs">{catSearch ? 'Không tìm thấy.' : 'Nhập từ khoá để tra cứu (vd: bê tông, AF.111, xây tường).'}</td></tr>
                  ) : catResults.map(n => (
                    <tr key={n.id} className="border-t border-outline-variant/30 hover:bg-surface-container/30">
                      <td className="py-2 px-3 font-mono text-[11px] text-primary">{n.code}</td>
                      <td className="py-2 px-3 text-on-surface">{n.name}</td>
                      <td className="py-2 px-2 text-center text-on-surface-variant">{n.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
