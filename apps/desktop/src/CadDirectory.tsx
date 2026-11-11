import { useState } from "react";
import { File, Folder, FolderPlus, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import CadFolderDialog from "./CadFolderDialog";
import type { CadFolder } from "./cadFolderTree";
import type { CadDrawing } from "./cadStorage";

export type CadFiles = { drawings: CadDrawing[]; folders: CadFolder[]; status: "loading" | "ready" | "error" };

const groups = [
  { label: "Tổng mặt bằng", codes: ["TMB", "SITE"] },
  { label: "Kiến trúc", codes: ["KT", "ARC", "ARCH"] },
  { label: "Kết cấu", codes: ["KC", "STR", "STRUCT"] },
  { label: "Cấp thoát nước", codes: ["CTN", "PLUM", "PLB"] },
  { label: "Điện", codes: ["ELC", "ELV", "ELEC", "DIEN"] },
  { label: "Thông gió và điều hòa", codes: ["HVAC", "DHKK"] },
  { label: "Phòng cháy chữa cháy", codes: ["PCCC", "FIRE"] },
  { label: "Cơ điện", codes: ["MEP"] },
];

type FolderNode = {
  name: string;
  folder?: CadFolder;
  folders: Map<string, FolderNode>;
  files: CadDrawing[];
  count: number;
};

const cadNames = new Intl.Collator("vi", { numeric: true });

function makeFolder(name: string, folder?: CadFolder): FolderNode {
  return { name, folder, folders: new Map(), files: [], count: 0 };
}

function buildTree({ drawings, folders }: CadFiles, search: string) {
  const root = makeFolder("");
  const catalog = new Map(folders.map((folder) => [folder.id, makeFolder(folder.name, folder)]));
  for (const folder of folders) {
    const parent = (folder.parentId ? catalog.get(folder.parentId) : undefined) ?? root;
    parent.folders.set(folder.id, catalog.get(folder.id)!);
  }
  const hasUploadedFolders = folders.length > 0 || drawings.some((drawing) => drawing.folders.length > 0);
  for (const drawing of drawings) {
    if (![...drawing.folders, drawing.name].join("/").toLocaleLowerCase().includes(search)) continue;
    const node = drawing.folderId ? catalog.get(drawing.folderId) : undefined;
    if (node) {
      node.files.push(drawing);
      continue;
    }
    let path = drawing.folders;
    const loose = !path.length;
    if (loose) {
      const tokens = drawing.name.toUpperCase().split(/[-_.\s]+/);
      const group = groups.find(({ codes }) => codes.some((code) => tokens.includes(code)));
      path = hasUploadedFolders ? ["Bản vẽ tải lẻ", group?.label ?? "Chưa phân nhóm"] : [group?.label ?? "Chưa phân nhóm"];
    }
    let parent = root;
    for (const [index, name] of path.entries()) {
      const key = loose && index === 0 ? "loose:" + name : "folder:" + name;
      let folder = parent.folders.get(key);
      if (!folder) {
        folder = makeFolder(name);
        parent.folders.set(key, folder);
      }
      parent = folder;
    }
    parent.files.push(drawing);
  }
  function prune(node: FolderNode, path: string): boolean {
    node.count = node.files.length;
    for (const [key, child] of node.folders) {
      if (prune(child, path + "/" + child.name)) node.count += child.count;
      else node.folders.delete(key);
    }
    return !search || node.count > 0 || node.folders.size > 0 || path.toLocaleLowerCase().includes(search);
  }
  prune(root, "");
  return root;
}

function FolderBranch({ folder, selected, onOpen, onManage }: {
  folder: FolderNode; selected?: string; onOpen: (drawing: CadDrawing) => void; onManage?: (folder: CadFolder) => void;
}) {
  const entry = folder.folder;
  return (
    <li className={entry && onManage ? "cad-folder-branch cad-folder-managed" : "cad-folder-branch"}>
      <details open>
        <summary><Folder size={14} /><span title={folder.name}>{folder.name}</span><small>{folder.count}</small></summary>
        <ul>
          {[...folder.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, child]) => (
            <FolderBranch key={key} folder={child} selected={selected} onOpen={onOpen} onManage={onManage} />
          ))}
          {folder.files.slice().sort((a, b) => cadNames.compare(a.name, b.name)).map((drawing) => (
            <li key={drawing.key}>
              <button type="button" aria-pressed={selected === drawing.key}
                title={[...drawing.folders, drawing.name].join("/")} onClick={() => onOpen(drawing)}>
                <File size={13} /><span>{drawing.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
      {entry && onManage && (
        <button type="button" className="cad-folder-manage" aria-label={`Quản lý thư mục ${entry.name}`}
          title="Quản lý thư mục" onClick={() => onManage(entry)}>
          <MoreHorizontal size={15} />
        </button>
      )}
    </li>
  );
}

export default function CadDirectory({ files, selected, canManage, onOpen, onReload }: {
  files: CadFiles; selected?: string; canManage: boolean; onOpen: (drawing: CadDrawing) => void; onReload: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CadFolder | null>();
  const term = search.trim().toLocaleLowerCase();
  const tree = buildTree(files, term);

  return (
    <section className="cad-directory" aria-label="Cây bản vẽ CAD">
      <div className="panel-section-header">
        <span>BẢN VẼ CAD</span>
        <div className="cad-directory-actions">
          {canManage && <button type="button" aria-label="Tạo thư mục CAD" title="Tạo thư mục CAD"
            disabled={files.status !== "ready"} onClick={() => setEditing(null)}><FolderPlus size={15} /></button>}
          <button type="button" aria-label="Tải lại cây bản vẽ CAD" disabled={files.status === "loading"} onClick={onReload}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
      <label className="model-search">
        <Search size={14} />
        <input placeholder="Tìm bản vẽ CAD…" aria-label="Tìm bản vẽ CAD" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </label>
      {files.status === "loading" && <p role="status">Đang tải cây bản vẽ…</p>}
      {files.status === "error" && <p role="alert">Không tải được cây bản vẽ.</p>}
      {files.status === "ready" && !files.drawings.length && !files.folders.length &&
        <p>Tải DWG/DXF lên tại <a href="?cde=1">Hồ sơ CDE</a>.</p>}
      {files.status === "ready" && term && tree.folders.size === 0 &&
        <p>Không có bản vẽ hoặc thư mục phù hợp.</p>}
      <div className="cad-directory-folders">
        <ul key={term}>
          {[...tree.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, folder]) => (
            <FolderBranch key={key} folder={folder} selected={selected} onOpen={onOpen}
              onManage={canManage && files.status === "ready" ? setEditing : undefined} />
          ))}
        </ul>
      </div>
      {editing !== undefined && canManage && (
        <CadFolderDialog folder={editing} folders={files.folders} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); setSearch(""); onReload(); }} />
      )}
    </section>
  );
}
