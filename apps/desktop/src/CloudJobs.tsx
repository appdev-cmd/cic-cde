import { useCallback, useEffect, useRef, useState } from "react";
import AccessDialog from "./AccessDialog";
import { API, call, selectedProject } from "./bridge";
import { projectHref } from "./projectRoute";
import { useCdeUser } from "./AuthContext";

type Job = { jobId: string; kind: string; name: string; phase: string; attempts: number; updatedAt: string; error?: string; stale: boolean; retryable: boolean; cancellable: boolean };
type Page = { items: Job[]; total: number };
const labels: Record<string, string> = { queued: "Đang chờ", running: "Đang xử lý", completed: "Hoàn tất", failed: "Không hoàn tất", cancelled: "Đã hủy" };

export default function CloudJobs({ onClose }: { onClose(): void }) {
  const user = useCdeUser();
  const [page, setPage] = useState<Page>();
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>();
  const alive = useRef(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await call<Page>("jobs.list", { limit: 10, offset });
      if (alive.current && current === sequence.current) setPage(next);
    } catch (e) { if (alive.current && current === sequence.current) setError(String(e)); }
  }, [offset]);
  useEffect(() => {
    alive.current = true;
    void reload();
    const interval = window.setInterval(() => void reload(), 5000);
    return () => { alive.current = false; sequence.current++; window.clearInterval(interval); };
  }, [reload]);

  async function act(job: Job, operation: "jobs.retry" | "jobs.cancel") {
    setBusy(job.jobId); setError("");
    try {
      await call(operation, { jobId: job.jobId });
      if (operation === "jobs.retry") {
        const { startCloudJob } = await import("./cloud");
        void startCloudJob(API, job.jobId).then(() => { if (alive.current) void reload(); }).catch(() => {
          if (alive.current) setError("Kết nối worker gián đoạn. Danh sách vẫn theo dõi trạng thái đã lưu trên cloud.");
        });
      }
      await reload();
    } catch (e) { if (alive.current) setError(String(e)); }
    finally { if (alive.current) setBusy(undefined); }
  }

  return <AccessDialog title="Tác vụ cloud của bạn" className="cloud-jobs-dialog" onClose={onClose}>
    <p>Trạng thái được lưu theo dự án và tài khoản, kể cả khi đóng tab. Chỉ tiếp tục khi worker đã hết thời gian giữ tác vụ; tối đa 3 lượt xử lý cho mỗi tác vụ.</p>
    <button type="button" className="button secondary" onClick={() => void reload()}>Cập nhật trạng thái</button>
    {error && <p role="alert">{error}</p>}
    {!page && <p role="status">Đang tải tác vụ…</p>}
    {page?.items.length === 0 && <p>Chưa có tác vụ.</p>}
    <ul className="cloud-job-list">{page?.items.map((job) => <li key={job.jobId}>
      <strong>{job.name}</strong>
      <p>{labels[job.phase] ?? job.phase}{job.stale ? " · Worker đã ngừng cập nhật" : ""} · Lượt {job.attempts}/3</p>
      <small>{new Date(job.updatedAt).toLocaleString("vi-VN")} · {job.jobId}</small>
      {job.error && <p>{job.error}</p>}
      <div className="cde-filters">
        {job.retryable && user?.role !== "viewer" && <button className="button secondary" disabled={!!busy} onClick={() => void act(job, "jobs.retry")}>Tiếp tục / thử lại</button>}
        {job.cancellable && user?.role !== "viewer" && <button className="button secondary" disabled={!!busy} onClick={() => void act(job, "jobs.cancel")}>Hủy tác vụ</button>}
        {job.phase === "completed" && <a className="button secondary" href={projectHref(selectedProject,"models") + "&job=" + encodeURIComponent(job.jobId)}>
          {job.kind === "checks" ? "Mở kết quả va chạm" : "Mở mô hình đã nhập"}
        </a>}
      </div>
    </li>)}</ul>
    {page && <nav className="cde-filters" aria-label="Phân trang tác vụ">
      <button className="button secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 10))}>Trước</button>
      <span>{page.total ? offset + 1 : 0}–{Math.min(offset + 10,page.total)} / {page.total}</span>
      <button className="button secondary" disabled={offset + 10 >= page.total} onClick={() => setOffset(offset + 10)}>Sau</button>
    </nav>}
  </AccessDialog>;
}
