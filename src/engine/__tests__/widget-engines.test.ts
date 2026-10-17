import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import part3 from '../../views/Part3Psych.astro?raw';
import { turnoverLedger } from '../ledger';
import { POCKETS, ROULETTE_BETS, payoutBreakdown } from '../roulette';
import { ALPHA, assessSequence, countSwitches, longestRun, longestRunCdf, longestRunPmf, switchPmf } from '../sequence';

/* ───────── W5 押法拆解 ───────── */
describe('roulette payout breakdown (W5)', () => {
  it('fair odds and edges match the exact table in numbers.json', () => {
    for (const bet of ROULETTE_BETS) {
      const b = payoutBreakdown(bet.key);
      const ref = numbers.roulette.bet_edges.value[bet.key];
      expect(b.fair).toBeCloseTo(ref.fair, 12);
      expect(b.edge).toBeCloseTo(ref.edge, 12);
      // 两种算法一致：优势 = 少付倍数 × 覆盖格数 / 38
      expect(b.edge).toBeCloseTo((b.shortfall * b.covers) / POCKETS, 12);
    }
  });

  it('seven bets give 2/38, the five-number bet gives 3/38', () => {
    for (const bet of ROULETTE_BETS) {
      expect(payoutBreakdown(bet.key).edge).toBeCloseTo(bet.key === 'five' ? 3 / 38 : 2 / 38, 12);
    }
  });

  it('the default bar (straight up) matches the design: fair 37, actual 35, blue part ≈ 94.6%', () => {
    const b = payoutBreakdown('straight');
    expect(b.fair).toBe(37);
    expect(b.pays).toBe(35);
    expect(b.shortfall).toBe(2);
    expect((b.paidShare * 100).toFixed(1)).toBe('94.6');
  });

});

/* ───────── W6 红黑序列检测 ───────── */
const bits = (x: number, n: number) => Array.from({ length: n }, (_, i) => ((x >> i) & 1) === 1);

describe('sequence statistics (W6)', () => {
  it('switch and longest-run distributions match brute-force enumeration', () => {
    for (const n of [2, 5, 9, 12]) {
      const sw = new Array(n).fill(0);
      const lr = new Array(n + 1).fill(0);
      for (let x = 0; x < 2 ** n; x++) {
        const s = bits(x, n);
        sw[countSwitches(s)] += 1 / 2 ** n;
        lr[longestRun(s)] += 1 / 2 ** n;
      }
      switchPmf(n).forEach((p, k) => expect(p).toBeCloseTo(sw[k], 12));
      longestRunPmf(n).forEach((p, L) => expect(p).toBeCloseTo(lr[L], 12));
    }
  });

  it('cdf is monotone and reaches 1', () => {
    let prev = 0;
    for (let L = 0; L <= 20; L++) {
      const c = longestRunCdf(20, L);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
    expect(prev).toBe(1);
  });

  it('a truly random 20-round sequence is flagged at most 5% of the time (all 2^20 sequences)', () => {
    const n = 20;
    const cache = new Map<string, boolean>();
    let flagged = 0;
    for (let x = 0; x < 2 ** n; x++) {
      const s = bits(x, n);
      const key = `${countSwitches(s)}-${longestRun(s)}`;
      let f = cache.get(key);
      if (f === undefined) {
        f = assessSequence(s).verdict !== 'random';
        cache.set(key, f);
      }
      if (f) flagged++;
    }
    const size = flagged / 2 ** n;
    expect(size).toBeLessThanOrEqual(ALPHA);
    // 第三部分检测器的小字写着“误判的概率不到 3%”（20 局时精确值 2.77%）
    expect(size).toBeLessThan(0.03);
    expect(size).toBeGreaterThan(0);
  });

  it('reproduces the A / B statistics printed on the Part 3 page', () => {
    // 取 Part3Psych.astro 里的 seqA / seqB（每串两行 × 20 局）
    const grab = (name: string) => {
      const block = part3.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))![1];
      return [...block.matchAll(/[01]/g)].map((m) => m[0] === '1');
    };
    const a = grab('seqA');
    const b = grab('seqB');
    expect(a).toHaveLength(40);
    expect(b).toHaveLength(40);
    expect([countSwitches(a), longestRun(a)]).toEqual([31, 2]);
    expect([countSwitches(b), longestRun(b)]).toEqual([18, 6]);
    expect(assessSequence(a).expectedSwitches).toBe(19.5);
    expect(assessSequence(a).verdict).toBe('too-even');
    expect(assessSequence(b).verdict).toBe('random');
  });

  it('extreme hand-made sequences get the expected verdicts', () => {
    const alternating = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
    const allRed = Array.from({ length: 20 }, () => true);
    expect(assessSequence(alternating).verdict).toBe('too-even');
    expect(assessSequence(allRed).verdict).toBe('too-streaky');
  });
});

/* ───────── W7 押注次数账本 ───────── */
describe('turnover ledger (W7)', () => {
  const edge = numbers.baccarat.eight_deck_published.value.edge.B;

  it('default 10 bets per chip reproduces the design: 1,000 / 10.6 / 1.06% / 10.6%', () => {
    const l = turnoverLedger(100, 10, edge);
    expect(l.totalBet).toBe(1000);
    expect(l.houseWin.toFixed(1)).toBe('10.6');
    expect((l.edge * 100).toFixed(2)).toBe('1.06');
    expect((l.holdOnCash * 100).toFixed(1)).toBe('10.6');
  });

  it('the hold on cash is exactly edge × times bet', () => {
    for (const n of [1, 5, 30]) expect(turnoverLedger(100, n, edge).holdOnCash).toBeCloseTo(edge * n, 12);
  });

  it('Nevada September 2025: slots + tables add up to the NGCB total', () => {
    const nv = numbers.facts.nevada_sep_2025;
    expect((nv.slots_win_usd.value + nv.table_win_usd.value) / 1e6).toBeCloseTo(nv.total_win_usd.value / 1e6, 1);
  });
});
