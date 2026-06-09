import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wrench, Search, MapPin, Package, AlertTriangle,
  CheckCircle2, Clock, Plus, X, QrCode, ShieldCheck
} from 'lucide-react';
import { fetchAssets, createTicket, updateTicketStatus, type AssetRow } from '../../lib/api/data';

/**
 * Phân hệ Vận hành & Quản lý Tài sản (FM) — theo chuẩn COBie.
 * Cấu trúc dữ liệu: Space (không gian) > Type (loại thiết bị) > Component (thiết bị cụ thể).
 * Mỗi Component có mã QR định danh để tra cứu/báo sự cố tại hiện trường.
 * Dữ liệu hiện ở dạng mock client-side; sẽ kết nối DB ở giai đoạn backend.
 */

// Dùng kiểu dữ liệu từ lớp API (Supabase). Trường dạng string để khớp DB.
type MaintenanceTicket = AssetRow['tickets'][number];
type Asset = AssetRow;

const FM_BASE_URL = 'https://cde.cic.vn/fm/asset';

const statusColor = (status: string) =>
  status === 'Hoạt động' ? 'bg-success/10 text-success border-success/20'
  : status === 'Cần bảo trì' ? 'bg-warning/10 text-warning border-warning/20'
  : 'bg-error/10 text-error border-error/20';

interface FmTabProps {
  projectId?: string;
}

