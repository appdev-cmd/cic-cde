import { useEffect, useRef, useState } from "react";
import { cloudEnabled, desktop } from "./bridge";
import { LoginLayout } from "./LoginScreen";
import PasswordForm from "./PasswordForm";

export const passwordRecoveryPath = "/?reset-password=1";

export function passwordRecoveryUrl() {
  return new URL(passwordRecoveryPath, desktop ? "https://cde.cic.com.vn" : location.origin).href;
}

export function readPasswordRecovery() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (!cloudEnabled || desktop ||
      (!url.searchParams.has("reset-password") && hash.get("type") !== "recovery" && !hash.has("error_code"))) return null;
  const accessToken = hash.get("type") === "recovery" ? hash.get("access_token") : null;
  const refreshToken = hash.get("refresh_token");
  url.hash = "";
  history.replaceState(null, "", url.pathname + url.search);
  return { accessToken, refreshToken };
}

type SavePassword = (password: string) => Promise<void>;

export default function PasswordRecovery({ link }: {
  link: NonNullable<ReturnType<typeof readPasswordRecovery>>;
}) {
  const [save, setSave] = useState<SavePassword | null>(null);
  const [error, setError] = useState("");
  const verification = useRef<Promise<SavePassword> | null>(null);
  const { accessToken, refreshToken } = link;

  useEffect(() => {
    if (!accessToken || !refreshToken) return;
    let active = true;
    verification.current ??= import("./cloud")
      .then(({ openPasswordRecovery }) => openPasswordRecovery(accessToken, refreshToken));
    void verification.current
      .then((onSave) => {
        if (active) setSave(() => onSave);
      })
      .catch(() => {
        if (active) setError("Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.");
      });
    return () => { active = false; };
  }, [accessToken, refreshToken]);

  return (
    <LoginLayout title="Đặt lại mật khẩu" description="Tạo mật khẩu mới cho tài khoản CIC CDE của bạn.">
      {save ? <PasswordForm onSave={save} /> : error || !accessToken || !refreshToken ? (
        <p className="login-error" role="alert">
          {error || "Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới."}
        </p>
      ) : <p role="status">Đang xác minh liên kết…</p>}
      <a className="login-invite" href="/">Quay lại đăng nhập</a>
    </LoginLayout>
  );
}
