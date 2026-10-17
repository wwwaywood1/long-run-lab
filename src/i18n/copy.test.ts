import { describe, expect, it } from 'vitest';
import { counted, formatCopy, highlightCopy, makeCopy } from './copy';
import baccarat from '../../i18n/source/Baccarat.json';
import sicbo from '../../i18n/source/SicBo.json';
import slots from '../../i18n/source/Slots.json';
import crash from '../../i18n/source/Crash.json';
import numbers from '../../data/numbers.json';
import { baccaratNet } from '../engine/baccarat';
import { THREE_KIND } from '../engine/slots';

const sources = { Baccarat: baccarat, SicBo: sicbo, Slots: slots, Crash: crash };
function entry(page: keyof typeof sources, id: number) {
  return sources[page].strings.find(e => e.id === `${page}.${String(id).padStart(3, '0')}`)!;
}
describe('localized presentation contracts', () => {
  it('uses complete common copy and pluralizes only the placeholder noun', () => {
    const t = makeCopy({ lost: '输掉的钱 {{itemText}}' }, baccarat);
    expect(formatCopy(t.en.lost, { itemText: '≈ 2 coffees' }, 'en')).toBe('Lost so far ≈ 2 coffees');
    expect(formatCopy(entry('Baccarat', 10).en, { rounds: 1, bets: 1000 }, 'en')).toBe('1 round · 1,000 bets');
    expect(formatCopy(entry('Slots', 8).en, { spins: 1, rings: 1, fakes: 0 }, 'en')).toBe('1 pull · 1 celebration · 0 of them actually losing');
    expect(formatCopy(entry('Baccarat', 10).zh, { rounds: 1, bets: 1 }, 'zh')).toBe('已发 1 局 · 共 1 注');
    expect([0, 1, 10, 1000].map(n => counted(n, 'table'))).toEqual(['0 tables', '1 table', '10 tables', '1,000 tables']);
  });
  it.each([
    ['Baccarat', 25, '一模一样', 'Exactly'],
    ['Slots', 27, '19 倍', '19 times'],
    ['Crash', 27, '一分不差', 'exactly the same'],
  ] as const)('keeps %s highlights and the full translated sentence', (page, id, zh, en) => {
    for (const locale of ['zh', 'en'] as const) {
      const text = entry(page, id)[locale], phrase = locale === 'zh' ? zh : en;
      const html = highlightCopy(text, phrase);
      expect(html).toContain(`<mark>${phrase}</mark>`);
      expect(html.replaceAll(/<\/?mark>/g, '')).toBe(text);
    }
    expect(() => highlightCopy(entry(page, id).en, zh)).toThrow();
  });
});

// Static translated sentences retain their numbers verbatim. Fail on a stale figure
// instead of rewriting arbitrary digits/substrings in Astro at runtime.
const { prob, edge } = numbers.baccarat.eight_deck_published.value;
const counts = numbers.sicbo.counts.value;
const slotCounts = numbers.slots.hundred_outcomes.value;
const crashLoss = -numbers.crash.ev_any_target.value * 100;
const cases: [keyof typeof sources, number, number[], number[]?][] = [
  ['Baccarat', 29, [Number(((Math.round(prob.B * 1e6) - Math.round(prob.P * 1e6)) / 1e4).toFixed(2)), Math.round((1 - baccaratNet('B', 'B')) * 100)]],
  ['Baccarat', 33, [Math.floor(edge.T / edge.B)]],
  ['SicBo', 19, [counts.big + counts.small + counts.triple]],
  ['SicBo', 20, [counts.small]], ['SicBo', 21, [counts.big]],
  ['SicBo', 22, [counts.triple]], ['SicBo', 23, [counts.triple]],
  ['SicBo', 24, [100, Number((numbers.sicbo.edge_big_small.value * 100).toFixed(2))]],
  ['Slots', 17, [slotCounts.win + slotCounts.ldw + slotCounts.miss]],
  ['Slots', 18, [slotCounts.win]], ['Slots', 19, [slotCounts.ldw]], ['Slots', 20, [slotCounts.miss]],
  ['Slots', 24, [7, THREE_KIND['777']]],
  ['Slots', 25, [1, Math.round(1 / numbers.slots.p_77x.value)]],
  ['Slots', 27, [Math.round(numbers.slots.p_77x.value / numbers.slots.p_777.value), 7]],
  ['Crash', 19, [100, crashLoss]], ['Crash', 20, [crashLoss]],
  ['Crash', 21, [crashLoss, 0, 0]],
  ['Crash', 28, [100, crashLoss], [crashLoss, 100]],
  ['Crash', 29, [numbers.crash.rtp.value * 100]],
];
it.each(cases)('%s.%s figures agree with numbers.json / engine constants in both languages', (page, id, expected, english) => {
  for (const locale of ['zh', 'en'] as const) {
    const values = [...entry(page, id)[locale].matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
    expect(values).toEqual(locale === 'en' ? english ?? expected : expected);
  }
});
