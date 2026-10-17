import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import source from '../../../i18n/source/Prologue.json';
import numbers from '../../../data/numbers.json';
import { pageText, plainText } from '../../i18n/page';
import { LEDGER, LEDGER_ROUNDS, PROLOGUE_CHANCE, PROLOGUE_COMPARISON, initialLedger } from '../../engine/house-ledger';
import { money } from '../../i18n/site';

describe('Prologue copy numbers', () => {
  for (const locale of ['zh', 'en'] as const) {
    const { t }=pageText(source,locale);
    const digits=(id:number)=>(t(id).replace(/(?<=\d),(?=\d)/g,'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    it(`${locale}: experiment, default design fixture and chart labels`, () => {
      expect(digits(4)).toEqual([LEDGER.guests,LEDGER.rounds,LEDGER.bet]);
      expect(t(14)).toBe(money(initialLedger().house.at(-1)!,locale));
      expect(digits(16)).toEqual([0]); expect(digits(17)).toEqual([LEDGER_ROUNDS]);
      expect(digits(18)).toEqual([100*LEDGER.coverage]); expect(digits(20)).toEqual([LEDGER.nights]);
      expect(digits(22)).toEqual([numbers.prologue.design_reference.value.illustrated_guests,numbers.prologue.design_reference.value.illustrated_winners]);
      expect(digits(23)).toEqual([LEDGER.rounds,Number((numbers.roulette.p_ahead_after_n.value['100']*100).toFixed(1))]);
    });
    it(`${locale}: tiny probability, zero count and lottery comparison`, () => {
      expect(digits(27)).toEqual([Number(PROLOGUE_CHANCE.coefficient),10,-PROLOGUE_CHANCE.exponent]);
      expect(digits(28)).toEqual([PROLOGUE_CHANCE.zeros,Number(PROLOGUE_CHANCE.coefficient),10]);
      expect(t(28)).toContain('⁻⁶²');
      const expected=locale==='zh'?[LEDGER.lottery_draws,PROLOGUE_COMPARISON]:[PROLOGUE_COMPARISON,LEDGER.lottery_draws];
      expect(digits(29)).toEqual(expected);
      expect(digits(30)).toEqual([1,numbers.lottery.jackpot_one_in.value]);
      expect(digits(36)).toEqual(locale==='zh'?[LEDGER_ROUNDS/2,1.3,10]:[LEDGER_ROUNDS,LEDGER_ROUNDS/2,1.3,10]);
      expect(t(36)).toContain('⁻⁶²');
    });
    it(`${locale}: Nevada fact/date fields match the existing cited source`, () => {
      const fact=numbers.facts.nevada_sep_2025;
      expect(t(33)).toContain(String(fact.consecutive_months));
      expect(t(33)).toContain(fact.as_of.slice(0,4));
      expect(t(33)).toContain(locale==='zh'?String(fact.monthly_win_usd_floor/1e8)+' 亿美元':'$'+fact.monthly_win_usd_floor/1e9+' billion');
      expect(t(34)).toContain(fact.reported_on);
    });
  }
  it('the unchanged static illustration really contains 14 paths and 5 positive endpoints', () => {
    const view=readFileSync(new URL('../Prologue.astro',import.meta.url),'utf8');
    const chart=view.split('<Step id="s3"')[1].split('</svg>')[0];
    const paths=[...chart.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
    expect(paths).toHaveLength(14);
    expect(paths.filter(d=>Number(d.match(/310\.0 ([\d.]+)$/)![1])<71)).toHaveLength(5);
    expect(plainText(pageText(source,'en').t(8))).toBe('Almost impossible');
    expect(numbers.prologue.house_loss_probability.value).toBeLessThan(1e-60);
  });
});
