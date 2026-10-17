import { describe, expect, it } from 'vitest';
import { allOutcomes, diceKind, rollRound, settleDice, SICBO_EDGE, sicboLossRates, type SicBoBet } from '../sicbo';
import { settleRed, redLossRates, EDGE_RED, pocketKind } from '../roulette';
import { appendRound, newSession, lossAmount } from '../session';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';

describe('SicBo exact settlement and shared bookkeeping', () => {
  it('enumerates each of the 216 outcomes once, in sum order, with sourced counts', () => {
    const all = allOutcomes();
    expect(new Set(all.map(o => o.dice.join(','))).size).toBe(216);
    expect(all.map(o => o.total)).toEqual(all.map(o => o.total).sort((a, b) => a - b));
    for (const kind of ['big', 'small', 'triple'] as SicBoBet[]) expect(all.filter(o => o.kind === kind)).toHaveLength(numbers.sicbo.counts.value[kind]);
  });
  it('exhaustively verifies all outcomes for every supported bet against numbers.json', () => {
    const all = allOutcomes();
    const edges = { big: numbers.sicbo.edge_big_small.value, small: numbers.sicbo.edge_big_small.value, triple: numbers.sicbo.edge_any_triple_30to1.value };
    for (const pick of ['big', 'small', 'triple'] as SicBoBet[]) {
      const settled = settleDice(all.map(o => o.dice), pick, 10);
      expect(settled.delta / settled.bets / 10).toBeCloseTo(-edges[pick], 12);
      expect(SICBO_EDGE[pick]).toBe(edges[pick]);
      expect(settled.wins).toBe(pick === 'triple' ? 6 : 105);
      expect(settled.losses + settled.wins).toBe(216);
      expect(settled.triples).toBe(6);
    }
  });
  it('triples always defeat big/small and pay 30 net when selected', () => {
    for (let face = 1; face <= 6; face++) {
      const dice: [number, number, number] = [face, face, face];
      expect(diceKind(dice)).toBe('triple');
      expect(settleDice([dice], 'big', 100).delta).toBe(-100);
      expect(settleDice([dice], 'small', 100).delta).toBe(-100);
      expect(settleDice([dice], 'triple', 100).delta).toBe(3000);
    }
    expect(diceKind([1, 3, 6])).toBe('small'); expect(diceKind([2, 3, 6])).toBe('big');
  });
  it('keeps cumulative totals across changes and limits only display history', () => {
    const rng = mulberry32(15);
    let session = newSession<ReturnType<typeof rollRound>>();
    for (let i = 0; i < 100; i++) session = appendRound(session, rollRound(10, 'big', 10, rng));
    expect(session.rounds).toBe(100); expect(session.bets).toBe(1000);
    expect(session.expected).toBeCloseTo(-1000 * 10 * 6 / 216, 10);
    const old = session;
    session = appendRound(session, settleDice([[1, 1, 1]], 'triple', 1000));
    expect(session.pnl - old.pnl).toBe(30000);
    expect(old.rounds).toBe(100); expect(session.bets).toBe(1001);
    for (let i = 0; i < 500; i++) session = appendRound(session, rollRound(1, 'small', 100, rng));
    expect(session.history).toHaveLength(400); expect(session.rounds).toBe(601);
    expect(session.history.at(-1)).toEqual({ p: session.pnl, e: session.expected });
    expect(lossAmount(-100)).toBe(100); expect(lossAmount(100)).toBe(0);
    expect(newSession().history).toEqual([{ p: 0, e: 0 }]);
  });
  it('uses the design rate assumptions without rounding engine amounts', () => {
    expect(sicboLossRates(1, 10, 'big').perMinute).toBeCloseTo(0.2777777778);
    expect(sicboLossRates(100, 1000, 'triple').perNight).toBeCloseTo(6666666.666666667);
  });
});
describe('roulette engine extraction', () => {
  it('settles every wheel index with unchanged red payouts and expected loss', () => {
    for (let i = 0; i < 38; i++) {
      const round = settleRed([i], 100);
      expect(round.delta).toBe(pocketKind(i) === 'win' ? 100 : -100);
      expect(round.expectedDelta).toBe(-100 * EDGE_RED);
      expect(round.bets).toBe(1);
    }
    expect(settleRed([0, 1, 2, 19], 10)).toMatchObject({ wins: 1, losses: 3, delta: -20, bets: 4 });
  });
  it('keeps 100 skipped rounds equivalent to accumulating single rounds', () => {
    const rng = mulberry32(10);
    let s = newSession<ReturnType<typeof settleRed>>();
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const indices = Array.from({ length: 10 }, () => Math.floor(rng() * 38));
      total += indices.reduce((p, index) => p + (pocketKind(index) === 'win' ? 10 : -10), 0);
      s = appendRound(s, settleRed(indices, 10));
    }
    expect(s.pnl).toBe(total); expect(s.rounds).toBe(100); expect(s.bets).toBe(1000);
    expect(s.expected).toBeCloseTo(-10000 * EDGE_RED, 8);
    expect(redLossRates(10, 10, 60).perNight).toBeCloseTo(2526.31578947);
  });
});
