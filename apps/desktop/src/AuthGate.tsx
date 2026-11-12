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
import LoginScreen from "./LoginScreen";
import PasswordForm from "./PasswordForm";
import { passwordRecoveryUrl } from "./PasswordRecovery";
import ProjectGate from "./ProjectGate";
import ProjectDirectory, { localProject } from "./ProjectDirectory";
import { hasProjectRoute } from "./projectRoute";
export { useCdeUser } from "./AuthContext";
export default function AuthGate({
  children,
}: {
  children: (controls: WorkspaceControls) => ReactNode;
}) {
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("invite") || "",
  );
  const [joining, setJoining] = useState(Boolean(inviteToken));
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [required, setRequired] = useState(!localDesktop);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const cloudAccount = cloudEnabled && !localDesktop;
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
      setShowUsers(false);
      setShowPasswordForm(false);
      setRequired(true);
      setError("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
    };
    window.addEventListener("ciccde-expired", expired);
    return () => window.removeEventListener("ciccde-expired", expired);
  }, []);
  async function signIn(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    setNotice("");
    const data = new FormData(form);
    try {
      const result = await authRequest(joining ? "join" : "login", {
        ...(joining ? { token: inviteToken } : {}),
        username: data.get("username"),
        password: data.get("password"),
      });
      if (joining) {
        history.replaceState(null, "", location.pathname + location.search);
        setInviteToken("");
        setJoining(false);
      }
      if (result.accountCreated) {
        setNotice("Đã tạo tài khoản và cấp quyền dự án. Hãy đăng nhập để tiếp tục.");
        return;
      }
      setSessionToken(result.token);
      setUser(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      form.reset();
      setNotice("Đã tạo tài khoản.");
      setUsers(await call<User[]>("users.list"));
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
      <LoginScreen
        busy={busy}
        joining={joining}
        hasInvite={Boolean(inviteToken)}
        error={error}
        notice={notice}
        connection={connection}
        onSubmit={(form) => { void signIn(form); }}
        onRequestReset={cloudAccount ? async (email) => {
          const { requestPasswordReset } = await import("./cloud");
          await requestPasswordReset(email, passwordRecoveryUrl());
        } : undefined}
        onToggleJoin={() => {
          setError("");
          setJoining((value) => !value);
        }}
      />
    );
  function closeAccountMenu(button: HTMLButtonElement) {
    const menu = button.closest<HTMLDetailsElement>(".account-menu");
    if (menu) {
      menu.querySelector("summary")?.focus();
      menu.open = false;
    }
  }

  const accountActions = (
    <>
      {connection}
      {user && cloudAccount && (
        <button
          className="button secondary"
          aria-haspopup="dialog"
          onClick={(event) => {
            closeAccountMenu(event.currentTarget);
            setShowPasswordForm(true);
          }}
        >
          Đổi mật khẩu
        </button>
      )}
      {user?.siteAdmin && (
        <button
          className="button secondary"
          aria-haspopup="dialog"
          onClick={(event) => {
            closeAccountMenu(event.currentTarget);
            setError("");
            setNotice("");
            setShowUsers(true);
            void call<User[]>("users.list")
              .then(setUsers)
              .catch((e) => setError(String(e)));
          }}
        >
          Tài khoản hệ thống
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
    </>
  );

  const settings = (
    <>
      <div className="project-page-heading">
        <div>
          <h1>Cài đặt</h1>
          <p>Quản lý tài khoản và kết nối CIC CDE.</p>
        </div>
      </div>
      <section className="project-surface directory-settings">
        <h2>Tài khoản và kết nối</h2>
        {user ? (
          <p><strong>{user.username}</strong>{user.organization && <> · {user.organization}</>}</p>
        ) : (
          <p>Bạn đang dùng CIC CDE ở chế độ cục bộ.</p>
        )}
        {(user || connection) && <div className="directory-settings-actions">{accountActions}</div>}
      </section>
    </>
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
        {accountActions}
      </div>
    </details>
  );
  return (
    <div className="workspace-frame">
      {user && showPasswordForm && (
        <AccessDialog
          title="Đổi mật khẩu"
          className="password-dialog"
          onClose={() => setShowPasswordForm(false)}
        >
          <PasswordForm change onSave={async (password, currentPassword) => {
            const { changePassword } = await import("./cloud");
            await changePassword(password, currentPassword);
          }} />
        </AccessDialog>
      )}
      {error && !showUsers && (
        <p role="alert" className="cde-message">
          {error}
        </p>
      )}
      {user?.siteAdmin && showUsers && (
        <AccessDialog
          title="Tài khoản hệ thống"
          className="member-panel"
          closeDisabled={busy}
          onClose={() => setShowUsers(false)}
        >
          {error && (
            <p role="alert" className="cde-message">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
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
                {cloudAccount ? "Email hoặc tên đăng nhập" : "Tên đăng nhập"}
                <input name="username" autoComplete="off" required minLength={3} maxLength={80} />
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
                Quyền hệ thống
                <select name="role">
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị hệ thống</option>
                </select>
              </label>
              <button className="button primary">Tạo tài khoản</button>
            </fieldset>
          </form>
        </AccessDialog>
      )}
      {user ? (
        <ProjectGate user={user} account={account} settings={settings}>
          {children}
        </ProjectGate>
      ) : (
        <UserContext.Provider value={null}>
          {hasProjectRoute ? children({ account }) : (
            <ProjectDirectory account={account} settings={settings} projects={[localProject]} />
          )}
        </UserContext.Provider>
      )}
    </div>
  );
}
