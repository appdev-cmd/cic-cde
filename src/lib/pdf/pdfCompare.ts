// So sánh PDF giữa hai phiên bản tài liệu — logic thuần, không phụ thuộc React.
// Ngữ nghĩa màu đồng bộ với so sánh mô hình 3D (BimViewer.compareModels):
//   Thêm = xanh lá · Xóa = đỏ · Sửa = vàng.
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pixelmatch from 'pixelmatch';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfDoc {
  doc: pdfjsLib.PDFDocumentProxy;
  numPages: number;
  url: string;
}

export async function loadPdf(url: string): Promise<PdfDoc> {
  const doc = await pdfjsLib.getDocument({ url }).promise;
  return { doc, numPages: doc.numPages, url };
}

/** Kết xuất một trang PDF vào canvas cho trước. Trả về kích thước pixel. */
export async function renderPageToCanvas(
  pdf: PdfDoc,
  pageNum: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  const page = await pdf.doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { width: canvas.width, height: canvas.height };
}

export interface DiffStats {
  changedPct: number;
  addedPx: number;
  removedPx: number;
  modifiedPx: number;
}

// Độ sáng cảm quan của một pixel RGBA (0..255)
const luma = (d: Uint8ClampedArray, i: number) =>
  0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

const WHITE_THRESHOLD = 230; // pixel sáng hơn ngưỡng này coi như nền trắng

/**
 * Diff 2 canvas (bản cũ / bản mới) → vẽ kết quả vào outCanvas.
 * Chuẩn hóa cả hai về max size (nền trắng) để chịu được trang lệch khổ.
 * Phân loại: trắng→đậm = THÊM (xanh) · đậm→trắng = XÓA (đỏ) · khác nhau = SỬA (vàng).
 * Nội dung không đổi vẽ mờ làm nền ngữ cảnh.
 */
export function diffCanvases(
  oldCanvas: HTMLCanvasElement,
  newCanvas: HTMLCanvasElement,
  outCanvas: HTMLCanvasElement,
): DiffStats {
  const w = Math.max(oldCanvas.width, newCanvas.width);
  const h = Math.max(oldCanvas.height, newCanvas.height);

  // Chuẩn hóa về cùng kích thước trên canvas tạm nền trắng
  const norm = (src: HTMLCanvasElement): ImageData => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    if (src.width > 0 && src.height > 0) ctx.drawImage(src, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  };

  const oldData = norm(oldCanvas);
  const newData = norm(newCanvas);
  const diffData = new ImageData(w, h);

  pixelmatch(oldData.data, newData.data, diffData.data, w, h, {
    threshold: 0.12,
    includeAA: false,
  });

  // Vẽ nền: nội dung mới ở dạng mờ (ngữ cảnh), sau đó tô màu pixel khác biệt
  const out = new ImageData(w, h);
  const od = oldData.data, nd = newData.data, dd = diffData.data, po = out.data;
  let addedPx = 0, removedPx = 0, modifiedPx = 0;

  for (let i = 0; i < po.length; i += 4) {
    // pixelmatch đánh dấu pixel khác biệt bằng màu đỏ (255,0,0) trong diff output;
    // pixel không đổi được chép mờ (grayscale) — ta tự dựng lớp nền thay vì dùng mặc định.
    const isDiff = dd[i] === 255 && dd[i + 1] === 0 && dd[i + 2] === 0;
    if (!isDiff) {
      // nền ngữ cảnh: bản mới, làm nhạt ~25%
      const g = luma(nd, i);
      const faded = 255 - (255 - g) * 0.25;
      po[i] = po[i + 1] = po[i + 2] = faded;
      po[i + 3] = 255;
      continue;
    }
    const oldWhite = luma(od, i) >= WHITE_THRESHOLD;
    const newWhite = luma(nd, i) >= WHITE_THRESHOLD;
    if (oldWhite && !newWhite) {
      po[i] = 0x22; po[i + 1] = 0xc5; po[i + 2] = 0x5e; // Thêm — xanh lá
      addedPx++;
    } else if (!oldWhite && newWhite) {
      po[i] = 0xef; po[i + 1] = 0x44; po[i + 2] = 0x44; // Xóa — đỏ
      removedPx++;
    } else {
      po[i] = 0xf5; po[i + 1] = 0x9e; po[i + 2] = 0x0b; // Sửa — vàng
      modifiedPx++;
    }
    po[i + 3] = 255;
  }

  outCanvas.width = w;
  outCanvas.height = h;
  outCanvas.getContext('2d')!.putImageData(out, 0, 0);

  const totalChanged = addedPx + removedPx + modifiedPx;
  return {
    changedPct: (totalChanged / (w * h)) * 100,
    addedPx,
    removedPx,
    modifiedPx,
  };
}
