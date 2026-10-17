import { Fragment, type ComponentChildren } from 'preact';
import './shared.css';
interface Props<T> { items: readonly T[]; label: string; renderCell: (item: T, index: number) => ComponentChildren; className?: string }
/** Ten columns for 100 people, results or tables; callers supply all semantics. */
export default function HundredGrid<T>({ items, label, renderCell, className = '' }: Props<T>) {
  return <div class={`hundred-grid ${className}`} role="group" aria-label={label}>
    {items.map((item, index) => <Fragment key={index}>{renderCell(item, index)}</Fragment>)}
  </div>;
}
