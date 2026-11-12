import { useState, type ReactNode } from "react";
import { ArrowRight, Box, Eye, EyeOff, Files, Layers3, LockKeyhole, UserRound } from "lucide-react";
import Brand, { BrandMark } from "./Brand";
import "./login.css";

type LoginScreenProps = {
  busy: boolean;
  joining: boolean;
  hasInvite: boolean;
  error: string;
  notice: string;
  connection?: ReactNode;
  onSubmit(form: HTMLFormElement): void;
  onToggleJoin(): void;
  onRequestReset?(email: string): Promise<void>;
};

export function LoginLayout({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Không gian phối hợp BIM">
        <div className="login-showcase-content">
          <div className="login-brand">
            <Brand />
          </div>
          <div className="login-intro">
            <h1>Không gian phối hợp <span>BIM &amp; CDE</span></h1>
            <p>Quản lý hồ sơ, xem mô hình IFC và phối hợp giữa các đơn vị trên cùng một dự án.</p>
            <ul className="login-capabilities">
              <li><Box size={17} aria-hidden="true" /> Mô hình IFC</li>
              <li><Layers3 size={17} aria-hidden="true" /> Phối hợp mô hình</li>
              <li><Files size={17} aria-hidden="true" /> Hồ sơ dự án</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="login-access" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-heading">
            <BrandMark />
            <h2 id="login-title">{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

export default function LoginScreen({
  busy, joining, hasInvite, error, notice, connection, onSubmit, onToggleJoin, onRequestReset,
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetError, setResetError] = useState("");

  if (forgot && onRequestReset) {
    return (
      <LoginLayout title="Quên mật khẩu" description="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.">
        {sent ? (
          <p className="login-notice" role="status">
            Nếu email đã đăng ký và có thể nhận thư, bạn sẽ nhận được liên kết đặt lại mật khẩu.
            Hãy kiểm tra cả thư rác.
          </p>
        ) : (
          <form onSubmit={async (event) => {
            event.preventDefault();
            const email = String(new FormData(event.currentTarget).get("email")).trim();
            setSending(true);
            setResetError("");
            try {
              await onRequestReset(email);
              setSent(true);
            } catch (cause) {
              setResetError(cause instanceof Error ? cause.message : "Chưa thể gửi yêu cầu. Vui lòng thử lại.");
            } finally {
              setSending(false);
            }
          }}>
            <fieldset disabled={sending}>
              <label htmlFor="reset-email">Email tài khoản</label>
              <div className="login-field">
                <UserRound size={18} aria-hidden="true" />
                <input id="reset-email" name="email" type="email" autoComplete="email"
                  defaultValue={username.includes("@") ? username.trim() : ""} required maxLength={80} />
              </div>
              {resetError && <p className="login-error" role="alert">{resetError}</p>}
              <button type="submit" className="login-submit">
                {sending ? "Đang gửi yêu cầu…" : "Gửi liên kết đặt lại"}
              </button>
            </fieldset>
          </form>
        )}
        <p className="login-help">Nếu tài khoản chưa có email nhận thư, hãy liên hệ quản trị viên CIC CDE.</p>
        <button type="button" className="login-invite" disabled={sending} onClick={() => {
          setSent(false);
          setForgot(false);
          setResetError("");
        }}>Quay lại đăng nhập</button>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout
      title={joining ? "Tham gia dự án" : "Đăng nhập"}
      description={joining ? "Nếu đơn vị đã có tài khoản CIC CDE, hãy đăng nhập để nhận lời mời." : "Truy cập không gian dự án CIC CDE của bạn."}
    >
          <form onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
            <fieldset disabled={busy}>
              <label htmlFor="login-username">{joining ? "Tên đăng nhập" : "Email hoặc tên đăng nhập"}</label>
              <div className="login-field">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  placeholder={joining ? "Nhập tên đăng nhập" : "Nhập email hoặc tên đăng nhập"}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="login-field">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  type={showPassword ? "text" : "password"}
                  autoComplete={joining ? "new-password" : "current-password"}
                  minLength={joining ? 12 : undefined}
                  required
                  maxLength={128}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {error && <p className="login-error" role="alert">{error}</p>}
              {notice && <p className="login-notice" role="status">{notice}</p>}
              <button className="login-submit" type="submit">
                {busy ? (joining ? "Đang tạo tài khoản…" : "Đang đăng nhập…")
                  : joining ? "Tạo tài khoản và tham gia" : "Đăng nhập"}
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </fieldset>
          </form>
          {!joining && onRequestReset && (
            <button type="button" className="login-invite" disabled={busy} onClick={() => {
              setShowPassword(false);
              setForgot(true);
            }}>Quên mật khẩu?</button>
          )}
          {hasInvite && (
            <button type="button" className="login-invite" disabled={busy} onClick={onToggleJoin}>
              {joining ? "Đăng nhập bằng tài khoản có sẵn" : "Tạo tài khoản theo lời mời"}
            </button>
          )}
          {connection && <div className="login-connection">{connection}</div>}
    </LoginLayout>
  );
}
