export type Locale = 'zh' | 'en';

export const SITE: Record<Locale, { name: string; subtitle: string; tagline: string; casino: string; research: string; footer: string }> = {
  zh: { name: '概率的游戏', subtitle: '庄家从不掷“骰子”', tagline: '亲手玩一遍，你会自己得出结论。', casino: '赌场大厅', research: '研究层', footer: '概率的游戏 · 开源公益项目' },
  en: { name: 'Long Run Lab', subtitle: "The house doesn't play dice.", tagline: 'Play it yourself. The conclusion will be yours.', casino: 'Casino floor', research: 'Research', footer: 'Long Run Lab · open source' },
};

/**
 * 金额的货币：
 * - 'stake'：假设的赌注（赌场桌游、章节页）。中文写元，英文写美元。
 * - 'CNY'：中国真实价格（双色球、刮刮乐、抽卡页）。英文也写人民币，见 docs/TRANSLATION.md 第 5 条。
 */
export type Currency = 'stake' | 'CNY';

/** 金额格式：中文“+1,234 元”，英文“+$1,234”；人民币页面的英文是“+1,234 yuan” */
export function money(n: number, locale: Locale, signed = true, currency: Currency = 'stake'): string {
  const a = Math.abs(n);
  const body = a < 100 && Math.abs(a - Math.round(a)) > 0.001 ? a.toFixed(a < 10 ? 2 : 1) : Math.round(a).toLocaleString('en-US');
  const sign = !signed || Math.round(n * 10) === 0 ? '' : n > 0 ? '+' : '−';
  if (locale === 'zh') return `${sign}${body} 元`;
  return currency === 'CNY' ? `${sign}${body} yuan` : `${sign}$${body}`;
}
