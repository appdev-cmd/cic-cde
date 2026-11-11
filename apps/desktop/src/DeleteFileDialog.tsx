import { useState } from "react";
import AccessDialog from "./AccessDialog";

export default function DeleteFileDialog({ title, name, description, onClose, onDelete }: {
  title: string;
  name: string;
  description: string;
  onClose(): void;
  onDelete(): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  return (
    <AccessDialog title={title} className="cde-delete-dialog" onClose={onClose} closeDisabled={busy}>
      <p className="cde-delete-name">{name}</p>
      <p>{description}</p>
      {error && <p className="cde-message" role="alert">{error}</p>}
      <div className="cde-delete-actions">
        <button type="button" className="button secondary" autoFocus disabled={busy} onClick={onClose}>Hủy</button>
        <button type="button" className="button cde-delete-confirm" disabled={busy} onClick={() => void remove()}>
          {busy ? "Đang xóa…" : "Xác nhận xóa"}
        </button>
      </div>
    </AccessDialog>
  );
}
