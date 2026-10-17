import { describe, expect, it } from 'vitest';
import { AMOUNTS, PER_MILLION, PRICE, appendScratchRound, buyScratchTickets, drawAmount, exactStats, fastScratch, newScratchSession, newScratchTicket, revealScratchTicket, scratchCell, scratchView, settleScratchTickets } from '../scratch';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';
function amountRng(amount: number) {
  let lower = 0;
  for (let i = 0; i < AMOUNTS.length; i++) { if (AMOUNTS[i] === amount) return (lower + PER_MILLION[i] / 2) / 1e6; lower += PER_MILLION[i]; }
  return .99;
}
function ticketFor(amount: number) {
  let first = true; const rng = mulberry32(7);
  return newScratchTicket(() => { if (first) { first = false; return amountRng(amount); } return rng(); });
}
describe('scratch port contracts', () => {
  it('keeps the original prize distribution and exact statistics', () => {
    for (const amount of AMOUNTS) expect(drawAmount(() => amountRng(amount))).toBe(amount);
    expect(drawAmount(() => .99)).toBe(0);
    expect(exactStats()).toMatchObject({ rtp: numbers.scratch.rtp.value, winRate: numbers.scratch.win_rate.value, breakEvenShareOfWins: numbers.scratch.break_even_share_of_wins.value });
  });
  it('hides all covered values, prizes and outcomes', () => {
    const play = ticketFor(1_000_000), view = scratchView(play);
    expect(view).toMatchObject({ winning: [null, null], settled: false, amount: null, net: null, outcome: 'pending', remaining: 8 });
    expect(view.mine.every(cell => cell.number === null && cell.prize === null && !cell.hit)).toBe(true);
  });
  it('opens a cell once and ignores invalid indices without mutating the ticket', () => {
    const play = ticketFor(20), opened = scratchCell(play, 3);
    expect(play.open.every(value => !value)).toBe(true); expect(opened.open[3]).toBe(true);
    expect(scratchView(opened).remaining).toBe(7); expect(scratchView(opened).mine[1].prize).toBeTypeOf('number');
    expect(scratchCell(opened, 3)).toBe(opened);
    for (const index of [-1, 8, 1.5, NaN]) expect(scratchCell(opened, index)).toBe(opened);
  });
  it.each([0, ...AMOUNTS])('keeps the %s outcome and matching prize invariant under reveal order', amount => {
    const play = ticketFor(amount); let current = play;
    for (const index of [7, 4, 0, 6, 2, 1, 3]) { current = scratchCell(current, index); expect(current.settled).toBe(false); }
    current = scratchCell(current, 5);
    expect(current).toEqual(revealScratchTicket(play)); expect(revealScratchTicket(current)).toBe(current);
    const view = scratchView(current), hits = view.mine.filter(cell => cell.hit);
    expect(view.amount).toBe(amount); expect(view.net).toBe(amount - PRICE);
    expect(view.outcome).toBe(amount === 0 ? 'miss' : amount === PRICE ? 'even' : 'win');
    expect(hits).toHaveLength(amount ? 1 : 0);
    for (const cell of view.mine) {
      expect(cell.prize).toBeTypeOf('number');
      expect(view.winning.includes(cell.number)).toBe(cell.hit);
      if (cell.hit) expect(cell.prize).toBe(amount);
    }
  });
  it('rejects covered ticket accounting and accumulates win/break-even/net independently', () => {
    expect(() => settleScratchTickets([ticketFor(10)])).toThrow('covered');
    const tickets = [0, 10, 20, 1_000_000].map(amount => revealScratchTicket(ticketFor(amount)));
    const round = settleScratchTickets(tickets);
    expect(round).toMatchObject({ paid: 1000030, bets: 4, hits: 3, evens: 1, delta: 999990, expectedDelta: -14, biggest: 1000000 });
    const session = appendScratchRound(newScratchSession(), round);
    expect(session).toMatchObject({ rounds: 1, bets: 4, hits: 3, evens: 1, pnl: 999990, expected: -14 });
    expect(newScratchSession()).toMatchObject({ bets: 0, hits: 0, evens: 0 });
  });
  it('fast-forward equals 100 normally settled buys from the same random stream', () => {
    const a = mulberry32(14), b = mulberry32(14);
    const fast = fastScratch(newScratchSession(), 10, a);
    let manual = newScratchSession();
    for (let i = 0; i < 100; i++) manual = appendScratchRound(manual, settleScratchTickets(buyScratchTickets(10, b).map(revealScratchTicket)));
    expect(fast).toEqual(manual); expect(fast.bets).toBe(1000); expect(fast.expected).toBeCloseTo(-3500);
    expect(fast.hits).toBeGreaterThanOrEqual(fast.evens); expect(fast.history).toHaveLength(101);
  });
  it('preserves cumulative totals across batch sizes and bounds history', () => {
    let session = newScratchSession(); const rng = mulberry32(15);
    for (const count of [1, 10, 100, 1, 10]) session = fastScratch(session, count, rng);
    expect(session.rounds).toBe(500); expect(session.bets).toBe(12200); expect(session.history).toHaveLength(400);
    expect(session.history.at(-1)).toEqual({ p: session.pnl, e: session.expected });
    expect(session.last!.tickets.every(ticket => ticket.settled)).toBe(true);
  });
});
