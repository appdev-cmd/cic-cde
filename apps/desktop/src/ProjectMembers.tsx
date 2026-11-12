import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { MailPlus, UserPlus } from "lucide-react";
import AccessDialog from "./AccessDialog";
import type { CdeUser } from "./AuthContext";
import { API, call, cloudEnabled, remoteDesktop, selectedProject } from "./bridge";
import { projectRoles } from "./ProjectDirectory";
import { projectHref } from "./projectRoute";
import { iso19650Roles, type Iso19650Role } from "./iso19650";

type Membership = {
  organization: string;
  role: string;
  active: boolean;
  revision: number;
  isoRole?: Iso19650Role | null;
};
type Invitation = Pick<Membership, "organization" | "role" | "isoRole"> & {
  id: string;
  expires: number;
};
const formatExpiry = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
});

const roles = Object.entries(projectRoles);
const isoRoles = Object.entries(iso19650Roles);

function IsoRoleField({ value, disabled }: { value?: Iso19650Role | null; disabled: boolean }) {
  return (
    <label>Vai trò ISO 19650
      <select name="isoRole" defaultValue={value ?? ""} disabled={disabled}>
        <option value="">Chưa xác định</option>
        {isoRoles.map(([role, label]) => <option key={role} value={role}>{label}</option>)}
      </select>
    </label>
  );
}

function PermissionField({ value = "member", disabled = false }: { value?: string; disabled?: boolean }) {
  return (
    <label>Quyền trên CIC CDE
      <select name="role" defaultValue={value} disabled={disabled}>
        {roles.map(([role, label]) => <option key={role} value={role}>{label}</option>)}
      </select>
    </label>
  );
}

