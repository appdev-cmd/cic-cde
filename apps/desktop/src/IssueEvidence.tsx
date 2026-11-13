import { useEffect, useRef, useState, type FormEvent } from "react";
import { attachIssueFile, getIssueFile, issueAttachmentLimit, issueFileAccept, issueFiles, issueImageAccept, issueImageType, type PendingIssueFile } from "./issueAttachments";
import type { CoordinationIssue, IssueAttachment } from "./types";

export default function IssueEvidence({ issue, cloud, readOnly, busy, onAttach, onSaveViewpoint, onRestoreViewpoint }: {
  issue: CoordinationIssue;
  cloud: boolean;
  readOnly: boolean;
  busy: boolean;
  onAttach: (payload: Record<string, unknown>) => Promise<void>;
  onSaveViewpoint?: () => void;
  onRestoreViewpoint?: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const pending = useRef<PendingIssueFile[]>([]);
  const upload = useRef<AbortController | null>(null);
  useEffect(() => () => upload.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const files = issue.attachments ?? [];
  const imagesOnly = !cloud || !!issue.manual;

  async function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (upload.current) return;
    const form = event.currentTarget;
    const input = form.elements.namedItem("evidence") as HTMLInputElement;
    const controller = new AbortController();
    upload.current = controller;
    setWorking(true);
    try {
      pending.current = pending.current.length ? pending.current : issueFiles(
        Array.from(input.files ?? []), imagesOnly, issueAttachmentLimit - files.length,
      );
      for (const entry of pending.current) {
        setMessage("Đang tải " + entry.file.name + "…");
        await attachIssueFile(issue.id, entry, cloud, controller.signal, onAttach, (percent) => {
          setMessage(entry.file.name + " · " + percent + "%");
        });
        pending.current = pending.current.filter((item) => item !== entry);
      }
      form.reset();
      setMessage("Đã lưu tệp đính kèm.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      upload.current = null;
      setWorking(false);
    }
  }

  async function openFile(item: IssueAttachment, download: boolean) {
    setMessage("");
    try {
      const file = await getIssueFile(issue, item, cloud);
      const url = URL.createObjectURL(file);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = item.filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPreview({ url, filename: item.filename });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <details className="issue-evidence" open={!!issue.manual || undefined}>
      <summary>{imagesOnly ? `Ảnh đính kèm (${files.length})` : "Bằng chứng và góc nhìn"}</summary>
      {(onRestoreViewpoint || onSaveViewpoint) && <div className="cde-filters">
        {issue.viewpoint && onRestoreViewpoint && <button type="button" className="button tiny secondary" onClick={onRestoreViewpoint}>Mở góc nhìn đã lưu</button>}
        {!readOnly && onSaveViewpoint && <button type="button" className="button tiny secondary" disabled={busy} onClick={onSaveViewpoint}>Lưu góc nhìn 3D hiện tại</button>}
      </div>}
      {!!files.length && (
        <ul className="issue-file-list">{files.map((item) => (
          <li key={item.id}>
            {issueImageType(item.filename)
              ? <button type="button" className="cde-doc-link" onClick={() => void openFile(item, false)}>{item.filename}</button>
              : <button type="button" className="button tiny secondary" onClick={() => void openFile(item, true)}>{item.filename}</button>}
            {issueImageType(item.filename) && <button type="button" className="button tiny secondary"
              aria-label={"Tải xuống " + item.filename} onClick={() => void openFile(item, true)}>Tải xuống</button>}
          </li>
        ))}</ul>
      )}
      {preview && <figure className="issue-image-preview">
        <img src={preview.url} alt={preview.filename} />
        <figcaption><button type="button" className="button tiny secondary" onClick={() => setPreview(null)}>Đóng ảnh</button></figcaption>
      </figure>}
      {!readOnly && files.length < issueAttachmentLimit && (
        <form onSubmit={(event) => void attach(event)}>
          <input aria-label={imagesOnly ? "Ảnh đính kèm" : "Tệp bằng chứng"} type="file" name="evidence"
            accept={imagesOnly ? issueImageAccept : issueFileAccept} multiple required disabled={working || busy}
            onChange={() => { pending.current = []; }} />
          <button className="button tiny secondary" disabled={working || busy}>{imagesOnly ? "Tải ảnh lên" : "Đính kèm tệp"}</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
