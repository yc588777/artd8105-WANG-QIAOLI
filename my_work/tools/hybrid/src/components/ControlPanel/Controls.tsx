export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" className={on ? "active" : ""} onClick={() => onChange(!on)}>
      {label} {on ? "ON" : "OFF"}
    </button>
  );
}

export function PresetSelector<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? "active" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return <PresetSelector {...props} />;
}

export function MetricReadout({ items }: { items: { k: string; v: string }[] }) {
  return (
    <div className="metrics">
      {items.map((it) => (
        <div key={it.k}>
          <b>{it.k}</b>
          {it.v}
        </div>
      ))}
    </div>
  );
}
