import { useEffect, useRef, useState } from "react";
import { call, cloudEnabled, importIfc, localDesktop } from "./bridge";
import {
  documentSuggestionBatchSize,
  readIfcDescription,
  suggestFromName,
  type DisciplineCode,
  type DocumentDraft,
} from "./documentMetadata";
import type { DocumentVersion } from "./Cde";
import type { BimModel } from "./types";

type DraftRow = {
  id: string;
  name: string;
  file?: File;
  modelId?: string;
  knownCode: string;
  draft: DocumentDraft;
  edited: Partial<Record<keyof DocumentDraft, true>>;
  suggestion: "name" | "existing" | "pending" | "ai" | "unavailable";
  phase: "ready" | "saving" | "saved" | "error";
  status?: string;
};

type Props = {
  documents: DocumentVersion[];
  models: BimModel[];
  disabled: boolean;
  onSavingChange(saving: boolean): void;
  onModelImported(model: BimModel): void;
  onDocumentSaved(documents: DocumentVersion[], id: number): void;
};

const suggestionLabels: Record<DraftRow["suggestion"], string> = {
  name: "Theo tên file",
  existing: "Theo hồ sơ đã có",
  pending: "AI đang phân tích…",
  ai: "Đã gợi ý bằng Vertex AI",
  unavailable: "AI chưa phản hồi · kiểm tra gợi ý từ tên file",
};

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function validDraft(draft: DocumentDraft) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(draft.code.trim()) &&
    Boolean(draft.title.trim() && draft.discipline);
}

