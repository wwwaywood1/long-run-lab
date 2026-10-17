import type { ComponentChildren } from 'preact';
import { money, type Currency, type Locale } from '../../i18n/site';
import './shared.css';
/** Sign controls presentation only; settlement is supplied by the engine. */
export const pnlColor = (value: number) => value < 0 ? 'var(--loss)' : value > 0 ? 'var(--you)' : 'var(--ink)';
interface Props { pnl: number; locale: Locale; label: string; meta: string; children?: ComponentChildren; currency?: Currency }
export default function PnlHeader({ pnl, locale, label, meta, children, currency = 'stake' }: Props) {
  return <div class="pnl-header" aria-live="polite" aria-atomic="true">
    <span class="caption">{label}</span><span class="value" style={{ color: pnlColor(pnl) }}>{money(pnl, locale, true, currency)}</span>
    <span class="meta" data-stats>{meta}</span>{children}
  </div>;
}
