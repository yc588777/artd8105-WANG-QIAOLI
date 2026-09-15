import { useRef } from "react";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  recMin?: number;
  recMax?: number;
  onChange: (v: number) => void;
  onReset?: () => void;
};

export function ParameterSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = "",
  hint,
  recMin,
  recMax,
  onChange,
  onReset,
}: Props) {
  const fine = useRef(false);
  return (
    <label className="param">
      <header>
        <span
          onDoubleClick={() => onReset?.()}
          title="双击恢复默认"
        >
          {label}
        </span>
        <span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number.isInteger(step) ? value : Number(value.toFixed(4))}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ width: 72, textAlign: "right" }}
          />
          {unit}
        </span>
      </header>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={(e) => {
          fine.current = e.shiftKey;
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (fine.current) {
            const mid = (min + max) / 2;
            onChange(value + (v - value) * 0.15);
            void mid;
          } else onChange(v);
        }}
      />
      <span className="hint">
        {hint ?? ""}
        {recMin != null && recMax != null ? `  推荐 ${recMin}–${recMax}` : ""}
      </span>
    </label>
  );
}
