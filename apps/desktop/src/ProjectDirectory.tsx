import { lazy, Suspense, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, FolderOpen, LayoutDashboard, MailPlus, Plus, Search, Settings, Trash2, X } from "lucide-react";
import Brand from "./Brand";
import ProjectArtwork from "./ProjectArtwork";
import WorkspaceLayout from "./WorkspaceLayout";
import { directoryHrefs, directoryModule, projectHref } from "./projectRoute";

const BimLibrary = lazy(() => import("./BimLibrary"));
const WorkspaceDashboard = lazy(() => import("./WorkspaceDashboard"));
const modules = [
  { id: "dashboard", label: "Dashboard", href: directoryHrefs.dashboard, icon: LayoutDashboard },
  { id: "projects", label: "Dự án", href: directoryHrefs.projects, icon: FolderOpen },
  { id: "knowledge", label: "Tri thức BIM", href: directoryHrefs.knowledge, icon: BookOpen },
  { id: "settings", label: "Cài đặt", href: directoryHrefs.settings, icon: Settings, pinToBottom: true },
] as const;

export type Project = { id: string; name: string; role: string };
export const projectRoles: Record<string, string> = {
  admin: "Quản trị dự án",
  reviewer: "Kiểm duyệt",
  member: "Phối hợp",
  viewer: "Chỉ xem",
};
export const localProject: Project = { id: "demo-project", name: "Riverside Tower", role: "local" };
export const projectCover = "/cde-login-hero.jpg";

type ProjectListProps = {
  projects: Project[];
  loading?: boolean;
  error?: string;
  message?: string;
  onCreate?: () => void;
  onInvite?: () => void;
  onDelete?: (project: Project) => void;
};

export default function ProjectDirectory({
  account, settings, username, ...list
}: ProjectListProps & { account: ReactNode; settings: ReactNode; username?: string }) {
  return (
    <div className="project-page directory-page">
      <header className="project-header">
        <div className="project-header-inner">
          <div className="directory-brand">
            <a className="brand" href={directoryHrefs.dashboard} aria-label="Trang chính CIC CDE"><Brand /></a>
            <span>Môi trường dữ liệu chung</span>
          </div>
          <div className="project-header-actions">
            {list.onInvite && (
              <button className="icon-button" type="button" title="Nhận lời mời"
                aria-label="Nhận lời mời" aria-haspopup="dialog" onClick={list.onInvite}>
                <MailPlus size={18} />
              </button>
            )}
            {account}
          </div>
        </div>
      </header>
      <WorkspaceLayout label="Phân hệ CIC CDE" links={modules} current={directoryModule}>
        <main className={`project-content directory-content${directoryModule === "dashboard" ? " dashboard-content" : ""}`}>
          {directoryModule === "dashboard" ? (
            <Suspense fallback={<p role="status">Đang mở Dashboard…</p>}>
              <WorkspaceDashboard projects={list.projects} loading={list.loading} error={list.error} username={username} />
            </Suspense>
          ) : directoryModule === "knowledge" ? (
            <Suspense fallback={<p role="status">Đang mở Tri thức BIM…</p>}>
              <BimLibrary />
            </Suspense>
          ) : directoryModule === "settings" ? settings : (
            <ProjectList {...list} />
          )}
        </main>
      </WorkspaceLayout>
    </div>
  );
}

function ProjectList({ projects, loading, error, message, onCreate, onInvite, onDelete }: ProjectListProps) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const listTitle = useId();
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const visible = projects.map((project, index) => ({ ...project, index })).filter(({ name }) => {
    const text = normalizeSearch(name);
    return terms.every((term) => text.includes(term));
  });

  return (
    <>
      <div className="directory-hero">
        <div className="directory-hero-copy">
          <p className="directory-hero-eyebrow">Không gian làm việc</p>
          <h1>Dự án</h1>
          <p className="directory-hero-description">Truy cập hồ sơ, mô hình và không gian phối hợp của từng dự án.</p>
          {onCreate && (
            <button className="directory-create" type="button" aria-haspopup="dialog" onClick={onCreate}>
              <Plus size={17} aria-hidden="true" /> Tạo dự án
            </button>
          )}
        </div>
      </div>
      <section className="directory-projects" aria-labelledby={listTitle}>
        <div className="directory-toolbar">
          <div className="directory-list-heading">
            <h2 id={listTitle}>Danh sách dự án</h2>
            {!loading && (!error || projects.length > 0) && (
              <span className="directory-count" role="status" aria-label={`${visible.length} dự án`}>
                {visible.length}
              </span>
            )}
          </div>
          {projects.length > 0 && (
            <div className="directory-search" role="search">
              <Search size={18} aria-hidden="true" />
              <input ref={searchInput} type="search" aria-label="Tìm dự án" placeholder="Tìm theo tên dự án…" value={query}
                onChange={(event) => setQuery(event.target.value)} />
              {query && (
                <button type="button" aria-label="Xóa từ khóa" onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
        {error && <p className="cde-message" role="alert">{error}</p>}
        {message && <p className="cde-message" role="status">{message}</p>}
        {loading ? (
          <p className="project-empty-state" role="status">Đang tải dự án…</p>
        ) : visible.length > 0 ? (
          <ul className="project-grid" aria-labelledby={listTitle}>
            {visible.map(({ id, name, role, index }) => (
              <li key={id} className="project-grid-item">
                <a className="project-tile" href={projectHref(id)}>
                  <ProjectArtwork index={index} />
                  <div className="project-tile-body">
                    <h3>{name}</h3>
                    <div className="project-tile-meta">
                      <span className="project-role">{projectRoles[role] ?? "Dự án cục bộ"}</span>
                      <span className="project-tile-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span>
                    </div>
                  </div>
                </a>
                {onDelete && role === "admin" && (
                  <button className="icon-button project-tile-delete" type="button"
                    aria-label={`Xóa dự án ${name}`} title="Xóa dự án" aria-haspopup="dialog"
                    onClick={() => onDelete({ id, name, role })}>
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : projects.length > 0 ? (
          <div className="project-empty-state">
            <Search size={25} aria-hidden="true" />
            <p>Không tìm thấy dự án phù hợp.</p>
          </div>
        ) : !error && (
          <div className="project-empty-state">
            <FolderOpen size={25} aria-hidden="true" />
            <p>Bạn chưa được cấp quyền vào dự án nào.</p>
            {onInvite && <button className="button secondary" type="button" onClick={onInvite}>Nhập mã lời mời</button>}
          </div>
        )}
      </section>
    </>
  );
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}
