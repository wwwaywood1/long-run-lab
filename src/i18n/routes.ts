import type { Locale } from './site';

/**
 * 设计稿文件名 → 正式站点路径（语言前缀之后）。
 * 设计稿里的 href="Ch4-Martingale.dc.html" 在正式页面里写成 pageHref(locale, 'Ch4-Martingale')。
 */
export const PAGE_PATH = {
  Home: '',
  Prologue: 'prologue/',
  'Ch1-EV': 'ch1/',
  'Ch2-LLN': 'ch2/',
  'Ch3-Ruin': 'ch3/',
  'Ch4-Martingale': 'ch4/',
  'Part2-Roulette': 'part2/roulette/',
  'Part2-Scam': 'part2/scam/',
  'Part3-Psych': 'part3/psych/',
  'Part4-RealWorld': 'part4/house/',
  Ending: 'ending/',
  Casino: 'casino/',
  RouletteLab: 'casino/roulette/',
  SicBo: 'casino/sicbo/',
  Baccarat: 'casino/baccarat/',
  Slots: 'casino/slots/',
  Crash: 'casino/crash/',
  Blackjack: 'casino/blackjack/',
  Lottery: 'casino/lottery/',
  Scratch: 'casino/scratch/',
  Gacha: 'casino/gacha/',
  Sports: 'casino/sports/',
  'Research-Ville': 'research/ville/',
  'Research-Detector': 'research/detector/',
} as const;

export type PageName = keyof typeof PAGE_PATH;

export const otherLocale = (locale: Locale): Locale => (locale === 'zh' ? 'en' : 'zh');

/** 站内链接：pageHref('en', 'Ch4-Martingale') → /<base>/en/ch4/；hash 例如 '#s2' */
export function pageHref(locale: Locale, page: PageName, hash = ''): string {
  return `${import.meta.env.BASE_URL}${locale}/${PAGE_PATH[page]}${hash}`;
}
