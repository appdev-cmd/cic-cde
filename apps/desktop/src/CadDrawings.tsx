import { useEffect, useRef, useState } from "react";
import { downloadCadDrawing, listCadDrawings, uploadCadDrawing, type CadDrawing } from "./cadStorage";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function CadPreview({ drawing, close }: { drawing: CadDrawing; close(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [file, setFile] = useState<Blob>();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    const request = new AbortController();
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "cde-cad-loaded") setLoaded(true);
      if (event.data?.type === "cde-cad-error") {
        setError("Không thể hiển thị bản vẽ. Hãy kiểm tra file hoặc thử lại bằng bản DXF.");
      }
    }
    window.addEventListener("message", receive);
    void downloadCadDrawing(drawing, request.signal).then((blob) => {
      if (!request.signal.aborted) setFile(blob);
    }).catch((failure: unknown) => {
      if (!request.signal.aborted) setError(errorMessage(failure));
    });
    return () => {
      request.abort();
      window.removeEventListener("message", receive);
    };
  }, [drawing]);

  useEffect(() => {
    if (!file || loaded || error) return;
    const timer = window.setTimeout(() => setError("Trình xem mất quá nhiều thời gian để mở bản vẽ."), 60_000);
    return () => window.clearTimeout(timer);
  }, [file, loaded, error]);

  return (
    <dialog className="cde-cad-dialog" ref={dialog} onClose={close} aria-labelledby="cde-cad-title">
      <header>
        <h2 id="cde-cad-title">{drawing.name}</h2>
        <button type="button" className="button secondary" onClick={close}>Đóng</button>
      </header>
      {error && <p className="cde-message" role="alert">{error}</p>}
      {!error && !loaded && <p className="cde-cad-loading" role="status">{file ? "Đang mở bản vẽ…" : "Đang tải bản vẽ…"}</p>}
      {file && !error && (
        <iframe
          ref={frame}
          src={import.meta.env.BASE_URL + "cad-viewer.html"}
          title={`Trình xem ${drawing.name}`}
          onLoad={() => frame.current?.contentWindow?.postMessage({
            type: "cde-cad-open", file, format: drawing.format,
          }, location.origin)}
        />
      )}
    </dialog>
  );
}

export default function CadDrawings({ canUpload }: { canUpload: boolean }) {
  const [drawings, setDrawings] = useState<CadDrawing[]>([]);
  const [selected, setSelected] = useState<CadDrawing>();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController>(null);

  async function reload() {
    const current = new AbortController();
    request.current = current;
    setLoading(true);
    setError("");
    try {
      setDrawings(await listCadDrawings(current.signal));
    } catch (failure) {
      if (!current.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => request.current?.abort();
  }, []);

  async function upload(file: File) {
    const current = new AbortController();
    request.current = current;
    setProgress(0);
    setMessage("");
    setError("");
    try {
      const drawing = await uploadCadDrawing(file, current.signal, (uploaded, total) => {
        setProgress(Math.floor(100 * uploaded / total));
      });
      if (current.signal.aborted) return;
      setDrawings((previous) => [drawing, ...previous]);
      setMessage(`Đã tải lên ${drawing.name}.`);
    } catch (failure) {
      if (!current.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!current.signal.aborted) setProgress(undefined);
    }
  }

  return (
    <section className="cde-card cde-cad">
      <div className="cde-intro">
        <div>
          <h2>Bản vẽ CAD</h2>
          <span>DWG và DXF · tối đa 25 MB mỗi bản vẽ</span>
        </div>
        <button type="button" className="button secondary" disabled={loading || progress !== undefined} onClick={() => void reload()}>
          Tải lại bản vẽ
        </button>
      </div>
      {canUpload && (
        <label className="cde-cad-upload">
          Tải bản vẽ lên dự án
          <input type="file" accept=".dwg,.dxf" disabled={loading || progress !== undefined} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void upload(file);
          }} />
        </label>
      )}
      {progress !== undefined && <p role="status">Đang tải lên… {progress}%</p>}
      {message && <p role="status">{message}</p>}
      {error && <p className="cde-message" role="alert">{error}</p>}
      {drawings.length > 0 ? (
        <div className="cde-table">
          <table>
            <thead><tr><th>Bản vẽ</th><th>Định dạng</th><th>Dung lượng</th><th>Ngày tải lên</th></tr></thead>
            <tbody>
              {drawings.map((drawing) => (
                <tr key={drawing.key}>
                  <td><button type="button" className="cde-doc-link" onClick={() => setSelected(drawing)}>{drawing.name}</button></td>
                  <td>{drawing.format.toUpperCase()}</td>
                  <td>{drawing.bytes < 1_000_000 ? `${number.format(drawing.bytes / 1_000)} KB` : `${number.format(drawing.bytes / 1_000_000)} MB`}</td>
                  <td>{date.format(new Date(drawing.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error && <p>{loading ? "Đang tải danh sách bản vẽ…" : "Dự án chưa có bản vẽ CAD."}</p>}
      {selected && <CadPreview drawing={selected} close={() => setSelected(undefined)} />}
    </section>
  );
}