export function FmTab({ projectId }: FmTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketType, setNewTicketType] = useState<'PM' | 'CM'>('CM');

  // Nạp thiết bị từ Supabase theo dự án
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchAssets(projectId)
      .then(rows => {
        setAssets(rows);
        if (rows.length) setSelectedId(rows[0].id);
      })
      .catch(err => console.error('Không tải được thiết bị FM:', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  const selected = assets.find(a => a.id === selectedId) || null;

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.space.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTicket = async () => {
    if (!newTicketTitle.trim() || !selected) return;
    const prefix = newTicketType === 'PM' ? 'PM' : 'CM';
    const code = `${prefix}-${String(Math.floor(100 + Math.random() * 900))}`;
    const date = new Date().toISOString().split('T')[0];
    const assetId = selected.id;

    // Persist trước để lấy đúng id; nếu lỗi vẫn cập nhật UI lạc quan
    await createTicket(assetId, { code, type: newTicketType, title: newTicketTitle, status: 'Mới', date });
    // Nạp lại tickets của thiết bị từ Supabase để có id thật
    try {
      const rows = await fetchAssets(projectId || '');
      setAssets(rows);
    } catch {
      setAssets(prev => prev.map(a => a.id === assetId
        ? { ...a, tickets: [{ id: code, code, type: newTicketType, title: newTicketTitle, status: 'Mới', date }, ...a.tickets] }
        : a));
    }
    setNewTicketTitle('');
    setIsCreatingTicket(false);
  };

  const handleAdvanceTicket = (ticketId: string) => {
    if (!selected) return;
    let nextStatus = '';
    setAssets(prev => prev.map(a => {
      if (a.id !== selected.id) return a;
      return {
        ...a,
        tickets: a.tickets.map(t => {
          if (t.id !== ticketId) return t;
          nextStatus = t.status === 'Mới' ? 'Đang xử lý' : 'Hoàn thành';
          return { ...t, status: nextStatus };
        }),
      };
    }));
    if (nextStatus) updateTicketStatus(ticketId, nextStatus);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: equipment list */}
      <aside className="w-[340px] bg-surface-container-lowest border-r border-outline-variant flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            <h2 className="font-bold text-[15px] text-on-surface">Quản lý Vận hành (FM)</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm thiết bị, mã, không gian..."
              className="w-full pl-9 pr-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
            />
          </div>
          <div className="text-[10px] font-bold text-outline uppercase tracking-wider">
            {filtered.length} thiết bị (COBie Component)
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
          {filtered.map(a => (
            <div
              key={a.id}
              onClick={() => { setSelectedId(a.id); setIsCreatingTicket(false); }}
              className={`p-3 rounded-xl cursor-pointer border transition-all ${
                selectedId === a.id
                  ? 'bg-primary/5 border-primary/40'
                  : 'bg-surface border-outline-variant/40 hover:border-primary/30'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono text-[10px] font-bold text-primary">{a.code}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor(a.status)}`}>{a.status}</span>
              </div>
              <div className="font-bold text-[13px] text-on-surface leading-snug mb-1">{a.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                <MapPin size={11} className="text-outline shrink-0" />
                <span className="truncate">{a.space}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest p-6">
        {selected ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[12px] font-bold text-primary bg-primary-container/10 px-2 py-0.5 rounded">{selected.code}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(selected.status)}`}>{selected.status}</span>
                </div>
                <h1 className="text-xl font-bold text-on-surface tracking-tight">{selected.name}</h1>
                <p className="text-[13px] text-on-surface-variant font-medium mt-0.5">{selected.type}</p>
              </div>
              {/* QR code */}
              <div className="shrink-0 bg-surface border border-outline-variant rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                <QRCodeSVG value={`${FM_BASE_URL}/${selected.id}`} size={92} level="M" />
                <span className="text-[9px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                  <QrCode size={10} /> Quét tại hiện trường
                </span>
              </div>
            </div>

            {/* COBie specs */}
            <div className="bg-surface border border-outline-variant/60 rounded-2xl p-5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <Package size={13} /> Thông số kỹ thuật (COBie Type)
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <Spec label="Không gian (Space)" value={selected.space} />
                <Spec label="Nhà sản xuất" value={selected.manufacturer} />
                <Spec label="Model" value={selected.model} />
                <Spec label="Công suất" value={selected.capacity} />
                <Spec label="Ngày lắp đặt" value={selected.installDate} />
                <Spec label="Bảo hành đến" value={selected.warrantyUntil} />
                <Spec label="Chu kỳ bảo trì" value={selected.maintenanceCycle} />
                <Spec label="Mã định danh (UUID)" value={selected.id} mono />
              </div>
            </div>

            {/* Maintenance tickets */}
            <div className="bg-surface border border-outline-variant/60 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-[11px] uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Wrench size={13} /> Phiếu bảo trì ({selected.tickets.length})
                </h3>
                <button
                  onClick={() => setIsCreatingTicket(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-container px-2 py-1 rounded hover:bg-primary/5 transition-colors"
                >
                  <Plus size={12} /> Tạo phiếu
                </button>
              </div>

              {isCreatingTicket && (
                <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[12px] text-on-surface">Tạo phiếu bảo trì mới</h4>
                    <button onClick={() => setIsCreatingTicket(false)} className="text-on-surface-variant hover:text-error"><X size={14} /></button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newTicketType}
                      onChange={(e) => setNewTicketType(e.target.value as 'PM' | 'CM')}
                      className="bg-surface border border-outline-variant/60 rounded-lg px-2 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <option value="CM">Khắc phục (CM)</option>
                      <option value="PM">Định kỳ (PM)</option>
                    </select>
                    <input
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                      placeholder="Mô tả sự cố / nội dung bảo trì..."
                      className="flex-1 px-3 py-2 bg-surface border border-outline-variant/60 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleCreateTicket}
                      className="bg-primary text-on-primary font-bold text-xs px-3 rounded-lg hover:bg-primary/95 transition-colors"
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              )}

              {selected.tickets.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant text-xs flex flex-col items-center gap-2">
                  <ShieldCheck size={24} className="text-success/50" />
                  Chưa có phiếu bảo trì nào. Thiết bị đang hoạt động ổn định.
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.tickets.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.type === 'PM' ? 'bg-tertiary-container/20 text-tertiary' : 'bg-error/10 text-error'}`}>{t.type}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[12.5px] text-on-surface truncate">{t.title}</div>
                          <div className="font-mono text-[10px] text-outline">{t.id} · {t.date}{t.technician ? ` · ${t.technician}` : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`flex items-center gap-1 text-[10px] font-bold ${
                          t.status === 'Hoàn thành' ? 'text-success' : t.status === 'Đang xử lý' ? 'text-warning' : 'text-on-surface-variant'
                        }`}>
                          {t.status === 'Hoàn thành' ? <CheckCircle2 size={12} /> : t.status === 'Đang xử lý' ? <Clock size={12} /> : <AlertTriangle size={12} />}
                          {t.status}
                        </span>
                        {t.status !== 'Hoàn thành' && (
                          <button
                            onClick={() => handleAdvanceTicket(t.id)}
                            className="text-[10px] font-bold text-primary hover:underline"
                          >
                            {t.status === 'Mới' ? 'Tiếp nhận' : 'Hoàn tất'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-on-surface-variant">Chọn một thiết bị để xem chi tiết.</div>
        )}
      </div>
    </div>
  );
}

function Spec({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold text-outline uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-on-surface font-semibold truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  );
}
