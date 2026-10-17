import { expect, it } from 'vitest';
import source from '../../i18n/source/Lottery.json';
import numbers from '../../data/numbers.json';
import { formatCopy, highlightCopy, makeCopy } from './copy';
import { money } from './site';
import { LOTTERY_DRAWS_PER_WEEK, LOTTERY_DRAWS_PER_YEAR, OFFICIAL_SPLIT, PRICE, PRIZES } from '../engine/lottery';
const entry = (id: number) => source.strings.find(e => e.id === `Lottery.${String(id).padStart(3, '0')}`)!;
const stats = numbers.lottery, facts = numbers.facts.china_lottery_2025;
const context = stats.presentation_reference.value, flow = stats.fund_flow_yuan_per_bet.value;
it('formats a complete CNY sentence with singular draws and no currency conversion', () => {
  const t = makeCopy({ meta: entry(22).zh, lost: entry(23).zh }, source);
  expect(formatCopy(t.en.meta, { draws: 1, years: 'About 1 week', spent: '2', won: '5' }, 'en'))
    .toBe('Bought 1 draw (About 1 week) · spent 2 yuan · won back 5 yuan');
  expect(formatCopy(t.en.lost, { itemText: '≈ 1 bubble tea' }, 'en')).toBe('Spent so far ≈ 1 bubble tea');
  for (const id of [20, 21, 23, 24, 25, 26, 27, 28, 30, 68, 69, 70, 71, 72, 73, 77, 78, 82, 87, 91, 92, 93]) expect(entry(id).en).not.toMatch(/[\u3400-\u9fff]/);
});
it('highlights a language-specific phrase without changing either sentence', () => {
  for (const [locale, phrase] of [['zh', '不到 0.5 元'], ['en', 'less than 0.5 yuan']] as const) {
    const text = entry(57)[locale], html = highlightCopy(text, phrase);
    expect(html).toContain(`<mark>${phrase}</mark>`); expect(html.replaceAll(/<\/?mark>/g, '')).toBe(text);
  }
});
it('conserves the official funding split and keeps it distinct from the assumed jackpot simulation', () => {
  expect(Object.values(flow).reduce((sum, value) => sum + value, 0)).toBeCloseTo(PRICE, 12);
  expect(flow.fixed_prizes / PRICE).toBeCloseTo(stats.fixed_prize_return_rate.value, 15);
  expect((flow.fixed_prizes + flow.top_prizes_and_pool) / PRICE).toBeCloseTo(OFFICIAL_SPLIT.prizes, 15);
  expect(flow.welfare / PRICE).toBeCloseTo(OFFICIAL_SPLIT.welfare, 15);
  expect(stats.site_simulation_return_rate.value).not.toBe(OFFICIAL_SPLIT.prizes);
  expect(context.welfare_allocation.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
});
const numeric = (text: string) => [...text.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
const f = (amount: number) => Number(money(amount, 'en', false, 'CNY').split(' ')[0]);
const cases: [number, number[], number[]?][] = [
  [3, [PRICE, 33, 6, 16, 1, LOTTERY_DRAWS_PER_WEEK], [PRICE, 6, 33, 1, 16, LOTTERY_DRAWS_PER_WEEK]],
  [6, [PRICE, flow.welfare], [flow.welfare, PRICE]],
  [8, [Math.round(facts.welfare_fund_yuan / 1e8)], [Number((facts.welfare_fund_yuan / 1e9).toFixed(1))]],
  [9, [2025, Math.round(facts.sales_yuan / 1e8), Math.round(facts.welfare_fund_yuan / facts.sales_yuan * 100)], [2025, Math.round(facts.welfare_fund_yuan / facts.sales_yuan * 100), Math.round(facts.sales_yuan / 1e9)]],
  [11, [context.welfare_allocation[1] * 100]], [12, [context.welfare_allocation[2] * 100]], [13, [context.welfare_allocation[3] * 100]],
  [33, [10, LOTTERY_DRAWS_PER_WEEK]],
  [43, [stats.jackpot_one_in.value, 10, LOTTERY_DRAWS_PER_YEAR, Math.round(stats.years_for_jackpot_10_bets_3_draws_week.value), context.pyramid_years_ago, context.qin_years_ago]],
  [46, [PRIZES[6], PRIZES[5], PRIZES[4], PRIZES[3]]],
  [47, [f(flow.fixed_prizes)]], [50, [f(flow.top_prizes_and_pool)]], [53, [f(flow.welfare)]], [56, [f(flow.operations)]],
  [58, [(1 - OFFICIAL_SPLIT.prizes) * 100]],
  [61, [Math.round(facts.sales_yuan / 1e8)], [Math.round(facts.sales_yuan / 1e9)]],
  [62, [2025, context.population / 1e8, context.per_capita_sales_display], [2025, context.population / 1e9, context.per_capita_sales_display]],
  [63, [context.ssq_2026_draw076_sales_yuan / 1e8], [context.ssq_2026_draw076_sales_yuan / 1e9]],
];
it.each(cases)('Lottery.%s copy agrees with numbers.json / engine in both languages', (id, zh, en) => {
  expect(numeric(entry(id).zh)).toEqual(zh); expect(numeric(entry(id).en)).toEqual(en ?? zh);
});
