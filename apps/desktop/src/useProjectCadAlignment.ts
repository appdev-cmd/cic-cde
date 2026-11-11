import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultCadAlignment, readCadAlignments, sameCadAlignment,
  type CadAlignment, type CadAlignmentValues, type ProjectCadAlignment,
} from "./cadAlignment";

type Draft = { alignment: CadAlignmentValues; baseRevision: number };
type Notice = { floor: string; error?: string; conflict?: boolean };

function messageOf(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Không thể lưu cấu hình CAD. Hãy thử lại.";
}

export function useProjectCadAlignment(enabled: boolean, canEdit: boolean, floor: string, localKey: string) {
  const [legacy] = useState(() => enabled ? readCadAlignments(localKey) : {});
  const [entries, setEntries] = useState(() => new Map<string, ProjectCadAlignment>());
  const [drafts, setDrafts] = useState(() => new Map<string, Draft>());
  const [hidden, setHidden] = useState(() => new Set<string>());
  const [loading, setLoading] = useState(enabled);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const loadRequest = useRef<AbortController>(null);
  const saveLock = useRef(false);

  const saved = entries.get(floor);
  const draft = drafts.get(floor);
  const local = Object.hasOwn(legacy, floor) ? legacy[floor] : undefined;
  const revision = saved?.revision ?? 0;
  const values = draft?.alignment ?? saved?.alignment ?? (saved ? undefined : local) ?? defaultCadAlignment;
  const alignment = { ...values, visible: !hidden.has(floor) };
  const dirty = saved?.alignment ? !sameCadAlignment(values, saved.alignment) : Boolean(values.drawing);
  const conflict = Boolean(draft && draft.baseRevision !== revision) ||
    Boolean(notice?.floor === floor && notice.conflict);
  const canSave = canEdit && !loading && !loadError && !saving && dirty && !conflict;

  const reload = useCallback(async () => {
    loadRequest.current?.abort();
    const request = new AbortController();
    loadRequest.current = request;
    setLoading(true);
    setLoadError(false);
    try {
      const { listProjectCadAlignments } = await import("./cloud");
      const result = await listProjectCadAlignments(request.signal);
      if (request.signal.aborted) return false;
      setEntries((previous) => {
        const next = new Map(previous);
        for (const entry of result) {
          if ((next.get(entry.floor)?.revision ?? 0) <= entry.revision) next.set(entry.floor, entry);
        }
        return next;
      });
      return true;
    } catch {
      if (!request.signal.aborted) setLoadError(true);
      return false;
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    return () => loadRequest.current?.abort();
  }, [enabled, reload]);

  function update({ visible, ...update }: Partial<CadAlignment>) {
    if (visible !== undefined) {
      setHidden((previous) => {
        const next = new Set(previous);
        if (visible) next.delete(floor);
        else next.add(floor);
        return next;
      });
    }
    if (!Object.keys(update).length) return;
    setDrafts((previous) => {
      const next = new Map(previous);
      const existing = previous.get(floor);
      next.set(floor, {
        alignment: { ...(existing?.alignment ?? values), ...update },
        baseRevision: existing?.baseRevision ?? revision,
      });
      return next;
    });
    setNotice((previous) => previous?.floor === floor && !previous.conflict ? undefined : previous);
  }

  function clearDraft() {
    setDrafts((previous) => {
      const next = new Map(previous);
      next.delete(floor);
      return next;
    });
    setNotice((previous) => previous?.floor === floor ? undefined : previous);
  }

  async function useSaved() {
    if (!conflict || await reload()) clearDraft();
  }

  async function save() {
    if (!canSave || saveLock.current) return;
    saveLock.current = true;
    setSaving(floor);
    setNotice(undefined);
    try {
      const { saveProjectCadAlignment } = await import("./cloud");
      const entry = await saveProjectCadAlignment(floor, draft?.baseRevision ?? revision, values.drawing ? values : null);
      setEntries((previous) => new Map(previous).set(floor, entry));
      clearDraft();
    } catch (error) {
      const stale = Boolean(error && typeof error === "object" && "code" in error && error.code === "PT409");
      setNotice({ floor, error: messageOf(error), conflict: stale });
    } finally {
      saveLock.current = false;
      setSaving(undefined);
    }
  }

  return {
    alignment,
    update,
    controls: {
      canEdit, canSave, dirty, conflict, loading, loadError, reload, save, useSaved,
      saving: saving === floor,
      stored: Boolean(saved?.alignment),
      cleared: Boolean(saved && !saved.alignment),
      error: notice?.floor === floor ? notice.error : undefined,
    },
  };
}

export type CadProjectControls = ReturnType<typeof useProjectCadAlignment>["controls"];
