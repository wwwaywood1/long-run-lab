import { useMemo } from 'preact/hooks';
import type { HistoryPoint } from '../../engine/session';
import { pnlColor } from './PnlHeader';
import './shared.css';
interface Props { history: readonly HistoryPoint[]; pnl: number; label: string; note: string; title?: string; height?: number }
export default function PnlChart({ history, pnl, label, note, title, height = 120 }: Props) {
  const chart = useMemo(() => {
    let top = 10, bottom = -10;
    for (const point of history) { top = Math.max(top, point.p, point.e); bottom = Math.min(bottom, point.p, point.e); }
    const pad = (top - bottom) * .08; top += pad; bottom -= pad;
    const y = (v: number) => (6 + (top - v) / (top - bottom) * (height - 12)).toFixed(1);
    const path = (key: 'p' | 'e') => history.length < 2 ? `M0 ${y(0)} L342 ${y(0)}`
      : 'M' + history.map((point, i) => `${(i / (history.length - 1) * 342).toFixed(1)} ${y(point[key])}`).join(' L');
    return { zero: y(0), p: path('p'), e: path('e') };
  }, [history, height]);
  return <div class="pnl-chart">
    {title && <span class="pnl-chart-title">{title}</span>}
    <svg viewBox={`0 0 342 ${height}`} role="img" aria-label={label}>
      <line x1="0" y1={chart.zero} x2="342" y2={chart.zero} stroke="#C9CDD3" stroke-width="1" />
      <path d={chart.e} fill="none" stroke="var(--ink)" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="5 4" />
      <path d={chart.p} fill="none" stroke={pnlColor(pnl)} stroke-width="2.4" stroke-linejoin="round" />
    </svg><p class="shared-note">{note}</p>
  </div>;
}
