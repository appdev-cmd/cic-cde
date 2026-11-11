import { useEffect, useRef, useState } from "react";
import { deleteCadDrawing, listCadDrawings, uploadCadDrawing, type CadDrawing } from "./cadStorage";
import CadFilePreview from "./CadFilePreview";
import DeleteFileDialog from "./DeleteFileDialog";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function CadPreview({ drawing, close }: { drawing: CadDrawing; close(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog className="cde-cad-dialog" ref={dialog} onClose={close} aria-labelledby="cde-cad-title">
      <header>
        <h2 id="cde-cad-title">{drawing.name}</h2>
        <button type="button" className="button secondary" onClick={close}>Đóng</button>
      </header>
      <CadFilePreview key={drawing.key} drawing={drawing} />
    </dialog>
  );
}

export default function CadDrawings({ canUpload, canDelete }: { canUpload: boolean; canDelete: boolean }) {
  const [drawings, setDrawings] = useState<CadDrawing[]>([]);
  const [selected, setSelected] = useState<CadDrawing>();
  const [toDelete, setToDelete] = useState<CadDrawing>();
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number; percent: number }>();
  const [failed, setFailed] = useState<{ file: File; message: string }[]>([]);
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

  async function upload(files: File[]) {
    const current = new AbortController();
    request.current = current;
    setProgress({ done: 0, total: files.length, percent: 0 });
    setFailed([]);
    setMessage("");
    setError("");
    const failures: { file: File; message: string }[] = [];
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let sentBytes = 0;
    let done = 0;
    let index = 0;
    function report() {
      if (!current.signal.aborted) {
        setProgress({ done, total: files.length, percent: Math.min(100, Math.floor(100 * sentBytes / (totalBytes || 1))) });
      }
    }
    async function next() {
      while (index < files.length && !current.signal.aborted) {
        const file = files[index++];
        let last = 0;
        try {
          const drawing = await uploadCadDrawing(file, current.signal, (uploaded) => {
            sentBytes += uploaded - last;
            last = uploaded;
            report();
          });
          if (!current.signal.aborted) setDrawings((previous) => [drawing, ...previous]);
        } catch (failure) {
          if (!current.signal.aborted) failures.push({ file, message: errorMessage(failure) });
        }
        sentBytes += file.size - last;
        done++;
        report();
      }
    }
    await Promise.all(Array.from({ length: Math.min(files.length, 3) }, () => next()));
    if (current.signal.aborted) return;
    setProgress(undefined);
    setFailed(failures);
    const count = files.length - failures.length;
    if (count > 0) {
      setMessage(files.length === 1 ? `Đã tải lên ${files[0].name}.` : `Đã tải lên ${count}/${files.length} bản vẽ.`);
    }
  }

  const visible = drawings.filter((drawing) => (!format || drawing.format === format) &&
    drawing.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

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
          <input type="file" accept=".dwg,.dxf" multiple disabled={loading || progress !== undefined} onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) void upload(files);
          }} />
        </label>
      )}
      {progress && <p role="status">Đã xử lý {progress.done}/{progress.total} bản vẽ · {progress.percent}%</p>}
      {message && <p role="status">{message}</p>}
      {error && <p className="cde-message" role="alert">{error}</p>}
      {failed.length > 0 && (
        <div className="cde-message" role="alert">
          <strong>{failed.length} bản vẽ tải lên thất bại</strong>
          <ul>{failed.map(({ file, message }, index) => <li key={index}>{file.name} · {message}</li>)}</ul>
          <button type="button" className="button secondary" disabled={loading}
            onClick={() => void upload(failed.map(({ file }) => file))}>Thử lại các file lỗi</button>
        </div>
      )}
      <div className="cde-filters">
        <input type="search" aria-label="Tìm bản vẽ" placeholder="Tìm theo tên bản vẽ"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Lọc định dạng bản vẽ" value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="">Mọi định dạng</option>
          <option value="dwg">DWG</option>
          <option value="dxf">DXF</option>
        </select>
      </div>
      {visible.length > 0 ? (
        <div className="cde-table">
          <table>
            <thead><tr><th>Bản vẽ</th><th>Định dạng</th><th>Dung lượng</th><th>Ngày tải lên</th>{canDelete && <th>Thao tác</th>}</tr></thead>
            <tbody>
              {visible.map((drawing) => (
                <tr key={drawing.key}>
                  <td><button type="button" className="cde-doc-link" onClick={() => setSelected(drawing)}>{drawing.name}</button></td>
                  <td>{drawing.format.toUpperCase()}</td>
                  <td>{drawing.bytes < 1_000_000 ? `${number.format(drawing.bytes / 1_000)} KB` : `${number.format(drawing.bytes / 1_000_000)} MB`}</td>
                  <td>{date.format(new Date(drawing.createdAt))}</td>
                  {canDelete && (
                    <td>
                      <button type="button" className="button cde-delete-link"
                        aria-label={`Xóa bản vẽ ${drawing.name}`}
                        disabled={loading || progress !== undefined}
                        onClick={() => setToDelete(drawing)}>Xóa</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !error && <p className="cde-file-empty">{loading ? "Đang tải danh sách bản vẽ…" : drawings.length ? "Không có bản vẽ phù hợp." : "Dự án chưa có bản vẽ CAD."}</p>}
      {selected && <CadPreview drawing={selected} close={() => setSelected(undefined)} />}
      {toDelete && (
        <DeleteFileDialog title="Xóa bản vẽ CAD" name={toDelete.name}
          description="Tệp sẽ bị xóa khỏi dự án. Nếu đã dùng bản vẽ này để đối chiếu theo tầng, bạn cần chọn lại bản vẽ cho tầng đó."
          onClose={() => setToDelete(undefined)}
          onDelete={async () => {
            await deleteCadDrawing(toDelete);
            setDrawings((previous) => previous.filter((item) => item.key !== toDelete.key));
            setMessage(`Đã xóa ${toDelete.name}.`);
          }}
        />
      )}
    </section>
  );
}
