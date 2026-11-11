import { useEffect, useRef, useState } from "react";
import DeleteFileDialog from "./DeleteFileDialog";
import {
  deleteProjectFile, documentExtensions, downloadProjectFile, fileCategories,
  listProjectFiles, uploadProjectFile, type FileCategory, type ProjectFile,
} from "./projectFileStorage";

const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export default function ProjectFiles({ canUpload, canDelete }: { canUpload: boolean; canDelete: boolean }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<FileCategory>("OTHER");
  const [sort, setSort] = useState("recent");
  const [upload, setUpload] = useState<{ index: number; total: number; percent: number }>();
  const [download, setDownload] = useState<string>();
  const [toDelete, setToDelete] = useState<ProjectFile>();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const request = useRef<AbortController>(null);

  async function reload() {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setLoading(true);
    setErrors([]);
    try {
      const result = await listProjectFiles(current.signal);
      if (!current.signal.aborted) setFiles(result);
    } catch (error) {
      if (!current.signal.aborted) setErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => request.current?.abort();
  }, []);

  async function addFiles(batch: File[]) {
    const current = new AbortController();
    request.current = current;
    setMessage("");
    setErrors([]);
    const failures: string[] = [];
    for (const [index, file] of batch.entries()) {
      setUpload({ index: index + 1, total: batch.length, percent: 0 });
      try {
        const item = await uploadProjectFile(file, category, current.signal, (bytes) => {
          if (!current.signal.aborted) setUpload({ index: index + 1, total: batch.length, percent: Math.min(100, Math.round(bytes / file.size * 100)) });
        });
        if (!current.signal.aborted) setFiles((previous) => [item, ...previous]);
      } catch (error) {
        failures.push(`${file.name} · ${error instanceof Error ? error.message : String(error)}`);
      }
      if (current.signal.aborted) return;
    }
    setUpload(undefined);
    setErrors(failures);
    const count = batch.length - failures.length;
    if (count > 0) {
      setFilter(category);
      setQuery("");
      setMessage(`Đã tải lên ${count}/${batch.length} tài liệu.`);
    }
  }

  async function getFile(file: ProjectFile) {
    setDownload(file.key);
    setErrors([]);
    try {
      await downloadProjectFile(file);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setDownload(undefined);
    }
  }

  const visible = files.filter((file) => (!filter || file.category === filter) &&
    file.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "vi") : b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="cde-card cde-project-files">
      <div className="cde-intro">
        <div><h2>Tài liệu dự án</h2><span>{files.length} tài liệu</span></div>
        <button type="button" className="button secondary" disabled={loading || Boolean(upload)} onClick={() => void reload()}>Tải lại tài liệu</button>
      </div>
      {canUpload && (
        <div className="cde-file-upload">
          <label>Phân loại khi tải lên
            <select value={category} disabled={Boolean(upload)} onChange={(event) => setCategory(event.target.value as FileCategory)}>
              {Object.entries(fileCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Tải tài liệu lên
            <input type="file" multiple accept={documentExtensions.map((extension) => "." + extension).join(",")}
              disabled={loading || Boolean(upload)} onChange={(event) => {
                const batch = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                if (batch.length) void addFiles(batch);
              }} />
          </label>
          <small>PDF, Word, Excel, PowerPoint, văn bản, ZIP và ảnh · tối đa 50 MB mỗi file</small>
        </div>
      )}
      {upload && <p role="status">Đang tải tài liệu {upload.index}/{upload.total} · {upload.percent}%</p>}
      {message && <p role="status">{message}</p>}
      {errors.length > 0 && <ul className="cde-message" role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
      <div className="cde-filters">
        <input type="search" aria-label="Tìm tài liệu" placeholder="Tìm theo tên tài liệu" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Lọc theo loại tài liệu" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">Mọi loại tài liệu</option>
          {Object.entries(fileCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select aria-label="Sắp xếp tài liệu" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="recent">Mới nhất</option>
          <option value="name">Theo tên</option>
        </select>
      </div>
      {visible.length > 0 ? (
        <div className="cde-table">
          <table>
            <thead><tr><th>Tên tài liệu</th><th>Phân loại</th><th>Dung lượng</th><th>Ngày tải lên</th><th>Thao tác</th></tr></thead>
            <tbody>{visible.map((file) => (
              <tr key={file.key}>
                <td className="cde-file-name">{file.name}</td>
                <td><span className="cde-state">{fileCategories[file.category]}</span></td>
                <td>{file.bytes < 1_000_000 ? `${number.format(file.bytes / 1_000)} KB` : `${number.format(file.bytes / 1_000_000)} MB`}</td>
                <td>{date.format(new Date(file.createdAt))}</td>
                <td><div className="cde-file-actions">
                  <button type="button" className="button secondary" disabled={Boolean(download)}
                    aria-label={`Tải xuống ${file.name}`} onClick={() => void getFile(file)}>
                    {download === file.key ? "Đang tải…" : "Tải xuống"}
                  </button>
                  {canDelete && <button type="button" className="button cde-delete-link"
                    aria-label={`Xóa tài liệu ${file.name}`} disabled={loading || Boolean(upload)} onClick={() => setToDelete(file)}>Xóa</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="cde-file-empty">{loading ? "Đang tải tài liệu…" : files.length ? "Không có tài liệu phù hợp." : "Dự án chưa có tài liệu."}</p>}
      {toDelete && <DeleteFileDialog title="Xóa tài liệu" name={toDelete.name}
        description="Tệp sẽ bị xóa khỏi hồ sơ dự án." onClose={() => setToDelete(undefined)}
        onDelete={async () => {
          await deleteProjectFile(toDelete);
          setFiles((previous) => previous.filter((item) => item.key !== toDelete.key));
          setMessage(`Đã xóa ${toDelete.name}.`);
        }} />}
    </section>
  );
}
