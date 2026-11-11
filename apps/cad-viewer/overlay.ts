export type CadWindow = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type PlanPoint = { x: number; y: number };
export type PlanPick = { u: number; v: number; view: CadWindow };

export function isPlanPoint(value: unknown): value is PlanPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as PlanPoint;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isCadWindow(value: unknown): value is CadWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as CadWindow;
  return Number.isFinite(window.centerX) && Number.isFinite(window.centerY)
    && Number.isFinite(window.width) && window.width > 0
    && Number.isFinite(window.height) && window.height > 0;
}
