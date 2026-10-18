import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import { mulberry32, type Rng } from '../rng';
import {
  BUST, BUST_IN_ROUNDS, EDGE, EV_PER_ROUND, LADDER, MG, STRATEGIES, doublingRound, simulate, storySession, summarize,
} from '../martingale';

/** 按给定的 u 序列出数的“随机数”：u < 18/38 为红，< 36/38 为黑，其余为 0 / 00 */
const scripted = (us: number[]): Rng => { let i = 0; return () => us[i++ % us.length]; };
const R = 0.1, B = 0.6, G = 0.99;

describe('martingale engine (W4)', () => {
  it('ladder and exact constants match numbers.json', () => {
    expect(LADDER).toBe(1270);
    expect(LADDER).toBe(MG.bankroll);
    expect(BUST).toBeCloseTo(numbers.roulette.martingale_bust.value, 15);
    expect(EV_PER_ROUND).toBeCloseTo(numbers.roulette.martingale_ev_per_round.value, 12);
    expect(BUST_IN_ROUNDS(100)).toBeCloseTo(numbers.roulette.martingale_bust_in_100.value, 12);
    expect((BUST_IN_ROUNDS(100) * 100).toFixed(1)).toBe('67.5');
    // 每轮平均盈亏也等于 −(2/38) × 每轮平均下注
    let meanWager = 0;
    for (let k = 0; k < MG.steps; k++) {
      const pReach = (1 - 18 / 38) ** k; // 前 k 注都输，才会押第 k+1 注
      meanWager += pReach * MG.base * 2 ** k;
    }
    expect(EV_PER_ROUND).toBeCloseTo(-EDGE * meanWager, 12);
  });

  it('a doubling round wins 10 or loses the whole ladder', () => {
    expect(doublingRound(scripted([R]))).toEqual({ delta: 10, wagered: 10, bets: 1, bust: false });
    expect(doublingRound(scripted([B, G, R]))).toEqual({ delta: 10, wagered: 70, bets: 3, bust: false });
    expect(doublingRound(scripted([B]))).toEqual({ delta: -1270, wagered: 1270, bets: 7, bust: true });
  });

  it('the story session reproduces the design: 82 rounds +820, then −1,270 in round 83', () => {
    const s = storySession();
    expect(s.path).toHaveLength(84);
    expect(Math.max(...s.path) - MG.bankroll).toBe(820);
    expect(s.path[83] - s.path[82]).toBe(-1270);
    expect(s.net).toBe(-450);
  });

  it('doubling stops when the bankroll can no longer fund a full ladder', () => {
    const s = simulate('double', scripted([B]));
    expect(s.path).toEqual([1270, 0]);
    expect(s.wagered).toBe(1270);
  });

  it('stop rules end at +100 or −300', () => {
    const win = simulate('stops', scripted([R]));
    expect(win.net).toBe(100);
    expect(win.bets).toBe(10);
    const loss = simulate('stops', scripted([B]));
    expect(loss.net).toBe(-300);
    expect(loss.bets).toBe(30);
  });

  it('pattern only bets after three of the same color, on the other color', () => {
    // 红红红 → 押黑（开黑，赢）；黑之后连串重新计数
    const s = simulate('pattern', scripted([R, R, R, B, G, G, G, R]));
    expect(s.bets).toBeGreaterThan(0);
    const first = simulate('pattern', scripted([R, R, R, B]));
    // 前三局不押，第四局押黑并赢 10；之后黑黑黑 → 第 8 局押红……
    expect(first.path.slice(0, 5)).toEqual([1270, 1270, 1270, 1270, 1280]);
    // 0 / 00 连开不触发
    const greens = simulate('pattern', scripted([G]));
    expect(greens.bets).toBe(0);
  });

  it('every method loses 2/38 of what it wagers (10,000 sessions each, ±4 standard errors)', () => {
    for (const strategy of STRATEGIES) {
      const rng = mulberry32(20261017);
      const nets: number[] = [];
      const wagers: number[] = [];
      for (let i = 0; i < 10000; i++) {
        const s = simulate(strategy, rng);
        nets.push(s.net);
        wagers.push(s.wagered);
      }
      const W = wagers.reduce((a, b) => a + b, 0);
      const r = -nets.reduce((a, b) => a + b, 0) / W;
      // 比值估计的标准误（delta 方法）
      const se = Math.sqrt(nets.reduce((acc, n, i) => acc + (n + r * wagers[i]) ** 2, 0)) / W;
      expect(se, strategy).toBeLessThan(0.01);
      expect(Math.abs(r - EDGE), `${strategy}: ${r} ± ${se}`).toBeLessThan(4 * se);
    }
  });

  it('summarize agrees with simulate', () => {
    const a = summarize('flat', 500, mulberry32(1));
    expect(a.n).toBe(500);
    expect(a.meanWagered).toBe(1000);
    expect(a.ahead).toBeGreaterThan(0.1);
    expect(a.ahead).toBeLessThan(0.45);
  });
});
