import type { BepStage, Suitability } from "./ProjectBepSettings";

export type Stage =
  "WIP" | "Shared" | "Review" | "Approved" | "Published" | "Archived";
export type DocumentVersion = {
  id: number;
  code: string;
  title: string;
  discipline: string;
  modelId: string;
  revision: number;
  state: Stage;
  revisionCode?: string | null;
  suitabilityCode?: string | null;
  suitabilityOptions?: Record<BepStage, Suitability[]> | null;
  bepVersion?: number | null;
  bepReference?: string | null;
  history: { state: Stage; note: string; createdAt: string; revisionCode?: string; suitabilityCode?: string }[];
};
export function documentRevision(document: DocumentVersion) {
  return document.revisionCode ?? "R" + String(document.revision).padStart(2, "0");
}
