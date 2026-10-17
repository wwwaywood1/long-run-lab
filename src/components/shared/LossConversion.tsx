import { itemsFor, lossToItems } from '../../engine/items';
import { money, type Currency, type Locale } from '../../i18n/site';
import { formatCopy } from '../../i18n/copy';
import './shared.css';
const SINGULAR: Record<string, string> = { coffees: 'coffee', 'bubble teas': 'bubble tea', 'movie tickets': 'movie ticket', 'dinners out': 'dinner out', 'hot pot dinners': 'hot pot dinner', 'pairs of sneakers': 'pair of sneakers', "months' groceries": "month's groceries", "months' living costs": "month's living costs", phones: 'phone', laptops: 'laptop', "years' rent": "year's rent", cars: 'car', 'house down payments': 'house down payment', 'apartment down payments': 'apartment down payment' };
/** currency='CNY' 用于双色球、刮刮乐、抽卡页：英文版也按人民币物价换算 */
interface Props { loss: number; locale: Locale; label: string; variant?: 'inline' | 'panel'; emptyText?: string; currency?: Currency }
export default function LossConversion({ loss, locale, label, variant = 'inline', emptyText = '', currency = 'stake' }: Props) {
  const conversion = lossToItems(loss, locale, currency);
  const itemText = conversion ? `${conversion.count} ${locale === 'en' && conversion.count === 1 ? SINGULAR[conversion.item.unit] : conversion.item.unit}` : '';
  if (variant === 'inline') return conversion ? <span class="loss-conversion-inline">{formatCopy(label, { itemText: `≈ ${itemText}` }, locale)}</span> : null;
  return <div class="loss-conversion-panel">
    <span class="caption">{label}</span><span class="item">{conversion ? itemText : emptyText}</span>
    {conversion && <span class="caption amount">{money(loss, locale, false, currency)}</span>}
    <div class="loss-conversion-chips">{itemsFor(locale, currency).map(item => <span key={item.name} class={item.price <= loss ? 'got' : ''}>{item.name}</span>)}</div>
  </div>;
}
