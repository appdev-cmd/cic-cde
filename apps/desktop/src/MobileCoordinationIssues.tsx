import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Box, ChevronRight } from "lucide-react";
import { findingDistance, findingTitle, issueCode, issueLabels } from "./coordinationPresentation";
import type { CoordinationIssue, IssueState } from "./types";

type Props = {
  projectName: string;
  issues: CoordinationIssue[];
  selected: CoordinationIssue | undefined;
  ready: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (id: number | null) => void;
  onView: (issue?: CoordinationIssue) => void;
  children: ReactNode;
};

export default function MobileCoordinationIssues({
  projectName, issues, selected, ready, error, onRetry, onSelect, onView, children,
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
            {findingTitle(selected.finding)}
          </h1>
          <button type="button" className="mobile-coordination-view" onClick={() => onView(selected)}>
            <Box size={21} aria-hidden="true" />
            <span><strong>Xem góc nhìn 3D</strong><small>Va chạm {selected.finding.id}</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <dl className="coordination-facts">
            <div><dt>Đơn vị phụ trách</dt><dd>{selected.assignee || "Chưa giao"}</dd></div>
            <div><dt>Tầng</dt><dd>{selected.finding.storey || "Chưa xác định"}</dd></div>
            {findingDistance(selected.finding) && <div><dt>Độ giao cắt</dt><dd>{findingDistance(selected.finding)}</dd></div>}
            <div><dt>Thảo luận</dt><dd>{selected.comments.length} bình luận</dd></div>
          </dl>
          <details className="coordination-elements"><summary>Cấu kiện IFC</summary><p>{selected.finding.title}</p></details>
          {children}
        </>
      ) : (
        <>
          <header className="mobile-coordination-title">
            <div><small>{projectName}</small><h1>Vấn đề phối hợp</h1></div>
            <button type="button" className="button secondary" onClick={() => onView()}>
              <Box size={16} aria-hidden="true" /> Mô hình
            </button>
          </header>
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
                  <strong>{findingTitle(issue.finding)}</strong>
                  <span className="mobile-coordination-meta">
                    <span>{issue.finding.storey || "Chưa xác định tầng"} · {issue.assignee || "Chưa giao"}</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
