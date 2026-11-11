import { useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import { isPlanPoint, type CadWindow, type PlanPick, type PlanPoint } from "@qabim/cad-viewer/overlay";
import {
  alignCadPoints, cadUnits, cadUnitScale, detectedCadScale, ifcPointFromPick, maxCadScale,
  minCadScale, projectIfcPoint, toCadWindow, type CadAlignment, type CadUnit,
} from "./cadAlignment";
import { cadDrawingPath, downloadCadDrawing, type CadDrawing } from "./cadStorage";
import type { CadFiles } from "./CadDirectory";
import type { CadProjectControls } from "./useProjectCadAlignment";

export type CadOverlayApi = { sync(view: CadWindow): void; pick(point: PlanPick): boolean };
type CadLayerApi = Pick<CadOverlayApi, "sync">;
type PickStage = "cad" | "ifc" | null;
type CadReader = { drawing: string; unitScale?: number };
type Calibration = { cad: PlanPoint[]; ifc: PlanPoint[] };
const noPoints: PlanPoint[] = [];

type LayerProps = {
  ref: Ref<CadLayerApi>;
  drawing: CadDrawing;
  alignment: CadAlignment;
  view: RefObject<CadWindow | null>;
  stage: PickStage;
  points: PlanPoint[];
  onPoint: (point: PlanPoint) => void;
  onCancel: () => void;
  onReady: (reader: CadReader | null) => void;
};

function CadLayer({ ref, drawing, alignment, view, stage, points, onPoint, onCancel, onReady }: LayerProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const detectedScale = useRef<number>(undefined);
  const latest = useRef(alignment);
  latest.current = alignment;
  const callbacks = useRef({ onPoint, onCancel, onReady });
  callbacks.current = { onPoint, onCancel, onReady };
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
      if (event.data?.type === "cde-cad-overlay-synced") {
        setSynced(true);
        callbacks.current.onReady({ drawing: drawing.key, unitScale: detectedScale.current });
      }
      if (event.data?.type === "cde-cad-pick-point" && isPlanPoint(event.data.point)) {
        callbacks.current.onPoint(event.data.point);
      }
      if (event.data?.type === "cde-cad-pick-cancel") callbacks.current.onCancel();
      if (event.data?.type === "cde-cad-error") {
        callbacks.current.onReady(null);
        setError("Không thể mở bản vẽ CAD để chồng lên IFC.");
      }
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
    if (!synced) return;
    frame.current?.contentWindow?.postMessage({
      type: "cde-cad-pick-mode", active: stage === "cad", points,
    }, location.origin);
  }, [points, stage, synced]);

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
          className={stage === "cad" ? "cad-overlay-frame cad-overlay-picking" : "cad-overlay-frame"}
          src={import.meta.env.BASE_URL + "cad-viewer.html"}
          title={`Lớp CAD ${drawing.name}`}
          aria-hidden={stage !== "cad"}
          tabIndex={-1}
          style={{ opacity: stage === "cad" ? 1 : synced && stage !== "ifc" && alignment.visible ? alignment.opacity : 0 }}
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

