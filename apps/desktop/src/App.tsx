import { useCdeUser, type WorkspaceControls } from "./AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Box,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Command,
  Cuboid,
  Crosshair,
  Eye,
  EyeOff,
  FileBox,
  Filter,
  Focus,
  Grid2X2,
  Layers3,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  MousePointer2,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Ruler,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Terminal,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import Viewer from "./Viewer";
import { groupByStorey, spaceKey, spaceLabel, storeyLabel } from "./spatial";
import {
  call,
  importIfc,
  loadWorkspace,
  waitImport,
  localDesktop,
  remoteDesktop,
} from "./bridge";
import type {
  CheckRun,
  CoordinationIssue,
  IssueState,
  Finding,
  ViewerApi,
  ViewMode,
  Workspace,
} from "./types";

const issueLabels: Record<IssueState, string> = {
  Open: "Mới",
  InProgress: "Đang xử lý",
  Review: "Chờ kiểm lại",
  Closed: "Đã đóng",
};
const issueTransitions: Record<IssueState, IssueState[]> = {
  Open: ["InProgress"],
  InProgress: ["Review"],
  Review: ["Closed", "InProgress"],
  Closed: ["Open"],
};

const EMPTY: Workspace = {
  models: [],
  elements: [],
  findings: [],
  synthetic: true,
};
function mergeImported(
  previous: Workspace,
  imported: {
    model: Workspace["models"][number];
    elements: Workspace["elements"];
  },
): Workspace {
  if (previous.models.some((model) => model.id === imported.model.id))
    return {
      ...previous,
      models: previous.models.map((model) =>
        model.id === imported.model.id ? imported.model : model,
      ),
      elements: [
        ...previous.elements.filter(
          (element) => element.modelId !== imported.model.id,
        ),
        ...imported.elements,
      ],
    };
  return {
    ...previous,
    models: [...previous.models, imported.model],
    elements: [...previous.elements, ...imported.elements],
  };
}
const NAV = [
  { id: "models", label: "Mô hình", icon: Boxes },
  { id: "checks", label: "Kiểm tra", icon: ShieldCheck },
  { id: "issues", label: "Issues", icon: ClipboardList },
  { id: "data", label: "Dữ liệu", icon: Grid2X2 },
];
type Nav = "models" | "checks" | "issues" | "data";
type Message = { role: "user" | "assistant"; text: string };
function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`tool-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function App({ project, account }: WorkspaceControls) {
  const projectUser = useCdeUser();
  const projectName = projectUser?.projectName || "Riverside Tower";
  const readOnly = projectUser?.role === "viewer";
  const [data, setData] = useState<Workspace>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [nav, setNav] = useState<Nav>(() =>
    new URLSearchParams(window.location.search).has("cde")
      ? "issues"
      : "models",
  );
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [floor, setFloorValue] = useState("all");
  const [room, setRoom] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [expandedStoreys, setExpandedStoreys] = useState<Set<string>>(
    new Set(),
  );
  const setFloor = useCallback((value: string) => {
    setFloorValue(value);
    setRoom(null);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [finding, setFinding] = useState<Finding | null>(null);
  const focusPoint = useMemo<[number, number, number] | null>(
    () =>
      finding?.pointA && finding?.pointB
        ? (finding.pointA.map((n, i) => (n + finding.pointB![i]) / 2) as [
            number,
            number,
            number,
          ])
        : null,
    [finding],
  );
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ViewMode>("solid");
  const [section, setSection] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [bottom, setBottom] = useState(true);
  const [left, setLeft] = useState(true);
  const [assistant, setAssistant] = useState(false);
  const [modal, setModal] = useState<
    "check" | "settings" | "help" | "alignment" | null
  >(null);
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const importController = useRef<AbortController | null>(null);
  const [importPhase, setImportPhase] = useState({
    label: "",
    cancellable: true,
  });
  const [geometryProgress, setGeometryProgress] = useState({
    done: 0,
    total: 0,
  });
  const [geometryStopped, setGeometryStopped] = useState(false);
  const [geometryAttempt, setGeometryAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkModelsA, setCheckModelsA] = useState<string[]>(["demo"]);
  const [checkModelsB, setCheckModelsB] = useState<string[]>(["demo"]);
  const [geometryLoading, setGeometryLoading] = useState(false);
  const [geometryStats, setGeometryStats] = useState<{
    durationMs: number;
    added: number;
  } | null>(null);
  const [alignmentModel, setAlignmentModel] = useState("");
  const [alignmentOffset, setAlignmentOffset] = useState<
    [number, number, number]
  >([0, 0, 0]);
  const [alignmentAngle, setAlignmentAngle] = useState(0);
  const [aligning, setAligning] = useState(false);
  const [classA, setClassA] = useState("IfcDuctSegment");
  const [classB, setClassB] = useState("IfcBeam");
  const [tolerance, setTolerance] = useState(2);
  const [checkRun, setCheckRun] = useState<CheckRun | null>(null);
  const [issues, setIssues] = useState<CoordinationIssue[]>([]);
  const [activeIssueId, setActiveIssueId] = useState<number | null>(null);
  const activeIssue = issues.find((issue) => issue.id === activeIssueId);
  const [comment, setComment] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);
  const issueRequest = useRef(0);
  const loadIssues = useCallback(
    async (operation = "issues.list", input = {}) => {
      const request = ++issueRequest.current;
      const next = await call<CoordinationIssue[]>(operation, input);
      if (operation !== "issues.list") {
        issueRequest.current++;
        setIssues(next);
      } else if (request === issueRequest.current) {
        setIssues(next);
      }
      return next;
    },
    [],
  );
  useEffect(() => {
    if (nav !== "issues" || !connected) return;
    const refresh = () => {
      void loadIssues().catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [nav, connected, loadIssues]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const inputFile = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const viewer = useRef<ViewerApi>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  useEffect(() => {
    let active = true;
    loadWorkspace()
      .then(({ data, connected }) => {
        if (active) {
          setData(data);
          const modelId = new URLSearchParams(window.location.search).get(
            "model",
          );
          if (modelId && data.models.some((model) => model.id === modelId)) {
            setHidden(
              new Set(
                data.models
                  .filter((model) => model.id !== modelId)
                  .map((model) => model.id),
              ),
            );
          }
          setConnected(connected);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          notify(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    const timer = setInterval(() => {
      call("health")
        .then(async () => {
          setConnected(true);
          if (remoteDesktop) {
            const current = await call<Workspace>("workspace.get");
            setData((previous) =>
              JSON.stringify(previous.models) === JSON.stringify(current.models)
                ? previous
                : { ...current, findings: [] },
            );
          }
        })
        .catch(() => setConnected(false));
    }, 8000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistant((v) => !v);
      }
      if (e.key === "Escape") {
        setModal(null);
        setFinding(null);
        setSelected(null);
        setFocusIds([]);
        setMeasure(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  const elementsById = useMemo(
    () => new Map(data.elements.map((element) => [element.id, element])),
    [data.elements],
  );
  const element = selected ? elementsById.get(selected) : undefined;
  const storeys = useMemo(() => groupByStorey(data.elements), [data.elements]);
  const currentRoom = storeys
    .find((storey) => storey.name === floor)
    ?.rooms.find(([key]) => key === room)?.[1];
  const scopeLabel =
    currentRoom?.label ??
    (floor === "all" ? "Tất cả các tầng" : storeyLabel(floor));
  const scopedElements = data.elements.filter(
    (e) =>
      (floor === "all" || e.storey === floor) &&
      (room === null || spaceKey(e) === room),
  );
  const filteredElements = scopedElements.filter(
    (e) =>
      !search ||
      `${e.name} ${e.ifcClass} ${e.globalId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const findings = data.findings.filter((f) => {
    const source = elementsById.get(f.a);
    return (
      (floor === "all" || (source?.storey ?? f.storey) === floor) &&
      (room === null || (source && spaceKey(source) === room)) &&
      (status === "all" || f.status === status)
    );
  });
  function chooseSpace(storey: string, key: string | null = null) {
    setFloorValue(storey);
    setRoom(key);
    setSelected(null);
    setFocusIds([]);
    setFinding(null);
    setFitRequest((request) => request + 1);
  }
  const openFinding = useCallback(
    (f: Finding) => {
      setFinding(f);
      setSelected(f.a);
      setFloor(elementsById.get(f.a)?.storey ?? f.storey);
      setHidden((previous) => {
        const next = new Set(previous);
        for (const id of [f.a, f.b]) {
          const modelId = elementsById.get(id)?.modelId;
          if (modelId) next.delete(modelId);
        }
        return next;
      });
      setFocusIds([f.a, f.b]);
      setMode("xray");
    },
    [elementsById, setFloor],
  );
  const selectElement = useCallback((id: string | null) => setSelected(id), []);
  const handleMeasure = useCallback(
    (d: number) => {
      setDistance(d);
      notify(`Khoảng cách hai điểm: ${d.toFixed(3)} m`);
    },
    [notify],
  );
  const toggleModel = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reset = () => {
    setFloor("all");
    setHidden(new Set());
    setFocusIds([]);
    setFinding(null);
    setSelected(null);
    setSection(false);
    setMeasure(false);
    setMode("solid");
    setTimeout(() => viewer.current?.fit(), 0);
  };
  const importFile = async (file: File) => {
    setImporting(true);
    const controller = new AbortController();
    importController.current = controller;
    try {
      const imported = await importIfc(file, controller.signal, setImportPhase);
      setData((prev) => mergeImported(prev, imported));
      setFloor("all");
      notify(
        `Đã nhập ${imported.elements.length} cấu kiện${(imported.coverage?.failed.length ?? 0) ? ` · ${imported.coverage?.failed.length ?? 0} lỗi hình học` : ""}`,
      );
    } catch (error) {
      notify(
        `Không nhập được IFC: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      importController.current = null;
      setImporting(false);
    }
  };
  const pickIfc = async () => {
    if (readOnly) {
      notify("Vai trò chỉ xem không được nhập IFC.");
      return;
    }
    if (!localDesktop) {
      inputFile.current?.click();
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({
      multiple: false,
      filters: [{ name: "IFC STEP", extensions: ["ifc"] }],
    });
    if (typeof path !== "string") return;
    setImporting(true);
    const controller = new AbortController();
    importController.current = controller;
    try {
      setImportPhase({ label: "Đang khởi tạo tác vụ...", cancellable: true });
      const { jobId } = await call<{ jobId: string }>("model.import.start", {
        path,
      });
      const imported = await waitImport(
        jobId,
        controller.signal,
        setImportPhase,
      );
      setData((prev) => mergeImported(prev, imported));
      setFloor("all");
      notify(`Đã nhập ${imported.elements.length} cấu kiện`);
    } catch (e) {
      notify(String(e));
    } finally {
      importController.current = null;
      setImporting(false);
    }
  };
  const createIssue = async () => {
    if (!finding || !checkRun?.findings.includes(finding) || issueSaving)
      return;
    setIssueSaving(true);
    try {
      const next = await loadIssues("issues.create", {
        runId: checkRun.runId,
        findingId: finding.id,
      });
      const issue = next.find(
        (i) => i.runId === checkRun.runId && i.finding.id === finding.id,
      );
      setActiveIssueId(issue?.id ?? null);
      setComment("");
      setNav("issues");
      setBottom(true);
      notify("Đã lưu issue phối hợp");
    } catch (e) {
      notify(String(e));
    } finally {
      setIssueSaving(false);
    }
  };
  const reviewIssue = async (issue: CoordinationIssue) => {
    if (activeIssueId !== issue.id) setComment("");
    setActiveIssueId(issue.id);
    try {
      const current = await call<Workspace>("workspace.get");
      const evidenceAvailable =
        issue.snapshots?.length &&
        issue.snapshots.every((snapshot) => {
          if (snapshot.modelId === "demo") return true;
          const model = current.models.find((m) => m.id === snapshot.modelId);
          return (
            model?.hash === snapshot.sourceHash &&
            (model.transform?.revision ?? 0) === snapshot.transform.revision
          );
        }) &&
        [issue.finding.a, issue.finding.b].every((id) =>
          current.elements.some((e) => e.id === id),
        );
      if (!evidenceAvailable) {
        setFinding(null);
        setFocusIds([]);
        setSelected(null);
        notify("Thiếu phiên bản IFC hoặc định vị gốc của issue");
        return;
      }
      setData((previous) => ({ ...current, findings: previous.findings }));
      openFinding(issue.finding);
      const models = new Set(
        current.elements
          .filter((e) => [issue.finding.a, issue.finding.b].includes(e.id))
          .map((e) => e.modelId),
      );
      setHidden(
        (previous) => new Set([...previous].filter((id) => !models.has(id))),
      );
    } catch (e) {
      notify(String(e));
    }
  };
  const updateIssue = async (
    issue: CoordinationIssue,
    assignee: string,
    state: IssueState,
  ) => {
    if (issueSaving) return;
    setIssueSaving(true);
    try {
      await loadIssues("issues.update", {
        issueId: issue.id,
        expectedRevision: issue.revision,
        assignee,
        state,
      });
      notify("Đã cập nhật issue");
    } catch (e) {
      notify(String(e));
    } finally {
      setIssueSaving(false);
    }
  };
  const postIssueComment = async () => {
    if (!activeIssue || !comment.trim() || issueSaving) return;
    setIssueSaving(true);
    try {
      await loadIssues("issues.comment", {
        issueId: activeIssue.id,
        body: comment,
      });
      setComment("");
    } catch (e) {
      notify(String(e));
    } finally {
      setIssueSaving(false);
    }
  };
  const runCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await call<CheckRun>("checks.run", {
        modelIdsA: checkModelsA,
        modelIdsB: checkModelsB,
        classA,
        classB,
        floor,
        tolerance: tolerance / 1000,
      });
      setCheckRun(result);
      setData((prev) => ({ ...prev, findings: result.findings }));
      setFinding(null);
      setSelected(null);
      setRoom(null);
      setFocusIds([]);
      setStatus("all");
      setNav("checks");
      setBottom(true);
      setModal(null);
      notify(
        `${result.findings.length} giao cắt · ${result.coverage.generated}/${result.coverage.expected} hình học · ${result.coverage.complete ? "Hoàn tất" : "Coverage chưa đủ"}`,
      );
    } catch (error) {
      notify(
        `Kiểm tra thất bại: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setChecking(false);
    }
  };
  const editAlignment = (id: string) => {
    const model = data.models.find((m) => m.id === id);
    if (!model) return;
    setAlignmentModel(id);
    setAlignmentOffset(model.transform?.translation ?? [0, 0, 0]);
    setAlignmentAngle(model.transform?.rotationZDegrees ?? 0);
    setModal("alignment");
  };
  const saveAlignment = async () => {
    setAligning(true);
    try {
      const model = data.models.find((m) => m.id === alignmentModel)!;
      const saved = await call<Workspace["models"][number]>(
        "models.transform",
        {
          modelId: alignmentModel,
          translation: alignmentOffset,
          rotationZDegrees: alignmentAngle,
          expectedRevision: model.transform?.revision ?? 0,
        },
      );
      setData((previous) => ({
        ...previous,
        models: previous.models.map((m) => (m.id === saved.id ? saved : m)),
        findings: [],
      }));
      setCheckRun(null);
      setFinding(null);
      setFocusIds([]);
      setModal(null);
      notify("Đã cập nhật định vị. Cần chạy lại các kiểm tra liên quan.");
    } catch (error) {
      notify(String(error));
    } finally {
      setAligning(false);
    }
  };
  const sendPrompt = async (text: string) => {
    if (!text.trim()) return;
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    try {
      const result = await call<{
        reply: string;
        actions: {
          operation: string;
          hiddenModelIds?: string[];
          floor?: string;
          query?: string;
        }[];
      }>("assistant.command", { prompt: text });
      for (const action of result.actions) {
        if (action.operation === "view.isolate")
          setHidden(new Set(action.hiddenModelIds));
        if (action.operation === "view.floor") setFloor(action.floor ?? "all");
        if (action.operation === "elements.filter")
          setSearch(action.query ?? "");
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Chưa kết nối được Rust core. Khởi chạy pnpm core để dùng bộ lệnh local.",
        },
      ]);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="CIC CDE Home">
          <span className="brand-symbol">
            <Cuboid size={23} />
          </span>
          <span>
            CIC<span className="brand-light">CDE</span>
          </span>
        </a>
        <span className="top-divider" />
        {project || <span className="local-project">{projectName}</span>}
        <div className="top-spacer" />
        <a className="top-ai" href="?cde=1">
          Hồ sơ CDE
        </a>
        <button className="top-ai" onClick={() => setAssistant((v) => !v)}>
          <Sparkles size={15} /> Trợ lý BIM <span>Ctrl J</span>
        </button>
        <button
          className="icon-button"
          title="Trợ giúp"
          aria-label="Trợ giúp"
          onClick={() => setModal("help")}
        >
          <CircleHelp size={18} />
        </button>
        <button
          className="icon-button notification"
          title="Trạng thái workspace"
          aria-label="Trạng thái workspace"
          onClick={() => notify("G1 local workspace · Chưa có thông báo mới")}
        >
          <Bell size={18} />
          <i />
        </button>
        {account}
      </header>

      <aside className="rail">
        <div className="rail-top">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`rail-item ${nav === item.id ? "selected" : ""}`}
              onClick={() => {
                setNav(item.id as Nav);
                if (item.id === "checks" || item.id === "issues")
                  setBottom(true);
              }}
              title={item.label}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
              {item.id === "issues" && issues.length > 0 && (
                <b>{issues.length}</b>
              )}
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className="rail-item"
            onClick={() => {
              setAssistant(true);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: "MCP development bridge có project_get, models_list, elements_search và checks_run. Khởi chạy bằng pnpm mcp sau khi core đã chạy.",
                },
              ]);
            }}
          >
            <Workflow size={20} />
            <span>Agent</span>
          </button>
          <button className="rail-item" onClick={() => setModal("settings")}>
            <Settings2 size={20} />
            <span>Cài đặt</span>
          </button>
          <span className="rail-version">v0.1</span>
        </div>
      </aside>

      <main className="main">
        <div className="workspace-heading">
          <h1>
            Không gian phối hợp
            {!loading && data.synthetic && <span className="demo-pill">Dự án mẫu</span>}
          </h1>
          <div className="heading-actions">
            <button
              className="button secondary"
              onClick={() => viewer.current?.capture()}
            >
              <ArrowDownToLine size={15} /> Xuất góc nhìn
            </button>
            <button
              className="button primary"
              onClick={() => setModal("check")}
            >
              <ShieldCheck size={15} /> Kiểm tra mô hình
            </button>
          </div>
        </div>
        <div className="workspace-tabs">
          <div className="tab-group">
            <button
              className={nav !== "data" ? "tab active" : "tab"}
              onClick={() => setNav("models")}
            >
              <Box size={15} /> Mô hình 3D
            </button>
            <button
              className={nav === "data" ? "tab active" : "tab"}
              onClick={() => setNav("data")}
            >
              <Grid2X2 size={15} /> Bảng cấu kiện
            </button>
          </div>
          <div className="workspace-meta">
            <span className="status-dot" /> IFC4{" "}
            <span className="meta-divider" /> {data.models.length} mô hình{" "}
            <span className="meta-divider" />{" "}
            {data.elements.length.toLocaleString()} cấu kiện
          </div>
        </div>

        <div
          className={`workspace-body ${left ? "" : "no-left"} ${assistant ? "assistant-open" : ""}`}
        >
          {left && (
            <aside className="model-panel">
              <div className="panel-title">
                <h2>Mô hình dự án</h2>
                <button
                  className="icon-button small"
                  title="Thu gọn danh sách"
                  aria-label="Thu gọn danh sách"
                  onClick={() => setLeft(false)}
                >
                  <PanelLeftClose size={15} />
                </button>
              </div>
              <div className="model-search">
                <Search size={14} />
                <input
                  ref={searchInput}
                  placeholder="Tìm cấu kiện..."
                  aria-label="Tìm cấu kiện"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>Ctrl K</kbd>
              </div>
              <div className="panel-section-header">
                <span>MÔ HÌNH LIÊN KẾT</span>
                <button
                  title="Thêm IFC"
                  aria-label="Thêm IFC"
                  onClick={() => void pickIfc()}
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="model-list">
                {data.models.map((m) => (
                  <div
                    className={`model-row ${hidden.has(m.id) ? "is-hidden" : ""}`}
                    key={m.id}
                  >
                    <button
                      className="visibility"
                      aria-label={`${hidden.has(m.id) ? "Hiện" : "Ẩn"} ${m.name}`}
                      onClick={() => toggleModel(m.id)}
                    >
                      {hidden.has(m.id) ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </button>
                    <span
                      className={`discipline-icon ${m.discipline.toLowerCase()}`}
                    >
                      <FileBox size={17} />
                    </span>
                    <div className="model-row-info">
                      <span title={m.name}>
                        {m.name.replace("RVT_", "").replace("_Riverside", "")}
                      </span>
                      <small>
                        {m.discipline} <i /> {m.count} cấu kiện
                      </small>
                    </div>
                    {m.synthetic ? (
                      <CheckCircle2 className="model-ready" size={13} />
                    ) : (
                      <button
                        className="icon-button small"
                        title="Định vị mô hình"
                        aria-label={`Định vị ${m.name}`}
                        onClick={() => editAlignment(m.id)}
                      >
                        <Settings2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="import-zone"
                onClick={() => void pickIfc()}
                disabled={importing}
              >
                <Upload size={15} />
                {importing ? "Đang xử lý IFC..." : "Thêm mô hình IFC"}
                <span>+</span>
              </button>
              <div className="panel-section-header storey-header">
                <span>CẤU TRÚC KHÔNG GIAN</span>
              </div>
              <button
                className={`tree-root ${floor === "all" ? "active" : ""}`}
                onClick={() => chooseSpace("all")}
              >
                <ChevronDown size={13} />
                <Layers3 size={15} />
                <span>{projectName}</span>
                <small>{data.elements.length}</small>
              </button>
              <ul className="storey-list">
                {storeys.map(({ name, count, rooms }) => (
                  <li key={name}>
                    <div className="storey-line">
                      {rooms.length > 0 && (
                        <button
                          className="storey-toggle"
                          aria-label={`Danh sách phòng · ${storeyLabel(name)}`}
                          aria-expanded={expandedStoreys.has(name)}
                          onClick={() =>
                            setExpandedStoreys((previous) => {
                              const next = new Set(previous);
                              if (next.has(name)) next.delete(name);
                              else next.add(name);
                              return next;
                            })
                          }
                        >
                          {expandedStoreys.has(name) ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </button>
                      )}
                      <button
                        className={`storey-row ${floor === name && room === null ? "active" : ""}`}
                        aria-pressed={floor === name && room === null}
                        title={storeyLabel(name)}
                        onClick={() => {
                          chooseSpace(name);
                          if (rooms.length)
                            setExpandedStoreys((previous) =>
                              new Set(previous).add(name),
                            );
                        }}
                      >
                        <Layers3 size={14} />
                        <span>{storeyLabel(name)}</span>
                        <small>{count}</small>
                      </button>
                    </div>
                    {expandedStoreys.has(name) && rooms.length > 0 && (
                      <ul className="room-list">
                        {rooms.map(([key, entry]) => (
                          <li key={key}>
                            <button
                              className={`storey-row ${room === key ? "active" : ""}`}
                              aria-pressed={room === key}
                              title={entry.label}
                              onClick={() => chooseSpace(name, key)}
                            >
                              <Box size={12} />
                              <span>{entry.label}</span>
                              <small>{entry.count}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              {search && (
                <div className="search-matches">
                  <span>{filteredElements.length} kết quả</span>
                  {filteredElements.slice(0, 8).map((e) => (
                    <button key={e.id} onClick={() => setSelected(e.id)}>
                      <Box size={12} />
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="model-panel-footer">
                <span className="green-dot" /> IfcOpenShell 0.8.5{" "}
                <span>IFC4</span>
              </div>
            </aside>
          )}

          <section className="canvas-column">
            <div className="viewer-header">
              <div className="viewer-context">
                {!left && (
                  <button
                    className="icon-button small"
                    onClick={() => setLeft(true)}
                    aria-label="Mở danh sách mô hình"
                  >
                    <Layers3 size={16} />
                  </button>
                )}
                <Box size={14} />
                <span>
                  {floor === "all" ? "Phối cảnh tổng thể" : scopeLabel}
                </span>
                <ChevronDown size={12} />
              </div>
              <div className="viewer-options">
                <button
                  className={
                    mode === "solid" ? "view-option active" : "view-option"
                  }
                  onClick={() => setMode("solid")}
                >
                  Solid
                </button>
                <button
                  className={
                    mode === "xray" ? "view-option active" : "view-option"
                  }
                  onClick={() => setMode("xray")}
                >
                  X-ray
                </button>
                <button
                  className={
                    mode === "wireframe" ? "view-option active" : "view-option"
                  }
                  onClick={() => setMode("wireframe")}
                >
                  Wireframe
                </button>
                <span className="mini-divider" />
                <button
                  className="icon-button small"
                  title="Đặt lại góc nhìn"
                  aria-label="Đặt lại góc nhìn"
                  onClick={reset}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            <div className="viewport">
              {nav === "data" ? (
                <div className="data-view">
                  <div className="data-heading">
                    <h2>Dữ liệu cấu kiện</h2>
                    <span>{filteredElements.length} đối tượng</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Tên cấu kiện</th>
                        <th>IFC Class</th>
                        <th>Tầng</th>
                        <th>Bộ môn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredElements.slice(0, 300).map((e) => (
                        <tr
                          key={e.id}
                          className={selected === e.id ? "selected" : ""}
                          onClick={() => setSelected(e.id)}
                        >
                          <td>{e.name}</td>
                          <td>{e.ifcClass}</td>
                          <td>{e.storey}</td>
                          <td>
                            <span
                              className={`discipline-tag ${e.discipline.toLowerCase()}`}
                            >
                              {e.discipline}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredElements.length > 300 && (
                    <p className="table-limit">
                      Hiển thị 300 dòng đầu trong bản preview.
                    </p>
                  )}
                </div>
              ) : (
                <Viewer
                  ref={viewer}
                  elements={data.elements}
                  models={data.models}
                  onGeometryLoading={setGeometryLoading}
                  loadAttempt={geometryAttempt}
                  onGeometryProgress={setGeometryProgress}
                  onGeometryError={notify}
                  onGeometryReady={setGeometryStats}
                  hidden={hidden}
                  floor={floor}
                  room={room}
                  fitRequest={fitRequest}
                  selected={selected}
                  focusIds={focusIds}
                  focusPoint={focusPoint}
                  mode={mode}
                  section={section}
                  measure={measure}
                  onSelect={selectElement}
                  onMeasure={handleMeasure}
                />
              )}
              {nav !== "data" && (
                <>
                  <div className="view-badge">
                    <span className="green-dot" /> LIVE VIEW <span>·</span>{" "}
                    {scopeLabel}
                  </div>
                  <div className="orientation">
                    <button
                      title="Nhìn từ trên"
                      aria-label="Nhìn từ trên"
                      onClick={() => viewer.current?.top()}
                      className="view-cube"
                    >
                      TOP
                    </button>
                    <span>N</span>
                    <i />
                  </div>
                  <div className="axis">
                    <span className="axis-z">Z</span>
                    <span className="axis-y">Y</span>
                    <span className="axis-x">X</span>
                    <i />
                  </div>
                  <div className="viewer-toolbar">
                    <ToolButton
                      label="Chọn cấu kiện"
                      active={!measure}
                      onClick={() => setMeasure(false)}
                    >
                      <MousePointer2 size={17} />
                    </ToolButton>
                    <span />
                    <ToolButton
                      label="Khung mô hình"
                      onClick={() => viewer.current?.fit()}
                    >
                      <Focus size={18} />
                    </ToolButton>
                    <ToolButton
                      label="Cắt mô hình tại cao độ 17.8 m"
                      active={section}
                      onClick={() => setSection((v) => !v)}
                    >
                      <Cuboid size={18} />
                    </ToolButton>
                    <ToolButton
                      label="Đo hai điểm trong mô hình"
                      active={measure}
                      onClick={() => {
                        setMeasure((v) => !v);
                        setDistance(null);
                      }}
                    >
                      <Ruler size={18} />
                    </ToolButton>
                    <span />
                    <ToolButton label="Hiện toàn bộ mô hình" onClick={reset}>
                      <Eye size={18} />
                    </ToolButton>
                    <ToolButton
                      label="Chụp góc nhìn"
                      onClick={() => viewer.current?.capture()}
                    >
                      <Maximize2 size={17} />
                    </ToolButton>
                  </div>
                  <div className="viewer-hint">
                    {measure ? (
                      <>
                        <Ruler size={12} />
                        {distance === null
                          ? "Chọn hai điểm trên cấu kiện"
                          : `${distance.toFixed(3)} m · Chọn tiếp hai điểm mới`}
                      </>
                    ) : (
                      <>
                        <MousePointer2 size={12} /> Kéo để xoay <span>·</span>{" "}
                        Chuột phải để di chuyển <span>·</span> Cuộn để zoom
                      </>
                    )}
                  </div>
                </>
              )}
              {(loading || geometryLoading) && (
                <div
                  className={
                    loading
                      ? "loading-overlay"
                      : "loading-overlay loading-progress"
                  }
                >
                  <LoaderCircle className="spin" size={28} />
                  <span>
                    Đang dựng hình học · {geometryProgress.done}/
                    {geometryProgress.total} cấu kiện
                  </span>
                  <progress
                    aria-label="Tiến trình dựng hình học"
                    value={geometryProgress.done}
                    max={geometryProgress.total || 1}
                  />
                  <button
                    onClick={() => {
                      viewer.current?.cancelLoad();
                      setGeometryLoading(false);
                      setGeometryStopped(true);
                    }}
                  >
                    Hủy tải hình học
                  </button>
                </div>
              )}
              {geometryStopped && !geometryLoading && (
                <div className="loading-overlay loading-progress">
                  <span>
                    Đã dừng tải hình học. Các mô hình đã tải được giữ lại.
                  </span>
                  <button
                    onClick={() => {
                      setGeometryStopped(false);
                      setGeometryAttempt((n) => n + 1);
                    }}
                  >
                    Tiếp tục tải
                  </button>
                </div>
              )}
              {finding && (
                <div className="review-banner">
                  <span className="conflict-dot" />
                  <strong>{finding.id}</strong>
                  <span>{finding.title}</span>
                  <button
                    onClick={() => {
                      setFinding(null);
                      setFocusIds([]);
                    }}
                    aria-label="Đóng chế độ duyệt"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="viewer-status">
              <span>
                <span className={connected ? "green-dot" : "amber-dot"} />
                {connected
                  ? "Rust core connected"
                  : "Preview · chưa kết nối Rust core"}
              </span>
              <span>
                m <i /> Z-up <i />{" "}
                {scopedElements.filter((e) => !hidden.has(e.modelId)).length}{" "}
                đối tượng hiển thị
                {geometryStats && (
                  <>
                    <i />
                    {geometryStats.durationMs.toFixed(0)} ms tải hình học
                  </>
                )}
              </span>
            </div>
          </section>

          <aside className="inspector">
            {assistant ? (
              <>
                <div className="panel-title">
                  <h2>
                    <Sparkles size={15} /> Trợ lý BIM
                  </h2>
                  <button
                    className="icon-button small"
                    aria-label="Đóng trợ lý"
                    onClick={() => setAssistant(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="assistant-mode">
                  <span className="green-dot" /> Local commands{" "}
                  <span>Mock provider</span>
                </div>
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="assistant-welcome">
                      <span className="assistant-logo">
                        <Sparkles size={25} />
                      </span>
                      <h3>Bắt đầu từ mô hình.</h3>
                      <p>
                        Tìm cấu kiện và điều khiển góc nhìn bằng bộ lệnh local.
                      </p>
                      {[
                        "Tổng quan mô hình",
                        "Hiện riêng HVAC",
                        "Hiện tầng 5",
                        "Tìm dầm",
                      ].map((t) => (
                        <button key={t} onClick={() => void sendPrompt(t)}>
                          {t}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                      <small>
                        Chưa kết nối AI bên ngoài. Các lệnh mẫu chạy trực tiếp
                        trên dữ liệu đang tải.
                      </small>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`chat-message ${m.role}`}>
                        <strong>
                          {m.role === "assistant" ? "QA Assistant" : "Bạn"}
                        </strong>
                        <p>{m.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendPrompt(prompt);
                  }}
                >
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Nhập một lệnh local..."
                    aria-label="Lệnh trợ lý"
                  />
                  <div>
                    <span>
                      <Command size={12} /> LOCAL
                    </span>
                    <button
                      type="submit"
                      disabled={!prompt.trim()}
                      aria-label="Gửi lệnh"
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="panel-title">
                  <h2>Thuộc tính</h2>
                  <SlidersHorizontal size={14} />
                </div>
                <div className="inspector-tabs">
                  <button className="active">Thông tin</button>
                  <button onClick={() => setAssistant(true)}>
                    <Sparkles size={12} /> Trợ lý
                  </button>
                </div>
                {element ? (
                  <>
                    <div className="element-heading">
                      <span
                        className={`element-type-icon ${element.discipline.toLowerCase()}`}
                      >
                        <Box size={22} />
                      </span>
                      <span className="element-class">{element.ifcClass}</span>
                      <h3>{element.name}</h3>
                      <div>
                        <span
                          className={`discipline-tag ${element.discipline.toLowerCase()}`}
                        >
                          {element.discipline}
                        </span>
                        <span>{storeyLabel(element.storey)}</span>
                      </div>
                    </div>
                    <div className="property-section">
                      <h4>
                        <ChevronDown size={12} /> Nhận dạng
                      </h4>
                      {Object.entries(element.properties).map(([k, v]) => (
                        <div className="property-row" key={k}>
                          <span>{k}</span>
                          <strong title={v}>{v}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="property-section">
                      <h4>
                        <ChevronDown size={12} /> Không gian & mô hình
                      </h4>
                      <div className="property-row">
                        <span>Tầng</span>
                        <strong>{storeyLabel(element.storey)}</strong>
                      </div>
                      {element.space && (
                        <div className="property-row">
                          <span>Không gian</span>
                          <strong>{spaceLabel(element.space)}</strong>
                        </div>
                      )}
                      <div className="property-row">
                        <span>Bộ môn</span>
                        <strong>{element.discipline}</strong>
                      </div>
                      <div className="property-row">
                        <span>Tam giác</span>
                        <strong>
                          {element.triangleCount ??
                            (element.indices?.length ?? 0) / 3}
                        </strong>
                      </div>
                    </div>
                    <div className="inspector-note">
                      <ShieldCheck size={15} />
                      <p>Dữ liệu được đọc trực tiếp từ IFC qua IfcOpenShell.</p>
                    </div>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <div className="select-illustration">
                      <MousePointer2 size={23} />
                      <Box size={34} />
                    </div>
                    <h3>Mọi chi tiết, trong tầm nhìn</h3>
                    <p>
                      Chọn một cấu kiện trong mô hình để xem thông tin và thuộc
                      tính IFC.
                    </p>
                    <div className="shortcut-row">
                      <span>Chọn cấu kiện</span>
                      <kbd>Click</kbd>
                    </div>
                    <div className="shortcut-row">
                      <span>Bỏ chọn</span>
                      <kbd>Esc</kbd>
                    </div>
                    <div className="overview-card">
                      <span>
                        <Activity size={14} /> TỔNG QUAN MÔ HÌNH
                      </span>
                      <div>
                        <strong>{data.elements.length}</strong>
                        <small>Cấu kiện đã tải</small>
                      </div>
                      <div className="discipline-bars">
                        {data.models.map((m) => (
                          <i
                            key={m.id}
                            className={m.discipline.toLowerCase()}
                            style={{ flex: m.count }}
                          />
                        ))}
                      </div>
                      <p>Hình học IFC thật · Dự án tổng hợp</p>
                    </div>
                  </div>
                )}
                <button
                  className="assistant-entry"
                  onClick={() => setAssistant(true)}
                >
                  <Sparkles size={15} />
                  <span>Khám phá với Trợ lý BIM</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </aside>
        </div>

        <section className={`results-panel ${bottom ? "" : "collapsed"}`}>
          <div className="results-heading">
            <div className="results-tabs">
              <button
                className={nav !== "issues" ? "active" : ""}
                onClick={() => {
                  setNav("checks");
                  setBottom(true);
                }}
              >
                <ShieldCheck size={15} /> Kết quả kiểm tra{" "}
                <span>{data.findings.length}</span>
              </button>
              <button
                className={nav === "issues" ? "active" : ""}
                onClick={() => {
                  setNav("issues");
                  setBottom(true);
                }}
              >
                <MessageSquare size={14} /> Issues <span>{issues.length}</span>
              </button>
            </div>
            <div className="results-actions">
              <span
                className={`sample-label ${checkRun ? (checkRun.coverage.complete ? "computed" : "incomplete") : ""}`}
              >
                {checkRun
                  ? `IfcOpenShell · ${checkRun.coverage.complete ? "Complete" : "Incomplete"}`
                  : "Dữ liệu UX mẫu"}
              </span>
              <button
                className="icon-button small"
                aria-label={bottom ? "Thu gọn kết quả" : "Mở kết quả"}
                onClick={() => setBottom((v) => !v)}
              >
                <ChevronDown className={bottom ? "" : "flipped"} size={16} />
              </button>
            </div>
          </div>
          {bottom && (
            <>
              {nav === "issues" ? (
                <div className="issues-view">
                  {issues.length ? (
                    issues.map((i) => (
                      <div key={i.id}>
                        <span className="issue-icon">
                          <MessageSquare size={16} />
                        </span>
                        <button
                          className="button tiny secondary"
                          aria-pressed={activeIssueId === i.id}
                          onClick={() => void reviewIssue(i)}
                        >
                          ISS-{String(i.id).padStart(3, "0")}
                        </button>
                        <span>{i.finding.title}</span>
                        <span>{storeyLabel(elementsById.get(i.finding.a)?.storey ?? i.finding.storey)}</span>
                        <small>
                          {issueLabels[i.state]} · {i.assignee || "Chưa giao"} ·{" "}
                          {i.comments.length} bình luận
                        </small>
                      </div>
                    ))
                  ) : (
                    <div className="issues-empty">
                      <ClipboardList size={25} />
                      <span>
                        Chưa có issue. Chạy kiểm tra hình học, chọn một kết quả
                        và tạo issue.
                      </span>
                    </div>
                  )}
                  {activeIssue && (
                    <section
                      className="issue-thread"
                      aria-label="Thảo luận issue"
                    >
                      <strong>
                        ISS-{String(activeIssue.id).padStart(3, "0")} ·{" "}
                        {activeIssue.finding.title}
                      </strong>
                      <form
                        key={activeIssue.id + ":" + activeIssue.revision}
                        className="issue-assignment"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void updateIssue(
                            activeIssue,
                            String(data.get("assignee") ?? ""),
                            data.get("state") as IssueState,
                          );
                        }}
                      >
                        <input
                          name="assignee"
                          aria-label="Đơn vị phụ trách"
                          placeholder="Đơn vị phụ trách"
                          defaultValue={activeIssue.assignee}
                          maxLength={120}
                          disabled={issueSaving || readOnly}
                        />
                        <select
                          name="state"
                          aria-label="Trạng thái issue"
                          defaultValue={activeIssue.state}
                          disabled={issueSaving || readOnly}
                        >
                          {[
                            activeIssue.state,
                            ...issueTransitions[activeIssue.state],
                          ].map((state) => (
                            <option key={state} value={state}>
                              {issueLabels[state]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button tiny secondary"
                          disabled={issueSaving || readOnly}
                        >
                          Lưu phân công
                        </button>
                      </form>
                      <ul>
                        {activeIssue.comments.map((entry) => (
                          <li key={entry.id}>{entry.body}</li>
                        ))}
                      </ul>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void postIssueComment();
                        }}
                      >
                        <input
                          aria-label="Nội dung bình luận"
                          placeholder="Viết bình luận…"
                          maxLength={2000}
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          disabled={issueSaving || readOnly}
                        />
                        <button
                          className="button tiny primary"
                          disabled={issueSaving || readOnly || !comment.trim()}
                        >
                          Gửi bình luận
                        </button>
                      </form>
                    </section>
                  )}
                </div>
              ) : (
                <>
                  <div className="results-filter">
                    <div className="filter-tabs">
                      {[
                        { id: "all", label: "Tất cả" },
                        { id: "new", label: "Mới" },
                        { id: "reviewed", label: "Đã duyệt" },
                      ].map((s) => (
                        <button
                          className={status === s.id ? "active" : ""}
                          key={s.id}
                          onClick={() => setStatus(s.id)}
                        >
                          {s.label}
                          {s.id === "new" && (
                            <span>
                              {
                                data.findings.filter((f) => f.status === "new")
                                  .length
                              }
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="filter-controls">
                      <span>
                        <Filter size={12} /> {scopeLabel}
                      </span>
                      <button onClick={() => setModal("check")}>
                        <Settings2 size={13} /> Quy tắc
                      </button>
                    </div>
                  </div>
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th className="check-cell">
                            <Square size={12} />
                          </th>
                          <th>MÃ</th>
                          <th>VẤN ĐỀ</th>
                          <th>TẦNG</th>
                          <th>MỨC ĐỘ</th>
                          <th>TRẠNG THÁI</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {findings.map((f) => (
                          <tr
                            key={f.id}
                            className={finding?.id === f.id ? "selected" : ""}
                            onClick={() => openFinding(f)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openFinding(f);
                            }}
                            aria-label={`Mở ${f.id}`}
                          >
                            <td className="check-cell">
                              <span className={`finding-type ${f.severity}`}>
                                <Box size={13} />
                              </span>
                            </td>
                            <td className="finding-id">{f.id}</td>
                            <td>
                              <strong>{f.title}</strong>
                              <small>
                                {f.rule}
                                {f.distance !== undefined
                                  ? ` · ${f.measurementKind} ${(f.distance * 1000).toFixed(1)} mm`
                                  : ""}
                              </small>
                            </td>
                            <td>{storeyLabel(elementsById.get(f.a)?.storey ?? f.storey)}</td>
                            <td>
                              <span className={`severity ${f.severity}`}>
                                <i />
                                {f.severity === "high" ? "Cao" : "Trung bình"}
                              </span>
                            </td>
                            <td>
                              <span className={`finding-status ${f.status}`}>
                                {f.status === "new" ? "Mới" : "Đã duyệt"}
                              </span>
                            </td>
                            <td>
                              <ArrowUpRight size={14} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="results-footer">
                <span>
                  {nav === "issues"
                    ? `${issues.length} issue phối hợp`
                    : checkRun
                      ? `${findings.length} giao cắt · ${checkRun.coverage.generated}/${checkRun.coverage.expected} hình học · ${checkRun.coverage.unmeasuredCollisionPairs} cặp không đo được`
                      : `${findings.length} kết quả mẫu · Chưa chạy engine clash`}
                </span>
                {finding ? (
                  <div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setData((prev) => ({
                          ...prev,
                          findings: prev.findings.map((f) =>
                            f.id === finding.id
                              ? { ...f, status: "reviewed" }
                              : f,
                          ),
                        }));
                        notify(
                          `${finding.id} đã đánh dấu duyệt trong phiên làm việc`,
                        );
                      }}
                    >
                      <Check size={13} /> Đánh dấu đã duyệt
                    </button>
                    <button
                      className="button tiny primary"
                      disabled={
                        !checkRun?.findings.includes(finding) || issueSaving
                      }
                      onClick={() => void createIssue()}
                    >
                      <Plus size={12} /> Tạo issue
                    </button>
                  </div>
                ) : (
                  <span className="results-tip">
                    <MousePointer2 size={11} /> Chọn kết quả để định vị trong mô
                    hình
                  </span>
                )}
              </div>
            </>
          )}
        </section>
        <footer className="app-status">
          <span>
            <span className="green-dot" /> LOCAL WORKSPACE{" "}
            <span className="meta-divider" />{" "}
            {connected ? "Rust application core" : "UI preview"}
          </span>
          <span>
            <Terminal size={11} /> MCP · 4 tools{" "}
            <span className="meta-divider" /> G0 / G1{" "}
            <span className="meta-divider" /> v0.1.0
          </span>
        </footer>
      </main>
      <input
        type="file"
        ref={inputFile}
        accept=".ifc"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = "";
        }}
      />
      {(toast || importing) && (
        <div className="toast" role="status">
          {importing ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <CheckCircle2 size={17} />
          )}
          <span>{importing ? importPhase.label : toast}</span>
          {importing && (
            <button
              disabled={
                !importPhase.cancellable ||
                importController.current?.signal.aborted
              }
              onClick={() => {
                importController.current?.abort();
                setImportPhase({
                  label: "Đang hủy tác vụ...",
                  cancellable: false,
                });
              }}
            >
              Hủy tải
            </button>
          )}
          {!importing && (
            <button onClick={() => setToast("")} aria-label="Đóng thông báo">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Đóng"
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
            {modal === "check" ? (
              <>
                <span className="modal-emblem">
                  <ShieldCheck size={26} />
                </span>
                <div className="eyebrow">MODEL VALIDATION</div>
                <h2 id="dialog-title">Kiểm tra, có chủ đích.</h2>
                <p>
                  Thiết lập phạm vi rõ ràng để tập trung vào những xung đột cần
                  xử lý.
                </p>
                <div className="rule-card">
                  <span className="discipline-tag hvac">NHÓM A</span>
                  <ArrowLeft size={14} />
                  <ArrowRight size={14} />
                  <span className="discipline-tag str">NHÓM B</span>
                  <strong>Va chạm hình học</strong>
                </div>
                <div className="check-model-groups">
                  {[
                    {
                      label: "Mô hình nhóm A",
                      ids: checkModelsA,
                      set: setCheckModelsA,
                    },
                    {
                      label: "Mô hình nhóm B",
                      ids: checkModelsB,
                      set: setCheckModelsB,
                    },
                  ].map((group) => (
                    <fieldset key={group.label}>
                      <legend>{group.label}</legend>
                      {[
                        { id: "demo", name: "Riverside · IFC mẫu" },
                        ...data.models.filter((m) => !m.synthetic),
                      ].map((model) => (
                        <label key={model.id}>
                          <input
                            type="checkbox"
                            checked={group.ids.includes(model.id)}
                            disabled={checking}
                            onChange={(event) =>
                              group.set((previous) =>
                                event.target.checked
                                  ? [...previous, model.id]
                                  : previous.filter((id) => id !== model.id),
                              )
                            }
                          />
                          <span>{model.name}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <div className="check-fields">
                  {[
                    { value: classA, set: setClassA, label: "Nhóm A" },
                    { value: classB, set: setClassB, label: "Nhóm B" },
                  ].map((item) => (
                    <label className="field-label" key={item.label}>
                      {item.label}
                      <select
                        value={item.value}
                        onChange={(e) => item.set(e.target.value)}
                        disabled={checking}
                      >
                        {[
                          "IfcDuctSegment",
                          "IfcPipeSegment",
                          "IfcBeam",
                          "IfcColumn",
                          "IfcSlab",
                          "IfcWall",
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="field-label">
                  Phạm vi
                  <select
                    value={floor}
                    disabled={checking}
                    onChange={(e) => setFloor(e.target.value)}
                  >
                    <option value="all">Toàn bộ công trình</option>
                    {storeys.map(({ name }) => (
                      <option key={name} value={name}>
                        {storeyLabel(name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label tolerance-field">
                  Ngưỡng giao cắt tối thiểu (mm)
                  <input
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.1"
                    value={tolerance}
                    disabled={checking}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                  />
                </label>
                <div className="development-note">
                  <Workflow size={18} />
                  <p>
                    Kiểm tra giữa các nhóm IFC, dùng cùng định vị với Viewer.
                    Ngưỡng tính bằng mét sau quy đổi; các trường hợp hình học
                    không kiểm được sẽ làm coverage chưa hoàn tất.
                  </p>
                </div>
                <button
                  className="button primary full"
                  disabled={
                    checking ||
                    !checkModelsA.length ||
                    !checkModelsB.length ||
                    !connected ||
                    !Number.isFinite(tolerance) ||
                    tolerance < 0.1 ||
                    tolerance > 1000
                  }
                  onClick={() => void runCheck()}
                >
                  {checking ? (
                    <>
                      <LoaderCircle className="spin" size={15} />
                      Đang kiểm tra hình học...
                    </>
                  ) : (
                    <>
                      Chạy kiểm tra <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </>
            ) : modal === "alignment" ? (
              <>
                <span className="modal-emblem">
                  <Crosshair size={25} />
                </span>
                <h2 id="dialog-title">Định vị mô hình</h2>
                <p>{data.models.find((m) => m.id === alignmentModel)?.name}</p>
                <div className="alignment-fields">
                  {["X", "Y", "Z"].map((axis, index) => (
                    <label className="field-label" key={axis}>
                      {axis} (m)
                      <input
                        type="number"
                        step="0.01"
                        value={alignmentOffset[index]}
                        onChange={(e) =>
                          setAlignmentOffset(
                            (previous) =>
                              previous.map((v, i) =>
                                i === index ? Number(e.target.value) : v,
                              ) as [number, number, number],
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="field-label tolerance-field">
                  Góc quay quanh Z (độ)
                  <input
                    type="number"
                    min="-360"
                    max="360"
                    value={alignmentAngle}
                    onChange={(e) => setAlignmentAngle(Number(e.target.value))}
                  />
                </label>
                <div className="development-note">
                  <Workflow size={18} />
                  <p>
                    Phép dịch và quay áp dụng cho cả Viewer và kiểm tra. Đổi
                    định vị sẽ bỏ kết quả đang xem; cần chạy lại kiểm tra.
                  </p>
                </div>
                <button
                  className="button primary full"
                  disabled={
                    aligning ||
                    alignmentOffset.some(
                      (v) => !Number.isFinite(v) || Math.abs(v) > 1e8,
                    ) ||
                    !Number.isFinite(alignmentAngle) ||
                    Math.abs(alignmentAngle) > 360
                  }
                  onClick={() => void saveAlignment()}
                >
                  {aligning ? "Đang lưu..." : "Áp dụng định vị"}
                </button>
              </>
            ) : modal === "settings" ? (
              <>
                <span className="modal-emblem">
                  <Settings2 size={26} />
                </span>
                <h2 id="dialog-title">Workspace local</h2>
                <p>CIC CDE Desktop · G0 / G1 · v0.1.0</p>
                <div className="settings-list">
                  <div>
                    <span>Giao diện</span>
                    <strong>React + TypeScript</strong>
                  </div>
                  <div>
                    <span>Application core</span>
                    <strong>
                      {connected ? "Rust · Connected" : "Chưa kết nối"}
                    </strong>
                  </div>
                  <div>
                    <span>Geometry</span>
                    <strong>IfcOpenShell 0.8.5</strong>
                  </div>
                  <div>
                    <span>AI runtime</span>
                    <strong>Mock / Local commands</strong>
                  </div>
                  <div>
                    <span>MCP</span>
                    <strong>stdio · Development bridge</strong>
                  </div>
                  <div>
                    <span>Đơn vị</span>
                    <strong>Mét · Z-up</strong>
                  </div>
                </div>
                <button
                  className="button secondary full"
                  onClick={() => {
                    reset();
                    setModal(null);
                  }}
                >
                  Đặt lại góc nhìn
                </button>
              </>
            ) : (
              <>
                <span className="modal-emblem">
                  <MousePointer2 size={26} />
                </span>
                <h2 id="dialog-title">Khám phá mô hình</h2>
                <p>
                  Giao diện thử nghiệm đang dùng IFC tổng hợp do CIC CDE tạo.
                </p>
                <div className="settings-list">
                  <div>
                    <span>Xoay mô hình</span>
                    <strong>Kéo chuột trái</strong>
                  </div>
                  <div>
                    <span>Di chuyển</span>
                    <strong>Chuột phải</strong>
                  </div>
                  <div>
                    <span>Zoom</span>
                    <strong>Cuộn chuột</strong>
                  </div>
                  <div>
                    <span>Xem thuộc tính</span>
                    <strong>Click cấu kiện</strong>
                  </div>
                  <div>
                    <span>Tìm cấu kiện</span>
                    <strong>Ctrl + K</strong>
                  </div>
                </div>
                <p className="small-note">
                  Nhập IFC thật cần Rust core local. Bản spike giới hạn 100 MB /
                  2.000 cấu kiện có hình học.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
