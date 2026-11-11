import { useEffect, useRef, useState } from "react";
import { useCdeUser } from "./AuthGate";
import { call, cloudEnabled, importIfc, localDesktop } from "./bridge";
import { emptyDocumentDraft, readIfcDescription, suggestFromName } from "./documentMetadata";
import type { DocumentDraft, DisciplineCode } from "./documentMetadata";
import type { BimModel } from "./types";

type Stage =
  "WIP" | "Shared" | "Review" | "Approved" | "Published" | "Archived";
type DocumentVersion = {
  id: number;
  code: string;
  title: string;
  discipline: string;
  modelId: string;
  revision: number;
  state: Stage;
  history: { state: Stage; note: string; createdAt: string }[];
};
const stageLabels: Record<Stage, string> = {
  WIP: "Đang soạn",
  Shared: "Đã chia sẻ",
  Review: "Chờ duyệt",
  Approved: "Đã duyệt",
  Published: "Đã phát hành",
  Archived: "Lưu trữ",
};
const actions: Record<Stage, [Stage, string][]> = {
  WIP: [["Shared", "Chia sẻ"]],
  Shared: [["Review", "Nộp duyệt"]],
  Review: [
    ["Approved", "Duyệt"],
    ["WIP", "Trả lại"],
  ],
  Approved: [["Published", "Phát hành"]],
  Published: [["Archived", "Lưu trữ"]],
  Archived: [],
};

