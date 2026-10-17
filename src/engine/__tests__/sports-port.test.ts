import { describe, expect, it } from 'vitest';
import {
  appendSportsRound, backSportsFavorites, createSportsSlips, evaluate, fastSports, favourite, makeMatch,
  newSportsSession, overround, pickSportsOutcome, revealSportsSlips, revealSportsStep, settleSportsRound,
  sportsHitRate, sportsReady, sportsSlipView, SPORTS_BETS, SPORTS_FAST_ROUNDS, SPORTS_LEGS, SPORTS_TABLES,
  type Match, type Outcome, type SportsSlip,
} from '../sports';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';

const fixture = (result: Outcome = 0): Match => ({ home: '北岸', away: '南港', p: [.46, .27, .27], odds: [2, 3.4, 3.4], result, score: result === 0 ? '1 : 0' : '0 : 0', pick: 0 });
const slip = (results: Outcome[] = [0, 0]): SportsSlip => ({ matches: results.map(fixture), revealed: 0 });

describe('G9 足球竞猜移植接口', () => {
  it('单人从未选开始，多单和自动模式由原引擎选热门', () => {
    const manual = createSportsSlips(1, 2, false, mulberry32(901));
    expect(sportsReady(manual)).toBe(false); expect(manual[0].matches.every(m => m.pick === -1)).toBe(true);
    for (const tables of [1, 10, 100]) {
      const generated = createSportsSlips(tables, 8, tables === 1, mulberry32(902));
      expect(generated).toHaveLength(tables); expect(sportsReady(generated)).toBe(true);
      expect(generated.every(s => s.matches.length === 8 && s.matches.every(m => m.pick === favourite(m)))).toBe(true);
    }
  });
  it('同随机流仍按原 makeMatch 生成，不改变真实概率、赔率和比分', () => {
    const a = mulberry32(903), b = mulberry32(903);
    expect(createSportsSlips(1, 4, false, a)[0].matches).toEqual(Array.from({ length: 4 }, () => makeMatch(b)));
  });
  it('单人每个结果都可选择且不改旧快照；非法和多人选择不生效', () => {
    const original = createSportsSlips(1, 2, false, mulberry32(904));
    for (const outcome of [0, 1, 2] as const) {
      const next = pickSportsOutcome(original, 0, outcome);
      expect(next[0].matches[0].pick).toBe(outcome); expect(original[0].matches[0].pick).toBe(-1);
      expect(next[0].matches[1]).toBe(original[0].matches[1]);
    }
    expect(pickSportsOutcome(original, 99, 0)).toBe(original);
    expect(pickSportsOutcome(original, 0, -1 as Outcome)).toBe(original);
    const multi = createSportsSlips(10, 1, false, mulberry32(905)); expect(pickSportsOutcome(multi, 0, 0)).toBe(multi);
    const shown = revealSportsStep(original); expect(pickSportsOutcome(shown, 0, 0)).toBe(shown);
  });
  it('押热门不可变，揭晓前不泄漏比分、结果或净额', () => {
    const original = createSportsSlips(1, 2, false, mulberry32(906)), chosen = backSportsFavorites(original);
    expect(sportsReady(chosen)).toBe(true); expect(original[0].matches[0].pick).toBe(-1);
    const view = sportsSlipView(chosen[0], 100);
    expect(view.ready).toBe(true); expect(view.settled).toBe(false);
    expect(view.hit).toBeNull(); expect(view.delta).toBeNull(); expect(view.right).toBeNull();
    for (const match of view.matches) {
      expect(match.score).toBeNull(); expect(match.result).toBeNull(); expect(match.right).toBeNull();
      expect(match.options.every(o => o.actual === null)).toBe(true);
    }
    const unpicked = sportsSlipView(original[0], 100); expect(unpicked.odds).toBeNull(); expect(unpicked.payout).toBeNull();
  });
  it('逐场揭晓只开放相应结果，未全开不能结算', () => {
    const original = [slip([0, 1])], once = revealSportsStep(original);
    const view = sportsSlipView(once[0], 10);
    expect(original[0].revealed).toBe(0); expect(once[0].revealed).toBe(1);
    expect(view.matches[0]).toMatchObject({ shown: true, score: '1 : 0', result: 0, right: true });
    expect(view.matches[1].result).toBeNull(); expect(view.delta).toBeNull();
    expect(() => settleSportsRound(once, 10)).toThrow('unrevealed');
    const all = revealSportsStep(once); expect(sportsSlipView(all[0], 10)).toMatchObject({ right: 1, hit: false, delta: -10, settled: true });
    expect(revealSportsStep(all)[0].revealed).toBe(2);
  });
  it.each([1, 2, 4, 8])('%s 场必须全中，总返还含本金而净赢扣除本金', legs => {
    const matches = Array.from({ length: legs }, () => fixture());
    const shown = revealSportsSlips([{ matches, revealed: 0 }]);
    const round = settleSportsRound(shown, 10), view = sportsSlipView(shown[0], 10);
    expect(round.wins).toBe(1); expect(round.lastOdds).toBe(2 ** legs);
    expect(round.delta).toBe((2 ** legs - 1) * 10); expect(view.payout).toBe(2 ** legs * 10);
    shown[0].matches[0] = fixture(1);
    expect(settleSportsRound(shown, 10).delta).toBe(-10);
  });
  it('混合单统一计算每轮净额和按真实概率/舍入赔率的数学期望', () => {
    const round = settleSportsRound(revealSportsSlips([slip(), slip([0, 1])]), 10);
    expect(round.bets).toBe(2); expect(round.wins).toBe(1); expect(round.delta).toBe(20);
    expect(round.expectedDelta).toBeCloseTo(-10 * (2 - .92 ** 2 * 2), 12);
    const random = revealSportsSlips(createSportsSlips(10, 4, true, mulberry32(907))), actual = settleSportsRound(random, 100);
    expect(actual.expectedDelta).toBeCloseTo(-100 * (10 - random.reduce((sum, s) => sum + evaluate(s.matches).ev, 0)), 10);
    expect(actual.expectedDelta).not.toBe(-100 * 10 * (1 - .92 ** 4));
  });
  it('没有票、未选或未揭晓时不能结算', () => {
    expect(sportsReady([])).toBe(false); expect(sportsReady([{ matches: [], revealed: 0 }])).toBe(false);
    for (const invalid of [[], [slip()], revealSportsSlips(createSportsSlips(1, 1, false, mulberry32(908)))]) expect(() => settleSportsRound(invalid, 10)).toThrow();
  });
  it.each([1, 10, 100])('%s 单快进与同随机流 100 轮逐次结算相同', tables => {
    const a = mulberry32(909), b = mulberry32(909), empty = newSportsSession();
    const fast = fastSports(empty, tables, 8, 100, a);
    let ordinary = newSportsSession();
    for (let i = 0; i < SPORTS_FAST_ROUNDS; i++) ordinary = appendSportsRound(ordinary, settleSportsRound(revealSportsSlips(createSportsSlips(tables, 8, true, b)), 100));
    expect(fast).toEqual(ordinary); expect(fast.bets).toBe(100 * tables); expect(fast.rounds).toBe(100);
    expect(empty).toEqual(newSportsSession()); expect(fast.expected).toBeLessThan(0);
  });
  it('累计、更换注额和最近 400 个点独立于旧会话', () => {
    const old = newSportsSession(), first = appendSportsRound(old, settleSportsRound(revealSportsSlips([slip()]), 10));
    const next = appendSportsRound(first, settleSportsRound(revealSportsSlips([slip([0, 1])]), 100));
    expect(old.bets).toBe(0); expect(first.pnl).toBe(30); expect(next.pnl).toBe(-70);
    expect(next.wins).toBe(1); expect(sportsHitRate(next)).toBe(.5); expect(sportsHitRate(old)).toBeNull();
    expect(first.last?.bet).toBe(10); expect(next.last?.bet).toBe(100);
    let history = newSportsSession();
    for (let i = 0; i < 405; i++) history = appendSportsRound(history, settleSportsRound(revealSportsSlips([slip()]), 10));
    expect(history.history).toHaveLength(400); expect(history.history.at(-1)?.p).toBe(history.pnl);
  });
  it('展示数字来自原模型和研究数据，旧 overround 保持不变', () => {
    const s = numbers.sports, p = s.presentation.value;
    expect(overround(p.example_odds)).toBe(s.example_overround.value);
    expect(p.example_vig).toBeCloseTo(s.example_overround.value - 1, 12);
    p.example_odds.forEach((o, i) => expect(p.example_implied_probabilities[i]).toBe(1 / o));
    for (const [legs, returned] of Object.entries(p.return_per_100)) expect(returned).toBe(100 * s.return_by_legs.value[legs as keyof typeof s.return_by_legs.value]);
    expect(SPORTS_TABLES).toEqual([1, 10, 100]); expect(SPORTS_BETS).toEqual([10, 100, 1000]); expect(SPORTS_LEGS).toEqual([1, 2, 4, 8]);
  });
});
