import { describe, expect, it } from 'vitest';
import {
  advanceFlight, appendCrashRound, cashOutProbability, CRASH_DISPLAY_CAP, crashLossRates, crashNet,
  canJump, crashPoint, crashTargetTerms, fastFlight, flightSummary, floorX, jumpFlight, multiplierAt, newCrashSession,
  newFlight, settleFlight, startFlight, timeAtMultiplier, type Flight,
} from '../crash';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';
const finish = (flight: Flight) => {
  let f = flight;
  for (let i = 0; f.running && i < 300; i++) f = advanceFlight(f);
  expect(f.running).toBe(false); return f;
};
const atCrash = (point: number, target = 2) => {
  const f = startFlight(1, target, 10, () => .5); return { ...f, games: [{ ...f.games[0], crash: point }] };
};
describe('Crash flight state machine', () => {
  it('preserves generator, equality and all published target probabilities', () => {
    expect(crashPoint(() => 0)).toBe(1);
    expect(crashPoint(() => .515)).toBeCloseTo(2, 12);
    expect(crashNet(2, 2)).toBe(1); expect(crashNet(2, 1.99)).toBe(-1);
    for (const [target, probability] of Object.entries(numbers.crash.success_probability.value)) expect(cashOutProbability(Number(target))).toBe(probability);
    expect(crashTargetTerms(5, 100)).toEqual({ probability: .194, win: 400, loss: 100 });
  });
  it('settles a failure, a target equality and a long flight without leaking future cash-outs', () => {
    expect(settleFlight(finish(atCrash(1))).delta).toBe(-10);
    const equality = finish(atCrash(2));
    expect(equality.games[0]).toMatchObject({ cash: 2, bust: false, net: 10 });
    let f = atCrash(100);
    for (let i = 0; i < 45; i++) f = advanceFlight(f);
    expect(f.running).toBe(true); expect(f.games[0].cash).toBe(2);
    const paid = f.games[0]; f = jumpFlight(f); expect(f.games[0]).toBe(paid);
    f = finish(f); expect(f.m).toBeGreaterThanOrEqual(CRASH_DISPLAY_CAP);
    expect(f.games[0].net).toBe(10);
    expect(timeAtMultiplier(multiplierAt(3))).toBeCloseTo(3, 12);
  });
  it('manual cash-out pays the displayed multiplier and does not change settled games', () => {
    let f = atCrash(4, 10);
    for (let i = 0; i < 10; i++) f = advanceFlight(f);
    const cash = floorX(f.m);
    const prior = f; f = jumpFlight(f);
    expect(prior.games[0].done).toBe(false);
    expect(f.games[0]).toMatchObject({ cash, bust: false, done: true });
    expect(f.games[0].net).toBeCloseTo((cash - 1) * 10);
    expect(settleFlight(finish(f)).delta).toBeCloseTo((cash - 1) * 10);
    expect(jumpFlight(newFlight(1)).games[0].idle).toBe(true);
    expect(() => settleFlight(prior)).toThrow('unfinished');
  });
  it('exactly 3% of rounds bust at take-off, and nobody can cash out before the first tick', () => {
    expect(crashPoint(() => .03 - 1e-12)).toBe(1);
    expect(crashPoint(() => .03 + 1e-9)).toBeGreaterThan(1);
    const start = atCrash(1);
    expect(canJump(start)).toBe(false);
    expect(jumpFlight(start)).toBe(start);
    expect(settleFlight(finish(jumpFlight(start))).delta).toBe(-10);
    expect(floorX(1.999)).toBe(1.99); expect(floorX(2)).toBe(2);
  });
  it('every manual stopping rule loses 3% on average', () => {
    const rng = mulberry32(20261016);
    const ticks = [1, 5, 15, 30, 60];
    for (const k of ticks) {
      let total = 0; const n = 40000;
      for (let i = 0; i < n; i++) {
        let f = startFlight(1, 1e9, 1, rng);
        for (let j = 0; j < k && f.running; j++) f = advanceFlight(f);
        f = jumpFlight(f);
        expect(f.games[0].done).toBe(true);
        total += f.games[0].net;
      }
      // 理论值恰好 −3%；4 万局的标准误约 0.5–2 个百分点
      expect(total / n).toBeCloseTo(-.03, 1);
    }
  });
  it('manual jumping in a mixed round leaves busted and already-cashed games unchanged', () => {
    let f = startFlight(3, 2, 10, mulberry32(1));
    f = { ...f, games: f.games.map((game, i) => ({ ...game, crash: [1, 2, 5][i] })) };
    f = advanceFlight(f); expect(f.games[0].bust).toBe(true);
    const busted = f.games[0]; f = jumpFlight(f);
    expect(f.games[0]).toBe(busted);
    const final = finish(f), round = settleFlight(final);
    expect(flightSummary(final)).toEqual({ flying: 0, cashed: 2, bust: 1 });
    expect(round.cashed + round.bust).toBe(3);
  });
  it('fast-forward matches animated automatic settlement and keeps totals across settings', () => {
    const rng1 = mulberry32(77), rng2 = mulberry32(77);
    let session = newCrashSession();
    for (let i = 0; i < 100; i++) {
      const animated = settleFlight(finish(startFlight(10, 2, 10, rng1)));
      const fast = settleFlight(fastFlight(10, 2, 10, rng2));
      expect(fast.delta).toBe(animated.delta); expect(fast.cashed).toBe(animated.cashed);
      session = appendCrashRound(session, fast);
    }
    expect(session.rounds).toBe(100); expect(session.bets).toBe(1000);
    expect(session.expected).toBeCloseTo(-300, 9);
    expect(session.cashRate).toBe(session.cashed / 1000);
    session = appendCrashRound(session, settleFlight(fastFlight(100, 10, 1000, rng2)));
    expect(session.bets).toBe(1100); expect(session.expected).toBeCloseTo(-3300, 8);
    expect(crashLossRates(1, 10).perMinute).toBeCloseTo(.9);
    expect(crashLossRates(1, 10).perNight).toBeCloseTo(432);
    expect(newCrashSession()).toMatchObject({ rounds: 0, cashed: 0, cashRate: null, pnl: 0 });
  });
});
