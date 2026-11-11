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

export default function CadDirectory({ files, selected, onOpen, onReload }: {
  files: CadFiles; selected?: string; onOpen: (drawing: CadDrawing) => void; onReload: () => void;
}) {
  const [search, setSearch] = useState("");
  const folderNames = [...groups.map((group) => group.label), "Chưa phân nhóm"];
  const folders = new Map(folderNames.map((name) => [name, [] as CadDrawing[]]));
  const term = search.trim().toLocaleLowerCase();
  for (const drawing of files.drawings) {
    if (!drawing.name.toLocaleLowerCase().includes(term)) continue;
    const tokens = drawing.name.toUpperCase().split(/[-_.\s]+/);
    const folder = groups.find((group) => group.codes.some((code) => tokens.includes(code)));
    folders.get(folder?.label ?? "Chưa phân nhóm")?.push(drawing);
  }

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
      {files.status === "ready" && files.drawings.length > 0 && ![...folders.values()].some((items) => items.length) &&
        <p>Không có bản vẽ phù hợp.</p>}
      <div className="cad-directory-folders">
        {[...folders].map(([folder, items]) => items.length > 0 && (
          <details key={folder} open>
            <summary><Folder size={14} /><span>{folder}</span><small>{items.length}</small></summary>
            <ul>
              {items.map((drawing) => (
                <li key={drawing.key}>
                  <button type="button" aria-pressed={selected === drawing.key} title={drawing.name} onClick={() => onOpen(drawing)}>
                    <File size={13} /><span>{drawing.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
