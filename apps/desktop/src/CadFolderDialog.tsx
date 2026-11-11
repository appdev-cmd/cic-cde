import { useState } from "react";
import AccessDialog from "./AccessDialog";
import { cadFolderNames, type CadFolder } from "./cadFolderTree";
import type { CadFolderChange } from "./cadStorage";

type Mode = "menu" | "create" | "rename" | "move" | "remove";
const titles: Record<Mode, string> = {
  menu: "Quản lý thư mục CAD",
  create: "Tạo thư mục CAD",
  rename: "Đổi tên thư mục CAD",
  move: "Di chuyển thư mục CAD",
  remove: "Xóa thư mục CAD",
};

export default function CadFolderDialog({ folder, folders, onClose, onSaved }: {
  folder: CadFolder | null; folders: CadFolder[]; onClose: () => void; onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>(folder ? "menu" : "create");
  const [name, setName] = useState("");
  const [parent, setParent] = useState(folder?.parentId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const byId = new Map(folders.map((item) => [item.id, item]));
  const currentPath = folder ? cadFolderNames(byId, folder.id).join(" / ") : "";
  const parentPath = folder?.parentId ? cadFolderNames(byId, folder.parentId).join(" / ") : "thư mục gốc";

  function choose(next: Mode) {
    setName(next === "rename" ? folder?.name ?? "" : "");
    setParent(folder?.parentId ?? "");
    setError("");
    setMode(next);
  }

  function validDestination(candidate: CadFolder) {
    let id: string | null = candidate.id;
    while (id) {
      if (id === folder?.id) return false;
      id = byId.get(id)?.parentId ?? null;
    }
    return true;
  }

  async function submit() {
    if (busy) return;
    let change: CadFolderChange;
    if (mode === "create") {
      change = { operation: "create", name: name.trim(), parentId: folder?.id ?? null };
    } else if (folder && mode !== "menu") {
      const identity = { id: folder.id, expectedRevision: folder.revision };
      change = mode === "rename" ? { operation: mode, ...identity, name: name.trim() } :
        mode === "move" ? { operation: mode, ...identity, parentId: parent || null } : { operation: "remove", ...identity };
    } else return;
    setBusy(true);
    setError("");
    try {
      const { changeCadFolder } = await import("./cadStorage");
      await changeCadFolder(change);
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật thư mục CAD.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessDialog title={titles[mode]} className="cad-folder-dialog" onClose={onClose} closeDisabled={busy}>
      {currentPath && <p className="cad-folder-dialog-path">{currentPath}</p>}
      {mode === "menu" ? (
        <div className="cad-folder-dialog-actions">
          <button type="button" className="button secondary" onClick={() => choose("create")}>Tạo thư mục con</button>
          <button type="button" className="button secondary" onClick={() => choose("rename")}>Đổi tên</button>
          <button type="button" className="button secondary" onClick={() => choose("move")}>Di chuyển</button>
          <button type="button" className="button cde-delete-link" onClick={() => choose("remove")}>Xóa thư mục</button>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          {(mode === "create" || mode === "rename") && (
            <label>Tên thư mục
              <input value={name} required maxLength={255} disabled={busy} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          {mode === "move" && (
            <label>Thư mục đích
              <select value={parent} disabled={busy} onChange={(event) => setParent(event.target.value)}>
                <option value="">Thư mục gốc</option>
                {folders.filter(validDestination).map((item) => (
                  <option key={item.id} value={item.id}>{cadFolderNames(byId, item.id).join(" / ")}</option>
                ))}
              </select>
            </label>
          )}
          {mode === "remove" && <p>Bản vẽ và thư mục con sẽ được chuyển lên <strong>{parentPath}</strong>.</p>}
          {error && <p role="alert" className="cde-message">{error}</p>}
          <div className="cad-folder-dialog-actions">
            <button type="button" className="button secondary" disabled={busy}
              onClick={() => folder ? choose("menu") : onClose()}>Hủy</button>
            <button type="submit" className={mode === "remove" ? "button cde-delete-link" : "button primary"}
              disabled={busy || ((mode === "create" || mode === "rename") && !name.trim()) ||
                (mode === "move" && parent === (folder?.parentId ?? ""))}>
              {busy ? "Đang lưu…" : mode === "remove" ? "Xóa thư mục" : "Lưu"}
            </button>
          </div>
        </form>
      )}
    </AccessDialog>
  );
}