export default function DocumentRegistration({
  documents, models, disabled, onSavingChange, onModelImported, onDocumentSaved,
}: Props) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const suggestionRequest = useRef<AbortController | null>(null);
  const saveRequest = useRef<AbortController | null>(null);
  const pending = rows.some((row) => row.suggestion === "pending");
  const unsaved = rows.filter((row) => row.phase !== "saved");

  useEffect(() => () => {
    suggestionRequest.current?.abort();
    saveRequest.current?.abort();
  }, []);

  function makeRow(name: string, source: { file: File } | { modelId: string }): DraftRow {
    const { structured, ...initial } = suggestFromName(name);
    const existing = documents.find((document) => document.code === initial.code);
    return {
      id: crypto.randomUUID(),
      name,
      ...source,
      knownCode: structured ? initial.code : "",
      draft: existing
        ? { code: existing.code, title: existing.title, discipline: existing.discipline as DisciplineCode }
        : initial,
      edited: {},
      suggestion: existing ? "existing" : cloudEnabled && !localDesktop ? "pending" : "name",
      phase: "ready",
    };
  }

  async function suggestRows(added: DraftRow[]) {
    const queue = added.filter((row) => row.suggestion === "pending");
    if (!queue.length) return;
    suggestionRequest.current?.abort();
    const request = new AbortController();
    suggestionRequest.current = request;
    for (let start = 0; start < queue.length; start += documentSuggestionBatchSize) {
      if (request.signal.aborted) return;
      const group = queue.slice(start, start + documentSuggestionBatchSize);
      let suggestions: (DocumentDraft | null)[] = [];
      try {
        const metadata = await Promise.all(group.map(async (row) => {
          const description = row.file ? await readIfcDescription(row.file).catch(() => null) : null;
          return {
            code: row.knownCode,
            discipline: row.draft.discipline,
            fileName: row.name.slice(0, 240),
            project: description?.project ?? "",
            description: description?.description ?? "",
          };
        }));
        const { suggestCloudDocuments } = await import("./cloud");
        if (request.signal.aborted) return;
        suggestions = await suggestCloudDocuments(metadata, request.signal);
      } catch {
        // Keep filename suggestions available for manual review.
      }
      if (request.signal.aborted) return;
      const results = new Map(group.map((row, index) => [row.id, suggestions[index]]));
      setRows((previous) => previous.map((row) => {
        if (!results.has(row.id)) return row;
        const suggestion = results.get(row.id);
        if (!suggestion) return { ...row, suggestion: "unavailable" };
        return {
          ...row,
          draft: {
            code: row.edited.code ? row.draft.code : suggestion.code || row.draft.code,
            title: row.edited.title ? row.draft.title : suggestion.title || row.draft.title,
            discipline: row.edited.discipline ? row.draft.discipline : suggestion.discipline || row.draft.discipline,
          },
          suggestion: "ai",
        };
      }));
    }
    suggestionRequest.current = null;
  }

  function addFiles(files: File[]) {
    const added: DraftRow[] = [];
    let skipped = 0;
    for (const file of files) {
      if (!/\.ifc$/i.test(file.name) || !file.size || file.size > 100 * 1024 * 1024 ||
          [...rows, ...added].some((row) => row.file && sameFile(row.file, file))) {
        skipped++;
      } else {
        added.push(makeRow(file.name, { file }));
      }
    }
    setNotice(skipped ? `Đã bỏ qua ${skipped} file trùng, rỗng, sai định dạng hoặc vượt 100 MB.` : "");
    setRows((previous) => [...previous, ...added]);
    void suggestRows(added);
  }

  function editField(id: string, field: keyof DocumentDraft, value: string) {
    setRows((previous) => previous.map((row) => row.id !== id ? row : {
      ...row,
      draft: { ...row.draft, [field]: value },
      edited: { ...row.edited, [field]: true },
    }));
  }

  function updateRow(id: string, changes: Partial<DraftRow>) {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...changes } : row));
  }

  async function saveBatch(targets = unsaved) {
    if (disabled || saveRequest.current || pending || !targets.length) return;
    if (targets.some((row) => !validDraft(row.draft))) {
      setNotice("Kiểm tra lại mã, tên và bộ môn của các dòng cần lưu.");
      return;
    }
    const request = new AbortController();
    saveRequest.current = request;
    setSaving(true);
    onSavingChange(true);
    setNotice("");
    let saved = 0;
    let failed = 0;
    try {
      for (const row of targets) {
        if (request.signal.aborted) break;
        updateRow(row.id, { phase: "saving", status: "Đang chuẩn bị lưu…" });
        try {
          let target = row.modelId;
          if (!target && row.file) {
            const { model } = await importIfc(row.file, request.signal, ({ label }) =>
              updateRow(row.id, { status: label }),
            );
            target = model.id;
            // Retain the imported model if saving the document fails or is stopped.
            updateRow(row.id, { modelId: target });
            onModelImported(model);
          }
          if (request.signal.aborted) {
            updateRow(row.id, { phase: "ready", status: "Đã dừng, chờ lưu lại" });
            break;
          }
          if (!target) throw new Error("Thiếu mô hình IFC.");
          const code = row.draft.code.trim().toUpperCase();
          updateRow(row.id, { status: "Đang ghi phiên bản WIP…" });
          const next = await call<DocumentVersion[]>("documents.register", {
            ...row.draft, code, title: row.draft.title.trim(), modelId: target,
          });
          const document = next.find((item) => item.code === code && item.modelId === target);
          if (!document) throw new Error("Chưa ghi được phiên bản. Hãy thử lưu lại.");
          if (document.state !== "WIP") {
            throw new Error("IFC này đã có phiên bản ngoài WIP với cùng mã hồ sơ.");
          }
          if (document.title !== row.draft.title.trim() || document.discipline !== row.draft.discipline) {
            throw new Error("IFC này đã có WIP với cùng mã nhưng thông tin khác. Hãy kiểm tra hồ sơ hiện có.");
          }
          onDocumentSaved(next, document.id);
          saved++;
          updateRow(row.id, { phase: "saved", status: `Đã lưu WIP · R${String(document.revision).padStart(2, "0")}` });
        } catch (error) {
          if (request.signal.aborted) {
            updateRow(row.id, { phase: "ready", status: "Đã dừng, chờ lưu lại" });
            break;
          }
          failed++;
          updateRow(row.id, { phase: "error", status: error instanceof Error ? error.message : String(error) });
        }
      }
      setNotice([
        `Đã lưu ${saved}/${targets.length} phiên bản WIP.`,
        failed ? `${failed} dòng lỗi có thể lưu lại.` : "",
        request.signal.aborted ? "Đã dừng các dòng còn lại." : "",
      ].filter(Boolean).join(" "));
    } finally {
      saveRequest.current = null;
      setSaving(false);
      setStopping(false);
      onSavingChange(false);
    }
  }

  return (
    <section className="cde-card cde-registration" aria-labelledby="registration-heading">
      <h2 id="registration-heading">Đăng ký phiên bản IFC</h2>
      <form onSubmit={(event) => { event.preventDefault(); void saveBatch(); }}>
        <fieldset disabled={disabled || saving}>
          <div className="cde-registration-sources">
            <label>
              Chọn file IFC
              <input type="file" accept=".ifc" multiple disabled={pending} onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }} />
            </label>
            <label>
              Hoặc thêm IFC đã nhập
              <select value="" disabled={pending} onChange={(event) => {
                const model = models.find((item) => item.id === event.target.value);
                if (!model) return;
                const row = makeRow(model.name, { modelId: model.id });
                setRows((previous) => [...previous, row]);
                void suggestRows([row]);
              }}>
                <option value="">Chọn mô hình</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}
                    disabled={unsaved.some((row) => row.modelId === model.id)}>
                    {model.name} · {model.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!!rows.length && <>
            <div className="cde-table cde-registration-table">
              <table aria-label="Rà soát hồ sơ IFC trước khi lưu">
                <thead><tr>
                  <th scope="col">File IFC</th>
                  <th scope="col">Mã hồ sơ</th>
                  <th scope="col">Tên hồ sơ</th>
                  <th scope="col">Bộ môn</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} data-phase={row.phase}>
                      <th scope="row" className="cde-registration-file">{row.name}</th>
                      <td><input aria-label={`Mã hồ sơ của ${row.name}`} required
                        pattern="[A-Za-z0-9_\-]+" maxLength={64} value={row.draft.code}
                        disabled={row.phase === "saved"}
                        onChange={(event) => editField(row.id, "code", event.target.value)} /></td>
                      <td><input aria-label={`Tên hồ sơ của ${row.name}`} required
                        maxLength={200} value={row.draft.title} disabled={row.phase === "saved"}
                        onChange={(event) => editField(row.id, "title", event.target.value)} /></td>
                      <td><select aria-label={`Bộ môn của ${row.name}`} required
                        value={row.draft.discipline} disabled={row.phase === "saved"}
                        onChange={(event) => editField(row.id, "discipline", event.target.value)}>
                        <option value="">Chọn bộ môn</option>
                        <option value="ARC">ARC</option>
                        <option value="STR">STR</option>
                        <option value="MEP">MEP</option>
                        <option value="OTHER">Khác</option>
                      </select></td>
                      <td className="cde-registration-status" aria-live="polite">
                        {row.status || suggestionLabels[row.suggestion]}
                      </td>
                      <td className="cde-registration-row-actions">{row.phase === "error" && <button type="button" className="cde-doc-link"
                        disabled={pending} onClick={() => { void saveBatch([row]); }}>
                        Lưu lại
                      </button>}
                      <button type="button" className="cde-doc-link"
                        aria-label={`Bỏ ${row.name} khỏi bảng rà soát`}
                        onClick={() => setRows((previous) => previous.filter((item) => item.id !== row.id))}>
                        Bỏ dòng
                      </button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cde-registration-actions">
              <button type="submit" className="button primary" disabled={pending || !unsaved.length}>
                Lưu WIP hàng loạt ({unsaved.length})
              </button>
              {pending ? <small role="status">Đang gợi ý cho các file. Bạn có thể chỉnh thông tin trong lúc chờ.</small>
                : !!unsaved.length && <small>Kiểm tra mã, tên và bộ môn của từng file trước khi lưu.</small>}
            </div>
          </>}
        </fieldset>
      </form>
      {saving && <button type="button" className="button secondary cde-stop-batch"
        disabled={stopping} onClick={() => {
          saveRequest.current?.abort();
          setStopping(true);
        }}>{stopping ? "Đang dừng…" : "Dừng lưu hàng loạt"}</button>}
      {notice && <p className="cde-message" role="status">{notice}</p>}
    </section>
  );
}
