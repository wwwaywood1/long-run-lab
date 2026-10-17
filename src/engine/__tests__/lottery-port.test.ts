import { describe, expect, it } from 'vitest';
import { appendLotteryRound, check, drawLotteryRound, expectedReturn, fastLottery, fastLotteryYears, lotteryElapsed, newLotterySession, OFFICIAL_SPLIT, PRICE, PRIZES, quickPick, sampleTier, settleTickets, tierOf, tierProbabilities, type Ticket } from '../lottery';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';
const draw: Ticket = { reds: [1, 2, 3, 4, 5, 6], blue: 1 };
describe('lottery port contracts', () => {
  it('covers every red/blue match combination and all prize tiers', () => {
    expect(Array.from({ length: 7 }, (_, r) => [tierOf(r, false), tierOf(r, true)]))
      .toEqual([[0, 6], [0, 6], [0, 6], [0, 5], [5, 4], [4, 3], [2, 1]]);
    for (let r = 0; r <= 6; r++) for (const blue of [true, false]) {
      const ticket = { reds: [...draw.reds.slice(0, r), ...Array.from({ length: 6 - r }, (_, i) => 20 + i)], blue: blue ? 1 : 2 };
      const result = settleTickets([ticket], draw);
      expect(result.tickets[0]).toMatchObject({ redHits: r, blueHit: blue, prize: PRIZES[tierOf(r, blue)] });
      expect(result.tickets[0].redMatches.filter(Boolean)).toHaveLength(r);
      expect(result.cost).toBe(PRICE); expect(result.delta).toBe(PRIZES[tierOf(r, blue)] - PRICE);
    }
  });
  it('generates valid independent quick picks', () => {
    const rng = mulberry32(6);
    for (let i = 0; i < 1000; i++) {
      const t = quickPick(rng);
      expect(t.reds).toHaveLength(6); expect(new Set(t.reds).size).toBe(6);
      expect([...t.reds].sort((a, b) => a - b)).toEqual(t.reds);
      expect(t.reds.every(r => r >= 1 && r <= 33)).toBe(true);
      expect(t.blue).toBeGreaterThanOrEqual(1); expect(t.blue).toBeLessThanOrEqual(16);
    }
  });
  it('agrees with existing exact probabilities and both return-rate definitions', () => {
    const p = tierProbabilities();
    for (let t = 1; t <= 6; t++) expect(p[t]).toBeCloseTo(numbers.lottery.tier_probability.value[String(t) as '1'], 15);
    expect(expectedReturn().allRate).toBeCloseTo(numbers.lottery.site_simulation_return_rate.value, 15);
    expect(expectedReturn().fixedOnlyRate).toBeCloseTo(numbers.lottery.fixed_prize_return_rate.value, 15);
    expect(numbers.facts.lotto_fund_split).toMatchObject(OFFICIAL_SPLIT);
  });
  it('samples each categorical tier including the rare jackpots and no prize', () => {
    const p = tierProbabilities(); let lower = 0;
    for (let tier = 1; tier <= 6; tier++) { expect(sampleTier(() => lower + p[tier] / 2)).toBe(tier); lower += p[tier]; }
    expect(sampleTier(() => .999999)).toBe(0);
  });
  it('counts all tickets, winnings and prize tiers across batch-size changes', () => {
    const first = settleTickets([draw, { ...draw, blue: 2 }, { reds: [20, 21, 22, 23, 24, 25], blue: 1 }], draw);
    const session = appendLotteryRound(newLotterySession(), first);
    expect(session).toMatchObject({ rounds: 1, bets: 3, spent: 6, won: 7120005, pnl: 7119999 });
    expect(session.tiers).toEqual([0, 1, 1, 0, 0, 0, 1]);
    expect(session.expected).toBeCloseTo(3 * (expectedReturn().all - PRICE));
    const next = appendLotteryRound(session, drawLotteryRound(10, mulberry32(10)));
    expect(next.rounds).toBe(2); expect(next.bets).toBe(13); expect(next.spent).toBe(26);
    expect(session.spent).toBe(6); expect(newLotterySession().tiers.every(c => c === 0)).toBe(true);
  });
  it.each([1, 156, 1560])('fast-forwards %s draws reproducibly, with a checkable last draw', draws => {
    const run = () => fastLottery(newLotterySession(), 100, draws, mulberry32(42));
    const session = run(); expect(session).toEqual(run());
    expect(session.rounds).toBe(draws); expect(session.bets).toBe(draws * 100); expect(session.spent).toBe(draws * 200);
    expect(session.pnl).toBe(session.won - session.spent);
    expect(session.expected).toBeCloseTo(draws * 100 * (expectedReturn().all - PRICE), 6);
    expect(session.last!.tickets).toHaveLength(100);
    for (const ticket of session.last!.tickets) expect(check(ticket, session.last!.draw!)).toMatchObject({ tier: ticket.tier, prize: ticket.prize });
    expect(session.history.length).toBeLessThanOrEqual(400);
    expect(session.history.at(-1)).toEqual({ p: session.pnl, e: session.expected });
  });
  it('samples a decade chart across the whole period and bounds cumulative history', () => {
    let session = fastLottery(newLotterySession(), 1, 1560, mulberry32(1));
    expect(session.history).toHaveLength(158); expect(session.history[0]).toEqual({ p: 0, e: 0 });
    for (let i = 0; i < 4; i++) session = fastLottery(session, 10, 156, mulberry32(i + 2));
    expect(session.history).toHaveLength(400); expect(session.rounds).toBe(2184);
    expect(() => fastLottery(session, 1, 0, mulberry32(1))).toThrow();
  });
  it('maps calendar batch actions to the same engine draw count', () => {
    expect(fastLotteryYears(newLotterySession(), 1, 1, mulberry32(11))).toEqual(fastLottery(newLotterySession(), 1, 156, mulberry32(11)));
    expect(fastLotteryYears(newLotterySession(), 1, 10, mulberry32(12))).toEqual(fastLottery(newLotterySession(), 1, 1560, mulberry32(12)));
  });
  it('expresses elapsed weeks and years using the design cadence', () => {
    expect(lotteryElapsed(0)).toEqual({ unit: 'weeks', amount: 0 });
    expect(lotteryElapsed(3)).toEqual({ unit: 'weeks', amount: 1 });
    expect(lotteryElapsed(156)).toEqual({ unit: 'years', amount: 1 });
    expect(lotteryElapsed(1560)).toEqual({ unit: 'years', amount: 10 });
  });
});
