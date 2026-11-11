import type { CadWindow } from "@qabim/cad-viewer/overlay";

export const cadUnits = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 } as const;
export type CadUnit = "auto" | keyof typeof cadUnits;
export type CadAlignment = {
  drawing: string;
  unit: CadUnit;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
};

export const defaultCadAlignment: CadAlignment = {
  drawing: "", unit: "auto", x: 0, y: 0, rotation: 0, opacity: 0.8, visible: true,
};

const insertionUnitScale: Record<number, number> = {
  1: 0.0254, 2: 0.3048, 3: 1609.344, 4: 0.001, 5: 0.01, 6: 1, 7: 1000,
  8: 2.54e-8, 9: 0.0000254, 10: 0.9144, 11: 1e-10, 12: 1e-9, 13: 1e-6,
  14: 0.1, 15: 10, 16: 100, 17: 1e9, 18: 149597870700, 19: 9.4607304725808e15,
  20: 3.085677581491367e16, 21: 1200 / 3937, 22: 100 / 3937, 23: 3600 / 3937, 24: 6336000 / 3937,
};

export function detectedCadScale(insunits: number) {
  return insertionUnitScale[insunits];
}

export function toCadWindow(view: CadWindow, alignment: CadAlignment, detectedScale?: number): CadWindow {
  const scale = alignment.unit === "auto" ? (detectedScale ?? cadUnits.mm) : cadUnits[alignment.unit];
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

export function readCadAlignments(key: string): Record<string, CadAlignment> {
  try {
    const data: Record<string, CadAlignment> = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(Object.entries(data).filter(([, value]) =>
      value && typeof value.drawing === "string" && typeof value.visible === "boolean"
      && (value.unit === "auto" || Object.hasOwn(cadUnits, value.unit))
      && [value.x, value.y, value.rotation, value.opacity].every(Number.isFinite)
      && value.opacity >= 0 && value.opacity <= 1,
    ));
  } catch {
    return {};
  }
}
