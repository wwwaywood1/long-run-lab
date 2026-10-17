import { describe, it, expect } from 'vitest';
import source from '../../../i18n/source/Casino.json';
import numbers from '../../../data/numbers.json';
import { pageText } from '../../i18n/page';
import { money } from '../../i18n/site';
import { CASINO_EDGES, CASINO_SPEEDS, CASINO_SPEED_RATIO, HOUSE_ASSUMPTIONS, HOUSE_GAME_IDS, houseNight } from '../../engine/house';
import { houseChance } from '../../components/widgets/HouseCalculator';
import { POCKETS, RED_NUMBERS } from '../../engine/roulette';
import { baccaratNet } from '../../engine/baccarat';

describe('Casino bilingual statistics match data and engines', () => {
  for (const locale of ['zh', 'en'] as const) {
    const { t } = pageText(source, locale);
    const digits = (id: number) => (t(id).match(/\d+(?:\.\d+)?/g) || []).map(Number);
    it(`${locale}: static explanatory numbers and model assumptions`, () => {
      expect(digits(5)).toEqual([POCKETS, POCKETS - 2 * RED_NUMBERS.size]);
      expect(digits(11)).toEqual([Math.round((1 - baccaratNet('B', 'B')) * 100)]);
      expect(digits(39)).toEqual([2, POCKETS]);
      expect(digits(41)).toEqual([numbers.sicbo.counts.value.triple, 6 ** 3]);
      expect(digits(43)).toEqual([Math.round(CASINO_EDGES.crash * 100), 100]);
      expect(digits(46)).toEqual([numbers.blackjack.presentation_reference.value.both_busts, numbers.blackjack.presentation_reference.value.bust_sample]);
      expect(digits(50)).toEqual([Math.round(CASINO_EDGES.sports * 100)]);
      expect(digits(56)).toEqual([HOUSE_ASSUMPTIONS.speed_bet]);
      expect(digits(72)).toEqual([HOUSE_ASSUMPTIONS.guests]);
      expect(digits(76)).toEqual([HOUSE_ASSUMPTIONS.hours]);
      expect(digits(81)).toEqual([HOUSE_ASSUMPTIONS.guests]);
      expect(digits(96)).toEqual([HOUSE_ASSUMPTIONS.crash_target, HOUSE_ASSUMPTIONS.rounds_per_hour.crash]);
      for (const [id, game] of [[87, 'roulette'], [89, 'sicbo'], [92, 'baccarat'], [94, 'slots']] as const)
        expect(digits(id)).toEqual([HOUSE_ASSUMPTIONS.rounds_per_hour[game]]);
    });
    it(`${locale}: speed labels, rounded money and approximate ratio`, () => {
      CASINO_SPEEDS.forEach((s, i) => {
        const precision = s.id === 'slots' ? 1 : s.id === 'crash' ? 0 : 2;
        expect(digits(57 + 2 * i)).toEqual([Number((s.edge * 100).toFixed(precision)), s.rounds]);
        expect(digits(58 + 2 * i)).toEqual([s.displayLoss]);
        expect(money(s.displayLoss, locale, false)).toContain(String(s.displayLoss));
      });
      expect(digits(69)).toEqual([HOUSE_ASSUMPTIONS.speed_bet, Math.round(CASINO_SPEED_RATIO / 10) * 10]);
    });
    it(`${locale}: calculated probability reproduces Casino.091 and threshold copy`, () => {
      expect(houseChance(houseNight('baccarat', 100).lossProbability, locale)).toBe(t(91));
      expect(houseChance(1e-9 - 1e-15, locale)).toBe(t(86));
      expect(houseChance(1e-9, locale)).not.toBe(t(86));
      for (const game of HOUSE_GAME_IDS) expect(houseChance(houseNight(game, 10).lossProbability, locale)).not.toContain('NaN');
    });
  }
  it('all numeric table edges and explicitly retained blackjack reference', () => {
    expect(Object.values(CASINO_EDGES).map(x => +(x * 100).toFixed(2))).toEqual([5.26, 2.78, 1.06, 8.22, 3, 49, 35, 100, 8]);
    expect(numbers.blackjack.presentation_reference.value.strategy_edges.basic_3to2).toBe(0.005);
    expect(HOUSE_ASSUMPTIONS.blackjack_speed_edge).toBe(0.0046);
  });
});
