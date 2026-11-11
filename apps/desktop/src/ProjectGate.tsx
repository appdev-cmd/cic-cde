import { useEffect, useState, type ReactNode } from "react";
import { MailPlus, Settings2 } from "lucide-react";
import { API, call, remoteDesktop, selectedProject } from "./bridge";
import {
  UserContext,
  type CdeUser,
  type WorkspaceControls,
} from "./AuthContext";
import AccessDialog from "./AccessDialog";
type Project = { id: string; name: string; role: string };
type Membership = {
  organization: string;
  role: string;
  active: boolean;
  revision: number;
};
const roles: Record<string, string> = {
  admin: "Quản trị dự án",
  reviewer: "Kiểm duyệt",
  member: "Phối hợp",
  viewer: "Chỉ xem",
};
export default function ProjectGate({
  user,
  account,
  children,
}: {
  user: CdeUser;
  account: ReactNode;
  children: (controls: WorkspaceControls) => ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<CdeUser | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("invite") || "",
  );
  const [inviteOpen, setInviteOpen] = useState(Boolean(inviteToken));
  function choose(id: string) {
    localStorage.setItem("ciccde.project", id);
    location.reload();
  }
  async function refresh() {
    const available = await call<Project[]>("projects.list");
    setProjects(available);
    const selected = available.find(
      (project) => project.id === selectedProject,
    );
    if (!selected) {
      setProfile(null);
      return;
    }
    setProfile(
      await call<CdeUser>("projects.current", { projectId: selected.id }),
    );
  }
  useEffect(() => {
    let active = true;
    void refresh().catch((e) => {
      if (active) setError(String(e));
    });
    const timer = setInterval(() => {
      void refresh().catch((e) => {
        if (active) setError(String(e));
      });
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function loadMembers() {
    setMembers(
      await call<Membership[]>("projects.members", {
        projectId: selectedProject,
      }),
    );
  }
  const activeProject = projects.find(
    (project) => project.id === selectedProject,
  );
  const project = (
    <div className="project-controls" role="group" aria-label="Dự án">
      <select
        aria-label="Dự án đang làm việc"
        title={
          activeProject &&
          `${activeProject.name} · ${roles[activeProject.role]}`
        }
        value={activeProject?.id || ""}
        disabled={busy}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="" disabled>
          Chọn dự án
        </option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} · {roles[project.role]}
          </option>
        ))}
      </select>
      {profile && (user.siteAdmin || profile.role === "admin") && (
        <button
          className="icon-button"
          aria-label="Quản lý dự án và đơn vị"
          title="Quản lý dự án và đơn vị"
          aria-haspopup="dialog"
          onClick={() => {
            setError("");
            setOpened(true);
            if (profile?.role === "admin") void perform(loadMembers);
          }}
        >
          <Settings2 size={16} />
        </button>
      )}
      <button
        className="icon-button"
        aria-label="Tôi có mã lời mời"
        title="Tôi có mã lời mời"
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setInviteOpen(true);
        }}
      >
        <MailPlus size={16} />
      </button>
    </div>
  );
  const errorMessage = error && (
    <p role="alert" className="cde-message">
      {error}
    </p>
  );
  const management = (!profile || opened) && (
    <>
      {user.siteAdmin && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const name = new FormData(form).get("name");
            void perform(async () => {
              const project = await call<Project>("projects.create", {
                name,
              });
              choose(project.id);
            });
          }}
        >
          <h2>Tạo dự án</h2>
          <label>
            Tên dự án
            <input name="name" required maxLength={160} />
          </label>
          <button className="button primary" disabled={busy}>
            Tạo dự án
          </button>
        </form>
      )}
      {profile?.role === "admin" && (
        <>
          <h2>Đơn vị trong {activeProject?.name}</h2>
          {members.map((member) => (
            <form
              key={member.organization + member.revision}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void perform(async () => {
                  await call("projects.members.update", {
                    projectId: selectedProject,
                    organization: member.organization,
                    role: data.get("role"),
                    active: data.get("active") === "on",
                    expectedRevision: member.revision,
                  });
                  await loadMembers();
                  await refresh();
                });
              }}
              className="membership-row"
            >
              <strong>{member.organization}</strong>
              <label>
                Vai trò
                <select name="role" defaultValue={member.role}>
                  {Object.entries(roles).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={member.active}
                />
                Đang tham gia
              </label>
              <button className="button secondary" disabled={busy}>
                Lưu quyền
              </button>
            </form>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void perform(async () => {
                const invite = await call<{ token: string }>(
                  "projects.invite",
                  {
                    projectId: selectedProject,
                    organization: data.get("organization"),
                    role: data.get("role"),
                  },
                );
                const url = new URL(
                  "/?cde=1",
                  remoteDesktop ? new URL(API).origin : location.origin,
                );
                url.hash = "invite=" + invite.token;
                setInviteLink(url.toString());
              });
            }}
          >
            <h3>Mời đơn vị</h3>
            <label>
              Tên đơn vị
              <input
                name="organization"
                required
                maxLength={120}
                placeholder="Đúng tên đơn vị của tài khoản nhận lời mời"
              />
            </label>
            <label>
              Vai trò
              <select name="role" defaultValue="member">
                {Object.entries(roles).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={busy}>
              Tạo link mời
            </button>
          </form>
          {inviteLink && (
            <div>
              <p>
                Link dùng một lần, hết hạn sau 7 ngày. Người nhận có thể tạo tài
                khoản hoặc đăng nhập để chấp nhận.
              </p>
              <label>
                Link mời
                <input
                  readOnly
                  value={inviteLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            </div>
          )}
        </>
      )}
    </>
  );
  return (
    <>
      {!opened && !inviteOpen && errorMessage}
      {profile ? (
        <UserContext.Provider value={profile}>
          {children({ project, account })}
        </UserContext.Provider>
      ) : (
        <>
          <header className="access-bar">
            {project}
            {account}
          </header>
          <section className="cde-card project-panel project-empty">
            <p>Chọn một dự án được cấp quyền để mở workspace.</p>
            {management}
          </section>
        </>
      )}
      {profile && opened && (
        <AccessDialog
          title="Quản lý dự án và đơn vị"
          className="project-panel"
          onClose={() => setOpened(false)}
        >
          {errorMessage}
          {management}
        </AccessDialog>
      )}
      {inviteOpen && (
        <AccessDialog
          title="Nhận lời mời tham gia dự án"
          className="project-panel"
          onClose={() => setInviteOpen(false)}
        >
          {errorMessage}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const token = String(
                new FormData(event.currentTarget).get("token") || "",
              ).trim();
              if (!token) {
                setError("Vui lòng nhập mã lời mời.");
                return;
              }
              void perform(async () => {
                await call("projects.accept", { token });
                history.replaceState(
                  null,
                  "",
                  location.pathname + location.search,
                );
                setInviteToken("");
                setInviteOpen(false);
                await refresh();
              });
            }}
          >
            <label>
              Mã lời mời
              <input
                name="token"
                defaultValue={inviteToken}
                required
                autoComplete="off"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Chấp nhận lời mời
            </button>
          </form>
        </AccessDialog>
      )}
    </>
  );
}
