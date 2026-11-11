import { useId, useState } from "react";
import type { SectionAxis, SectionBounds, SectionCut } from "./types";

const metres = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

const coordinateFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 6,
  useGrouping: false,
});

function CutCoordinateInput({
  label,
  range,
  coordinate,
  onCommit,
}: {
  label: string;
  range: SectionBounds[SectionAxis] | undefined;
  coordinate: number | undefined;
  onCommit: (position: number) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const display =
    coordinate === undefined ? "" : coordinateFormat.format(coordinate);
  const disabled = !range || range[0] === range[1];

  function commit() {
    if (!range || disabled || draft === null) return;
    const text = draft.trim();
    const value = Number(text.replace(",", "."));
    if (
      !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text) ||
      !Number.isFinite(value) ||
      value < range[0] ||
      value > range[1]
    ) {
      setInvalid(true);
      return;
    }
    setDraft(null);
    setInvalid(false);
    onCommit((value - range[0]) / (range[1] - range[0]));
  }

  return (
    <>
      <div className="section-controls-coordinate">
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder="—"
          value={draft ?? display}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.stopPropagation();
              setDraft(null);
              setInvalid(false);
            }
          }}
        />
        <span aria-hidden="true">m</span>
      </div>
      {invalid && range && (
        <p className="section-controls-error" id={errorId} role="alert">
          Nhập số từ {coordinateFormat.format(range[0])} đến{" "}
          {coordinateFormat.format(range[1])} m.
        </p>
      )}
    </>
  );
}

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
      <label htmlFor={positionId}>
        {cut.axis === "z" ? "Cao độ cắt" : `Tọa độ ${cut.axis.toUpperCase()}`}
      </label>
      <div className="section-controls-position">
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
        <CutCoordinateInput
          key={`${cut.axis}:${range?.join(":")}:${cut.position}`}
          label={
            cut.axis === "z"
              ? "Nhập cao độ cắt (m)"
              : `Nhập tọa độ ${cut.axis.toUpperCase()} (m)`
          }
          range={range}
          coordinate={coordinate}
          onCommit={(position) => onChange({ ...cut, position })}
        />
      </div>
      <div className="section-controls-side">
        {range ? side : "Chưa có hình học trong phạm vi này"}
      </div>
    </div>
  );
}
