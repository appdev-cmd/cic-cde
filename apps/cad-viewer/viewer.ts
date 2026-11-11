import { AcApDocManager, AcEdOpenMode } from "@mlightcad/cad-simple-viewer";
import { AcDbDatabaseConverterManager, AcDbFileType, acdbHostApplicationServices } from "@mlightcad/data-model";
import { AcDbLibreDwgConverter } from "@mlightcad/libredwg-converter";
import "./viewer.css";

const origin = location.origin;

function setupLayoutPicker(manager: AcApDocManager) {
  const database = manager.mdiActiveDocument.database;
  const layouts = [...database.objects.layout.entries()]
    .map(([, layout]) => layout)
    .sort((first, second) => first.tabOrder - second.tabOrder);
  if (layouts.length < 2) return;
  const picker = document.querySelector<HTMLSelectElement>("#cad-layout")!;
  const layoutManager = acdbHostApplicationServices().layoutManager;
  for (const layout of layouts) {
    picker.add(new Option(layout.layoutName, layout.layoutName));
  }
  picker.value = layoutManager.findActiveLayout();
  picker.addEventListener("change", () => {
    layoutManager.setCurrentLayout(picker.value, database);
    picker.value = layoutManager.findActiveLayout();
  });
  picker.hidden = false;
}

let opening = false;
window.addEventListener("message", async (event: MessageEvent) => {
  if (opening || window.parent === window || event.source !== window.parent || event.origin !== origin) return;
  const { type, file, format } = event.data ?? {};
  if (type !== "cde-cad-open" || !(file instanceof Blob) || (format !== "dwg" && format !== "dxf")) return;
  opening = true;
  try {
    const asset = (name: string) => new URL(`cad-assets/${name}`, location.href).href;
    const dwgParser = asset("libredwg-parser-worker.js");
    const mtextRender = asset("mtext-renderer-worker.js");
    const converter = new AcDbLibreDwgConverter({ useWorker: true, parserWorkerUrl: dwgParser });
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, converter);
    AcApDocManager.createInstance({
      container: document.getElementById("cad-canvas")!,
      autoResize: true,
      disableExport: true,
      webworkerFileUrls: { dwgParser, mtextRender },
    });
    const manager = AcApDocManager.instance;
    const opened = await manager.openDocument(`drawing.${format}`, await file.arrayBuffer(), {
      mode: AcEdOpenMode.Read,
      progressiveRendering: true,
    });
    if (!opened) throw new Error("CAD reader could not open the drawing");
    setupLayoutPicker(manager);
    document.getElementById("cad-fit")!.addEventListener("click", () => manager.curView.zoomToFitDrawing());
    document.getElementById("cad-toolbar")!.hidden = false;
    window.parent.postMessage({ type: "cde-cad-loaded" }, origin);
  } catch (error) {
    console.error("CAD preview failed", error);
    window.parent.postMessage({ type: "cde-cad-error" }, origin);
  }
});
