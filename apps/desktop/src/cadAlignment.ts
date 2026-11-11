import type { CadWindow, PlanPick, PlanPoint } from "@qabim/cad-viewer/overlay";

export const cadUnits = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 } as const;
export type CadUnit = "auto" | keyof typeof cadUnits;
export type CadAlignmentValues = {
  drawing: string;
  unit: CadUnit;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  scale?: number;
};
export type CadAlignment = CadAlignmentValues & { visible: boolean };
export type ProjectCadAlignment = { floor: string; revision: number; alignment: CadAlignmentValues | null };

export const defaultCadAlignment: CadAlignment = {
  drawing: "", unit: "auto", x: 0, y: 0, rotation: 0, opacity: 0.8, scale: 1, visible: true,
};

export function sameCadAlignment(a: CadAlignmentValues, b: CadAlignmentValues) {
  return a.drawing === b.drawing && a.unit === b.unit && a.x === b.x && a.y === b.y
    && a.rotation === b.rotation && a.opacity === b.opacity && (a.scale ?? 1) === (b.scale ?? 1);
}

const insertionUnitScale: Record<number, number> = {
  1: 0.0254, 2: 0.3048, 3: 1609.344, 4: 0.001, 5: 0.01, 6: 1, 7: 1000,
  8: 2.54e-8, 9: 0.0000254, 10: 0.9144, 11: 1e-10, 12: 1e-9, 13: 1e-6,
  14: 0.1, 15: 10, 16: 100, 17: 1e9, 18: 149597870700, 19: 9.4607304725808e15,
  20: 3.085677581491367e16, 21: 1200 / 3937, 22: 100 / 3937, 23: 3600 / 3937, 24: 6336000 / 3937,
};

export function detectedCadScale(insunits: number) {
  return insertionUnitScale[insunits];
}

export const minCadScale = 0.000001;
export const maxCadScale = 1000000;

export function cadUnitScale(unit: CadUnit, detectedScale?: number) {
  return unit === "auto" ? (detectedScale ?? cadUnits.mm) : cadUnits[unit];
}

export function toCadWindow(view: CadWindow, alignment: CadAlignment, detectedScale?: number): CadWindow {
  const scale = cadUnitScale(alignment.unit, detectedScale) * (alignment.scale ?? 1);
  const radians = alignment.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const x = view.centerX - alignment.x;
  const y = view.centerY - alignment.y;
  return {
    centerX: (cos * x + sin * y) / scale,
    centerY: (-sin * x + cos * y) / scale,
    width: view.width / scale,
    height: view.height / scale,
  };
}

export function ifcPointFromPick({ u, v, view }: PlanPick, rotation: number): PlanPoint {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const horizontal = (u - 0.5) * view.width;
  const vertical = (0.5 - v) * view.height;
  return { x: view.centerX + cos * horizontal - sin * vertical, y: view.centerY + sin * horizontal + cos * vertical };
}

export function projectIfcPoint(point: PlanPoint, view: CadWindow, rotation: number) {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const x = point.x - view.centerX, y = point.y - view.centerY;
  return { u: 0.5 + (cos * x + sin * y) / view.width, v: 0.5 - (-sin * x + cos * y) / view.height };
}

export function alignCadPoints(
  [cadA, cadB]: readonly [PlanPoint, PlanPoint],
  [ifcA, ifcB]: readonly [PlanPoint, PlanPoint],
  unitScale: number,
): Pick<CadAlignmentValues, "x" | "y" | "rotation" | "scale"> | null {
  const cadX = cadB.x - cadA.x, cadY = cadB.y - cadA.y;
  const ifcX = ifcB.x - ifcA.x, ifcY = ifcB.y - ifcA.y;
  const cadLength = Math.hypot(cadX, cadY), ifcLength = Math.hypot(ifcX, ifcY);
  const metresPerUnit = ifcLength / cadLength;
  const scale = metresPerUnit / unitScale;
  if (!(scale >= minCadScale && scale <= maxCadScale) || ifcLength < 0.000001) return null;
  const angle = Math.atan2(cadX * ifcY - cadY * ifcX, cadX * ifcX + cadY * ifcY);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const x = ifcA.x - metresPerUnit * (cos * cadA.x - sin * cadA.y);
  const y = ifcA.y - metresPerUnit * (sin * cadA.x + cos * cadA.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.max(Math.abs(x), Math.abs(y)) > 1e9) return null;
  return { x, y, rotation: angle * 180 / Math.PI, scale };
}

export function readCadAlignments(key: string): Record<string, CadAlignment> {
  try {
    const data: Record<string, CadAlignment> = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(Object.entries(data).filter(([, value]) =>
      value && typeof value.drawing === "string" && typeof value.visible === "boolean"
      && (value.unit === "auto" || Object.hasOwn(cadUnits, value.unit))
      && [value.x, value.y, value.rotation, value.opacity].every(Number.isFinite)
      && (value.scale === undefined || (value.scale >= minCadScale && value.scale <= maxCadScale))
      && value.opacity >= 0 && value.opacity <= 1,
    ));
  } catch {
    return {};
  }
}
