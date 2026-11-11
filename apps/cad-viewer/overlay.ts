export type CadWindow = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export function isCadWindow(value: unknown): value is CadWindow {
  if (!value || typeof value !== "object") return false;
  const window = value as CadWindow;
  return Number.isFinite(window.centerX) && Number.isFinite(window.centerY)
    && Number.isFinite(window.width) && window.width > 0
    && Number.isFinite(window.height) && window.height > 0;
}
