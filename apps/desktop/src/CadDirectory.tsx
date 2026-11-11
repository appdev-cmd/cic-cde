import { useRef, useState, type DragEvent } from "react";
import { File, Folder, FolderInput, FolderPlus, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import AccessDialog from "./AccessDialog";
import CadFolderDialog from "./CadFolderDialog";
import { cadFolderNames, type CadFolder } from "./cadFolderTree";
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
const cadDragType = "application/x-ciccde-cad-drawing";
const rootDropTarget = "root";

type DrawingActions = {
  dragged?: CadDrawing;
  target?: string;
  start: (event: DragEvent<HTMLElement>, drawing: CadDrawing) => void;
  end: () => void;
  over: (event: DragEvent<HTMLElement>, folderId: string | null) => void;
  leave: (event: DragEvent<HTMLElement>, target: string) => void;
  drop: (event: DragEvent<HTMLElement>, folderId: string | null) => void;
  choose: (drawing: CadDrawing) => void;
};

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

function FolderBranch({ folder, selected, onOpen, onManage, drawingActions }: {
  folder: FolderNode; selected?: string; onOpen: (drawing: CadDrawing) => void; onManage?: (folder: CadFolder) => void;
  drawingActions?: DrawingActions;
}) {
  const entry = folder.folder;
  return (
    <li className={entry && onManage ? "cad-folder-branch cad-folder-managed" : "cad-folder-branch"}>
      <details open>
        <summary data-cad-drop-active={entry && drawingActions?.target === entry.id ? true : undefined}
          onDragOver={entry && drawingActions ? (event) => drawingActions.over(event, entry.id) : undefined}
          onDragLeave={entry && drawingActions ? (event) => drawingActions.leave(event, entry.id) : undefined}
          onDrop={entry && drawingActions ? (event) => drawingActions.drop(event, entry.id) : undefined}>
          <Folder size={14} /><span title={folder.name}>{folder.name}</span><small>{folder.count}</small>
        </summary>
        <ul>
          {[...folder.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, child]) => (
            <FolderBranch key={key} folder={child} selected={selected} onOpen={onOpen}
              onManage={onManage} drawingActions={drawingActions} />
          ))}
          {folder.files.slice().sort((a, b) => cadNames.compare(a.name, b.name)).map((drawing) => (
            <li key={drawing.key} className="cad-drawing-row">
              <button type="button" aria-pressed={selected === drawing.key}
                draggable={Boolean(drawingActions && drawing.location)}
                data-cad-dragging={drawingActions?.dragged?.key === drawing.key ? true : undefined}
                onDragStart={drawingActions && drawing.location ? (event) => drawingActions.start(event, drawing) : undefined}
                onDragEnd={drawingActions?.end}
                title={[...drawing.folders, drawing.name].join("/")} onClick={() => onOpen(drawing)}>
                <File size={13} /><span>{drawing.name}</span>
              </button>
              {drawingActions && drawing.location && (
                <button type="button" className="cad-drawing-move" aria-label={`Di chuyển ${drawing.name}`}
                  title="Di chuyển bản vẽ" onClick={() => drawingActions.choose(drawing)}><FolderInput size={14} /></button>
              )}
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
  const [dragged, setDragged] = useState<CadDrawing>();
  const dragSource = useRef<CadDrawing>(undefined);
  const [target, setTarget] = useState<string>();
  const [choosing, setChoosing] = useState<CadDrawing>();
  const [destination, setDestination] = useState("");
  const [moving, setMoving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const term = search.trim().toLocaleLowerCase();
  const tree = buildTree(files, term);
  const folderIndex = new Map(files.folders.map((folder) => [folder.id, folder]));

  function endDrag() {
    dragSource.current = undefined;
    setDragged(undefined);
    setTarget(undefined);
  }

  function accepts(event: DragEvent<HTMLElement>, folderId: string | null) {
    return dragSource.current && (dragSource.current.folderId ?? null) !== folderId &&
      event.dataTransfer.types.includes(cadDragType);
  }

  async function move(drawing: CadDrawing, folderId: string | null) {
    if (moving || !drawing.location || (drawing.folderId ?? null) === folderId) return;
    setChoosing(undefined);
    setMoving(true);
    setFeedback(undefined);
    try {
      const { moveCadDrawing } = await import("./cadStorage");
      await moveCadDrawing(drawing.location, folderId);
      setSearch("");
      setFeedback({ text: `Đã di chuyển ${drawing.name}.` });
    } catch (failure) {
      setFeedback({ text: failure instanceof Error ? failure.message : "Không thể di chuyển bản vẽ.", error: true });
    } finally {
      onReload();
      setMoving(false);
    }
  }

  const canMove = canManage && files.status === "ready" && !moving && files.folders.length > 0;
  const drawingActions: DrawingActions | undefined = canMove ? {
    dragged, target,
    start(event, drawing) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(cadDragType, drawing.key);
      dragSource.current = drawing;
      setDragged(drawing);
    },
    end: endDrag,
    over(event, folderId) {
      if (!accepts(event, folderId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setTarget(folderId ?? rootDropTarget);
    },
    leave(event, targetId) {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      setTarget((current) => current === targetId ? undefined : current);
    },
    drop(event, folderId) {
      const drawing = dragSource.current;
      if (!drawing || !accepts(event, folderId) || event.dataTransfer.getData(cadDragType) !== drawing.key) return;
      event.preventDefault();
      endDrag();
      void move(drawing, folderId);
    },
    choose(drawing) {
      setDestination("");
      setChoosing(drawing);
    },
  } : undefined;
  const dropAtRoot = Boolean(drawingActions?.dragged?.folderId);

  return (
    <section className="cad-directory" aria-label="Cây bản vẽ CAD">
      <div className="panel-section-header">
        <span className="cad-directory-title" data-cad-root-drop={dropAtRoot || undefined}
          data-cad-drop-active={target === rootDropTarget ? true : undefined}
          onDragOver={dropAtRoot ? (event) => drawingActions?.over(event, null) : undefined}
          onDragLeave={dropAtRoot ? (event) => drawingActions?.leave(event, rootDropTarget) : undefined}
          onDrop={dropAtRoot ? (event) => drawingActions?.drop(event, null) : undefined}>
          {dropAtRoot ? "Thả vào thư mục gốc" : "BẢN VẼ CAD"}
        </span>
        <div className="cad-directory-actions">
          {canManage && <button type="button" aria-label="Tạo thư mục CAD" title="Tạo thư mục CAD"
            disabled={files.status !== "ready"} onClick={() => setEditing(null)}><FolderPlus size={15} /></button>}
          <button type="button" aria-label="Tải lại cây bản vẽ CAD" disabled={files.status === "loading" || moving}
            onClick={() => { endDrag(); setFeedback(undefined); onReload(); }}>
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
      {moving && <p role="status">Đang di chuyển bản vẽ…</p>}
      {feedback && <p className="cad-move-feedback" role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      {files.status === "ready" && !files.drawings.length && !files.folders.length &&
        <p>Tải DWG/DXF lên tại <a href="?cde=1">Hồ sơ CDE</a>.</p>}
      {files.status === "ready" && term && tree.folders.size === 0 &&
        <p>Không có bản vẽ hoặc thư mục phù hợp.</p>}
      <div className="cad-directory-folders">
        <ul key={term}>
          {[...tree.folders].sort(([, a], [, b]) => cadNames.compare(a.name, b.name)).map(([key, folder]) => (
            <FolderBranch key={key} folder={folder} selected={selected} onOpen={onOpen}
              onManage={canManage && files.status === "ready" ? setEditing : undefined} drawingActions={drawingActions} />
          ))}
        </ul>
      </div>
      {editing !== undefined && canManage && (
        <CadFolderDialog folder={editing} folders={files.folders} onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); setSearch(""); onReload(); }} />
      )}
      {choosing && canMove && (
        <AccessDialog title="Di chuyển bản vẽ CAD" className="cad-folder-dialog" onClose={() => setChoosing(undefined)}>
          <p className="cad-folder-dialog-path">{choosing.name}</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (destination) void move(choosing, destination === rootDropTarget ? null : destination);
          }}>
            <label>Thư mục đích
              <select value={destination} onChange={(event) => setDestination(event.target.value)} required>
                <option value="" disabled>Chọn thư mục</option>
                {choosing.folderId && <option value={rootDropTarget}>Thư mục gốc</option>}
                {files.folders.filter((folder) => folder.id !== choosing.folderId).map((folder) => (
                  <option key={folder.id} value={folder.id}>{cadFolderNames(folderIndex, folder.id).join(" / ")}</option>
                ))}
              </select>
            </label>
            <div className="cad-folder-dialog-actions">
              <button type="button" className="button secondary" onClick={() => setChoosing(undefined)}>Hủy</button>
              <button type="submit" className="button primary" disabled={!destination}>Di chuyển</button>
            </div>
          </form>
        </AccessDialog>
      )}
    </section>
  );
}
