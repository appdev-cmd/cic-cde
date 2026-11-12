import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Box, ChevronRight, FolderOpen, Info, UsersRound } from "lucide-react";
import { useCdeUser } from "./AuthContext";
import Brand from "./Brand";
import { localProject } from "./ProjectDirectory";
import ProjectOverview from "./ProjectOverview";
import WorkspaceLayout from "./WorkspaceLayout";
import { cloudEnabled, localDesktop } from "./bridge";
const CloudJobs = lazy(() => import("./CloudJobs"));
import { directoryHrefs, projectHref, projectTabs, readProjectTab } from "./projectRoute";

const App = lazy(() => import("./App"));
const Cde = lazy(() => import("./Cde"));
const tabIcons = { info: Info, files: FolderOpen, models: Box, members: UsersRound };

export default function ProjectWorkspace({ account, members }: { account: ReactNode; members?: ReactNode }) {
  const user = useCdeUser();
  const id = user?.projectId ?? localProject.id;
  const name = user?.projectName ?? localProject.name;
  const [activeTab, setActiveTab] = useState(readProjectTab);
  const [openedModels, setOpenedModels] = useState(activeTab === "models");
  const [initialModelId] = useState(() => new URLSearchParams(location.search).get("model"));
  const [ifcRegisterRevision, setIfcRegisterRevision] = useState(0);
  const [showJobs, setShowJobs] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  function syncTab() {
    const tab = readProjectTab();
    setActiveTab(tab);
    if (tab === "models") setOpenedModels(true);
  }

  useEffect(() => {
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);

  useEffect(() => { body.current?.scrollTo(0, 0); }, [activeTab]);

  function selectTab(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (event.currentTarget.getAttribute("aria-current") === "page") return;
    const href = event.currentTarget.href;
    if (href !== location.href) {
      history.pushState(null, "", href);
      syncTab();
    }
  }

  const tabs = projectTabs.map((tab) => ({
    ...tab,
    icon: tabIcons[tab.id],
    href: projectHref(id, tab.id, tab.id === "models" ? initialModelId ?? undefined : undefined),
    mobileLabel: tab.id === "models" ? "Mô hình" : undefined,
  }));

  return (
    <div className="project-page directory-page project-workspace-page">
      <header className="project-header">
        <div className="project-header-inner">
          <div className="project-navigation">
            <a className="brand" href={directoryHrefs.dashboard} aria-label="Trang chính CIC CDE"><Brand /></a>
            <nav className="project-breadcrumb" aria-label="Đường dẫn dự án">
              <a href={directoryHrefs.projects}>Dự án</a>
              <ChevronRight size={13} aria-hidden="true" />
              <span title={name}>{name}</span>
            </nav>
          </div>
          <div className="project-header-actions">
            {cloudEnabled && !localDesktop && <button className="button secondary" onClick={() => setShowJobs(true)}>Tác vụ cloud</button>}
            {account}
          </div>
        </div>
      </header>
      {showJobs && <Suspense fallback={<p role="status">Đang mở tác vụ…</p>}><CloudJobs onClose={() => setShowJobs(false)} /></Suspense>}
      <WorkspaceLayout label="Điều hướng dự án" links={tabs} current={activeTab} onSelect={selectTab}>
        <div className="project-workspace-body" ref={body}>
          {openedModels && (
            <div className="project-models" hidden={activeTab !== "models"}>
              <Suspense fallback={<p className="project-content" role="status">Đang mở mô hình…</p>}>
                <App active={activeTab === "models"} initialModelId={initialModelId}
                  ifcRegisterRevision={ifcRegisterRevision}
                  onOpenIfcRegister={() => {
                    history.pushState(null, "", projectHref(id, "files") + "&file=ifc");
                    syncTab();
                  }} />
              </Suspense>
            </div>
          )}
          {activeTab === "files" && (
            <Suspense fallback={<p role="status">Đang mở hồ sơ…</p>}>
              <Cde onIfcRegisterChange={() => setIfcRegisterRevision((revision) => revision + 1)} />
            </Suspense>
          )}
          {activeTab === "members" && (
            <main className="project-content">
              <div className="project-page-heading"><h1>Thành viên</h1></div>
              {members ?? <p>Quản lý thành viên khả dụng với dự án đã kết nối.</p>}
            </main>
          )}
          {activeTab === "info" && <ProjectOverview id={id} name={name} />}
        </div>
      </WorkspaceLayout>
    </div>
  );
}