export default function ProjectMembers({
  profile, onChange,
}: {
  profile: CdeUser;
  onChange: () => Promise<CdeUser | null>;
}) {
  const [members, setMembers] = useState<Membership[]>();
  const [invitations, setInvitations] = useState<Invitation[]>();
  const [inviteLink, setInviteLink] = useState<{ id: string; url: string }>();
  const [showAccount, setShowAccount] = useState(false);
  const [accountUnit, setAccountUnit] = useState("");
  const unitsId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManage = profile.role === "admin";
  const isoReady = profile.isoRole !== undefined || members?.some(({ isoRole }) => isoRole !== undefined);
  // The production API may precede the optional project-account migration.
  const accountApiReady = !cloudEnabled || profile.isoRole !== undefined;
  const accountMembership = members?.find((member) => member.organization === accountUnit.trim());

  const loadMembers = useCallback(async () => {
    setMembers(await call<Membership[]>("projects.members", { projectId: selectedProject }));
  }, []);
  const loadInvitations = useCallback(async () => {
    if (cloudEnabled && profile.isoRole === undefined) return;
    const pending = await call<Invitation[]>("projects.invitations", { projectId: selectedProject });
    setInvitations(pending);
    setInviteLink((link) => pending.some(({ id }) => id === link?.id) ? link : undefined);
  }, [profile.isoRole]);

  useEffect(() => {
    if (canManage) void Promise.all([loadMembers(), loadInvitations()]).catch((failure) => setError(String(failure)));
  }, [canManage, loadMembers, loadInvitations]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      await call("projects.accounts.create", {
        projectId: selectedProject,
        organization: data.get("organization"),
        username: data.get("username"),
        password: data.get("password"),
        role: data.get("role"),
        ...(isoReady ? { isoRole: data.get("isoRole") || null } : {}),
      });
      setShowAccount(false);
      setMessage(`Đã tạo tài khoản ${data.get("username")} cho ${accountUnit.trim()}.`);
      await Promise.all([loadMembers(), loadInvitations()]);
    });
  }

  function save(event: FormEvent<HTMLFormElement>, member: Membership) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      try {
        await call("projects.members.update", {
          projectId: selectedProject,
          organization: member.organization,
          role: data.get("role"),
          active: data.has("active"),
          expectedRevision: member.revision,
          ...(isoReady ? { isoRole: data.get("isoRole") || null } : {}),
        });
      } catch (failure) {
        await loadMembers().catch(() => undefined);
        throw failure;
      }
      setMessage("Đã lưu quyền của " + member.organization + ".");
      const current = await onChange();
      if (current?.role === "admin") await Promise.all([loadMembers(), loadInvitations()]);
    });
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      const { id, token } = await call<{ id: string; token: string }>("projects.invite", {
        projectId: selectedProject,
        organization: data.get("organization"),
        role: data.get("role"),
        ...(isoReady ? { isoRole: data.get("isoRole") || null } : {}),
      });
      const base = remoteDesktop ? new URL("/", API) : location.href;
      const url = new URL(projectHref(selectedProject), base);
      url.hash = new URLSearchParams({ invite: token }).toString();
      setInviteLink({ id, url: url.toString() });
      await loadInvitations();
    });
  }

  function revoke(invitation: Invitation) {
    void perform(async () => {
      await call("projects.invitations.revoke", { projectId: selectedProject, invitationId: invitation.id });
      if (inviteLink?.id === invitation.id) setInviteLink(undefined);
      setMessage(`Đã thu hồi lời mời của ${invitation.organization}.`);
      await loadInvitations();
    });
  }

  if (!canManage) {
    return (
      <section className="project-surface">
        <h2>Quyền của bạn</h2>
        <p>{profile.organization} · {projectRoles[profile.role] ?? profile.role}</p>
        {profile.isoRole && <p>{iso19650Roles[profile.isoRole]}</p>}
        <p>Quản trị dự án phụ trách phân quyền và mời đơn vị.</p>
      </section>
    );
  }

  return (
    <>
      {error && !showAccount && <p role="alert" className="cde-message">{error}</p>}
      {message && <p role="status">{message}</p>}
      {members && !isoReady && <p className="cde-message">Cần cập nhật cơ sở dữ liệu để lưu vai trò ISO 19650.</p>}
      <div className="project-members">
        <section className="project-surface project-panel" aria-labelledby="project-organizations">
          <div className="project-members-heading">
            <h2 id="project-organizations">Đơn vị tham gia</h2>
            {profile.siteAdmin && accountApiReady && <button type="button" className="button project-primary" disabled={busy || !members}
              onClick={() => { setError(""); setMessage(""); setAccountUnit(""); setShowAccount(true); }}>
              <UserPlus size={16} /> Tạo tài khoản
            </button>}
          </div>
          <p>Quyền dự án áp dụng cho mọi tài khoản thuộc đơn vị. Vai trò ISO 19650 ghi theo hồ sơ giao nhiệm vụ.</p>
          <details><summary>Hướng dẫn phân quyền</summary>
            <p>Quản trị dự án quản lý đơn vị, BEP và phát hành hồ sơ. Người xem xét được duyệt hoặc trả lại hồ sơ; người phối hợp tạo và trình hồ sơ thuộc đơn vị; người xem chỉ đọc dữ liệu được chia sẻ.</p>
            <p>Vai trò ISO 19650 không tự cấp quyền thao tác. Bỏ chọn “Đang tham gia” thu hồi quyền của cả đơn vị trong dự án; phải giữ ít nhất một đơn vị quản trị. Chỉ quản trị hệ thống tạo tài khoản mới.</p>
          </details>
          {members ? members.map((member) => (
            <form className="membership-row" key={member.organization + member.revision} onSubmit={(event) => save(event, member)}>
              <strong>{member.organization}</strong>
              <IsoRoleField value={member.isoRole} disabled={busy || !isoReady} />
              <PermissionField value={member.role} disabled={busy} />
              <label className="project-member-active">
                <input name="active" type="checkbox" defaultChecked={member.active} disabled={busy} /> Đang tham gia
              </label>
              <button className="button secondary" disabled={busy}>Lưu quyền</button>
            </form>
          )) : !error && <p role="status">Đang tải thành viên…</p>}
          {members?.length === 0 && <p>Chưa có đơn vị tham gia.</p>}
        </section>
        <section className="project-surface project-panel" aria-labelledby="project-invite">
          <h2 id="project-invite">Mời đơn vị</h2>
          <form className="project-invite-form" onSubmit={invite}>
            <label>Tên đơn vị<input name="organization" required maxLength={120} disabled={busy} placeholder="Tên đơn vị của tài khoản nhận lời mời" /></label>
            <IsoRoleField disabled={busy || !isoReady} />
            <PermissionField disabled={busy} />
            <button className="button project-primary" disabled={busy}><MailPlus size={16} /> Tạo liên kết mời</button>
          </form>
          {inviteLink && (
            <label className="project-invite-link">
              Liên kết dùng một lần, hết hạn sau 7 ngày
              <input readOnly value={inviteLink.url} onFocus={(event) => event.currentTarget.select()} />
            </label>
          )}
          {invitations && invitations.length > 0 && (
            <div className="project-pending-invites">
              <h3>Lời mời đang chờ</h3>
              <ul>
                {invitations.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.organization}</strong>
                      <p>{projectRoles[entry.role]} · Hết hạn {formatExpiry.format(entry.expires * 1000)}</p>
                      {entry.isoRole && <p>{iso19650Roles[entry.isoRole]}</p>}
                    </div>
                    <button type="button" className="button secondary" disabled={busy}
                      aria-label={`Thu hồi lời mời của ${entry.organization}`} onClick={() => revoke(entry)}>Thu hồi</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      {showAccount && (
        <AccessDialog title="Tạo tài khoản cho đơn vị" className="project-panel" closeDisabled={busy}
          onClose={() => { setShowAccount(false); setError(""); }}>
          {error && <p role="alert" className="cde-message">{error}</p>}
          <form onSubmit={createAccount}>
            <fieldset className="project-account-form" disabled={busy}>
              <label>Đơn vị
                <input name="organization" required maxLength={120} list={unitsId} value={accountUnit}
                  onChange={(event) => setAccountUnit(event.target.value)} />
                <datalist id={unitsId}>
                  {members?.map(({ organization }) => <option key={organization} value={organization} />)}
                </datalist>
              </label>
              <label>{cloudEnabled ? "Email hoặc tên đăng nhập" : "Tên đăng nhập"}
                <input name="username" required minLength={3} maxLength={80} autoComplete="off" />
              </label>
              <label>Mật khẩu ban đầu
                <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
              </label>
              {accountMembership ? (
                <p>{accountMembership.active
                  ? `Quyền hiện tại của đơn vị · ${projectRoles[accountMembership.role]}`
                  : "Đơn vị đang tạm ngừng tham gia. Hãy kích hoạt lại đơn vị trong danh sách trước khi tạo tài khoản."}</p>
              ) : (
                <>
                  <PermissionField />
                  <IsoRoleField disabled={!isoReady} />
                </>
              )}
              <button className="button project-primary" disabled={!accountUnit.trim() || accountMembership?.active === false}>
                {busy ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
            </fieldset>
          </form>
        </AccessDialog>
      )}
    </>
  );
}
