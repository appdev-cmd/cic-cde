// Modal so sánh PDF giữa 2 phiên bản tài liệu (z-[130], nằm trên modal lịch sử phiên bản).
// 2 chế độ: So sánh cạnh nhau (cuộn/zoom đồng bộ) · Chồng lớp (pixel-diff tô màu).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Columns2, Layers, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Loader2, GitCompareArrows,
} from 'lucide-react';
import { loadPdf, renderPageToCanvas, diffCanvases, type PdfDoc, type DiffStats } from '../../lib/pdf/pdfCompare';

interface CompareVersion {
  revision: string;
  version?: string;
  fileUrl: string;
  createdAt: string;
}

interface PdfCompareModalProps {
  docCode: string;
  versionA: CompareVersion; // bản cũ
  versionB: CompareVersion; // bản mới
  onClose: () => void;
}

const RENDER_SCALE = 2; // scale kết xuất cố định; zoom hiển thị bằng CSS transform

export function PdfCompareModal({ docCode, versionA, versionB, onClose }: PdfCompareModalProps) {
  const [mode, setMode] = useState<'side' | 'overlay'>('side');
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0.5); // hệ số hiển thị trên scale kết xuất 2 → 100% thực tế
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfA, setPdfA] = useState<PdfDoc | null>(null);
  const [pdfB, setPdfB] = useState<PdfDoc | null>(null);
  const [stats, setStats] = useState<DiffStats | null>(null);

  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const scrollARef = useRef<HTMLDivElement>(null);
  const scrollBRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  // Cache diff theo trang: tính lazy, dùng lại khi quay về trang cũ
  const diffCacheRef = useRef<Map<number, { canvas: HTMLCanvasElement; stats: DiffStats }>>(new Map());
  // Pan cho chế độ chồng lớp
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const totalPages = Math.max(pdfA?.numPages ?? 0, pdfB?.numPages ?? 0);
  const pageCountMismatch = pdfA && pdfB && pdfA.numPages !== pdfB.numPages;

  // Nạp 2 tài liệu PDF một lần
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [a, b] = await Promise.all([loadPdf(versionA.fileUrl), loadPdf(versionB.fileUrl)]);
        if (cancelled) return;
        setPdfA(a);
        setPdfB(b);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Không thể tải tệp PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [versionA.fileUrl, versionB.fileUrl]);

  // Kết xuất trang hiện tại (cả 2 chế độ đều cần canvas A/B; overlay cần thêm diff)
  useEffect(() => {
    if (!pdfA || !pdfB) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const renderOne = async (pdf: PdfDoc, canvas: HTMLCanvasElement | null) => {
          if (!canvas) return;
          if (page <= pdf.numPages) {
            await renderPageToCanvas(pdf, page, RENDER_SCALE, canvas);
          } else {
            // Trang không tồn tại ở phiên bản này → canvas trắng
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1, 1);
          }
        };

        if (mode === 'side') {
          await Promise.all([renderOne(pdfA, canvasARef.current), renderOne(pdfB, canvasBRef.current)]);
          setStats(null);
        } else {
          // Chế độ chồng lớp: dùng cache nếu có
          const cached = diffCacheRef.current.get(page);
          if (cached && diffCanvasRef.current) {
            const out = diffCanvasRef.current;
            out.width = cached.canvas.width;
            out.height = cached.canvas.height;
            out.getContext('2d')!.drawImage(cached.canvas, 0, 0);
            setStats(cached.stats);
          } else {
            const cA = document.createElement('canvas');
            const cB = document.createElement('canvas');
            await Promise.all([renderOne(pdfA, cA), renderOne(pdfB, cB)]);
            if (cancelled || !diffCanvasRef.current) return;
            const s = diffCanvases(cA, cB, diffCanvasRef.current);
            // Lưu cache (copy canvas kết quả)
            const keep = document.createElement('canvas');
            keep.width = diffCanvasRef.current.width;
            keep.height = diffCanvasRef.current.height;
            keep.getContext('2d')!.drawImage(diffCanvasRef.current, 0, 0);
            diffCacheRef.current.set(page, { canvas: keep, stats: s });
            setStats(s);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Lỗi kết xuất trang PDF.');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfA, pdfB, page, mode]);

  // Cuộn đồng bộ giữa 2 khung (chế độ cạnh nhau)
  const syncScroll = useCallback((src: HTMLDivElement | null, dst: HTMLDivElement | null) => {
    if (!src || !dst || isSyncingRef.current) return;
    isSyncingRef.current = true;
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  const missingIn = (pdf: PdfDoc | null) => pdf !== null && page > pdf.numPages;

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
  };

  return (
    <div
      className="fixed inset-0 bg-inverse-on-surface/40 backdrop-blur-[2px] flex items-center justify-center z-[130] p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full h-full max-w-[1600px] rounded-2xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-low/30 px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <GitCompareArrows size={20} className="text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-on-surface text-sm truncate">So sánh PDF — <span className="font-mono">{docCode}</span></div>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="px-1.5 py-0.5 rounded bg-error/10 text-error font-mono font-bold">{versionA.revision}</span>
                <span>({fmtDate(versionA.createdAt)})</span>
                <span>→</span>
                <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-mono font-bold">{versionB.revision}</span>
                <span>({fmtDate(versionB.createdAt)})</span>
                {pageCountMismatch && (
                  <span className="text-warning font-semibold">· Số trang: {pdfA!.numPages} → {pdfB!.numPages}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-full shrink-0"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-outline-variant px-5 py-2">
          {/* Chọn chế độ */}
          <div className="flex items-center rounded-lg border border-outline-variant overflow-hidden">
            <button
              onClick={() => setMode('side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${mode === 'side' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'}`}
            >
              <Columns2 size={14} /> So sánh cạnh nhau
            </button>
            <button
              onClick={() => { setMode('overlay'); setPanOffset({ x: 0, y: 0 }); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${mode === 'overlay' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'}`}
            >
              <Layers size={14} /> Chồng lớp
            </button>
          </div>

          {/* Điều hướng trang */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-outline-variant text-on-surface disabled:opacity-40 hover:bg-surface-container"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-mono text-on-surface min-w-[64px] text-center">
              {page} / {totalPages || '—'}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-outline-variant text-on-surface disabled:opacity-40 hover:bg-surface-container"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom(z => Math.max(0.15, z - 0.1))}
              className="p-1.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs font-mono text-on-surface min-w-[44px] text-center">{Math.round(zoom * RENDER_SCALE * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Chú giải màu (chế độ chồng lớp) */}
          {mode === 'overlay' && (
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#22c55e]" /> Thêm</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#ef4444]" /> Xóa</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#f59e0b]" /> Sửa</span>
              {stats && (
                <span className="font-semibold text-on-surface">Khác biệt: {stats.changedPct < 0.005 && stats.changedPct > 0 ? '<0,01' : stats.changedPct.toFixed(2).replace('.', ',')}%</span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 relative bg-surface-container">
          {(loading || rendering) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container/60">
              <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                <Loader2 size={18} className="animate-spin" />
                {loading ? 'Đang tải PDF…' : 'Đang kết xuất…'}
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="text-error text-sm font-semibold px-4 py-2 bg-error/10 rounded-lg border border-error/20">{error}</div>
            </div>
          )}

          {mode === 'side' ? (
            <div className="flex h-full divide-x divide-outline-variant">
              {/* Bản cũ */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="px-3 py-1.5 text-[11px] font-bold text-error bg-error/5 border-b border-outline-variant shrink-0">
                  Phiên bản cũ — {versionA.revision}
                </div>
                <div
                  ref={scrollARef}
                  onScroll={() => syncScroll(scrollARef.current, scrollBRef.current)}
                  className="flex-1 overflow-auto p-4"
                >
                  {missingIn(pdfA) ? (
                    <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">
                      Trang không tồn tại ở phiên bản này
                    </div>
                  ) : (
                    <canvas
                      ref={canvasARef}
                      className="shadow-md bg-white"
                      style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                    />
                  )}
                </div>
              </div>
              {/* Bản mới */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="px-3 py-1.5 text-[11px] font-bold text-success bg-success/5 border-b border-outline-variant shrink-0">
                  Phiên bản mới — {versionB.revision}
                </div>
                <div
                  ref={scrollBRef}
                  onScroll={() => syncScroll(scrollBRef.current, scrollARef.current)}
                  className="flex-1 overflow-auto p-4"
                >
                  {missingIn(pdfB) ? (
                    <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">
                      Trang không tồn tại ở phiên bản này
                    </div>
                  ) : (
                    <canvas
                      ref={canvasBRef}
                      className="shadow-md bg-white"
                      style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Chế độ chồng lớp: canvas diff, pan bằng kéo chuột */
            <div
              className="h-full overflow-hidden cursor-grab active:cursor-grabbing flex items-start justify-center"
              onMouseDown={(e) => {
                dragStartRef.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
              }}
              onMouseMove={(e) => {
                if (!dragStartRef.current) return;
                const d = dragStartRef.current;
                setPanOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
              }}
              onMouseUp={() => { dragStartRef.current = null; }}
              onMouseLeave={() => { dragStartRef.current = null; }}
            >
              <canvas
                ref={diffCanvasRef}
                className="shadow-md bg-white mt-4"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  transformOrigin: 'top center',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
