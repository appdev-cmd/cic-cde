import { useState } from "react";
import { ArrowRight, ArrowUpRight, Box, FileText, FolderOpen } from "lucide-react";
import { projectRoles, type Project } from "./ProjectDirectory";
import { directoryHrefs, projectHref } from "./projectRoute";
import { readRecentIfc, recentIfcHref } from "./recentIfc";
import "./dashboard.css";

export default function WorkspaceDashboard({ projects, loading, error, username }: {
  projects: Project[];
  loading?: boolean;
  error?: string;
  username?: string;
}) {
  const [lastProjectId] = useState(() => localStorage.getItem("ciccde.project"));
  const [selectedId, setSelectedId] = useState<string>();
  const lastProject = projects.find(({ id }) => id === lastProjectId);
  const project = projects.find(({ id }) => id === selectedId) ?? lastProject ?? projects[0];
  const recent = username && project ? readRecentIfc(username, project.id) : undefined;
  const listedProjects = lastProject
    ? [lastProject, ...projects.filter(({ id }) => id !== lastProject.id)]
    : projects;

  return (
    <div className="dashboard-workspace">
      <h1>Dashboard</h1>
      {project && (
        <section className="dashboard-resume" aria-label="Tiếp tục công việc">
          <div>
            <p>{project.id === lastProject?.id ? "Dự án mở gần nhất" : "Dự án đang chọn"}</p>
            <h2><a href={projectHref(project.id)}>{project.name}</a></h2>
            <small>{projectRoles[project.role] ?? "Dự án cục bộ"}</small>
          </div>
          <div className="dashboard-resume-links">
            <a href={recent ? recentIfcHref(project.id, recent.id) : projectHref(project.id, "files")}>
              <FileText size={17} aria-hidden="true" />
              <span>{recent && <small>Phiên bản IFC xem gần nhất</small>}<strong>{recent?.title ?? "Hồ sơ dự án"}</strong></span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a className="dashboard-model-link" href={projectHref(project.id, "models")}>
              <Box size={15} aria-hidden="true" /> Phối hợp mô hình <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </section>
      )}
      <section className="dashboard-roster" aria-labelledby="dashboard-projects-title">
        <header>
          <h2 id="dashboard-projects-title">Dự án của bạn</h2>
          {listedProjects.length > 0 && <a href={directoryHrefs.projects}>{listedProjects.length} dự án <ArrowRight size={15} aria-hidden="true" /></a>}
        </header>
        {error && <p className="dashboard-notice" role="alert">{projects.length ? "Chưa thể làm mới danh sách dự án." : "Không tải được danh sách dự án."}</p>}
        {loading ? <p className="dashboard-notice" role="status">Đang tải dự án…</p> : listedProjects.length ? (
          <ul className="dashboard-roster-list">
            {listedProjects.slice(0, 5).map(({ id, name, role }) => (
              <li key={id}>
                <button type="button" className="dashboard-project-choice" aria-pressed={project?.id === id} onClick={() => setSelectedId(id)}>
                  <FolderOpen size={18} aria-hidden="true" />
                  <strong>{name}</strong>
                  <small>{projectRoles[role] ?? "Dự án cục bộ"}</small>
                </button>
                <a href={projectHref(id)} aria-label={`Mở dự án ${name}`}><ArrowUpRight size={17} aria-hidden="true" /></a>
              </li>
            ))}
          </ul>
        ) : !error && <p className="dashboard-notice">Bạn chưa được cấp quyền vào dự án nào.</p>}
      </section>
    </div>
  );
}
