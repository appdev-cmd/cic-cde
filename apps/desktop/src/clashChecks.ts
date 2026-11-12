import type { BimElement, CheckRun } from "./types";

export const clashClasses = {
  IfcDuctSegment: "Đoạn ống gió",
  IfcPipeSegment: "Đoạn ống",
  IfcBeam: "Dầm",
  IfcColumn: "Cột",
  IfcSlab: "Sàn",
  IfcWall: "Tường",
} as const;

export type ClashClass = keyof typeof clashClasses;

export const clashPresets = [
  { label: "Ống gió × Dầm", classA: "IfcDuctSegment", classB: "IfcBeam" },
  { label: "Ống × Dầm", classA: "IfcPipeSegment", classB: "IfcBeam" },
  { label: "Ống gió × Tường", classA: "IfcDuctSegment", classB: "IfcWall" },
  { label: "Ống × Sàn", classA: "IfcPipeSegment", classB: "IfcSlab" },
] as const satisfies ReadonlyArray<{ label: string; classA: ClashClass; classB: ClashClass }>;

const supportedSubtypes: Partial<Record<ClashClass, readonly string[]>> = {
  IfcBeam: ["IfcBeamStandardCase"],
  IfcColumn: ["IfcColumnStandardCase"],
  IfcSlab: ["IfcSlabStandardCase", "IfcSlabElementedCase"],
  IfcWall: ["IfcWallStandardCase", "IfcWallElementedCase"],
};

export function countClashCandidates(
  elements: readonly BimElement[],
  floor: string,
  ifcClass: ClashClass,
) {
  const counts = new Map<string, number>();
  const classes = new Set([ifcClass, ...(supportedSubtypes[ifcClass] ?? [])]);
  for (const element of elements) {
    if ((floor === "all" || element.storey === floor) && classes.has(element.ifcClass)) {
      counts.set(element.modelId, (counts.get(element.modelId) ?? 0) + 1);
    }
  }
  return counts;
}

export function clashCoverageLabel(coverage: CheckRun["coverage"]) {
  if (!coverage.groupA || !coverage.groupB) {
    return "Thiếu đối tượng ở nhóm " + (!coverage.groupA && !coverage.groupB ? "A và B" : !coverage.groupA ? "A" : "B");
  }
  if (coverage.hasCandidateGroups === false) return "Chưa có cặp cấu kiện để kiểm tra";
  if (coverage.limitReached) return "Đạt giới hạn số kết quả";
  return coverage.complete ? "Độ bao phủ đầy đủ" : "Độ bao phủ chưa đầy đủ";
}
