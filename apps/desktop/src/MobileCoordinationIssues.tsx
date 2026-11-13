import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Box, ChevronRight } from "lucide-react";
import { findingDistance, findingTitle, issueCode, issueLabels, issuePriorities, issueTitle } from "./coordinationPresentation";
import type { CoordinationIssue, IssueState } from "./types";

type Props = {
  projectName?: string;
  issues: CoordinationIssue[];
  selected: CoordinationIssue | undefined;
  ready: boolean;
  error: string;
  onRetry: () => void;
  onCreate?: () => void;
  onSelect: (id: number | null) => void;
  onView: (issue?: CoordinationIssue) => void;
  children: ReactNode;
};

export default function MobileCoordinationIssues({
  projectName, issues, selected, ready, error, onRetry, onCreate, onSelect, onView, children,
}: Props) {
  const [filter, setFilter] = useState<IssueState | "">("");
  const focusReturn = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId !== undefined) heading.current?.focus({ preventScroll: true });
  }, [selectedId]);
  const visible = filter ? issues.filter((issue) => issue.state === filter) : issues;

  return (
    <main className="mobile-coordination">
      {selected ? (
        <>
          <button type="button" className="mobile-coordination-back" onClick={() => {
            focusReturn.current = selected.id;
            onSelect(null);
          }}>
            <ArrowLeft size={17} aria-hidden="true" /> Danh sách vấn đề
          </button>
          <div className="mobile-coordination-meta">
            <span className="coordination-code">{issueCode(selected.id)}</span>
            <span className="coordination-badge" data-state={selected.state}>{issueLabels[selected.state]}</span>
          </div>
          <h1 tabIndex={-1} ref={heading}>
            {selected.finding ? findingTitle(selected.finding) : issueTitle(selected)}
          </h1>
          {selected.finding && <button type="button" className="mobile-coordination-view" onClick={() => onView(selected)}>
            <Box size={21} aria-hidden="true" />
            <span><strong>Xem góc nhìn 3D</strong><small>Va chạm {selected.finding.id}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>}
          {selected.manual && <p className="manual-issue-description">{selected.manual.description}</p>}
          <dl className="coordination-facts">
            <div><dt>Đơn vị phụ trách</dt><dd>{selected.assignee || "Chưa giao"}</dd></div>
            {selected.assignedUsername && <div><dt>Người phụ trách</dt><dd>{selected.assignedUsername}</dd></div>}
            {selected.dueDate && <div><dt>Hạn xử lý</dt><dd>{new Date(selected.dueDate + "T00:00:00").toLocaleDateString("vi-VN")}</dd></div>}
            {selected.finding && <div><dt>Tầng</dt><dd>{selected.finding.storey || "Chưa xác định"}</dd></div>}
            {selected.finding && findingDistance(selected.finding) && <div><dt>Độ giao cắt</dt><dd>{findingDistance(selected.finding)}</dd></div>}
            {selected.manual && <>
              {selected.manual.location && <div><dt>Vị trí</dt><dd>{selected.manual.location}</dd></div>}
              <div><dt>Mức ưu tiên</dt><dd>{issuePriorities[selected.manual.priority]}</dd></div>
              <div><dt>Người tạo</dt><dd>{selected.manual.author}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{new Date(selected.manual.createdAt).toLocaleString("vi-VN")}</dd></div>
            </>}
          </dl>
          {selected.finding && <details className="coordination-elements"><summary>Cấu kiện IFC</summary><p>{selected.finding.title}</p></details>}
        </>
      ) : (
        <>
          <header className="mobile-coordination-title">
            <div>{projectName && <small>{projectName}</small>}<h1>Vấn đề phối hợp</h1></div>
            <button type="button" className="button secondary" onClick={() => onView()}>
              <Box size={16} aria-hidden="true" /> Mô hình
            </button>
          </header>
          {onCreate && <button type="button" className="button primary" onClick={onCreate}>Tạo vấn đề</button>}
          <label className="mobile-coordination-filter">
            <span aria-live="polite">{ready ? `${visible.length} vấn đề` : "Trạng thái"}</span>
            <select value={filter} aria-label="Lọc trạng thái vấn đề" onChange={(event) => setFilter(event.target.value as IssueState | "")}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(issueLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {error && <div role="alert" className="mobile-coordination-notice">
            <p>{error}</p><button type="button" className="button secondary" onClick={onRetry}>Thử lại</button>
          </div>}
          {!ready && !error && <p role="status" className="mobile-coordination-notice">Đang tải vấn đề phối hợp…</p>}
          {ready && !visible.length && <p className="mobile-coordination-notice">
            {filter ? "Không có vấn đề ở trạng thái này." : "Chưa có vấn đề phối hợp."}
          </p>}
          <ul className="mobile-coordination-list">
            {visible.map((issue) => (
              <li key={issue.id}>
                <button type="button" onClick={() => onSelect(issue.id)}
                  ref={(element) => {
                    if (element && focusReturn.current === issue.id) {
                      element.focus({ preventScroll: true });
                      focusReturn.current = null;
                    }
                  }}>
                  <span className="mobile-coordination-meta">
                    <span className="coordination-code">{issueCode(issue.id)}</span>
                    <span className="coordination-badge" data-state={issue.state}>{issueLabels[issue.state]}</span>
                  </span>
                  <strong>{issue.finding ? findingTitle(issue.finding) : issueTitle(issue)}</strong>
                  <span className="mobile-coordination-meta">
                    <span>{[issue.finding?.storey || issue.manual?.location, issue.assignedUsername || issue.assignee || "Chưa giao"].filter(Boolean).join(" · ")}</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {children}
    </main>
  );
}
