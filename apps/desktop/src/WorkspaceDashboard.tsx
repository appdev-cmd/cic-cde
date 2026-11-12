import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Box, FileText, FolderOpen, Layers3 } from "lucide-react";
import { projectRoles, type Project } from "./ProjectDirectory";
import { directoryHrefs, projectHref } from "./projectRoute";
import "./dashboard.css";

const accessRoles = [
  { id: "admin", color: "#3973ed" },
  { id: "reviewer", color: "#9472ed" },
  { id: "member", color: "#35a790" },
  { id: "viewer", color: "#acbfd8" },
  { id: "local", color: "#6688af" },
] as const;

export default function WorkspaceDashboard({ projects, loading, error }: {
  projects: Project[];
  loading?: boolean;
  error?: string;
}) {
  const [lastProjectId] = useState(() => localStorage.getItem("ciccde.project"));
  const lastProject = projects.find(({ id }) => id === lastProjectId);
  const focusProject = lastProject ?? (projects.length === 1 ? projects[0] : undefined);
  const displayedProjects = (lastProject
    ? [lastProject, ...projects.filter(({ id }) => id !== lastProject.id)]
    : projects).slice(0, 4);

  const shortcuts = [
    ...(focusProject ? [
      { label: "Hồ sơ dự án", description: focusProject.name, href: projectHref(focusProject.id, "files"), icon: FileText },
      { label: "Phối hợp mô hình", description: focusProject.name, href: projectHref(focusProject.id, "models"), icon: Box },
    ] : [
      { label: "Danh sách dự án", description: "Tìm và mở dự án", href: directoryHrefs.projects, icon: FolderOpen },
    ]),
    { label: "Tri thức BIM", description: "Tra cứu tiêu chuẩn và thuật ngữ", href: directoryHrefs.knowledge, icon: BookOpen },
  ];

  return (
    <div className="dashboard-grid">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero-copy">
          <h1 id="dashboard-title">Tổng quan<br />không gian dự án</h1>
          {focusProject && (
            <p>{lastProject ? "Mở gần nhất" : "Dự án của bạn"} <span aria-hidden="true">·</span> <strong>{focusProject.name}</strong></p>
          )}
          <a className="dashboard-primary" href={focusProject ? projectHref(focusProject.id) : directoryHrefs.projects}>
            {lastProject ? "Mở lại dự án" : focusProject ? "Mở dự án" : "Xem các dự án"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <AccessSummary projects={projects} loading={loading} error={error} />

      <section className="dashboard-panel dashboard-projects" aria-labelledby="dashboard-projects-title">
        <div className="dashboard-panel-heading">
          <h2 id="dashboard-projects-title">Dự án của bạn</h2>
          <a className="dashboard-all" href={directoryHrefs.projects}>Tất cả <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
        {error && (
          <p className="dashboard-notice" role="alert">
            {projects.length ? "Chưa thể làm mới danh sách. Đang hiển thị dữ liệu đã tải." : "Không tải được danh sách dự án."}
          </p>
        )}
        {loading ? (
          <p className="dashboard-notice" role="status">Đang tải dự án…</p>
        ) : displayedProjects.length ? (
          <ul className="dashboard-list">
            {displayedProjects.map(({ id, name, role }) => (
              <li key={id}>
                <a href={projectHref(id)} className="dashboard-project-link">
                  <span className="dashboard-row-icon"><FolderOpen size={19} aria-hidden="true" /></span>
                  <span className="dashboard-row-copy">
                    <strong>{name}</strong>
                    <small>{projectRoles[role] ?? "Dự án cục bộ"}</small>
                  </span>
                  {id === lastProject?.id && <span className="dashboard-recent">Mở gần nhất</span>}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : !error && (
          <p className="dashboard-notice">Bạn chưa được cấp quyền vào dự án nào.</p>
        )}
      </section>

      <section className="dashboard-panel dashboard-shortcuts" aria-labelledby="dashboard-shortcuts-title">
        <div className="dashboard-panel-heading">
          <h2 id="dashboard-shortcuts-title">Lối tắt</h2>
        </div>
        <ul className="dashboard-list">
          {shortcuts.map(({ label, description, href, icon: Icon }) => (
            <li key={label}>
              <a className="dashboard-shortcut" href={href}>
                <span className="dashboard-row-icon"><Icon size={19} aria-hidden="true" /></span>
                <span className="dashboard-row-copy">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AccessSummary({ projects, loading, error }: {
  projects: Project[];
  loading?: boolean;
  error?: string;
}) {
  const counts = new Map<string, number>();
  for (const { role } of projects) {
    const id = accessRoles.some((entry) => entry.id === role) ? role : "local";
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const distribution = accessRoles
    .map((role) => ({ ...role, count: counts.get(role.id) ?? 0 }))
    .filter(({ count }) => count > 0);
  let offset = 0;
  const stops = distribution.map(({ color, count }) => {
    const start = offset;
    offset += count;
    return `${color} ${start / projects.length * 100}% ${offset / projects.length * 100}%`;
  });

  return (
    <section className="dashboard-panel dashboard-access" aria-labelledby="dashboard-access-title">
      <div className="dashboard-panel-heading">
        <h2 id="dashboard-access-title">Quyền truy cập</h2>
        <Layers3 size={20} aria-hidden="true" />
      </div>
      <div className="dashboard-access-body">
        <div className="dashboard-ring" style={stops.length ? { background: `conic-gradient(${stops.join(", ")})` } : undefined}>
          <div className="dashboard-ring-center">
            <strong>{loading || (error && !projects.length) ? "–" : projects.length}</strong>
            <span>Dự án</span>
          </div>
        </div>
        {distribution.length > 0 ? (
          <ul className="dashboard-legend" aria-label="Số dự án theo quyền truy cập">
            {distribution.map(({ id, color, count }) => (
              <li key={id}>
                <span className="dashboard-dot" style={{ backgroundColor: color }} aria-hidden="true" />
                <span>{projectRoles[id] ?? "Dự án cục bộ"}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-access-caption">
            {loading ? "Đang tải dữ liệu…" : error ? "Chưa có dữ liệu" : "Chưa có dự án"}
          </p>
        )}
      </div>
    </section>
  );
}
