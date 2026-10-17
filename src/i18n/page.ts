import common from '../../i18n/source/common.json';
import type { Locale } from './site';

export interface CopyEntry { id: string; kind: string; zh: string; en: string }
export interface CopySource { page: string; strings: CopyEntry[] }

/** 比较用：<br> 记成换行，去掉其余标签，合并空白 */
export const plainText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

/**
 * 静态页面的文案。一个模板同时渲染中英文：
 *
 *   const { t, rich } = pageText(source, locale);
 *   t(12)            → 本页 JSON 里 "<Page>.012" 的 zh 或 en
 *   t('common.031')  → common.json 里的条目
 *   rich(22, { zh: '…<span class="hl">1</span>…', en: '…' })
 *                    → 需要行内高亮的句子，按语言各写一份 HTML。
 *                      去掉标签后必须和 JSON 原文一字不差，否则构建报错（防止中文改了、高亮版没跟上）。
 *
 * 编号不存在、或英文页缺译文时构建直接报错，不会悄悄退回中文。
 */
export function pageText(source: CopySource, locale: Locale) {
  const entries = new Map<string, CopyEntry>();
  for (const s of (common as CopySource).strings) entries.set(s.id, s);
  for (const s of source.strings) entries.set(s.id, s);

  const idOf = (key: number | string) => (typeof key === 'number' ? `${source.page}.${String(key).padStart(3, '0')}` : key);

  const t = (key: number | string): string => {
    const id = idOf(key);
    const entry = entries.get(id);
    if (!entry) throw new Error(`[copy] ${id} 不在 i18n/source 里`);
    const text = locale === 'zh' ? entry.zh : entry.en;
    if (!text) throw new Error(`[copy] ${id} 缺少 ${locale} 文案`);
    return text;
  };

  const rich = (key: number | string, html: Record<Locale, string>): string => {
    const expected = plainText(t(key));
    const actual = plainText(html[locale]);
    if (actual !== expected) {
      throw new Error(`[copy] ${idOf(key)} 的高亮版和 JSON 不一致（${locale}）\n  JSON: ${expected}\n  HTML: ${actual}`);
    }
    return html[locale];
  };

  return { t, rich, locale };
}
