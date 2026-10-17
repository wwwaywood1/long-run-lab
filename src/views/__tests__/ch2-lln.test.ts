import { describe, expect, it } from 'vitest';
import source from '../../../i18n/source/Ch2-LLN.json';
import numbers from '../../../data/numbers.json';
import { pageText } from '../../i18n/page';
import { EDGE_RED } from '../../engine/roulette';
import { aheadPerHundred, rareAheadMillions, LLN_PLAYERS, LLN_COVERAGE, LLN_DEFAULT_SEED, simulatePaths } from '../../engine/lln';

describe('Ch2 bilingual copy numbers', () => {
  for(const locale of ['zh','en'] as const) {
    const {t}=pageText(source,locale);
    it(`${locale}: source claims agree with engine and generated data`, () => {
      expect(t(4)).toContain((EDGE_RED*100).toFixed(2)+'%');
      expect(t(16)).toContain('−'+(EDGE_RED*100).toFixed(2)+'%');
      expect(t(11)).toContain(String(LLN_PLAYERS));
      expect(t(11)).toContain(`${LLN_COVERAGE*100}%`);
      expect(t(16)).toContain(`${LLN_COVERAGE*100}%`);
      expect(t(12)).toContain(String(simulatePaths(1000,LLN_DEFAULT_SEED).you).replace('-','−'));
      expect(t(20)).toContain((100-aheadPerHundred(1000)).toFixed(1));
      expect(t(28)).toContain(locale==='zh' ? `${rareAheadMillions*100} 万` : `${rareAheadMillions} million`);
      expect(t(8)).toContain('50');
      expect(10*aheadPerHundred(1000)).toBeLessThan(50);
      for(const [i,n] of [1,10,100,1000,10000].entries()) expect(t(23+i).replaceAll(',','')).toContain(String(n));
      expect(t(35)).toContain('2025-10-30');
    });
  }
  it('retains the five independently checked rounded bars and published hold data', () => {
    expect([1,10,100,1000].map(n=>aheadPerHundred(n).toFixed(1))).toEqual(['47.4','31.4','26.5','4.5']);
    expect(aheadPerHundred(10000)).toBeLessThan(0.00001);
    const hold=numbers.facts.nevada_sep_2025;
    expect(hold.strip_slots_hold.value.map(v=>(100*v).toFixed(1))).toEqual(['8.8','8.0']);
    expect(hold.strip_baccarat_hold.value.map(v=>(100*v).toFixed(2))).toEqual(['17.10','8.49']);
  });
});
