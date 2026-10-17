import { describe, expect, it } from 'vitest';
import {
  appendSlotsRound, CHERRY_PAY, exactStats, newSlotsSession, payout, pull, pullAtStops, pullRound,
  REELS, settlePulls, slotsLossRates, STOPS, THREE_KIND,
} from '../slots';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';

describe('Slots port contracts', () => {
  it('preserves all reel lengths, special payouts and cherry payouts', () => {
    expect(REELS.map(reel => reel.length)).toEqual([STOPS, STOPS, STOPS]);
    for (const [symbols, pay] of Object.entries(THREE_KIND)) expect(payout(symbols[0], symbols[1], symbols[2])).toBe(pay);
    expect(CHERRY_PAY).toEqual([0, .5, 2, 5]);
    expect(payout('C', '7', '_')).toBe(.5);
    expect(payout('C', 'C', '_')).toBe(2);
    expect(payout('C', 'C', 'C')).toBe(5);
  });
  it('exhaustively matches each payout row, RTP, hit/LDW rates and near-miss definitions', () => {
    const all = [];
    const counts: Record<string, number> = { '777': 0, BBB: 0, SSS: 0, DDD: 0, CCC: 0, CC: 0, C: 0 };
    let broad = 0, near = 0;
    for (let a = 0; a < STOPS; a++) for (let b = 0; b < STOPS; b++) for (let c = 0; c < STOPS; c++) {
      const p = pullAtStops([a, b, c]); all.push(p);
      const s = p.symbols.join('');
      const key = THREE_KIND[s] ? s : 'C'.repeat(p.symbols.filter(x => x === 'C').length);
      if (key in counts) counts[key]++;
      if (p.symbols[0] === '7' && p.symbols[1] === '7' && p.symbols[2] !== '7') broad++;
      if (p.nearMiss) near++;
    }
    const n = STOPS ** 3;
    expect(Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, count / n]))).toEqual(numbers.slots.pay_table_probabilities.value);
    const round = settlePulls(all, 1);
    expect(round.delta / n).toBeCloseTo(-numbers.slots.edge.value, 12);
    expect(round.rings / n).toBe(numbers.slots.hit_rate.value);
    expect(round.fakes / n).toBe(numbers.slots.ldw_rate.value);
    expect(round.real / n).toBe(numbers.slots.real_win_rate.value);
    expect(broad / n).toBe(numbers.slots.p_77x.value);
    expect(near).toBe(broad); // 横幅的“差一点”与揭晓段的 19 倍是同一个事件
    expect(exactStats().rtp).toBe(numbers.slots.rtp.value);
  });
  it('treats a half-stake return as a ringing loss and a jackpot as net return less stake', () => {
    const ldw = pullAtStops([1, 0, 1]);
    const jackpot = pullAtStops([0, 0, 13]);
    const near = pullAtStops([0, 0, 12]);
    expect(settlePulls([ldw], 10).machines[0]).toMatchObject({ outcome: 'ldw', gross: 5, net: -5, loss: 5 });
    expect(settlePulls([jackpot], 10).machines[0]).toMatchObject({ outcome: 'win', gross: 2000, net: 1990, loss: 0 });
    expect(settlePulls([near], 10).machines[0]).toMatchObject({ outcome: 'miss', nearMiss: true, net: -10 });
    const round = settlePulls([ldw, jackpot, near], 10);
    expect(round).toMatchObject({ delta: 1975, rings: 2, fakes: 1, real: 1, bets: 3 });
  });
  it('preserves random pull output when evaluating known stops', () => {
    const rng = mulberry32(17);
    for (let i = 0; i < 100; i++) {
      const result = pull(rng);
      expect(result).toEqual(pullAtStops(result.stops));
    }
  });
  it('accumulates single/ten/hundred machines, stake changes and all ring counts', () => {
    const rng = mulberry32(25);
    let session = newSlotsSession(), rings = 0, fakes = 0;
    for (let k = 0; k < 100; k++) {
      const round = pullRound(10, 10, rng);
      rings += round.rings; fakes += round.fakes;
      session = appendSlotsRound(session, round);
    }
    expect(session).toMatchObject({ rounds: 100, bets: 1000, rings, fakes });
    expect(session.expected).toBeCloseTo(-10000 * numbers.slots.edge.value, 9);
    const old = session;
    session = appendSlotsRound(session, pullRound(100, 100, rng));
    expect(old.rounds).toBe(100); expect(session.bets).toBe(1100);
    expect(session.expected - old.expected).toBeCloseTo(-10000 * numbers.slots.edge.value, 9);
    for (let k = 0; k < 400; k++) session = appendSlotsRound(session, pullRound(1, 1, rng));
    expect(session.history).toHaveLength(400); expect(session.rounds).toBe(501);
    expect(newSlotsSession()).toMatchObject({ rounds: 0, bets: 0, pnl: 0, rings: 0, fakes: 0 });
  });
  it('matches the sourced 100-cell illustration and rate assumptions', () => {
    const grid = numbers.slots.hundred_outcomes.value;
    expect(grid.win).toBe(Math.round(numbers.slots.real_win_rate.value * 100));
    expect(grid.ldw).toBe(Math.round(numbers.slots.ldw_rate.value * 100));
    expect(grid.miss + grid.win + grid.ldw).toBe(100);
    expect(slotsLossRates(1, 10).perMinute).toBeCloseTo(8.21875);
    expect(slotsLossRates(1, 10).perNight).toBeCloseTo(3945);
  });
});
