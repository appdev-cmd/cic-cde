import { useId } from "react";
import type { SectionAxis, SectionBounds, SectionCut } from "./types";

const metres = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

export default function SectionControls({
  cut,
  bounds,
  onChange,
}: {
  cut: SectionCut;
  bounds: SectionBounds | null;
  onChange: (cut: SectionCut) => void;
}) {
  const positionId = useId();
  const range = bounds?.[cut.axis];
  const coordinate = range && range[0] + (range[1] - range[0]) * cut.position;
  const side =
    cut.axis === "z"
      ? cut.flipped
        ? "Giữ phía trên"
        : "Giữ phía dưới"
      : `Giữ ${cut.axis.toUpperCase()} ${cut.flipped ? "≥" : "≤"} mặt cắt`;

  return (
    <div
      className="section-controls"
      role="group"
      aria-label="Thiết lập mặt cắt"
    >
      <div className="section-controls-row">
        <select
          aria-label="Trục mặt cắt"
          value={cut.axis}
          onChange={(event) =>
            onChange({ ...cut, axis: event.target.value as SectionAxis })
          }
        >
          <option value="z">Z · Cắt ngang</option>
          <option value="x">X · Cắt đứng</option>
          <option value="y">Y · Cắt đứng</option>
        </select>
        <button
          type="button"
          aria-pressed={cut.flipped}
          onClick={() => onChange({ ...cut, flipped: !cut.flipped })}
        >
          Đảo phía
        </button>
      </div>
      <div className="section-controls-row section-controls-reading">
        <label htmlFor={positionId}>
          {cut.axis === "z" ? "Cao độ cắt" : `Tọa độ ${cut.axis.toUpperCase()}`}
        </label>
        <output htmlFor={positionId}>
          {coordinate === undefined ? "—" : `${metres.format(coordinate)} m`}
        </output>
      </div>
      <input
        id={positionId}
        type="range"
        min={0}
        max={1000}
        value={Math.round(cut.position * 1000)}
        aria-valuetext={
          coordinate === undefined
            ? undefined
            : `${metres.format(coordinate)} mét`
        }
        disabled={!range || range[0] === range[1]}
        onChange={(event) =>
          onChange({ ...cut, position: event.target.valueAsNumber / 1000 })
        }
      />
      <div className="section-controls-side">
        {range ? side : "Chưa có hình học trong phạm vi này"}
      </div>
    </div>
  );
}
