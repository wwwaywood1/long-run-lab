// src/i18n/toc.ts
/**
 * 全站章节目录：首页“目录”段和页眉的“目录”按钮共用这一份数据。
 * 文案仍取自 i18n/source/Home.json（Home.016–Home.029），链接仍用 pageHref。
 */
import home from '../../i18n/source/Home.json';
import { pageText } from './page';
import { pageHref } from './routes';
import type { Locale } from './site';

export interface TocEntry {
  href: string;
  /** 左侧 mono 短标签：序 / 01–08 / 厅 / 终 */
  tag: string;
  /** 章节名 */
  label: string;
}

export function tocEntries(locale: Locale): TocEntry[] {
  const { t } = pageText(home, locale);
  return [
    { href: pageHref(locale, 'Prologue'), tag: t(16), label: t(17) },
    { href: pageHref(locale, 'Ch1-EV'), tag: '01', label: t(18) },
    { href: pageHref(locale, 'Ch2-LLN'), tag: '02', label: t(19) },
    { href: pageHref(locale, 'Ch3-Ruin'), tag: '03', label: t(20) },
    { href: pageHref(locale, 'Ch4-Martingale'), tag: '04', label: t(21) },
    { href: pageHref(locale, 'Part2-Roulette'), tag: '05', label: t(32) },
    { href: pageHref(locale, 'Part2-Scam'), tag: '06', label: t(23) },
    { href: pageHref(locale, 'Part3-Psych'), tag: '07', label: t(24) },
    { href: pageHref(locale, 'Part4-RealWorld'), tag: '08', label: t(25) },
    { href: pageHref(locale, 'Casino'), tag: t(26), label: t(27) },
    { href: pageHref(locale, 'Ending'), tag: t(28), label: t(29) },
  ];
}