export default function Cde() {
  const user = useCdeUser();
  const isAdmin = !user || user.role === "admin";
  const canReview = isAdmin || user?.role === "reviewer";
  const [documents, setDocuments] = useState<DocumentVersion[]>([]);
  const [models, setModels] = useState<BimModel[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [stage, setStage] = useState("");
  const [selectedId, setSelectedId] = useState<number>();
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(emptyDocumentDraft);
  const { code, title, discipline } = draft;
  const edited = useRef(new Set<keyof DocumentDraft>());
  const suggestionRequest = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [suggestionStatus, setSuggestionStatus] = useState("");
  const [modelId, setModelId] = useState("");
  const [file, setFile] = useState<File>();
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadController, setUploadController] = useState<AbortController>();
  const selected = documents.find((document) => document.id === selectedId);
  const visible = documents.filter(
    (document) =>
      (!stage || document.state === stage) &&
      (document.code + " " + document.title + " " + document.discipline)
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
  );

  async function reload() {
    setBusy(true);
    try {
      const [versions, imported] = await Promise.all([
        call<DocumentVersion[]>("documents.list"),
        call<BimModel[]>("models.list"),
      ]);
      setDocuments(versions);
      setModels(imported.filter((model) => !model.synthetic && model.hash));
      setReady(true);
      setMessage("");
    } catch (error) {
      setReady(false);
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => suggestionRequest.current?.abort();
  }, []);

  function editField<K extends keyof DocumentDraft>(field: K, value: DocumentDraft[K]) {
    edited.current.add(field);
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function suggest(name: string, source?: File) {
    suggestionRequest.current?.abort();
    const request = new AbortController();
    suggestionRequest.current = request;

    function fill(values: Partial<DocumentDraft>) {
      if (request.signal.aborted) return;
      const fields = (Object.keys(values) as (keyof DocumentDraft)[])
        .filter((field) => !edited.current.has(field));
      setDraft((previous) => ({ ...previous, ...Object.fromEntries(fields.map((field) => [field, values[field]])) }));
    }

    setSuggestionStatus("");
    const initial = suggestFromName(name);
    const existing = documents.find((document) => document.code === initial.code);
    fill(existing
      ? { code: existing.code, title: existing.title, discipline: existing.discipline as DisciplineCode }
      : initial);
    if (existing) {
      setSuggestionStatus("Đã dùng thông tin của mã hồ sơ hiện có.");
      return;
    }
    if (!name || !cloudEnabled || localDesktop) return;

    setSuggestionStatus("Vertex AI đang gợi ý thông tin hồ sơ…");
    try {
      const metadata = source ? await readIfcDescription(source) : { project: "", description: "" };
      if (request.signal.aborted) return;
      const { suggestCloudDocument } = await import("./cloud");
      if (request.signal.aborted) return;
      const result = await suggestCloudDocument({
        ...metadata, fileName: name.slice(0, 240), discipline: initial.discipline,
      }, request.signal);
      if (request.signal.aborted) return;
      fill({ title: result.title || initial.title, discipline: initial.discipline || result.discipline });
      setSuggestionStatus("Đã phân tích bằng Vertex AI. Bạn có thể sửa trước khi lưu.");
    } catch {
      if (!request.signal.aborted) {
        setSuggestionStatus("Vertex AI chưa phản hồi. Bạn có thể dùng gợi ý từ tên file và bổ sung trường còn thiếu.");
      }
    }
  }

  async function register() {
    suggestionRequest.current?.abort();
    setSuggestionStatus("");
    setBusy(true);
    setMessage("");
    try {
      let target = modelId;
      if (file) {
        const controller = new AbortController();
        setUploadController(controller);
        const { model } = await importIfc(file, controller.signal, (progress) =>
          setUploadProgress(progress.label),
        );
        setUploadController(undefined);
        target = model.id;
        setModels((previous) =>
          previous.some((item) => item.id === model.id)
            ? previous
            : [...previous, model],
        );
      }
      const next = await call<DocumentVersion[]>("documents.register", {
        code,
        title,
        discipline,
        modelId: target,
      });
      setDocuments(next);
      setSelectedId(
        next.find(
          (document) =>
            document.code === code.trim().toUpperCase() &&
            document.modelId === target,
        )?.id,
      );
      setMessage("Đã ghi phiên bản vào sổ hồ sơ.");
      edited.current.clear();
      setDraft(emptyDocumentDraft);
      setFile(undefined);
      setModelId("");
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      setMessage(String(error));
    } finally {
      setUploadController(undefined);
      setUploadProgress("");
      setBusy(false);
    }
  }

  async function transition(document: DocumentVersion, state: Stage) {
    setBusy(true);
    setMessage("");
    try {
      setDocuments(
        await call<DocumentVersion[]>("documents.transition", {
          id: document.id,
          expectedState: document.state,
          state,
          note,
        }),
      );
      setNote("");
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cde-page">
      <header className="cde-header">
        <strong>
          CIC CDE <span>{user ? (cloudEnabled ? "CLOUD" : "PILOT CÔNG BÁO") : "CDE LOCAL"}</span>
        </strong>
        <nav aria-label="Điều hướng CDE">
          <a aria-current="page" href="?cde=1">
            Hồ sơ
          </a>
          <a href="?cde=issues">Issues</a>
          <a href="/">Phối hợp 3D</a>
        </nav>
      </header>
      <main>
        <div className="cde-intro">
          <div>
            <p>{(user?.projectName || "Riverside Tower").toUpperCase()}</p>
            <h1>Sổ hồ sơ phối hợp</h1>
            <span>Quản lý phiên bản IFC và theo dõi quá trình duyệt.</span>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void reload()}
          >
            Tải lại dữ liệu
          </button>
        </div>
        <div className="cde-summary">
          <div>
            <span>Phiên bản IFC</span>
            <strong>{documents.length}</strong>
          </div>
          <div>
            <span>Chờ duyệt</span>
            <strong>
              {
                documents.filter((document) => document.state === "Review")
                  .length
              }
            </strong>
          </div>
          <div>
            <span>Đã phát hành</span>
            <strong>
              {
                documents.filter((document) => document.state === "Published")
                  .length
              }
            </strong>
          </div>
        </div>
        <div className="cde-columns">
          <section className="cde-card">
            <h2>Danh sách phiên bản</h2>
            <div className="cde-filters">
              <input
                aria-label="Tìm hồ sơ"
                placeholder="Tìm theo mã, tên hoặc bộ môn"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <select
                aria-label="Lọc trạng thái"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                <option value="">Mọi trạng thái</option>
                {Object.entries(stageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {visible.length ? (
              <div className="cde-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mã hồ sơ</th>
                      <th>Tên hồ sơ</th>
                      <th>Phiên bản</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((document) => (
                      <tr key={document.id}>
                        <td>
                          <button
                            className="cde-doc-link"
                            aria-pressed={selectedId === document.id}
                            onClick={() => {
                              setSelectedId(document.id);
                              setNote("");
                            }}
                          >
                            {document.code}
                          </button>
                        </td>
                        <td>
                          {document.title} <small>{document.discipline}</small>
                        </td>
                        <td>R{String(document.revision).padStart(2, "0")}</td>
                        <td>
                          <span
                            className="cde-state"
                            data-stage={document.state}
                          >
                            {stageLabels[document.state]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {ready
                  ? "Không có phiên bản phù hợp."
                  : "Đang tải hồ sơ…"}
              </p>
            )}
          </section>
          <section className="cde-card">
            <h2>Đăng ký phiên bản</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void register();
              }}
            >
              <fieldset disabled={busy || !ready || user?.role === "viewer"}>
                <label>
                  Tải IFC mới
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".ifc"
                    onChange={(event) => {
                      const next = event.target.files?.[0];
                      setFile(next);
                      setModelId("");
                      void suggest(next?.name ?? "", next);
                    }}
                  />
                </label>
                <label>
                  Hoặc chọn IFC đã nhập
                  <select
                    disabled={!!file}
                    required={!file}
                    value={modelId}
                    onChange={(event) => {
                      const model = models.find((item) => item.id === event.target.value);
                      setModelId(event.target.value);
                      void suggest(model?.name ?? "");
                    }}
                  >
                    <option value="">Chọn mô hình</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} · {model.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                {suggestionStatus && <small role="status">{suggestionStatus}</small>}
                <label>
                  Mã hồ sơ
                  <input
                    required
                    pattern="[A-Za-z0-9_\-]+"
                    maxLength={64}
                    placeholder="VD: RIV-MEP-MODEL"
                    value={code}
                    onChange={(event) => editField("code", event.target.value)}
                  />
                </label>
                <label>
                  Tên hồ sơ
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(event) => editField("title", event.target.value)}
                  />
                </label>
                <label>
                  Bộ môn
                  <select
                    required
                    value={discipline}
                    onChange={(event) => editField("discipline", event.target.value as DisciplineCode)}
                  >
                    <option value="">Chọn bộ môn</option>
                    <option>MEP</option>
                    <option>STR</option>
                    <option>ARC</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                <button className="button primary" disabled={!file && !modelId}>
                  Lưu phiên bản WIP
                </button>
              </fieldset>
            </form>
            {uploadController && (
              <button
                className="button secondary"
                disabled={uploadController.signal.aborted}
                onClick={() => {
                  uploadController.abort();
                  setUploadProgress("Đang yêu cầu hủy…");
                }}
              >
                Hủy tải IFC
              </button>
            )}
            {uploadProgress && <p role="status">{uploadProgress}</p>}
          </section>
        </div>
        {message && (
          <p className="cde-message" role="status">
            {message}
          </p>
        )}
        {selected && (
          <section className="cde-card cde-detail">
            <div className="cde-intro">
              <div>
                <h2>
                  {selected.code} · R
                  {String(selected.revision).padStart(2, "0")}
                </h2>
                <p>
                  {selected.title} · {stageLabels[selected.state]}
                </p>
              </div>
              <a
                className="button secondary"
                href={"?model=" + encodeURIComponent(selected.modelId)}
              >
                Mở phiên bản trong Viewer
              </a>
            </div>
            {!!actions[selected.state].length && (
              <div className="cde-actions">
                <label>
                  Ghi chú xử lý
                  <input
                    maxLength={500}
                    placeholder="Bắt buộc khi trả lại"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                {actions[selected.state]
                  .filter(
                    ([next]) =>
                      isAdmin ||
                      (canReview && ["Approved", "WIP"].includes(next)) ||
                      (user?.role !== "viewer" &&
                        ["Shared", "Review"].includes(next)),
                  )
                  .map(([next, label]) => (
                    <button
                      key={next}
                      className="button secondary"
                      disabled={busy || (next === "WIP" && !note.trim())}
                      onClick={() => void transition(selected, next)}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            )}
            <h3>Lịch sử phiên bản</h3>
            <ul>
              {selected.history.map((event, index) => (
                <li key={index}>
                  <strong>{stageLabels[event.state]}</strong> ·{" "}
                  {event.createdAt} UTC{" "}
                  {event.note && <span> · {event.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
