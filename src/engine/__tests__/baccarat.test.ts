import { describe, expect, it } from 'vitest';
import { appendRound, baccaratNet, bankerDraws, dealRound, lossRates, newSession, playHand, settleHands, Shoe, visibleHand, type BaccaratHand, type Side } from '../baccarat';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';
import { BACCARAT_EDGE, BACCARAT_PROB } from '../baccarat';

const hand = (win: Side): BaccaratHand => ({ player: [], banker: [], pt: 0, bt: 0, win });
describe('baccarat port contracts', () => {
  it('keeps published constants aligned with numbers.json', () => {
    expect(BACCARAT_EDGE).toEqual(numbers.baccarat.eight_deck_published.value.edge);
    expect(BACCARAT_PROB).toEqual(numbers.baccarat.eight_deck_published.value.prob);
  });
  it('covers all nine payout combinations, including ties', () => {
    const sides: Side[] = ['B', 'P', 'T'];
    expect(sides.map(pick => sides.map(win => baccaratNet(win, pick))))
      .toEqual([[0.95, -1, 0], [-1, 1, 0], [-1, -1, 8]]);
  });
  it('covers the banker third-card table', () => {
    const allowed = ['0123456789', '0123456789', '0123456789', '012345679', '234567', '4567', '67', '', '', ''];
    for (let b = 0; b <= 9; b++) {
      expect(bankerDraws(b, null)).toBe(b <= 5);
      for (let p = 0; p <= 9; p++) expect(bankerDraws(b, p)).toBe(allowed[b].includes(String(p)));
    }
  });
  it.each([
    [['4', '2', '4', '3'], 2, 2, 'P'], // natural stops both hands
    [['2', '2', '3', '4', '6', 'A'], 3, 3, 'B'], // banker six draws on player six
    [['3', 'A', '3', '3', '2'], 2, 3, 'T'], // player stands, banker draws
  ] as const)('deals a known shoe %j', (ranks, p, b, winner) => {
    let index = 0;
    const shoe = { startHand: () => {}, draw: () => ({ r: ranks[index++], s: '♠' }) } as unknown as Shoe;
    const result = playHand(shoe);
    expect(result.player).toHaveLength(p);
    expect(result.banker).toHaveLength(b);
    expect(result.win).toBe(winner);
    expect(index).toBe(p + b);
    for (let shown = 0; shown <= p + b; shown++) {
      expect(visibleHand(result, 'player', shown).cards.length + visibleHand(result, 'banker', shown).cards.length).toBe(shown);
    }
  });
  it('settles mixed outcomes without treating losing tie bets as pushes', () => {
    const hands = ['B', 'P', 'T'].map(s => hand(s as Side));
    expect(settleHands(hands, 'B', 10)).toMatchObject({ delta: -0.5, wins: 1, losses: 1, pushes: 1 });
    expect(settleHands(hands, 'T', 10)).toMatchObject({ delta: 60, wins: 1, losses: 2, pushes: 0 });
  });
  it('fast-forward equals 100 single rounds and keeps totals across setting changes', () => {
    const run = () => {
      const rng = mulberry32(42), shoes: Shoe[] = [];
      let s = newSession();
      for (let i = 0; i < 100; i++) s = appendRound(s, dealRound(shoes, 10, 'B', 10, rng));
      return { s, shoes, rng };
    };
    const { s, shoes, rng } = run();
    expect(s).toEqual(run().s);
    expect(s.rounds).toBe(100); expect(s.bets).toBe(1000);
    expect(s.history).toHaveLength(101); expect(s.road).toHaveLength(100);
    expect(s.expected).toBeCloseTo(-105.79, 8);
    const shoe = shoes[0];
    const next = appendRound(s, dealRound(shoes, 100, 'T', 100, rng));
    expect(shoes[0]).toBe(shoe);
    expect(next.bets).toBe(1100);
    expect(next.expected - s.expected).toBeCloseTo(-1435.96, 8);
    expect(newSession().rounds).toBe(0);
  });
  it('bounds display history while preserving cumulative totals', () => {
    let s = newSession();
    for (let i = 0; i < 605; i++) s = appendRound(s, settleHands([hand('B')], 'B', 10));
    expect(s.history).toHaveLength(400); expect(s.road).toHaveLength(600);
    expect(s.pnl).toBe(5747.5); expect(s.rounds).toBe(605);
    expect(lossRates(1, 10, 'B').perMinute).toBeCloseTo(0.1234216667);
    expect(lossRates(1, 10, 'B').perNight).toBeCloseTo(59.2424);
  });
  it('reshuffles only between hands, never in the middle of one', () => {
    const shoe = new Shoe(mulberry32(5));
    while (shoe.remaining >= 52) playHand(shoe);
    const before = shoe.remaining;
    expect(before).toBeLessThan(52);
    playHand(shoe); // 这一局开始前洗牌
    expect(shoe.remaining).toBeGreaterThan(8 * 52 - 7);
    for (let i = 0; i < 2000; i++) {
      const left = shoe.remaining;
      const h = playHand(shoe);
      const used = h.player.length + h.banker.length;
      expect(shoe.remaining === left - used || (left < 52 && shoe.remaining === 8 * 52 - used)).toBe(true);
    }
  });
});
