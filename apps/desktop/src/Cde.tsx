import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useCdeUser } from "./AuthGate";
import { call, cloudEnabled, desktop, localDesktop, selectedProject } from "./bridge";
import DocumentRegistration from "./DocumentRegistration";
import DeleteFileDialog from "./DeleteFileDialog";
import { projectHref } from "./projectRoute";
import type { BimModel } from "./types";
import ProjectBepSettings, { type BepSettings } from "./ProjectBepSettings";
import { documentRevision, type DocumentVersion, type Stage } from "./documentVersion";
import { forgetIfc, rememberIfc } from "./recentIfc";

const CadDrawings = lazy(() => import("./CadDrawings"));
const ProjectFiles = lazy(() => import("./ProjectFiles"));
type FileView = "documents" | "cad" | "ifc";
type DocumentPage = { items: DocumentVersion[]; total: number; review: number; published: number; filteredTotal: number };

const stageLabels: Record<Stage, string> = {
  WIP: "Đang thực hiện (WIP)",
  Shared: "Đã chia sẻ",
  Review: "Chờ xem xét",
  Approved: "Đã phê duyệt",
  Published: "Đã phát hành",
  Archived: "Đã lưu trữ",
};
const actions: Record<Stage, [Stage, string][]> = {
  WIP: [["Shared", "Chia sẻ"]],
  Shared: [["Review", "Trình xem xét"]],
  Review: [
    ["Approved", "Phê duyệt"],
    ["WIP", "Trả lại để chỉnh sửa"],
  ],
  Approved: [["Published", "Phát hành"]],
  Published: [["Archived", "Lưu trữ"]],
  Archived: [],
};

