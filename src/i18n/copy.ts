import common from '../../i18n/source/common.json';
import type { Locale } from './site';

interface Entry { id: string; kind: string; zh: string; en: string }
interface Source { strings: Entry[] }

/**
 * 组件文案表：键 → 设计稿里的中文原文。英文按中文原文到 i18n/source 里查，先查本页 JSON，再查 common.json。
 *
 * 只适合整句文案。设计稿里被代码拆成碎片的句子（kind: "script"），英文的语序和碎片不一一对应，
 * 要按首碎片 note 里的 TEMPLATE 在组件里写成英文函数，不要把碎片拼起来。
 * 英文缺失时退回中文；npm run check:en 会把构建结果里残留的中文列出来。
 */
export function makeCopy<K extends string>(copy: Record<K, string>, page: Source): Record<Locale, Record<K, string>> {
  const find = (zh: string) => page.strings.find(s => s.zh === zh) ?? (common as Source).strings.find(s => s.zh === zh);
  const build = (locale: Locale) => Object.fromEntries(
    (Object.entries(copy) as [K, string][]).map(([key, zh]) => [key, locale === 'en' ? find(zh)?.en || zh : zh]),
  ) as Record<K, string>;
  return { zh: build('zh'), en: build('en') };
}

/** Counted English nouns; also used by whole-sentence templates. */
export const counted = (n: number, singular: string, plural = `${singular}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? singular : plural}`;

/** Interpolate source placeholders, inflecting only the noun attached to that count. */
export function formatCopy(template: string, values: Record<string, string | number>, locale: Locale): string {
  return template.replace(/\{\{(\w+)\}\}(?: (rounds|bets|pulls|celebrations|spins|hands|draws))?/g, (match, key: string, noun?: string) => {
    const value = values[key];
    if (value === undefined) return match;
    const text = typeof value === 'number' ? value.toLocaleString('en-US') : value;
    return `${text}${noun ? ` ${locale === 'en' && value === 1 ? noun.slice(0, -1) : noun}` : ''}`;
  });
}

/** Emphasis is localized separately from the unchanged translated sentence. */
export function highlightCopy(text: string, phrase: string): string {
  const parts = text.split(phrase);
  if (parts.length !== 2) throw new Error(`Expected one highlight phrase: ${phrase}`);
  return `${parts[0]}<mark>${phrase}</mark>${parts[1]}`;
}
