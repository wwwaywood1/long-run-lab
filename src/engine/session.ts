/** Pure cumulative bookkeeping; game-specific payouts stay in each game engine. */
export interface HistoryPoint { p: number; e: number }
export interface RoundTotals { delta: number; expectedDelta: number; bets: number }
export interface Session<R extends RoundTotals> {
  pnl: number; expected: number; rounds: number; bets: number;
  history: HistoryPoint[]; last: R | null;
}
export const newSession = <R extends RoundTotals>(): Session<R> => ({
  pnl: 0, expected: 0, rounds: 0, bets: 0, history: [{ p: 0, e: 0 }], last: null,
});
export function appendRound<R extends RoundTotals>(session: Session<R>, round: R): Session<R> {
  const pnl = session.pnl + round.delta, expected = session.expected + round.expectedDelta;
  return { pnl, expected, rounds: session.rounds + 1, bets: session.bets + round.bets,
    history: [...session.history, { p: pnl, e: expected }].slice(-400), last: round };
}
export const lossAmount = (pnl: number) => Math.max(0, -pnl);
