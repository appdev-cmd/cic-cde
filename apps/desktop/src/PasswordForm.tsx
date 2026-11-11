import { useState, type FormEvent } from "react";

export default function PasswordForm({ change, onSave }: {
  change?: boolean;
  onSave(password: string, currentPassword: string): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get("newPassword"));
    if (password !== fields.get("confirmPassword")) {
      setError("Hai mật khẩu mới chưa khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(password, String(fields.get("currentPassword") ?? ""));
      form.reset();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể cập nhật mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) return (
    <p className="login-notice" role="status">
      Đã cập nhật mật khẩu. Hãy dùng mật khẩu mới trong lần đăng nhập tiếp theo.
    </p>
  );

  return (
    <form className="password-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {change && (
          <label>Mật khẩu hiện tại
            <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
          </label>
        )}
        <label>Mật khẩu mới
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        </label>
        <label>Nhập lại mật khẩu mới
          <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        </label>
        <p className="password-hint">Mật khẩu mới cần ít nhất 12 ký tự.</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" className="login-submit">
          {busy ? "Đang cập nhật…" : change ? "Lưu mật khẩu mới" : "Đặt lại mật khẩu"}
        </button>
      </fieldset>
    </form>
  );
}
