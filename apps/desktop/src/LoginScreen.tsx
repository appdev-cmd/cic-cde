import { useState, type ReactNode } from "react";
import { ArrowRight, Box, Cuboid, Eye, EyeOff, Files, Layers3, LockKeyhole, UserRound } from "lucide-react";
import "./login.css";

type LoginScreenProps = {
  busy: boolean;
  joining: boolean;
  hasInvite: boolean;
  error: string;
  connection?: ReactNode;
  onSubmit(form: HTMLFormElement): void;
  onToggleJoin(): void;
};

export default function LoginScreen({
  busy, joining, hasInvite, error, connection, onSubmit, onToggleJoin,
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Không gian phối hợp BIM">
        <div className="login-showcase-content">
          <div className="login-brand">
            <span className="login-brand-icon"><Cuboid size={23} aria-hidden="true" /></span>
            <span>CIC CDE</span>
          </div>
          <div className="login-intro">
            <h1>Không gian phối hợp <span>BIM &amp; CDE</span></h1>
            <p>Quản lý hồ sơ, xem mô hình IFC và phối hợp giữa các đơn vị trên cùng một dự án.</p>
            <ul className="login-capabilities">
              <li><Box size={17} aria-hidden="true" /> Mô hình IFC</li>
              <li><Layers3 size={17} aria-hidden="true" /> Phối hợp 3D</li>
              <li><Files size={17} aria-hidden="true" /> Hồ sơ dự án</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="login-access" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-brand-icon"><Cuboid size={23} aria-hidden="true" /></span>
            <h2 id="login-title">{joining ? "Tham gia dự án" : "Đăng nhập"}</h2>
            <p>{joining ? "Tạo tài khoản từ lời mời bạn đã nhận." : "Truy cập không gian dự án CIC CDE của bạn."}</p>
          </div>
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
              <button className="login-submit" type="submit">
                {busy ? (joining ? "Đang tạo tài khoản…" : "Đang đăng nhập…")
                  : joining ? "Tạo tài khoản và tham gia" : "Đăng nhập"}
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </fieldset>
          </form>
          {hasInvite && (
            <button type="button" className="login-invite" disabled={busy} onClick={onToggleJoin}>
              {joining ? "Đăng nhập bằng tài khoản có sẵn" : "Tạo tài khoản theo lời mời"}
            </button>
          )}
          {connection && <div className="login-connection">{connection}</div>}
        </div>
      </section>
    </main>
  );
}
