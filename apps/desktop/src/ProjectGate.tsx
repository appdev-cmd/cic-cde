import { useEffect, useState, type ReactNode } from "react";
import { API, call, remoteDesktop, selectedProject } from "./bridge";
import { UserContext, type CdeUser } from "./AuthContext";
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
  children,
}: {
  user: CdeUser;
  children: ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<CdeUser | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [acceptToken, setAcceptToken] = useState(
    new URLSearchParams(location.hash.slice(1)).get("invite") || "",
  );
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
  return (
    <>
      <section className="project-bar" aria-label="Chọn dự án">
        <label>
          Dự án
          <select
            aria-label="Dự án đang làm việc"
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
        </label>
        {profile && (
          <span>
            {roles[profile.role]} · {user.organization}
          </span>
        )}
        {(user.siteAdmin || profile?.role === "admin") && (
          <button
            className="button secondary"
            onClick={() => {
              setOpened((value) => !value);
              if (profile?.role === "admin") void perform(loadMembers);
            }}
          >
            Quản lý dự án và đơn vị
          </button>
        )}
      </section>
      {error && (
        <p role="alert" className="cde-message">
          {error}
        </p>
      )}
      {(!profile || opened) && (
        <section className="cde-card project-panel">
          {!profile && <p>Chọn một dự án được cấp quyền để mở workspace.</p>}
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
                      remoteDesktop
                        ? new URL(API).origin
                        : location.origin,
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
                    Link dùng một lần, hết hạn sau 7 ngày. Người nhận có thể tạo
                    tài khoản hoặc đăng nhập để chấp nhận.
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
        </section>
      )}
      {acceptToken && (
        <section className="cde-card project-panel">
          <h2>Nhận lời mời tham gia dự án</h2>
          <label>
            Mã lời mời
            <input
              value={acceptToken}
              onChange={(event) => setAcceptToken(event.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await call("projects.accept", { token: acceptToken.trim() });
                setAcceptToken("");
                history.replaceState(
                  null,
                  "",
                  location.pathname + location.search,
                );
                await refresh();
              })
            }
          >
            Chấp nhận lời mời
          </button>
        </section>
      )}
      {!acceptToken && (
        <details className="project-panel">
          <summary>Tôi có mã lời mời</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAcceptToken(
                String(
                  new FormData(event.currentTarget).get("token") || "",
                ).trim(),
              );
            }}
          >
            <label>
              Mã lời mời
              <input name="token" required autoComplete="off" />
            </label>
            <button>Tiếp tục</button>
          </form>
        </details>
      )}
      {profile && (
        <UserContext.Provider value={profile}>{children}</UserContext.Provider>
      )}
    </>
  );
}
