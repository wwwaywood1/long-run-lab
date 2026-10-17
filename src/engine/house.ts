import numbers from '../../data/numbers.json';
import { EDGE_RED } from './roulette';
import { BACCARAT_EDGE, BACCARAT_PROB, baccaratNet } from './baccarat';
import { CRASH_EDGE, cashOutProbability } from './crash';

export const HOUSE_ASSUMPTIONS = numbers.casino.assumptions.value;
export const HOUSE_BETS = [10, 100, 1000] as const;
export const HOUSE_GAME_IDS = ['roulette', 'sicbo', 'baccarat', 'slots', 'crash'] as const;
export type HouseGame = typeof HOUSE_GAME_IDS[number];
export const HOUSE_TINY_PROBABILITY = 1e-9;
const bankerMean = -Object.entries(BACCARAT_PROB).reduce((s, [side, p]) => s + p * baccaratNet(side as keyof typeof BACCARAT_PROB, 'B'), 0);
const bankerSecond = Object.entries(BACCARAT_PROB).reduce((s, [side, p]) => s + p * baccaratNet(side as keyof typeof BACCARAT_PROB, 'B') ** 2, 0);
const crashP = cashOutProbability(HOUSE_ASSUMPTIONS.crash_target);
export const HOUSE_GAMES = {
  roulette: { edge: EDGE_RED, variance: 1 - EDGE_RED ** 2 },
  sicbo: { edge: numbers.sicbo.edge_big_small.value, variance: 1 - numbers.sicbo.edge_big_small.value ** 2 },
  baccarat: { edge: BACCARAT_EDGE.B, variance: bankerSecond - bankerMean ** 2 },
  slots: { edge: numbers.slots.edge.value, variance: numbers.slots.net_variance.value },
  crash: { edge: CRASH_EDGE, variance: HOUSE_ASSUMPTIONS.crash_target ** 2 * crashP * (1 - crashP) },
} as const;

/** Normal upper tail, evaluated directly (never 1 − CDF).
 * Numerical Recipes erfc approximation; relative error about 1.2e-7.
 * This preserves tiny tails; the model itself is only a CLT approximation.
 */
export function normalSurvival(z: number): number {
  if (Number.isNaN(z)) throw new Error('z must be a number');
  if (z === 0) return 0.5;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const tail = 0.5 * t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return z < 0 ? 1 - tail : tail;
}

/** Fixed independent rounds per guest; no bankroll limit, shared rounds or stopping.
 * Unit variance includes pushes and commission for Banker and the slot jackpot.
 * Published baccarat edge and probabilities are separately rounded constants.
 */
export function houseNight(game: HouseGame, bet: number) {
  if (!Number.isFinite(bet) || bet <= 0) throw new Error('bet must be finite and positive');
  if (!Object.hasOwn(HOUSE_GAMES, game)) throw new Error('unknown game');
  const { edge, variance } = HOUSE_GAMES[game];
  const rounds = HOUSE_ASSUMPTIONS.rounds_per_hour[game] * HOUSE_ASSUMPTIONS.hours * HOUSE_ASSUMPTIONS.guests;
  const expected = rounds * edge * bet;
  return { rounds, expected, perGuest: expected / HOUSE_ASSUMPTIONS.guests,
    standardDeviation: bet * Math.sqrt(rounds * variance),
    lossProbability: normalSurvival(edge * Math.sqrt(rounds / variance)) };
}

export const CASINO_EDGES = {
  ...Object.fromEntries(HOUSE_GAME_IDS.map(k => [k, HOUSE_GAMES[k].edge])) as Record<HouseGame, number>,
  lottery: 1 - numbers.facts.lotto_fund_split.prizes,
  scratch: 1 - numbers.facts.instant_fund_split.prizes,
  gacha: 1 - numbers.gacha.presentation.value.cash_payout_rate,
  sports: 1 - numbers.sports.return_by_legs.value['1'],
};
export const CASINO_SPEEDS = ['blackjack', 'baccarat', 'sicbo', 'roulette', 'crash', 'slots'].map(id => {
  const game = id as HouseGame;
  const edge = id === 'blackjack' ? HOUSE_ASSUMPTIONS.blackjack_speed_edge : HOUSE_GAMES[game].edge;
  const rounds = id === 'blackjack' ? HOUSE_ASSUMPTIONS.blackjack_rounds_per_hour : HOUSE_ASSUMPTIONS.rounds_per_hour[game];
  const loss = edge * rounds * HOUSE_ASSUMPTIONS.speed_bet;
  const maximum = HOUSE_GAMES.slots.edge * HOUSE_ASSUMPTIONS.rounds_per_hour.slots * HOUSE_ASSUMPTIONS.speed_bet;
  return { id, edge, rounds, loss, width: loss / maximum * 100, displayLoss: loss >= 100 ? Math.round(loss) : Math.round(loss * 10) / 10 };
});
export const CASINO_SPEED_RATIO = CASINO_SPEEDS[5].loss / CASINO_SPEEDS[0].loss;
