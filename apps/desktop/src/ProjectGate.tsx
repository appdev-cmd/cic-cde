import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { call, selectedProject } from "./bridge";
import { UserContext, type CdeUser, type WorkspaceControls } from "./AuthContext";
import AccessDialog from "./AccessDialog";
import DeleteFileDialog from "./DeleteFileDialog";
import ProjectDirectory, { type Project } from "./ProjectDirectory";
import ProjectMembers from "./ProjectMembers";
import { directoryModule, hasProjectRoute, projectHref } from "./projectRoute";

export default function ProjectGate({
  user, account, settings, children,
}: {
  user: CdeUser;
  account: ReactNode;
  settings: ReactNode;
  children: (controls: WorkspaceControls) => ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>();
  const [toDelete, setToDelete] = useState<Project>();
  const [message, setMessage] = useState("");
  const refreshId = useRef(0);
  const [profile, setProfile] = useState<CdeUser | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("invite") || "",
  );
  const [dialog, setDialog] = useState<"create" | "invite" | null>(inviteToken ? "invite" : null);

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current;
    const available = await call<Project[]>("projects.list");
    const active = hasProjectRoute && available.find(({ id }) => id === selectedProject);
    const current = active
      ? await call<CdeUser>("projects.current", { projectId: active.id })
      : null;
    if (requestId !== refreshId.current) return current;
    if (current && active) localStorage.setItem("ciccde.project", active.id);
    setProjects(available);
    setProfile(current);
    setLoadError("");
    return current;
  }, []);

  useEffect(() => {
    if (directoryModule === "knowledge" || directoryModule === "settings") return;
    let active = true;
    const load = () => void refresh().catch((error) => {
      if (active) setLoadError(String(error));
    });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(String(error));
    } finally {
      setBusy(false);
    }
  }

  function showDialog(name: "create" | "invite") {
    setActionError("");
    setDialog(name);
  }

  return (
    <>
      {hasProjectRoute && !projects && !loadError && !dialog ? (
        <p role="status">Đang mở dự án…</p>
      ) : profile ? (
        <UserContext.Provider value={profile}>
          {children({
            account,
            members: <ProjectMembers profile={profile} onChange={refresh} />,
          })}
        </UserContext.Provider>
      ) : (
        <ProjectDirectory
          username={user.username}
          projects={projects ?? []}
          loading={!projects && !loadError}
          error={loadError || (hasProjectRoute && projects ? "Dự án không khả dụng với tài khoản này." : "")}
          account={account}
          settings={settings}
          onCreate={user.siteAdmin ? () => showDialog("create") : undefined}
          onInvite={() => showDialog("invite")}
          onDelete={setToDelete}
          message={message}
        />
      )}
      {toDelete && (
        <DeleteFileDialog title="Xóa dự án" name={toDelete.name}
          description="Dự án sẽ bị gỡ khỏi danh sách và các thành viên sẽ mất quyền truy cập. Dữ liệu được giữ để có thể khôi phục."
          onClose={() => setToDelete(undefined)}
          onDelete={async () => {
            await call("projects.delete", { projectId: toDelete.id });
            ++refreshId.current;
            setProjects((current) => current?.filter(({ id }) => id !== toDelete.id));
            if (localStorage.getItem("ciccde.project") === toDelete.id) localStorage.removeItem("ciccde.project");
            setMessage(`Đã xóa dự án ${toDelete.name}.`);
          }} />
      )}
      {dialog && (
        <AccessDialog
          title={dialog === "create" ? "Tạo dự án" : "Nhận lời mời tham gia dự án"}
          className="project-panel"
          closeDisabled={busy}
          onClose={() => setDialog(null)}
        >
          {actionError && <p role="alert" className="cde-message">{actionError}</p>}
          {dialog === "create" ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
              void perform(async () => {
                if (!name) throw new Error("Nhập tên dự án.");
                const project = await call<Project>("projects.create", { name });
                location.assign(projectHref(project.id));
              });
            }}>
              <label>Tên dự án<input name="name" required maxLength={160} /></label>
              <button className="button project-primary" disabled={busy}>Tạo dự án</button>
            </form>
          ) : (
            <form onSubmit={(event) => {
              event.preventDefault();
              const token = String(new FormData(event.currentTarget).get("token") ?? "").trim();
              void perform(async () => {
                if (!token) throw new Error("Nhập mã lời mời.");
                await call("projects.accept", { token });
                history.replaceState(null, "", location.pathname + location.search);
                setInviteToken("");
                setDialog(null);
                await refresh();
              });
            }}>
              <p>Bạn đang nhận lời mời cho đơn vị <strong>{user.organization}</strong>.</p>
              <label>Mã lời mời<input name="token" defaultValue={inviteToken} required autoComplete="off" disabled={busy} /></label>
              <button className="button project-primary" disabled={busy}>Chấp nhận lời mời</button>
            </form>
          )}
        </AccessDialog>
      )}
    </>
  );
}
