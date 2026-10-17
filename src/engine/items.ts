/** 把输掉的钱换算成实物。中文版用人民币物价，英文版用美元物价（均为大致参考）。 */
export interface Item { unit: string; name: string; price: number }

export const ITEMS: Record<'zh' | 'en', Item[]> = {
  zh: [
    { unit: '杯奶茶', name: '一杯奶茶', price: 20 }, { unit: '张电影票', name: '一张电影票', price: 50 }, { unit: '顿火锅', name: '一顿火锅', price: 200 },
    { unit: '双运动鞋', name: '一双运动鞋', price: 600 }, { unit: '个月生活费', name: '一个月生活费', price: 2000 }, { unit: '部手机', name: '一部手机', price: 5000 },
    { unit: '台笔记本电脑', name: '一台笔记本电脑', price: 8000 }, { unit: '年房租', name: '一年房租', price: 30000 }, { unit: '辆小汽车', name: '一辆小汽车', price: 100000 },
    { unit: '套房的首付', name: '一套房的首付', price: 500000 },
  ],
  en: [
    { unit: 'coffees', name: 'a coffee', price: 5 }, { unit: 'movie tickets', name: 'a movie ticket', price: 15 }, { unit: 'dinners out', name: 'a dinner out', price: 60 },
    { unit: 'pairs of sneakers', name: 'sneakers', price: 120 }, { unit: "months' groceries", name: 'a month of groceries', price: 500 }, { unit: 'phones', name: 'a phone', price: 900 },
    { unit: 'laptops', name: 'a laptop', price: 1500 }, { unit: "years' rent", name: 'a year of rent', price: 20000 }, { unit: 'cars', name: 'a car', price: 30000 },
    { unit: 'house down payments', name: 'a down payment', price: 80000 },
  ],
};

/** 人民币页面（双色球、刮刮乐、抽卡）的英文版：英文名称、人民币价格，与 ITEMS.zh 一一对应 */
export const ITEMS_EN_CNY: Item[] = [
  { unit: 'bubble teas', name: 'a bubble tea', price: 20 }, { unit: 'movie tickets', name: 'a movie ticket', price: 50 }, { unit: 'hot pot dinners', name: 'a hot pot dinner', price: 200 },
  { unit: 'pairs of sneakers', name: 'sneakers', price: 600 }, { unit: "months' living costs", name: 'a month of living costs', price: 2000 }, { unit: 'phones', name: 'a phone', price: 5000 },
  { unit: 'laptops', name: 'a laptop', price: 8000 }, { unit: "years' rent", name: 'a year of rent', price: 30000 }, { unit: 'cars', name: 'a car', price: 100000 },
  { unit: 'apartment down payments', name: 'a down payment', price: 500000 },
];

/** 金额是假设的赌注（'stake'）还是中国真实价格（'CNY'），见 src/i18n/site.ts 的 money() */
export function itemsFor(locale: 'zh' | 'en', currency: 'stake' | 'CNY' = 'stake'): Item[] {
  return locale === 'en' && currency === 'CNY' ? ITEMS_EN_CNY : ITEMS[locale];
}

/** 返回“≈ 3 顿火锅”式的换算；不足最便宜的一件时返回 null */
export function lossToItems(loss: number, locale: 'zh' | 'en', currency: 'stake' | 'CNY' = 'stake'): { count: number; item: Item } | null {
  let best: Item | null = null;
  for (const it of itemsFor(locale, currency)) if (it.price <= loss) best = it;
  return best ? { count: Math.floor(loss / best.price), item: best } : null;
}