function OffsetInput({ label, value, onChange, limit, minimum = -limit }: {
  label: string; value: number; onChange: (value: number) => void; limit: number; minimum?: number;
}) {
  return (
    <label>
      {label}
      <input type="number" step="any" min={minimum} max={limit} defaultValue={value} key={value}
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

export default function CadOverlay({ ref, alignment, floor, view, project, files, reloadFiles, onChange, onClose }: {
  ref: Ref<CadOverlayApi>;
  alignment: CadAlignment;
  floor: string;
  view: RefObject<CadWindow | null>;
  project: CadProjectControls;
  files: CadFiles;
  reloadFiles: () => void;
  onChange: (update: Partial<CadAlignment>) => void;
  onClose: () => void;
}) {
  const { drawings, status } = files;
  const drawing = drawings.find((item) => item.key === alignment.drawing);
  const layer = useRef<CadLayerApi>(null);
  const [reader, setReader] = useState<CadReader | null>(null);
  const calibration = useRef<Calibration>(null);
  const [picks, setPicks] = useState<Calibration | null>(null);
  const [markerView, setMarkerView] = useState<CadWindow | null>(null);
  const [pickError, setPickError] = useState("");
  const [preview, setPreview] = useState(false);
  const stage: PickStage = !picks ? null : picks.cad.length < 2 ? "cad" : "ifc";

  function setCalibration(next: Calibration | null) {
    calibration.current = next;
    setPicks(next);
  }

  function cancelCalibration() {
    setCalibration(null);
    setPickError("");
  }

  function collectCad(point: PlanPoint) {
    const current = calibration.current;
    if (!current || current.cad.length >= 2) return;
    const first = current.cad[0];
    if (first && Math.hypot(first.x - point.x, first.y - point.y) < 1e-9) {
      setPickError("Chọn điểm CAD thứ hai ở vị trí khác điểm thứ nhất.");
      return;
    }
    setPickError("");
    setCalibration({ ...current, cad: [...current.cad, point] });
  }

  function collectIfc(pick: PlanPick) {
    const current = calibration.current;
    if (!current) return false;
    if (current.cad.length !== 2) return true;
    const point = ifcPointFromPick(pick, alignment.rotation);
    const first = current.ifc[0];
    setMarkerView(pick.view);
    if (!first) {
      setCalibration({ ...current, ifc: [point] });
      return true;
    }
    const result = alignCadPoints([current.cad[0], current.cad[1]], [first, point],
      cadUnitScale(alignment.unit, reader?.unitScale));
    if (!result) {
      setPickError("Không tính được phép căn. Chọn điểm IFC thứ hai ở xa hơn hoặc kiểm tra đơn vị CAD.");
      return true;
    }
    cancelCalibration();
    onChange({ ...result, visible: true });
    setPreview(true);
    return true;
  }

  useImperativeHandle(ref, () => ({
    sync(window) {
      layer.current?.sync(window);
      if (calibration.current?.ifc.length) setMarkerView(window);
    },
    pick: collectIfc,
  }));

  useEffect(() => {
    cancelCalibration();
    setPreview(false);
  }, [alignment.drawing]);

  useEffect(() => {
    if (!stage) return;
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") cancelCalibration();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [stage]);

  return (
    <>
      {drawing && (
        <CadLayer key={drawing.key} ref={layer} drawing={drawing} alignment={alignment} view={view}
          stage={stage} points={picks?.cad ?? noPoints} onPoint={collectCad} onCancel={cancelCalibration} onReady={setReader} />
      )}
      {stage === "ifc" && markerView && picks?.ifc.map((point, index) => {
        const { u, v } = projectIfcPoint(point, markerView, alignment.rotation);
        return <span className="ifc-pick-marker" key={index} aria-hidden="true"
          style={{ left: `${u * 100}%`, top: `${v * 100}%` }}>{index + 1}</span>;
      })}
      <section className="cad-overlay-panel" aria-labelledby="cad-overlay-title">
        <header>
          <h2 id="cad-overlay-title">Đối chiếu CAD · {floor}</h2>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        {status === "loading" && <p role="status">Đang tải danh sách bản vẽ…</p>}
        {status === "error" && <p role="alert">
          Không tải được danh sách. <button type="button" onClick={reloadFiles}>Thử lại</button>
        </p>}
        {stage && (
          <div className="cad-calibration-active">
            <strong role="status">{stage === "cad" ? `CAD · Chọn điểm ${(picks?.cad.length ?? 0) + 1}` :
              `IFC · Chọn điểm ${(picks?.ifc.length ?? 0) + 1}`}</strong>
            <p>{stage === "cad" ? "Cuộn để thu phóng, kéo bằng nút giữa để di chuyển." :
              "Chọn các điểm tương ứng theo đúng thứ tự trên CAD."}</p>
            {pickError && <p role="alert">{pickError}</p>}
            <button type="button" onClick={cancelCalibration}>Hủy căn chỉnh</button>
          </div>
        )}
        {!stage && project.canEdit && drawing && (
          <button type="button" className="button secondary cad-calibrate-button"
            disabled={reader?.drawing !== drawing.key || project.saving || project.loading}
            onClick={() => {
              setPreview(false);
              setMarkerView(view.current);
              setCalibration({ cad: [], ifc: [] });
            }}>Căn bằng 2 điểm</button>
        )}
        {!stage && preview && project.dirty && <p role="status">Đã căn bằng 2 điểm. Kiểm tra lớp chồng rồi lưu vào dự án.</p>}
        <fieldset disabled={project.saving || Boolean(stage)}>
        {status === "ready" && (
          <label>
            Bản vẽ của tầng
            <select value={alignment.drawing} onChange={(event) => onChange({ drawing: event.target.value })}
              disabled={!drawings.length && !alignment.drawing}>
              <option value="">{project.stored ? "Bỏ gán bản vẽ" : "Chọn DWG hoặc DXF"}</option>
              {alignment.drawing && !drawing && <option value={alignment.drawing} disabled>Bản vẽ không còn trong hồ sơ</option>}
              {drawings.map((item) => <option value={item.key} key={item.key}>{cadDrawingPath(item)}</option>)}
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
              <OffsetInput label="Hệ số tỷ lệ" value={alignment.scale ?? 1} minimum={minCadScale} limit={maxCadScale}
                onChange={(scale) => onChange({ scale })} />
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
        </fieldset>
        <footer className="cad-overlay-project">
          {project.loadError && <p role="alert">
            Không tải được cấu hình dự án. <button type="button" onClick={() => void project.reload()}>Thử lại</button>
          </p>}
          {project.conflict ? (
            <p role="alert">Cấu hình tầng đã thay đổi. <button type="button" disabled={project.loading}
              onClick={() => void project.useSaved()}>Dùng cấu hình dự án</button></p>
          ) : project.error && <p role="alert">{project.error}</p>}
          {project.loading ? <p role="status">Đang tải cấu hình dự án…</p> : !project.loadError && !project.conflict && (
            <p role="status">
              {project.saving ? "Đang lưu cấu hình…" :
                project.dirty ? (project.canEdit ? "Có thay đổi chưa lưu vào dự án." : "Căn chỉnh tạm trong phiên này.") :
                  project.stored ? "Đã lưu vào dự án." : project.cleared ? "Đã bỏ gán bản vẽ của tầng." : "Tầng chưa có cấu hình chung."}
            </p>
          )}
          {project.canEdit && (
            <button type="button" className="button primary" disabled={!project.canSave || Boolean(stage)}
              onClick={() => void project.save()}>Lưu vào dự án</button>
          )}
        </footer>
      </section>
    </>
  );
}
