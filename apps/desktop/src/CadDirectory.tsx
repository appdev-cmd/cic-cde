import { useState } from "react";
import { File, Folder, RefreshCw, Search } from "lucide-react";
import type { CadDrawing } from "./cadStorage";

export type CadFiles = { drawings: CadDrawing[]; status: "loading" | "ready" | "error" };

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

type CadFolder = {
  name: string;
  folders: Map<string, CadFolder>;
  files: CadDrawing[];
  count: number;
};

const cadNames = new Intl.Collator("vi", { numeric: true });

function makeFolder(name: string): CadFolder {
  return { name, folders: new Map(), files: [], count: 0 };
}

function buildTree(drawings: CadDrawing[], search: string) {
  const root = makeFolder("");
  const hasUploadedFolders = drawings.some((drawing) => drawing.folders.length > 0);
  for (const drawing of drawings) {
    if (![...drawing.folders, drawing.name].join("/").toLocaleLowerCase().includes(search)) continue;
    let path = drawing.folders;
    const loose = !path.length;
    if (loose) {
      const tokens = drawing.name.toUpperCase().split(/[-_.\s]+/);
      const group = groups.find(({ codes }) => codes.some((code) => tokens.includes(code)));
      path = hasUploadedFolders ? ["Bản vẽ tải lẻ", group?.label ?? "Chưa phân nhóm"] : [group?.label ?? "Chưa phân nhóm"];
    }
    root.count++;
    let parent = root;
    for (const [index, name] of path.entries()) {
      const key = loose && index === 0 ? "loose:" + name : "folder:" + name;
      let folder = parent.folders.get(key);
      if (!folder) {
        folder = makeFolder(name);
        parent.folders.set(key, folder);
      }
      folder.count++;
      parent = folder;
    }
    parent.files.push(drawing);
  }
  return root;
}

function FolderBranch({ folder, selected, onOpen }: {
  folder: CadFolder; selected?: string; onOpen: (drawing: CadDrawing) => void;
}) {
  return (
    <li>
      <details open>
        <summary><Folder size={14} /><span title={folder.name}>{folder.name}</span><small>{folder.count}</small></summary>
        <ul>
          {[...folder.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, child]) => (
            <FolderBranch key={key} folder={child} selected={selected} onOpen={onOpen} />
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
    </li>
  );
}

export default function CadDirectory({ files, selected, onOpen, onReload }: {
  files: CadFiles; selected?: string; onOpen: (drawing: CadDrawing) => void; onReload: () => void;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase();
  const tree = buildTree(files.drawings, term);

  return (
    <section className="cad-directory" aria-label="Cây bản vẽ CAD">
      <div className="panel-section-header">
        <span>BẢN VẼ CAD</span>
        <button type="button" aria-label="Tải lại cây bản vẽ CAD" disabled={files.status === "loading"} onClick={onReload}>
          <RefreshCw size={13} />
        </button>
      </div>
      <label className="model-search">
        <Search size={14} />
        <input placeholder="Tìm bản vẽ CAD…" aria-label="Tìm bản vẽ CAD" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </label>
      {files.status === "loading" && <p role="status">Đang tải cây bản vẽ…</p>}
      {files.status === "error" && <p role="alert">Không tải được cây bản vẽ.</p>}
      {files.status === "ready" && !files.drawings.length &&
        <p>Tải DWG/DXF lên tại <a href="?cde=1">Hồ sơ CDE</a>.</p>}
      {files.status === "ready" && files.drawings.length > 0 && tree.count === 0 &&
        <p>Không có bản vẽ phù hợp.</p>}
      <div className="cad-directory-folders">
        <ul key={term}>
          {[...tree.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, folder]) => (
            <FolderBranch key={key} folder={folder} selected={selected} onOpen={onOpen} />
          ))}
        </ul>
      </div>
    </section>
  );
}
