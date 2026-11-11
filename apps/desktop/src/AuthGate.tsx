import { useEffect, useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import {
  authRequest,
  call,
  cloudEnabled,
  desktop,
  localDesktop,
  remoteDesktop,
  setSessionToken,
} from "./bridge";

import {
  UserContext,
  type CdeUser as User,
  type WorkspaceControls,
} from "./AuthContext";
import AccessDialog from "./AccessDialog";
import ProjectGate from "./ProjectGate";
export { useCdeUser } from "./AuthContext";
export default function AuthGate({
  children,
}: {
  children: (controls: WorkspaceControls) => ReactNode;
}) {
  const inviteToken =
    new URLSearchParams(window.location.hash.slice(1)).get("invite") || "";
  const [joining, setJoining] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [required, setRequired] = useState(!localDesktop);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  useEffect(() => {
    let active = true;
    if (localDesktop) {
      setChecking(false);
      return;
    }
    authRequest("me")
      .then((value) => {
        if (active) {
          setUser(value.user);
          setRequired(value.required);
        }
      })
      .catch(() => {
        if (active) setRequired(true);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const expired = () => {
      setSessionToken("");
      setUser(null);
      setRequired(true);
      setError("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
    };
    window.addEventListener("ciccde-expired", expired);
    return () => window.removeEventListener("ciccde-expired", expired);
  }, []);
  async function signIn(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    const data = new FormData(form);
    try {
      const result = await authRequest(joining ? "join" : "login", {
        ...(joining ? { token: inviteToken } : {}),
        username: data.get("username"),
        password: data.get("password"),
      });
      if (joining)
        history.replaceState(null, "", location.pathname + location.search);
      setSessionToken(result.token);
      setUser(result.user);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await authRequest("logout", {});
      setSessionToken("");
      location.reload();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }
  async function createUser(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    const data = new FormData(form);
    try {
      await call("users.create", {
        username: data.get("username"),
        password: data.get("password"),
        organization: data.get("organization"),
        role: data.get("role"),
      });
      setUsers(await call<User[]>("users.list"));
      form.reset();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const connection = desktop && (
    <button
      className="button secondary"
      onClick={() => {
        localStorage.setItem(
          "ciccde.remote",
          remoteDesktop ? "local" : "pilot",
        );
        location.reload();
      }}
    >
      {remoteDesktop
        ? "Chuyển về desktop offline"
        : cloudEnabled
          ? "Kết nối CIC CDE Cloud"
          : "Kết nối pilot Công Báo"}
    </button>
  );
  if (checking) return <p role="status">Đang kiểm tra phiên CIC CDE…</p>;
  if (required && !user)
    return (
      <main className="login-page">
        <section className="cde-card">
          <h1>CIC CDE</h1>
          <p>Đăng nhập không gian phối hợp BIM</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signIn(event.currentTarget);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Tên đăng nhập
                <input
                  name="username"
                  autoComplete="username"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Mật khẩu
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <button className="button primary">
                {joining ? "Tạo tài khoản và tham gia" : "Đăng nhập"}
              </button>
            </fieldset>
          </form>
          {inviteToken && (
            <button onClick={() => setJoining((value) => !value)}>
              {joining
                ? "Đăng nhập bằng tài khoản có sẵn"
                : "Tạo tài khoản theo lời mời"}
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          {connection}
        </section>
      </main>
    );
  const account = (user || connection) && (
    <details
      className="account-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        className="icon-button"
        title="Tài khoản và kết nối"
        aria-label="Tài khoản và kết nối"
      >
        <UserRound size={17} />
      </summary>
      <div className="account-menu-content">
        <strong>{user?.username || "Desktop local"}</strong>
        {user && <span>{user.organization}</span>}
        {connection}
        {user?.role === "admin" && (
          <button
            className="button secondary"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.currentTarget
                .closest("details")
                ?.querySelector("summary")
                ?.focus();
              setError("");
              setShowUsers(true);
              void call<User[]>("users.list")
                .then(setUsers)
                .catch((e) => setError(String(e)));
            }}
          >
            Thành viên
          </button>
        )}
        {user && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Đăng xuất
          </button>
        )}
      </div>
    </details>
  );
  return (
    <div className="workspace-frame">
      {error && !showUsers && (
        <p role="alert" className="cde-message">
          {error}
        </p>
      )}
      {showUsers && (
        <AccessDialog
          title="Tài khoản hệ thống"
          className="member-panel"
          onClose={() => setShowUsers(false)}
        >
          {error && (
            <p role="alert" className="cde-message">
              {error}
            </p>
          )}
          <ul>
            {users.map((entry) => (
              <li key={entry.username}>
                {entry.username} · {entry.organization} ·{" "}
                {entry.role === "admin" ? "Quản trị" : "Thành viên"}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createUser(event.currentTarget);
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Tên đăng nhập
                <input name="username" required minLength={3} maxLength={80} />
              </label>
              <label>
                Đơn vị
                <input name="organization" required maxLength={120} />
              </label>
              <label>
                Mật khẩu ban đầu
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Vai trò
                <select name="role">
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị</option>
                </select>
              </label>
              <button className="button primary">Tạo tài khoản</button>
            </fieldset>
          </form>
        </AccessDialog>
      )}
      {user ? (
        <ProjectGate user={user} account={account}>
          {children}
        </ProjectGate>
      ) : (
        <UserContext.Provider value={null}>
          {children({ account })}
        </UserContext.Provider>
      )}
    </div>
  );
}
