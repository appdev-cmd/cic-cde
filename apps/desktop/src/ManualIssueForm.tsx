import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { issuePriorities } from "./coordinationPresentation";
import { attachIssueFile, issueAttachmentLimit, issueFiles, issueImageAccept, type PendingIssueFile } from "./issueAttachments";
import type { CoordinationIssue } from "./types";

export default function ManualIssueForm({ assignees, cloud, onClose, onCreate, onAttach, onOpen }: {
  assignees: { id: string; username: string; organization: string }[];
  cloud: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<CoordinationIssue>;
  onAttach: (payload: Record<string, unknown>) => Promise<void>;
  onOpen: (issue: CoordinationIssue) => void;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string>(null);
  const controller = useRef<AbortController | null>(null);
  const [issue, setIssue] = useState<CoordinationIssue>();
  const [files, setFiles] = useState<PendingIssueFile[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      controller.current?.abort();
      element?.close();
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const upload = new AbortController();
    controller.current = upload;
    setWorking(true);
    setError("");
    let created = issue;
    try {
      if (!created) {
        for (const key of ["title", "description"] as const) {
          if (!String(payload[key] ?? "").trim()) throw new Error("Nhập tiêu đề và mô tả vấn đề.");
        }
        setMessage("Đang tạo vấn đề…");
        requestId.current ??= crypto.randomUUID();
        created = await onCreate({ ...payload, requestId: requestId.current });
        upload.signal.throwIfAborted();
        setIssue(created);
      }
      for (const entry of files) {
        setMessage("Đang tải " + entry.file.name + "…");
        await attachIssueFile(created.id, entry, cloud, upload.signal, onAttach,
          (percent) => setMessage(entry.file.name + " · " + percent + "%"));
        setFiles((current) => current.filter((item) => item.id !== entry.id));
      }
      onOpen(created);
    } catch (err) {
      if (!upload.signal.aborted) {
        const detail = err instanceof Error ? err.message : String(err);
        setError(created ? "Vấn đề đã được tạo. Ảnh còn lại chưa lưu. " + detail : detail);
      }
    } finally {
      controller.current = null;
      setWorking(false);
      setMessage("");
    }
  }

  function close() {
    if (controller.current) return;
    if (issue) onOpen(issue);
    else onClose();
  }

  return (
    <dialog ref={dialog} className="manual-issue-dialog" aria-labelledby={heading} onCancel={(event) => {
      event.preventDefault();
      close();
    }}>
      <h2 id={heading}>Tạo vấn đề phối hợp</h2>
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={working || !!issue} className="manual-issue-fields">
          <label className="manual-issue-wide">Tiêu đề <input name="title" required maxLength={160} autoFocus /></label>
          <label className="manual-issue-wide">Mô tả <textarea name="description" required maxLength={4000} rows={4} /></label>
          <label>Mức ưu tiên
            <select name="priority" defaultValue="medium">
              {Object.entries(issuePriorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Vị trí <input name="location" placeholder="Tầng, trục hoặc khu vực" maxLength={160} /></label>
          <label>Đơn vị phụ trách <input name="assignee" maxLength={120} /></label>
          <label>Hạn xử lý <input type="date" name="dueDate" min="2000-01-01" max="2100-12-31" /></label>
          {cloud && <label className="manual-issue-wide">Người phụ trách
            <select name="assignedUserId">
              <option value="">Chưa phân công</option>
              {assignees.map(({ id, username, organization }) => <option key={id} value={id}>{username} · {organization}</option>)}
            </select>
          </label>}
        </fieldset>
        <label className="manual-issue-photos">Ảnh đính kèm <small>PNG, JPEG · Tối đa 20 MB mỗi ảnh</small>
          <input type="file" accept={issueImageAccept} multiple disabled={working || !!issue} onChange={(event) => {
            try {
              setFiles(issueFiles(Array.from(event.target.files ?? []), true, issueAttachmentLimit));
              setError("");
            } catch (err) {
              event.target.value = "";
              setFiles([]);
              setError(err instanceof Error ? err.message : String(err));
            }
          }} />
        </label>
        {!!files.length && <ul className="issue-file-list">{files.map(({ id, file }) => <li key={id}>{file.name}</li>)}</ul>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" className="button secondary" disabled={working} onClick={close}>{issue ? "Mở vấn đề" : "Hủy"}</button>
          <button className="button primary" disabled={working}>{issue ? "Thử tải lại ảnh" : "Tạo vấn đề"}</button>
        </footer>
      </form>
    </dialog>
  );
}
