const params = new URLSearchParams(location.search);
const legacyView = params.get("cde");
const moduleView = params.get("module");

export const directoryHrefs = {
  dashboard: "./",
  projects: "?module=projects",
  knowledge: "?module=knowledge",
  settings: "?module=settings",
} as const;

export const routeProjectId = params.get("project");
export const hasProjectRoute = params.has("project") ||
  legacyView === "1" || legacyView === "issues" || params.has("model");

export const directoryModule = (() => {
  if (hasProjectRoute) return "projects";
  if (moduleView === "projects" || moduleView === "knowledge" || moduleView === "settings") return moduleView;
  return legacyView === "knowledge" ? "knowledge" : "dashboard";
})();

export const projectTabs = [
  { id: "info", label: "Thông tin" },
  { id: "files", label: "Hồ sơ" },
  { id: "models", label: "Phối hợp mô hình" },
  { id: "members", label: "Thành viên" },
] as const;

type ProjectTab = (typeof projectTabs)[number]["id"];
export const openProjectIssues = legacyView === "issues";
export function readProjectTab(): ProjectTab {
  const query = new URLSearchParams(location.search);
  const view = query.get("cde");
  return projectTabs.find(({ id }) => id === query.get("tab"))?.id ??
    (view === "1" ? "files" : view === "issues" || query.has("model") ? "models" : "info");
}

export function projectHref(id: string, tab: ProjectTab = "info", model?: string) {
  const query = new URLSearchParams({ project: id, tab });
  if (model) query.set("model", model);
  return "?" + query.toString();
}
