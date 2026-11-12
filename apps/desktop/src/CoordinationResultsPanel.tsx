import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronDown, Maximize2, Minimize2 } from "lucide-react";

type Props = {
  open: boolean;
  onToggle: () => void;
  viewer: RefObject<HTMLDivElement | null>;
  tabs: ReactNode;
  coverage: ReactNode;
  children: ReactNode;
};

function measure(panel: HTMLElement, viewer: HTMLDivElement) {
  const style = getComputedStyle(panel);
  const height = panel.offsetHeight;
  const min = parseFloat(style.minHeight);
  const viewerMin = parseFloat(style.getPropertyValue("--results-viewer-min"));
  return { height, min, max: Math.max(min, height + viewer.offsetHeight - viewerMin) };
}

export default function CoordinationResultsPanel({ open, onToggle, viewer, tabs, coverage, children }: Props) {
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const drag = useRef<{ pointerId: number; y: number; height: number; min: number; max: number } | null>(null);
  const [size, setSize] = useState<"default" | "expanded" | number>("default");
  const [bounds, setBounds] = useState<ReturnType<typeof measure>>();
  const custom = typeof size === "number";

  useEffect(() => {
    const section = panel.current;
    const workspace = viewer.current;
    if (!open || !section || !workspace) return;
    const update = () => {
      const next = measure(section, workspace);
      setBounds((old) => old?.height === next.height && old.min === next.min && old.max === next.max ? old : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(section);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [open, viewer]);

  return (
    <section
      id={panelId}
      ref={panel}
      className={`results-panel${!open ? " collapsed" : size === "expanded" ? " expanded" : custom ? " resized" : ""}`}
      style={open && custom ? { height: size } : undefined}
    >
      {open && (
        <div
          className="results-resize-handle"
          role="separator"
          tabIndex={0}
          aria-label="Chiều cao bảng kết quả"
          aria-orientation="horizontal"
          aria-controls={panelId}
          aria-valuemin={bounds?.min}
          aria-valuemax={bounds?.max}
          aria-valuenow={bounds?.height}
          aria-valuetext={bounds && `${bounds.height} pixel`}
          title="Kéo để chỉnh chiều cao bảng"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0 || !panel.current || !viewer.current) return;
            drag.current = {
              pointerId: event.pointerId,
              y: event.clientY,
              ...measure(panel.current, viewer.current),
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const height = start.height + start.y - event.clientY;
            setSize(Math.max(start.min, Math.min(start.max, height)));
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = null;
          }}
          onKeyDown={(event) => {
            if (!panel.current || !viewer.current) return;
            const { height, min, max } = measure(panel.current, viewer.current);
            let next: number;
            switch (event.key) {
              case "ArrowUp": next = height + 24; break;
              case "ArrowDown": next = height - 24; break;
              case "Home": next = min; break;
              case "End": next = max; break;
              default: return;
            }
            event.preventDefault();
            setSize(Math.max(min, Math.min(max, next)));
          }}
        />
      )}
      <div className="results-heading">
        <div className="results-tabs">{tabs}</div>
        <div className="results-actions">
          {coverage}
          {open && (
            <button
              type="button"
              className="results-size-button"
              onClick={() => setSize(size === "default" ? "expanded" : "default")}
            >
              {size === "default" ? <Maximize2 size={14} aria-hidden="true" /> : <Minimize2 size={14} aria-hidden="true" />}
              {size === "default" ? "Mở rộng bảng" : "Về kích thước mặc định"}
            </button>
          )}
          <button
            type="button"
            className="icon-button small"
            aria-label={open ? "Thu gọn kết quả" : "Mở kết quả"}
            aria-expanded={open}
            onClick={onToggle}
          >
            <ChevronDown className={open ? "" : "flipped"} size={16} />
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}
