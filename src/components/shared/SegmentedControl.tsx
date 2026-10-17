import './shared.css';
export interface SegmentedControlProps<T extends string | number> {
  label: string; values: readonly T[]; value: T; format: (value: T) => string;
  onChange: (value: T) => void; disabled?: boolean;
}
export default function SegmentedControl<T extends string | number>({ label, values, value, format, onChange, disabled = false }: SegmentedControlProps<T>) {
  return <div class="seg" role="group" aria-label={label}>
    {values.map(item => <button key={item} type="button" disabled={disabled} aria-pressed={item === value} onClick={() => onChange(item)}>{format(item)}</button>)}
  </div>;
}
