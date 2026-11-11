import { useEffect, useRef, useState } from "react";
import { downloadCadDrawing, type CadDrawing } from "./cadStorage";

export default function CadFilePreview({ drawing }: { drawing: CadDrawing }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [file, setFile] = useState<Blob>();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "cde-cad-loaded") setLoaded(true);
      if (event.data?.type === "cde-cad-error") {
        setError("Không thể hiển thị bản vẽ. Hãy kiểm tra file hoặc thử lại bằng bản DXF.");
      }
    }
    window.addEventListener("message", receive);
    void downloadCadDrawing(drawing, request.signal).then((blob) => {
      if (!request.signal.aborted) setFile(blob);
    }).catch(() => {
      if (!request.signal.aborted) setError("Không thể tải bản vẽ từ hồ sơ dự án.");
    });
    return () => {
      request.abort();
      window.removeEventListener("message", receive);
    };
  }, [drawing]);

  useEffect(() => {
    if (!file || loaded || error) return;
    const timer = window.setTimeout(() => setError("Trình xem mất quá nhiều thời gian để mở bản vẽ."), 60_000);
    return () => window.clearTimeout(timer);
  }, [file, loaded, error]);

  return (
    <>
      {error && <p className="cde-message" role="alert">{error}</p>}
      {!error && !loaded && <p className="cde-cad-loading" role="status">{file ? "Đang mở bản vẽ…" : "Đang tải bản vẽ…"}</p>}
      {file && !error && (
        <iframe
          ref={frame}
          src={import.meta.env.BASE_URL + "cad-viewer.html"}
          title={`Trình xem ${drawing.name}`}
          onLoad={() => frame.current?.contentWindow?.postMessage({
            type: "cde-cad-open", file, format: drawing.format,
          }, location.origin)}
        />
      )}
    </>
  );
}
