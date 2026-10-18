import { expect, it } from 'vitest';
import source from '../../i18n/source/Scratch.json';
import numbers from '../../data/numbers.json';
import { AMOUNTS, PRICE, OFFICIAL_SPLIT, SCRATCH_FAST_ROUNDS } from '../engine/scratch';
import { counted, formatCopy, highlightCopy, makeCopy } from './copy';
import { scratchMoney } from './scratch';
const entry = (id: number) => source.strings.find(e => e.id === `Scratch.${String(id).padStart(3, '0')}`)!;
const flow = numbers.scratch.fund_flow_yuan_per_ticket.value, counts = numbers.scratch.hundred_outcomes.value;
const context = numbers.scratch.presentation_reference.value;
const national = numbers.facts.china_lottery_2025;
it('uses whole translated count sentences and correct ticket plurals', () => {
  const t = makeCopy({ meta: entry(22).zh, lost: '输掉的钱 {{itemText}}' }, source);
  expect(formatCopy(t.en.meta, { cards: 1, hits: 1, evens: 1 }, 'en')).toBe('Scratched 1 · “wins” 1 · 1 only broke even');
  expect(formatCopy(t.en.lost, { itemText: '≈ 1 bubble tea' }, 'en')).toBe('Lost so far ≈ 1 bubble tea');
  expect(counted(1, 'ticket')).toBe('1 ticket'); expect(counted(100, 'ticket')).toBe('100 tickets');
  for (const id of [20, 21, 23, 24, 25, 26, 101, 28, 29, 30, 31, 33, 72, 73, 74, 76, 79, 82, 84, 85, 88, 90, 100]) expect(entry(id).en).not.toMatch(/[\u3400-\u9fff]/);
});
it.each([
  [0, '0元', '¥0'], [10, '10元', '¥10'], [1000, '1,000元', '¥1,000'],
  [10000, '1万', '¥10K'], [100000, '10万', '¥100K'], [1000000, '100万', '¥1M'],
] as const)('formats %s as renminbi on both ticket faces without a factor-of-100 error', (amount, zh, en) => {
  expect(scratchMoney(amount, 'zh')).toBe(zh); expect(scratchMoney(amount, 'en')).toBe(en);
});
it('keeps the exact highlighted sentence in both languages', () => {
  for (const locale of ['zh', 'en'] as const) {
    const text = entry(47)[locale], html = highlightCopy(text, '35%');
    expect(html).toContain('<mark>35%</mark>'); expect(html.replaceAll(/<\/?mark>/g, '')).toBe(text);
  }
});
it('keeps the funding, 100-ticket illustration and prototype batch size consistent', () => {
  expect(Object.values(flow).reduce((a, b) => a + b, 0)).toBe(PRICE);
  expect(flow.prizes / PRICE).toBeCloseTo(numbers.scratch.rtp.value);
  expect(OFFICIAL_SPLIT).toEqual({ prizes: flow.prizes / PRICE, welfare: flow.welfare / PRICE, operations: flow.operations / PRICE });
  expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(100);
  expect(counts.win).toBe(Math.round(numbers.scratch.real_win_rate.value * 100));
  expect(counts.even).toBe(Math.round(numbers.scratch.win_rate.value * numbers.scratch.break_even_share_of_wins.value * 100));
  expect(SCRATCH_FAST_ROUNDS).toBe(100);
});
const numeric = (text: string) => [...text.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
const cases: [number, number[], number[]?][] = [
  [3, [PRICE]], [6, [PRICE, flow.welfare], [flow.welfare, PRICE]],
  [8, [Math.round(national.welfare_fund_yuan / 1e8)], [Number((national.welfare_fund_yuan / 1e9).toFixed(1))]],
  [9, [2025, Math.round(national.sales_yuan / 1e8), Math.round(national.welfare_fund_yuan / national.sales_yuan * 100)], [2025, Math.round(national.welfare_fund_yuan / national.sales_yuan * 100), Math.round(national.sales_yuan / 1e9)]],
  [24, [PRICE, AMOUNTS.at(-1)! / 10000], [PRICE, AMOUNTS.at(-1)! / 1000000]],
  [34, [Math.round(numbers.scratch.win_rate.value * 100), 100]],
  [35, [counts.win]], [36, [counts.even, PRICE]], [37, [counts.miss]],
  [42, [flow.prizes]], [44, [flow.welfare]], [46, [flow.operations]],
  [47, [numbers.scratch.edge.value * 100, PRICE, numbers.scratch.edge.value * PRICE, Math.round(numbers.scratch.edge.value / numbers.roulette.edge_red.value)], [numbers.scratch.edge.value * 100, numbers.scratch.edge.value * PRICE, PRICE, Math.round(numbers.scratch.edge.value / numbers.roulette.edge_red.value)]],
  // 出处是财政部公告 2026 年第 24 号（D5 核实后更新）；英文语序是 No. 24 of 2026
  [48, [OFFICIAL_SPLIT.prizes * 100, OFFICIAL_SPLIT.welfare * 100, OFFICIAL_SPLIT.operations * 100, 2026, 24, OFFICIAL_SPLIT.prizes * 100], [OFFICIAL_SPLIT.prizes * 100, OFFICIAL_SPLIT.welfare * 100, OFFICIAL_SPLIT.operations * 100, 24, 2026, OFFICIAL_SPLIT.prizes * 100]],
  [50, [context.instant_sales_2025_jan_nov_yuan / 1e8], [context.instant_sales_2025_jan_nov_yuan / 1e9]],
  [51, [2025, 1, 11, context.growth_2025 * 100, 2023, Number((context.growth_2023 * 100).toFixed(1))], [2025, context.growth_2025 * 100, 2023, Number((context.growth_2023 * 100).toFixed(1))]],
  [55, [3, 1], [1, 3]],
];
it.each(cases)('Scratch.%s numeric copy agrees with numbers.json / engine in both languages', (id, zh, en) => {
  expect(numeric(entry(id).zh)).toEqual(zh); expect(numeric(entry(id).en)).toEqual(en ?? zh);
});
