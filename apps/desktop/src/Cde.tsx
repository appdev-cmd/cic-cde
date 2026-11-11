import { lazy, Suspense, useEffect, useState } from "react";
import { useCdeUser } from "./AuthGate";
import { call, cloudEnabled, desktop } from "./bridge";
import DocumentRegistration from "./DocumentRegistration";
import DeleteFileDialog from "./DeleteFileDialog";
import type { BimModel } from "./types";

const CadDrawings = lazy(() => import("./CadDrawings"));
const ProjectFiles = lazy(() => import("./ProjectFiles"));
type FileView = "documents" | "cad" | "ifc";

type Stage =
  "WIP" | "Shared" | "Review" | "Approved" | "Published" | "Archived";
export type DocumentVersion = {
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
  const cloudFiles = cloudEnabled && !desktop && Boolean(user);
  const canDelete = cloudEnabled && user?.role === "admin";
  const canUpload = Boolean(user && user.role !== "viewer");
  const [view, setView] = useState<FileView>(cloudFiles ? "documents" : "ifc");
  const [openedViews, setOpenedViews] = useState<FileView[]>([view]);
  const openedIfc = openedViews.includes("ifc");
  const [toDelete, setToDelete] = useState<DocumentVersion>();
  const [documents, setDocuments] = useState<DocumentVersion[]>([]);
  const [models, setModels] = useState<BimModel[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [stage, setStage] = useState("");
  const [selectedId, setSelectedId] = useState<number>();
  const [note, setNote] = useState("");
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
    if (openedIfc) void reload();
  }, [openedIfc]);

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
            <h1>Hồ sơ dự án</h1>
            <span>{cloudEnabled && !desktop ? "Quản lý bản vẽ CAD, phiên bản IFC và theo dõi quá trình duyệt." : "Quản lý phiên bản IFC và theo dõi quá trình duyệt."}</span>
          </div>
          {view === "ifc" && (
            <button className="button secondary" disabled={busy} onClick={() => void reload()}>
              Tải lại dữ liệu
            </button>
          )}
        </div>
        {cloudFiles && (
          <nav className="cde-file-views" aria-label="Loại hồ sơ">
            {([["documents", "Tài liệu"], ["cad", "Bản vẽ CAD"], ["ifc", "Mô hình IFC"]] as const)
              .map(([key, label]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => {
                  setView(key);
                  setOpenedViews((previous) => previous.includes(key) ? previous : [...previous, key]);
                }}>{label}</button>
              ))}
          </nav>
        )}
        {cloudFiles && openedViews.includes("documents") && (
          <div hidden={view !== "documents"}>
            <Suspense fallback={<p role="status">Đang mở tài liệu…</p>}>
              <ProjectFiles canUpload={canUpload} canDelete={canDelete} />
            </Suspense>
          </div>
        )}
        {cloudFiles && openedViews.includes("cad") && (
          <div hidden={view !== "cad"}>
            <Suspense fallback={<p role="status">Đang mở bản vẽ CAD…</p>}>
              <CadDrawings canUpload={canUpload} canDelete={canDelete} />
            </Suspense>
          </div>
        )}
        {openedIfc && <div hidden={view !== "ifc"}>
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
          {user?.role !== "viewer" && (
            <DocumentRegistration
              documents={documents}
              models={models}
              disabled={busy || !ready}
              onSavingChange={setBusy}
              onModelImported={(model) => setModels((previous) =>
                previous.some((item) => item.id === model.id) ? previous : [...previous, model],
              )}
              onDocumentSaved={(next, id) => {
                setDocuments(next);
                setSelectedId(id);
              }}
            />
          )}
          <section className="cde-card cde-versions">
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
                      {canDelete && <th>Thao tác</th>}
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
                        {canDelete && (
                          <td>
                            {document.state === "WIP" && (
                              <button type="button" className="button cde-delete-link"
                                aria-label={`Xóa phiên bản ${document.code} R${document.revision}`}
                                disabled={busy} onClick={() => setToDelete(document)}>Xóa</button>
                            )}
                          </td>
                        )}
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
        </div>}
        {toDelete && (
          <DeleteFileDialog title="Xóa phiên bản IFC"
            name={`${toDelete.code} · R${String(toDelete.revision).padStart(2, "0")}`}
            description="Phiên bản đang soạn sẽ bị xóa khỏi sổ hồ sơ. Mô hình IFC vẫn có thể dùng trong Viewer và đăng ký lại."
            onClose={() => setToDelete(undefined)}
            onDelete={async () => {
              setBusy(true);
              try {
                const cloud = await import("./cloud");
                setDocuments(await cloud.deleteDocumentDraft(toDelete.id));
                if (selectedId === toDelete.id) {
                  setSelectedId(undefined);
                  setNote("");
                }
                setMessage(`Đã xóa phiên bản của ${toDelete.code}.`);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
