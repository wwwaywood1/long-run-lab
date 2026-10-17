import { expect, it } from 'vitest';
import numbers from '../../data/numbers.json';
import source from '../../i18n/source/Blackjack.json';
import { formatCopy, highlightCopy, makeCopy } from './copy';
import { BLACKJACK_ROUNDS_PER_HOUR, DECKS } from '../engine/blackjack';
const reference = numbers.blackjack.presentation_reference.value;
const counting = reference.counting;
const entry = (id: number) => source.strings.find(e => e.id === `Blackjack.${String(id).padStart(3, '0')}`)!;
it('localizes shared and page copy without fragments or missing translations', () => {
  const t = makeCopy({ meta: entry(12).zh, lost: '输掉的钱 {{itemText}}', action: '要牌', strategy: '学庄家' }, source);
  expect(formatCopy(t.en.meta, { rounds: 1, bets: 1 }, 'en')).toBe('1 round · 1 hand');
  expect(formatCopy(t.en.lost, { itemText: '≈ 1 coffee' }, 'en')).toBe('Lost so far ≈ 1 coffee');
  expect(t.en.action).toBe('Hit'); expect(t.en.strategy).toBe('Mimic the dealer');
  for (const id of [1, 3, 16, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 77, 81, 82, 83, 86, 91, 100, 101, 107, 108, 109, 110, 111]) expect(entry(id).en.length).toBeGreaterThan(0);
});
it('highlights the localized phrase while preserving the complete sentence', () => {
  for (const [locale, phrase] of [['zh', '输得最慢'], ['en', 'you lose the slowest']] as const) {
    const text = entry(52)[locale], html = highlightCopy(text, phrase);
    expect(html).toContain(`<mark>${phrase}</mark>`);
    expect(html.replaceAll(/<\/?mark>/g, '')).toBe(text);
  }
});
// These figures have design-reference provenance, not a claim of a newly rerun experiment.
const cases: [number, number[], number[]?][] = [
  [19, [BLACKJACK_ROUNDS_PER_HOUR]], [21, [reference.player_busts]], [22, [reference.both_busts]],
  [23, [reference.bust_sample]],
  [25, [3, 2, reference.strategy_edges.basic_3to2 * 100, reference.bust_simulation_rounds / 1e4], [3, 2, reference.strategy_edges.basic_3to2 * 100, reference.bust_simulation_rounds / 1e6]],
  [30, [4]],
  [35, [DECKS, 17, reference.strategy_simulation_rounds[0] / 1e4, reference.strategy_simulation_rounds[1] / 1e4, 6, 5], [DECKS, 17, reference.strategy_simulation_rounds[0] / 1e6, reference.strategy_simulation_rounds[1] / 1e6, 6, 5]],
  [39, [2, 2, 3, 4, 4, 8, counting.simulation_rounds / 1e4], [2, 2, 3, 4, 4, 8, counting.simulation_rounds / 1e6]],
  [41, [counting.minimum_bet]], [42, [counting.hourly_win]], [44, [counting.hourly_swing]],
  [45, [counting.confidence * 100]], [46, [counting.hours / 1e4], [counting.hours]],
  [47, [counting.hours_per_day, 5], [counting.hours_per_day, 5]], // Chinese 半 / English half encode the remaining 0.5 year.
];
it.each(cases)('Blackjack.%s numeric copy agrees with its source in both languages', (id, zh, en) => {
  for (const locale of ['zh', 'en'] as const) {
    const text = entry(id)[locale].replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '');
    const digits = [...text.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
    expect(digits).toEqual(locale === 'en' ? en ?? zh : zh);
  }
});
it('keeps the unreproduced design references explicitly separate from the existing simulation', () => {
  expect(numbers.blackjack.presentation_reference.method).toBe('design_reference');
  expect(numbers.blackjack.presentation_reference.source).toContain('preview/Blackjack.dc.html');
  expect(numbers.blackjack.basic_strategy_edge.method).toBe('simulation');
  expect(counting.years).toBe(5.5);
});
