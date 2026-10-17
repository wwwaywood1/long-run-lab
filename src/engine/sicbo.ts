import { type Rng, randInt } from './rng';

export type SicBoBet = 'big' | 'small' | 'triple';
export type Dice = [number, number, number];

/** 庄家优势：大/小 = 6/216（豹子通杀）；任意豹子 30 赔 1 = 30/216 */
export const SICBO_EDGE: Record<SicBoBet, number> = { big: 6 / 216, small: 6 / 216, triple: 30 / 216 };
export const ANY_TRIPLE_PAYS = 30;

export function rollDice(rng: Rng): Dice {
  return [1 + randInt(rng, 6), 1 + randInt(rng, 6), 1 + randInt(rng, 6)];
}

export const isTriple = (d: Dice) => d[0] === d[1] && d[1] === d[2];
export const sum = (d: Dice) => d[0] + d[1] + d[2];

/** 一注的净收益（以注额为单位）：赢 +1 或 +30，输 −1 */
export function sicboNet(d: Dice, bet: SicBoBet): number {
  const t = isTriple(d);
  if (bet === 'triple') return t ? ANY_TRIPLE_PAYS : -1;
  if (t) return -1;
  const s = sum(d);
  if (bet === 'big') return s >= 11 ? 1 : -1;
  return s <= 10 ? 1 : -1;
}

/** 216 种结果的精确计数，用于“揭晓”图 */
export function outcomeCounts(): { big: number; small: number; triple: number } {
  let big = 0, small = 0, triple = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const d: Dice = [a, b, c];
    if (isTriple(d)) triple++;
    else if (sum(d) >= 11) big++;
    else small++;
  }
  return { big, small, triple };
}

export const SICBO_ROUNDS_PER_HOUR = 60;
export const SICBO_NIGHT_HOURS = 8;
export const SICBO_FAST_ROUNDS = 100;
export function diceKind(dice: Dice): SicBoBet {
  return isTriple(dice) ? 'triple' : sum(dice) >= 11 ? 'big' : 'small';
}
export interface SicBoGame { dice: Dice; total: number; kind: SicBoBet; net: number; win: boolean }
export interface SicBoRound {
  games: SicBoGame[]; pick: SicBoBet; stake: number; delta: number; expectedDelta: number;
  bets: number; wins: number; losses: number; triples: number;
}
export function settleDice(dice: Dice[], pick: SicBoBet, stake: number): SicBoRound {
  const games = dice.map(d => {
    const net = sicboNet(d, pick) * stake;
    return { dice: d, total: sum(d), kind: diceKind(d), net, win: net > 0 };
  });
  const wins = games.filter(game => game.win).length;
  return { games, pick, stake, delta: games.reduce((total, game) => total + game.net, 0),
    expectedDelta: -stake * games.length * SICBO_EDGE[pick], bets: games.length,
    wins, losses: games.length - wins, triples: games.filter(game => game.kind === 'triple').length };
}
export function rollRound(tables: number, pick: SicBoBet, stake: number, rng: Rng): SicBoRound {
  return settleDice(Array.from({ length: tables }, () => rollDice(rng)), pick, stake);
}
export function sicboLossRates(tables: number, stake: number, pick: SicBoBet) {
  const perMinute = tables * stake * SICBO_ROUNDS_PER_HOUR * SICBO_EDGE[pick] / 60;
  return { perMinute, perNight: perMinute * 60 * SICBO_NIGHT_HOURS };
}
/** Sorted exact sample space for the reveal diagram; no UI reimplements classification. */
export function allOutcomes() {
  const outcomes: { dice: Dice; total: number; kind: SicBoBet }[] = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const dice: Dice = [a, b, c];
    outcomes.push({ dice, total: sum(dice), kind: diceKind(dice) });
  }
  return outcomes.sort((a, b) => a.total - b.total);
}
