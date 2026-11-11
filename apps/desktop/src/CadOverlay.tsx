import { useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import type { CadWindow } from "@qabim/cad-viewer/overlay";
import { cadUnits, detectedCadScale, toCadWindow, type CadAlignment, type CadUnit } from "./cadAlignment";
import { downloadCadDrawing, listCadDrawings, type CadDrawing } from "./cadStorage";

export type CadOverlayApi = { sync(view: CadWindow): void };

type LayerProps = {
  ref: Ref<CadOverlayApi>;
  drawing: CadDrawing;
  alignment: CadAlignment;
  view: RefObject<CadWindow | null>;
};

function CadLayer({ ref, drawing, alignment, view }: LayerProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const detectedScale = useRef<number>(undefined);
  const latest = useRef(alignment);
  latest.current = alignment;
  const [file, setFile] = useState<Blob>();
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  function sync(window: CadWindow) {
    if (!ready.current) return;
    frame.current?.contentWindow?.postMessage({
      type: "cde-cad-overlay-window",
      window: toCadWindow(window, latest.current, detectedScale.current),
    }, location.origin);
  }

  useImperativeHandle(ref, () => ({ sync }), []);

  useEffect(() => {
    const request = new AbortController();
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "cde-cad-overlay-ready") {
        detectedScale.current = detectedCadScale(event.data.units);
        ready.current = true;
        if (view.current) sync(view.current);
      }
      if (event.data?.type === "cde-cad-overlay-synced") setSynced(true);
      if (event.data?.type === "cde-cad-error") setError("Không thể mở bản vẽ CAD để chồng lên IFC.");
    }
    window.addEventListener("message", receive);
    void downloadCadDrawing(drawing, request.signal).then((blob) => {
      if (!request.signal.aborted) setFile(blob);
    }).catch(() => {
      if (!request.signal.aborted) setError("Không thể tải bản vẽ CAD từ hồ sơ dự án.");
    });
    return () => {
      request.abort();
      ready.current = false;
      window.removeEventListener("message", receive);
    };
  }, [drawing, retry, view]);

  useEffect(() => {
    if (view.current) sync(view.current);
  }, [alignment, view]);

  useEffect(() => {
    if (!file || synced || error) return;
    const timer = window.setTimeout(() => setError("Trình xem mất quá nhiều thời gian để mở bản vẽ."), 60_000);
    return () => window.clearTimeout(timer);
  }, [file, synced, error]);

  return (
    <>
      {file && !error && (
        <iframe
          ref={frame}
          className="cad-overlay-frame"
          src={import.meta.env.BASE_URL + "cad-viewer.html"}
          title={`Lớp CAD ${drawing.name}`}
          aria-hidden="true"
          tabIndex={-1}
          style={{ opacity: synced && alignment.visible ? alignment.opacity : 0 }}
          onLoad={() => frame.current?.contentWindow?.postMessage({
            type: "cde-cad-overlay-open", file, format: drawing.format,
          }, location.origin)}
        />
      )}
      {error ? (
        <div className="cad-overlay-status" role="alert">
          {error} <button type="button" onClick={() => {
            setFile(undefined);
            setSynced(false);
            setError("");
            setRetry((attempt) => attempt + 1);
          }}>Thử lại</button>
        </div>
      ) : !synced && <p className="cad-overlay-status" role="status">Đang mở lớp CAD…</p>}
    </>
  );
}

function OffsetInput({ label, value, onChange, limit }: {
  label: string; value: number; onChange: (value: number) => void; limit: number;
}) {
  return (
    <label>
      {label}
      <input type="number" step="any" min={-limit} max={limit} defaultValue={value} key={value}
        onBlur={(event) => {
          const input = event.currentTarget;
          if (input.validity.valid && Number.isFinite(input.valueAsNumber)) onChange(input.valueAsNumber);
          else input.value = String(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

export default function CadOverlay({ ref, alignment, floor, view, onChange, onClose }: {
  ref: Ref<CadOverlayApi>;
  alignment: CadAlignment;
  floor: string;
  view: RefObject<CadWindow | null>;
  onChange: (update: Partial<CadAlignment>) => void;
  onClose: () => void;
}) {
  const [drawings, setDrawings] = useState<CadDrawing[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const drawing = drawings.find((item) => item.key === alignment.drawing);

  useEffect(() => {
    const request = new AbortController();
    void listCadDrawings(request.signal).then((result) => {
      if (!request.signal.aborted) {
        setDrawings(result);
        setStatus("ready");
      }
    }).catch(() => {
      if (!request.signal.aborted) setStatus("error");
    });
    return () => request.abort();
  }, [retry]);

  return (
    <>
      {drawing && <CadLayer key={drawing.key} ref={ref} drawing={drawing} alignment={alignment} view={view} />}
      <section className="cad-overlay-panel" aria-labelledby="cad-overlay-title">
        <header>
          <h2 id="cad-overlay-title">Đối chiếu CAD · {floor}</h2>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        {status === "loading" && <p role="status">Đang tải danh sách bản vẽ…</p>}
        {status === "error" && <p role="alert">
          Không tải được danh sách. <button type="button" onClick={() => {
            setStatus("loading");
            setRetry((attempt) => attempt + 1);
          }}>Thử lại</button>
        </p>}
        {status === "ready" && (
          <label>
            Bản vẽ của tầng
            <select value={drawing?.key ?? ""} onChange={(event) => onChange({ drawing: event.target.value })}
              disabled={!drawings.length}>
              <option value="">Chọn DWG hoặc DXF</option>
              {drawings.map((item) => <option value={item.key} key={item.key}>{item.name}</option>)}
            </select>
          </label>
        )}
        {status === "ready" && !drawings.length && <p>Tải DWG/DXF lên tại <a href="?cde=1">Hồ sơ → Bản vẽ CAD</a>.</p>}
        {drawing && (
          <>
            <div className="cad-overlay-fields" key={floor}>
              <label>
                Đơn vị CAD
                <select value={alignment.unit} onChange={(event) => onChange({ unit: event.target.value as CadUnit })}>
                  <option value="auto">Tự nhận · mặc định mm</option>
                  {Object.keys(cadUnits).map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                </select>
              </label>
              <OffsetInput label="Góc xoay (°)" value={alignment.rotation} limit={360}
                onChange={(rotation) => onChange({ rotation })} />
              <OffsetInput label="Dịch X (m)" value={alignment.x} limit={1e9} onChange={(x) => onChange({ x })} />
              <OffsetInput label="Dịch Y (m)" value={alignment.y} limit={1e9} onChange={(y) => onChange({ y })} />
            </div>
            <label className="cad-overlay-opacity">
              Độ đậm CAD
              <input type="range" min="0" max="1" step="0.05" value={alignment.opacity}
                onChange={(event) => onChange({ opacity: event.target.valueAsNumber })} />
            </label>
            <label className="cad-overlay-visible">
              <input type="checkbox" checked={alignment.visible}
                onChange={(event) => onChange({ visible: event.target.checked })} />
              Hiện CAD
            </label>
          </>
        )}
      </section>
    </>
  );
}
