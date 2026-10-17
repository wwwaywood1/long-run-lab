import { money, type Locale } from './site';
/** Compact ticket-face amounts follow Scratch.062–069, always in renminbi. */
export function scratchMoney(amount: number, locale: Locale): string {
  const body = (value: number) => money(value, locale, false, 'CNY').split(' ')[0];
  if (locale === 'zh') return amount >= 10_000 ? `${body(amount / 10_000)}万` : `${body(amount)}元`;
  if (amount >= 1_000_000) return `¥${body(amount / 1_000_000)}M`;
  if (amount >= 10_000) return `¥${body(amount / 1_000)}K`;
  return `¥${body(amount)}`;
}
