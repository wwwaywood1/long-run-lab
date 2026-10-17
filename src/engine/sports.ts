import { type Rng, randInt } from './rng';
import { appendRound, newSession, type Session } from './session';

/** 示例赔率：每场返还 92%（即赔率 = 0.92 / 真实概率，四舍五入到 0.01） */
export const RETURN_PER_LEG = 0.92;
export const TEAMS = ['北岸', '南港', '东林', '西川', '金城', '银湾', '铁山', '白河', '青石', '海风', '云峰', '长桥', '星野', '雪原', '火鸟', '黑岩'];
export type Outcome = 0 | 1 | 2; // 主胜 / 平 / 客胜

export interface Match { home: string; away: string; p: [number, number, number]; odds: [number, number, number]; result: Outcome; score: string; pick: Outcome | -1 }

export function makeMatch(rng: Rng): Match {
  const a = randInt(rng, TEAMS.length);
  let b = randInt(rng, TEAMS.length - 1);
  if (b >= a) b++;
  const pD = 0.22 + rng() * 0.08;
  const rest = 1 - pD;
  const pH = rest * (0.25 + rng() * 0.5);
  const p: [number, number, number] = [pH, pD, rest - pH];
  const odds = p.map((x) => Math.max(1.01, Math.round((RETURN_PER_LEG / x) * 100) / 100)) as [number, number, number];
  const u = rng();
  const result: Outcome = u < p[0] ? 0 : u < p[0] + p[1] ? 1 : 2;
  const g = randInt(rng, 3), extra = rng() < 0.35 ? 1 : 0;
  const score = result === 0 ? `${g + 1 + extra} : ${g}` : result === 1 ? `${g} : ${g}` : `${g} : ${g + 1 + extra}`;
  return { home: TEAMS[a], away: TEAMS[b], p, odds, result, score, pick: -1 };
}

export const favourite = (m: Match): Outcome => (m.p[0] >= m.p[2] ? 0 : 2);

/** 串关：总赔率、全中与否、精确期望返还（真实概率 × 赔率的连乘） */
export function evaluate(slip: Match[]) {
  let odds = 1, ev = 1, hit = true;
  for (const m of slip) {
    if (m.pick === -1) throw new Error('unpicked match');
    odds *= m.odds[m.pick];
    ev *= m.p[m.pick] * m.odds[m.pick];
    if (m.result !== m.pick) hit = false;
  }
  return { odds, ev, hit };
}

/** 赔率换算的隐含概率之和（> 1 的部分就是抽水） */
export const overround = (odds: number[]) => odds.reduce((s, o) => s + 1 / o, 0);

export const SPORTS_TABLES = [1, 10, 100] as const;
export const SPORTS_BETS = [10, 100, 1000] as const;
export const SPORTS_LEGS = [1, 2, 4, 8] as const;
export const SPORTS_OUTCOMES = [0, 1, 2] as const;
export const SPORTS_FAST_ROUNDS = 100;
export interface SportsSlip { matches: Match[]; revealed: number }

/** Multi-bet mode and automatic play back the original engine's favorites. */
export function createSportsSlips(tables: number, legs: number, autoPick: boolean, rng: Rng): SportsSlip[] {
  return Array.from({ length: tables }, () => ({ revealed: 0, matches: Array.from({ length: legs }, () => {
    const match = makeMatch(rng);
    if (autoPick || tables > 1) match.pick = favourite(match);
    return match;
  }) }));
}
export const sportsReady = (slips: SportsSlip[]) => slips.length > 0 && slips.every(s => s.matches.length > 0 && s.matches.every(m => m.pick >= 0));
export function pickSportsOutcome(slips: SportsSlip[], index: number, outcome: Outcome): SportsSlip[] {
  if (slips.length !== 1 || slips[0].revealed || !slips[0].matches[index] || !SPORTS_OUTCOMES.includes(outcome)) return slips;
  return [{ ...slips[0], matches: slips[0].matches.map((m, i) => i === index ? { ...m, pick: outcome } : m) }];
}
export const backSportsFavorites = (slips: SportsSlip[]): SportsSlip[] => slips.map(s => ({ ...s, matches: s.matches.map(m => ({ ...m, pick: favourite(m) })) }));
export const revealSportsStep = (slips: SportsSlip[]): SportsSlip[] => slips.map(s => ({ ...s, revealed: Math.min(s.matches.length, s.revealed + 1) }));
export const revealSportsSlips = (slips: SportsSlip[]): SportsSlip[] => slips.map(s => ({ ...s, revealed: s.matches.length }));

/** No unannounced score, outcome, hit or net result escapes this display view. */
export function sportsSlipView(slip: SportsSlip, bet: number) {
  const picked = slip.matches.filter(m => m.pick >= 0).length;
  const ready = picked === slip.matches.length && picked > 0;
  const settled = ready && slip.revealed === slip.matches.length;
  const evaluated = ready ? evaluate(slip.matches) : null;
  return {
    picked, total: slip.matches.length, ready, settled,
    odds: evaluated?.odds ?? null, payout: evaluated ? evaluated.odds * bet : null,
    hit: settled ? evaluated!.hit : null,
    right: settled ? slip.matches.filter(m => m.pick === m.result).length : null,
    delta: settled ? (evaluated!.hit ? evaluated!.odds - 1 : -1) * bet : null,
    matches: slip.matches.map((m, index) => {
      const shown = index < slip.revealed;
      return { home: m.home, away: m.away, shown, score: shown ? m.score : null,
        result: shown ? m.result : null, right: shown ? m.pick === m.result : null,
        options: SPORTS_OUTCOMES.map(outcome => ({ outcome, odds: m.odds[outcome], truePercent: Math.round(m.p[outcome] * 100), selected: m.pick === outcome, actual: shown ? m.result === outcome : null })),
      };
    }),
  };
}
export interface SportsRound {
  delta: number; expectedDelta: number; bets: number; wins: number; lastOdds: number; bet: number; slips: SportsSlip[];
}
export interface SportsSession extends Session<SportsRound> { wins: number }
export const newSportsSession = (): SportsSession => ({ ...newSession<SportsRound>(), wins: 0 });
export function settleSportsRound(slips: SportsSlip[], bet: number): SportsRound {
  if (!sportsReady(slips) || slips.some(s => s.revealed !== s.matches.length)) throw new Error('unrevealed sports slip');
  let units = 0, wins = 0, evSum = 0, lastOdds = 0;
  for (const slip of slips) {
    const result = evaluate(slip.matches);
    evSum += result.ev; lastOdds = result.odds;
    if (result.hit) { wins++; units += result.odds - 1; } else units--;
  }
  return { delta: units * bet, expectedDelta: -bet * (slips.length - evSum), bets: slips.length, wins, lastOdds, bet, slips };
}
export function appendSportsRound(session: SportsSession, round: SportsRound): SportsSession {
  return { ...appendRound(session, round), wins: session.wins + round.wins };
}
export const sportsHitRate = (session: SportsSession): number | null => session.bets ? session.wins / session.bets : null;
export function fastSports(session: SportsSession, tables: number, legs: number, bet: number, rng: Rng): SportsSession {
  let next = session;
  for (let i = 0; i < SPORTS_FAST_ROUNDS; i++) {
    next = appendSportsRound(next, settleSportsRound(revealSportsSlips(createSportsSlips(tables, legs, true, rng)), bet));
  }
  return next;
}