export default function Cde({ onIfcRegisterChange }: { onIfcRegisterChange: () => void }) {
  const user = useCdeUser();
  const isAdmin = !user || user.role === "admin";
  const canReview = isAdmin || user?.role === "reviewer";
  const cloudFiles = cloudEnabled && !desktop && Boolean(user);
  const paged = cloudEnabled && !localDesktop;
  const canDelete = cloudEnabled && user?.role === "admin";
  const canUpload = Boolean(user && user.role !== "viewer");
  const [view, setView] = useState<FileView>(() =>
    !cloudFiles || new URLSearchParams(location.search).get("file") === "ifc" ? "ifc" : "documents",
  );
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
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<DocumentPage>();
  const [detail, setDetail] = useState<DocumentVersion>();
  const [detailRefresh, setDetailRefresh] = useState(0);
  const requestSequence = useRef(0);
  const [selectedId, setSelectedId] = useState<number | undefined>(() => {
    const id = Number(new URLSearchParams(location.search).get("version"));
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  });
  const [note, setNote] = useState("");
  const [bep, setBep] = useState<BepSettings | null>(null);
  const [suitability, setSuitability] = useState<Partial<Record<Stage, string>>>({});
  const visible = paged ? documents : documents.filter(
    (document) =>
      (!stage || document.state === stage) &&
      [document.code, document.title, document.discipline, documentRevision(document), document.suitabilityCode].join(" ")
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
  );
  const activeId = selectedId ?? visible[0]?.id;
  const selected = paged ? (detail?.id === activeId ? detail : undefined) : documents.find((document) => document.id === activeId);
  const selectedSuitability = selected?.state === "Archived"
    ? selected.suitabilityOptions?.Published?.find((option) => option.code === selected.suitabilityCode)
    : selected?.suitabilityOptions?.[selected.state]?.find((option) => option.code === selected.suitabilityCode);

  async function reload() {
    const sequence = ++requestSequence.current;
    setBusy(true);
    try {
      const [versions, imported, settings] = await Promise.all([
        paged ? call<DocumentPage>("documents.page", { offset, limit: 25, query, state: stage }) : call<DocumentVersion[]>("documents.list"),
        call<BimModel[]>("models.list"),
        cloudFiles && isAdmin ? call<BepSettings | null>("bep.get") : Promise.resolve(null),
      ]);
      if (sequence !== requestSequence.current) return;
      setBep(settings);
      if (Array.isArray(versions)) setDocuments(versions);
      else {
        setDocuments(versions.items); setPage(versions);
        if (offset > 0 && offset >= versions.filteredTotal) setOffset(Math.max(0, Math.floor((versions.filteredTotal - 1) / 25) * 25));
      }
      setModels(imported.filter((model) => !model.synthetic && model.hash));
      setReady(true);
      setDetailRefresh((revision) => revision + 1);
      setMessage("");
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setReady(false);
      setMessage(String(error));
    } finally {
      if (sequence === requestSequence.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (openedIfc) void reload();
    return () => { requestSequence.current++; };
  }, [openedIfc, offset, query, stage]);

  useEffect(() => {
    if (!paged || activeId === undefined) { setDetail(undefined); return; }
    let cancelled = false;
    setDetail(undefined);
    void call<DocumentVersion>("documents.get", { id: activeId }).then(
      (value) => { if (!cancelled) setDetail(value); },
      (error) => { if (!cancelled) setMessage(String(error)); },
    );
    return () => { cancelled = true; };
  }, [activeId, paged, detailRefresh]);

  function selectVersion(document?: DocumentVersion) {
    setSelectedId(document?.id);
    setNote("");
    setSuitability({});
    if (user && document) {
      rememberIfc(user.username, user.projectId ?? selectedProject, document.id, document.title || document.code);
    }
  }

  async function transition(document: DocumentVersion, state: Stage, suitabilityCode?: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await call<DocumentVersion[] | DocumentVersion>(paged ? "documents.transitionOne" : "documents.transition", {
          id: document.id,
          expectedState: document.state,
          state,
          suitabilityCode,
          note,
        });
      if (Array.isArray(result)) setDocuments(result);
      else { setDetail(result); await reload(); }
      onIfcRegisterChange();
      setNote("");
      setSuitability({});
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cde-page workspace-files">
      <main>
        <div className="cde-intro">
          <div>
            <h1>Hồ sơ dự án</h1>
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
              <strong>{page?.total ?? documents.length}</strong>
            </div>
            <div>
              <span>Chờ xem xét</span>
              <strong>
                {
                  page?.review ?? documents.filter((document) => document.state === "Review")
                    .length
                }
              </strong>
            </div>
            <div>
              <span>Đã phát hành</span>
              <strong>
                {
                  page?.published ?? documents.filter((document) => document.state === "Published")
                    .length
                }
              </strong>
            </div>
          </div>
          {cloudFiles && isAdmin && ready && <ProjectBepSettings settings={bep} onSave={setBep} />}
          {user?.role !== "viewer" && (
            <details className="workspace-registration">
              <summary>Đăng ký phiên bản IFC</summary>
              <DocumentRegistration
                documents={documents}
                models={models}
                disabled={busy || !ready}
                onSavingChange={setBusy}
                onModelImported={(model) => setModels((previous) =>
                  previous.some((item) => item.id === model.id) ? previous : [...previous, model],
                )}
                onDocumentSaved={(next, id) => {
                  if (paged) { setDetail(next.find((item) => item.id === id)); void reload(); }
                  else setDocuments(next);
                  setSelectedId(id);
                  onIfcRegisterChange();
                }}
              />
            </details>
          )}
          {message && <p className="cde-message" role="status">{message}</p>}
          <div className="workspace-register">
            <section className="cde-card cde-versions">
              <h2>Sổ đăng ký phiên bản IFC</h2>
              <form className="cde-filters" onSubmit={(event) => { event.preventDefault(); selectVersion(); setOffset(0); setQuery(filter.trim()); }}>
                <input
                  aria-label="Tìm phiên bản IFC"
                  placeholder="Tìm theo mã, tên, bộ môn hoặc phiên bản"
                  value={filter}
                  onChange={(event) => { setFilter(event.target.value); if (!paged) selectVersion(); }}
                />
                <select
                  aria-label="Lọc theo trạng thái quy trình"
                  value={stage}
                  onChange={(event) => { selectVersion(); setOffset(0); setStage(event.target.value); }}
                >
                  <option value="">Mọi trạng thái</option>
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {paged && <button className="button secondary" disabled={busy}>Tìm kiếm</button>}
              </form>
              {visible.length ? (
                <ul className="workspace-register-list" aria-label="Phiên bản IFC">
                  {visible.map((document) => (
                    <li key={document.id}>
                      <button type="button" className="workspace-version" aria-pressed={activeId === document.id}
                        onClick={() => selectVersion(document)}>
                        <span>
                          <strong>{document.title || document.code}</strong>
                          <small>{documentRevision(document)} · {document.code}</small>
                        </span>
                        <span className="cde-state" data-stage={document.state}>{stageLabels[document.state]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {ready
                    ? "Không có phiên bản phù hợp."
                    : "Đang tải sổ đăng ký…"}
                </p>
              )}
              {paged && page && <nav className="cde-filters" aria-label="Phân trang hồ sơ">
                <button type="button" className="button secondary" disabled={busy || offset === 0} onClick={() => { selectVersion(); setOffset(Math.max(0, offset - 25)); }}>Trang trước</button>
                <span>{page.filteredTotal ? `${offset + 1}–${Math.min(offset + 25, page.filteredTotal)}` : "0"} / {page.filteredTotal} phiên bản</span>
                <button type="button" className="button secondary" disabled={busy || offset + 25 >= page.filteredTotal} onClick={() => { selectVersion(); setOffset(offset + 25); }}>Trang sau</button>
              </nav>}
            </section>
            <aside className="cde-card cde-detail workspace-inspector" aria-label="Chi tiết hồ sơ">
              {selected ? (
                <>
                  <div className="cde-intro">
                    <div>
                      <h2>
                        {selected.title || selected.code}
                      </h2>
                      <p>{selected.code}{selected.discipline && " · " + selected.discipline}</p>
                      {selected.bepReference && <small>{selected.bepReference} · Cấu hình lần {selected.bepVersion}</small>}
                    </div>
                    <a
                      className="button secondary"
                      href={projectHref(user?.projectId ?? selectedProject, "models", selected.modelId)}
                    >
                      Mở phiên bản trong khung nhìn 3D
                    </a>
                  </div>
                  <dl className="workspace-version-facts">
                    <div><dt>Phiên bản</dt><dd>{documentRevision(selected)}</dd></div>
                    <div><dt>Trạng thái</dt><dd>{stageLabels[selected.state]}</dd></div>
                    <div>
                      <dt>Mã sử dụng</dt>
                      <dd>{selected.suitabilityCode ?? "—"}{selectedSuitability && " · " + selectedSuitability.label}</dd>
                    </div>
                  </dl>
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
                        .map(([next, label]) => {
                          const options = next === "Archived" || next === "WIP" ? [] : selected.suitabilityOptions?.[next] ?? [];
                          const code = suitability[next] ?? (options.length === 1 ? options[0].code : "");
                          return (
                            <div className="cde-transition" key={next}>
                              {!!options.length && (
                                <label>Mã sử dụng khi {label.toLocaleLowerCase()}
                                  <select disabled={busy} value={code}
                                    onChange={(event) => setSuitability({ ...suitability, [next]: event.target.value })}>
                                    {options.length > 1 && <option value="">Chọn mã trạng thái sử dụng</option>}
                                    {options.map(({ code, label }) => <option key={code} value={code}>{code} · {label}</option>)}
                                  </select>
                                </label>
                              )}
                              <button className="button secondary"
                                disabled={busy || (next === "WIP" && !note.trim()) || (options.length > 0 && !code)}
                                onClick={() => void transition(selected, next, code || undefined)}>
                                {label}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  {canDelete && selected.state === "WIP" && (
                    <button type="button" className="button cde-delete-link"
                      aria-label={"Xóa phiên bản " + selected.code + " " + documentRevision(selected)}
                      disabled={busy} onClick={() => setToDelete(selected)}>Xóa phiên bản</button>
                  )}
                  <details className="workspace-history">
                  <summary>Lịch sử chuyển trạng thái</summary>
                    <ul>
                      {selected.history.map((event, index) => (
                        <li key={index}>
                          <strong>{stageLabels[event.state]}</strong> ·{" "}
                          {event.revisionCode && <span>{event.revisionCode} · </span>}
                          {event.suitabilityCode && <span>{event.suitabilityCode} · </span>}
                          {event.createdAt} UTC{" "}
                          {event.note && <span> · {event.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p role="status">{activeId === undefined ? "Chọn một phiên bản để xem chi tiết." : message || !paged
                  ? "Không tìm thấy chi tiết phiên bản." : "Đang tải chi tiết phiên bản…"}</p>
              )}
            </aside>
          </div>
        </div>}
        {toDelete && (
          <DeleteFileDialog title="Xóa phiên bản IFC"
            name={toDelete.code + " · " + documentRevision(toDelete)}
            description="Phiên bản đang thực hiện (WIP) sẽ bị xóa khỏi sổ đăng ký. Bạn vẫn có thể xem mô hình IFC trong khung nhìn 3D và đăng ký lại."
            onClose={() => setToDelete(undefined)}
            onDelete={async () => {
              setBusy(true);
              try {
                const cloud = await import("./cloud");
                const remaining = await cloud.deleteDocumentDraft(toDelete.id);
                if (user) forgetIfc(user.username, user.projectId ?? selectedProject, toDelete.id);
                if (paged) { await reload(); setDetail(undefined); }
                else setDocuments(remaining);
                onIfcRegisterChange();
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
