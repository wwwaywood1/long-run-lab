import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import source from '../../../i18n/source/Ch3-Ruin.json';
import { ENDS_AFTER } from '../../components/widgets/RuinCalculator';
import { ruin } from '../../engine/ruin';
import { formatChance, intCount, roughCount } from '../../i18n/format';
import { pageText, plainText } from '../../i18n/page';
import { money } from '../../i18n/site';

/** 文案里写死的数字必须和引擎 / numbers.json 一致；改了公式或数字，这里会先报错 */
describe('Ch3-Ruin copy numbers', () => {
  const base = ruin(100, 200, 1);
  const bold = ruin(100, 200, 100);
  const zh = pageText(source, 'zh');
  const en = pageText(source, 'en');

  it('one winner out of N people', () => {
    const n = intCount(numbers.roulette.ruin_one_in.value);
    expect(n).toBe('37,650');
    for (const { t } of [zh, en]) expect(t(22)).toContain(n);
  });

  it('chance of doubling, bold play and duration', () => {
    for (const { t } of [zh, en]) {
      expect(t(23)).toContain(formatChance(base.pWin));
      expect(t(25)).toContain(formatChance(bold.pWin));
      expect(t(28)).toContain(formatChance(bold.pWin));
    }
    expect(zh.t(18)).toBe(ENDS_AFTER.zh(roughCount(base.expectedRounds)));
    expect(en.t(18)).toBe(ENDS_AFTER.en(roughCount(base.expectedRounds)));
  });

  it('slider defaults match the design copy', () => {
    for (const [id, amount] of [[11, 100], [13, 200], [15, 1]] as const) {
      expect(zh.t(id)).toBe(money(amount, 'zh', false));
      expect(en.t(id)).toBe(money(amount, 'en', false));
    }
  });

  it('the predict answer (option 3, “under 1%”) is the true one', () => {
    expect(base.pWin).toBeLessThan(0.01);
    expect(zh.t(8)).toBe('不到 1%');
  });
});

describe('pageText', () => {
  const src = { page: 'X', strings: [{ id: 'X.001', kind: 'text', zh: '只有 1 个<br>做到了', en: 'only 1<br>made it' }] };
  it('looks up by number and by id, and checks rich markup against the JSON text', () => {
    const { t, rich } = pageText(src, 'en');
    expect(t(1)).toBe('only 1<br>made it');
    expect(t('common.029')).toBe('Guess');
    expect(rich(1, { zh: '', en: 'only <span class="hl">1</span><br>made it' })).toContain('hl');
    expect(() => rich(1, { zh: '', en: 'only <b>2</b><br>made it' })).toThrow();
    expect(() => t(2)).toThrow();
  });
  it('fails instead of silently falling back to Chinese', () => {
    const missing = { page: 'Y', strings: [{ id: 'Y.001', kind: 'text', zh: '中文', en: '' }] };
    expect(() => pageText(missing, 'en').t(1)).toThrow();
    expect(plainText('a <br> b')).toBe('a\nb');
  });
});
