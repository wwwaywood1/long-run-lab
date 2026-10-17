import { describe, expect, it } from 'vitest';
import { Table, advanceDealer, autoBlackjackRound, availableActions, blackjackLossRates, countView, handValue, roundView, settleBlackjackRounds, suggestedAction, type Card, type Round } from '../blackjack';
import { mulberry32 } from '../rng';
import { appendRound, newSession } from '../session';

const card = (r: string): Card => ({ r, s: '♠' });
function tableWith(draws: string[]) {
  const table = new Table(mulberry32(5));
  // Keep above the cut card; desired ranks are popped first.
  table.shoe = [...Array.from({ length: 90 }, () => card('10')), ...draws.map(card).reverse()];
  return table;
}
function finish(table: Table, round: Round, pay: 1.5 | 1.2 = 1.5) {
  let steps = 0;
  while (round.phase === 'dealer') { advanceDealer(table, round, pay); expect(++steps).toBeLessThan(20); }
}
describe('blackjack port contracts', () => {
  it('counts only exposed cards and reveals the hole exactly once', () => {
    const table = tableWith(['5', 'A', '6', 'K']);
    const round = table.start();
    expect(table.runningCount).toBe(1);
    expect(roundView(round, 10).dealer.cards).toEqual([card('A'), null]);
    expect(roundView(round, 10).dealer.value).toBeNull();
    expect(countView(table)?.running).toBe(1);
    table.reveal(round); table.reveal(round);
    expect(table.runningCount).toBe(0);
  });
  it.each([1.5, 1.2] as const)('pays natural blackjack at %s, and handles dealer blackjack / mutual naturals', pay => {
    for (const [draws, net, tag] of [
      [['A', '9', 'K', '8'], pay, 'bj'],
      [['9', 'A', '8', 'K'], -1, 'dbj'],
      [['A', 'A', 'K', 'K'], 0, 'push'],
    ] as const) {
      const table = tableWith([...draws]), round = table.start(); finish(table, round, pay);
      expect(round.net).toBe(net); expect(round.hands[0].tag).toBe(tag);
      expect(availableActions(table, round)).toEqual({ H: false, S: false, D: false, P: false });
    }
  });
  it('covers hit, stand, double and disabled post-action doubling', () => {
    const table = tableWith(['5', '6', '6', '10', '10', '10']), round = table.start();
    expect(suggestedAction(table, round, 'basic')).toBe('D');
    expect(availableActions(table, round)).toEqual({ H: true, S: true, D: true, P: false });
    table.act(round, 'D'); finish(table, round);
    expect(roundView(round, 100).hands[0]).toMatchObject({ doubled: true, net: 200 });
    const t2 = tableWith(['2', '6', '3', '10', '2', '10']), r2 = t2.start();
    t2.act(r2, 'H'); expect(t2.canDouble(r2)).toBe(false); t2.act(r2, 'S'); finish(t2, r2);
    expect(r2.net).toBe(1);
  });
  it('splits once, permits double after split and aggregates each hand', () => {
    const table = tableWith(['8', '6', '8', '10', '3', '2', '10', '10', '10']);
    const round = table.start(); table.act(round, 'P');
    expect(round.hands).toHaveLength(2); expect(table.canSplit(round)).toBe(false);
    expect(table.canDouble(round)).toBe(true);
    table.act(round, 'D'); table.act(round, 'S'); finish(table, round);
    const result = settleBlackjackRounds([round], 10, 'basic', 1.5);
    expect(result.bets).toBe(1); expect(result.delta).toBe(30);
    expect(result.results[0].hands.map(h => h.net)).toEqual([20, 10]);
  });
  it('split aces get one card each and their 21 is not a natural payout', () => {
    const table = tableWith(['A', '9', 'A', '8', 'K', 'Q']), round = table.start();
    table.act(round, 'P'); expect(round.phase).toBe('dealer'); finish(table, round);
    expect(round.hands.map(h => h.cards.length)).toEqual([2, 2]);
    expect(round.net).toBe(2);
    expect(roundView(round, 10).hands.every(h => !h.value.natural)).toBe(true);
  });
  it('player bust loses immediately even if a hypothetical dealer continuation would bust', () => {
    const table = tableWith(['10', '6', '6', '10', '10']), round = table.start();
    table.act(round, 'H'); finish(table, round);
    expect(round.hands[0].tag).toBe('bust'); expect(round.net).toBe(-1);
    expect(round.dealer).toHaveLength(2);
  });
  it('dealer stands on soft 17 and pushes equal totals', () => {
    const table = tableWith(['10', 'A', '7', '6']), round = table.start();
    table.act(round, 'S'); finish(table, round);
    expect(round.dealer).toHaveLength(2); expect(round.net).toBe(0);
    expect(handValue(round.dealer)).toMatchObject({ t: 17, soft: true, bust: false });
  });
  it('never and mimic suggestions stay in the engine', () => {
    const table = tableWith(['10', '10', '2', '8']), round = table.start();
    expect(suggestedAction(table, round, 'never')).toBe('S');
    expect(suggestedAction(table, round, 'mimic')).toBe('H');
    expect(suggestedAction(table, null, 'basic')).toBeNull();
    expect(countView(new Table(mulberry32(1)))).toBeNull();
  });
  it('fast-forward uses the same shoe stream and accounting as single rounds', () => {
    const run = () => {
      const tables = Array.from({ length: 10 }, (_, i) => new Table(mulberry32(i + 42)));
      let session = newSession<ReturnType<typeof autoBlackjackRound>>();
      for (let i = 0; i < 100; i++) session = appendRound(session, autoBlackjackRound(tables, 10, 'basic', 1.5));
      return { session, tables };
    };
    const { session, tables } = run(); expect(session).toEqual(run().session);
    expect(session.rounds).toBe(100); expect(session.bets).toBe(1000);
    expect(session.expected).toBeCloseTo(-46); expect(session.history).toHaveLength(101);
    const next = appendRound(session, autoBlackjackRound(tables, 100, 'never', 1.2));
    expect(next.bets).toBe(1010); expect(next.expected - session.expected).toBeCloseTo(-74.5);
    expect(blackjackLossRates(1, 10, 'basic', 1.5).perNight).toBeCloseTo(25.76);
  });
  it('rejects unfinished accounting and resets Hi-Lo only at the cut between hands', () => {
    const table = tableWith(['10', '6', '7', '10']), round = table.start();
    expect(() => settleBlackjackRounds([round], 10, 'basic', 1.5)).toThrow('unfinished');
    table.shoe = Array.from({ length: 77 }, () => card('10')); table.runningCount = 999;
    table.start(); expect(table.shoe).toHaveLength(308); expect(Math.abs(table.runningCount)).toBeLessThan(5);
  });
});
