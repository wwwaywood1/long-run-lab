import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import source from '../../../i18n/source/Ch1-EV.json';
import { POCKETS, RED_NUMBERS } from '../../engine/roulette';
import { pageText } from '../../i18n/page';

/** 文案里写死的数字必须和引擎 / numbers.json 一致 */
describe('Ch1-EV copy numbers', () => {
  const zh = pageText(source, 'zh');
  const en = pageText(source, 'en');
  const perHundred = numbers.roulette.edge_red.value * 100;

  it('the predict answer “lose about 5.3” is the true expected loss per 100', () => {
    expect(perHundred.toFixed(1)).toBe('5.3');
    expect(zh.t(8)).toContain('5.3');
    expect(en.t(8)).toContain('5.30');
  });

  it('pocket counts in the legend and ledger match the wheel', () => {
    const win = RED_NUMBERS.size;
    expect(win).toBe(18);
    expect(POCKETS).toBe(38);
    for (const { t } of [zh, en]) {
      expect(t(10)).toContain(String(POCKETS));
      expect(t(11)).toContain(String(win));
      expect(t(12)).toContain(String(POCKETS - win - 2));
      expect(t(14)).toContain(String(win));
      expect(t(15)).toContain(String(POCKETS - win));
    }
  });

  it('the bar chart scale is the one stated in the footnote', () => {
    for (const { t } of [zh, en]) expect(t(26)).toContain('6%');
    expect(numbers.roulette.edge_red.value).toBeLessThan(0.06);
  });
});
