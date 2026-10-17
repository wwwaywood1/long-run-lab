import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import ending from '../../../i18n/source/Ending.json';
import part2 from '../../../i18n/source/Part2-Roulette.json';
import part3 from '../../../i18n/source/Part3-Psych.json';
import part4 from '../../../i18n/source/Part4-RealWorld.json';
import { MULTIPLIER, SHORTFALL, edgeText, multiplierValue } from '../../components/widgets/PayoutBreakdown';
import { COPY as SEQ } from '../../components/widgets/SequenceDetector';
import { TIMES } from '../../components/widgets/TurnoverLedger';
import { payoutBreakdown } from '../../engine/roulette';
import { pageText, plainText } from '../../i18n/page';
import { PAGE_PATH } from '../../i18n/routes';
import { tocEntries } from '../../i18n/toc';

const LOCALES = ['zh', 'en'] as const;

/** DeepSeek D24–D28 的组件模板：在设计稿默认状态下必须与 JSON 原文一字不差，数字必须来自引擎或 numbers.json */
describe('D27 payout breakdown copy', () => {
  it('straight-up bet reproduces Part2-Roulette.024 / 026 / 027 exactly', () => {
    const b = payoutBreakdown('straight');
    for (const l of LOCALES) {
      const { t } = pageText(part2, l);
      expect(MULTIPLIER[l](multiplierValue(b.fair))).toBe(t(24));
      expect(MULTIPLIER[l](multiplierValue(b.pays))).toBe(t(26));
      expect(plainText(SHORTFALL[l](multiplierValue(b.shortfall), edgeText(b.edge)))).toBe(plainText(t(27)));
    }
  });

  it('other bets print the engine numbers', () => {
    expect(multiplierValue(payoutBreakdown('five').fair)).toBe('6.6');
    expect(multiplierValue(payoutBreakdown('dozen').fair)).toBe('2.17');
    expect(multiplierValue(payoutBreakdown('red').fair)).toBe('1.11');
    expect(edgeText(payoutBreakdown('five').edge)).toBe('7.89%');
  });
});

describe('D26 turnover ledger copy and Nevada numbers', () => {
  it('the slider label at 10 equals Part4-RealWorld.011', () => {
    for (const l of LOCALES) expect(TIMES[l](10)).toBe(pageText(part4, l).t(11));
  });

  it('the banker edge in Part4-RealWorld.014 matches numbers.json', () => {
    const edge = (numbers.baccarat.eight_deck_published.value.edge.B * 100).toFixed(2);
    for (const l of LOCALES) expect(pageText(part4, l).t(14)).toContain(`${edge}%`);
  });

  it('the 55-month streak in Part4-RealWorld.024 matches numbers.json', () => {
    const months = String(numbers.facts.nevada_sep_2025.streak_months.value);
    for (const l of LOCALES) expect(pageText(part4, l).t(24)).toContain(months);
  });
});

describe('D28 sequence detector copy', () => {
  it('the progress label at 9 rounds equals Part3-Psych.019', () => {
    for (const l of LOCALES) expect(SEQ[l].progress(9)).toBe(pageText(part3, l).t(19));
  });
});

describe('D25 share statement', () => {
  it('the 4.5 in Ending.030 is p_ahead_after_n[1000] × 100', () => {
    const v = (numbers.roulette.p_ahead_after_n.value['1000'] * 100).toFixed(1);
    expect(v).toBe('4.5');
    for (const l of LOCALES) expect(plainText(pageText(ending, l).t(30))).toContain(v);
  });
});

describe('D24 table of contents', () => {
  it('has 11 entries that all point to real routes', () => {
    const paths = new Set(Object.values(PAGE_PATH));
    for (const l of LOCALES) {
      const toc = tocEntries(l);
      expect(toc).toHaveLength(11);
      for (const e of toc) {
        const path = e.href.replace(/^.*?\/(zh|en)\//, '');
        expect(paths.has(path as never), e.href).toBe(true);
        expect(e.label.trim()).not.toBe('');
      }
    }
  });
});
