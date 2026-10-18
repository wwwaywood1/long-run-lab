import { describe, expect, it } from 'vitest';
import source from '../../../i18n/source/Ch4-Martingale.json';
import { AXIS } from '../../components/widgets/MartingaleLab';
import { BUST, BUST_IN_ROUNDS, EV_PER_ROUND, LADDER, MG, STORY, storySession } from '../../engine/martingale';
import { pageText } from '../../i18n/page';
import { money } from '../../i18n/site';

const LOCALES = ['zh', 'en'] as const;
const nums = (s: string) => (s.replace(/(?<=\d),(?=\d)/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

/** 第 4 章文案里的数字必须和引擎一致；默认画面的标签必须和 JSON 一字不差 */
describe('Ch4-Martingale copy numbers', () => {
  for (const l of LOCALES) {
    const { t } = pageText(source, l);
    it(`${l}: parameters and the default story`, () => {
      expect(nums(t(15))).toEqual([MG.base, MG.limit, MG.bankroll]);
      expect(nums(t(17))).toEqual([MG.bankroll]);
      const s = storySession();
      const n = s.path.length - 1;
      expect(n).toBe(STORY.wins + 1);
      expect(nums(t(18))).toEqual([STORY.wins, s.path[n - 1] - MG.bankroll]);
      expect(AXIS[l]('round', 0)).toBe(t(19));
      expect(AXIS[l]('round', n)).toBe(t(20));
      expect(nums(t(21))).toEqual([STORY.wins, MG.base, n, MG.steps, LADDER]);
      expect(nums(t(16)).sort((a, b) => a - b)).toEqual([STORY.wins, n, LADDER]);
    });
    it(`${l}: section 03 (98.88% / 1.12% / −4.32 / 67.5%)`, () => {
      expect(((1 - BUST) * 100).toFixed(2)).toBe('98.88');
      expect((BUST * 100).toFixed(2)).toBe('1.12');
      expect(nums(t(23))).toEqual([MG.base]);
      expect(nums(t(24))).toEqual([LADDER]);
      expect(money(EV_PER_ROUND, l)).toBe(t(26));
      expect(nums(t(27))).toEqual([100, MG.steps, Number((BUST_IN_ROUNDS(100) * 100).toFixed(1))]);
    });
    it(`${l}: the table-limit chart`, () => {
      expect(nums(t(33))).toEqual([8, 1280, MG.limit]);
      expect(nums(t(34))).toEqual([MG.limit]);
    });
  }
});
