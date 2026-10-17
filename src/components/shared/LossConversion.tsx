import { itemsFor, lossToItems } from '../../engine/items';
import { money, type Currency, type Locale } from '../../i18n/site';
import './shared.css';
/** currency='CNY' 用于双色球、刮刮乐、抽卡页：英文版也按人民币物价换算 */
interface Props { loss: number; locale: Locale; label: string; variant?: 'inline' | 'panel'; emptyText?: string; currency?: Currency }
export default function LossConversion({ loss, locale, label, variant = 'inline', emptyText = '', currency = 'stake' }: Props) {
  const conversion = lossToItems(loss, locale, currency);
  if (variant === 'inline') return conversion ? <span class="loss-conversion-inline">{label} ≈ {conversion.count} {conversion.item.unit}</span> : null;
  return <div class="loss-conversion-panel">
    <span class="caption">{label}</span><span class="item">{conversion ? `${conversion.count} ${conversion.item.unit}` : emptyText}</span>
    {conversion && <span class="caption amount">{money(loss, locale, false, currency)}</span>}
    <div class="loss-conversion-chips">{itemsFor(locale, currency).map(item => <span key={item.name} class={item.price <= loss ? 'got' : ''}>{item.name}</span>)}</div>
  </div>;
}
