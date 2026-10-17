import { appendRound, newSession, type Session } from './session';
import { type Rng, randInt, sampleSorted } from './rng';

/**
 * 双色球：33 选 6 红球 + 16 选 1 蓝球，每注 2 元。
 * 三到六等奖为固定奖金；一二等奖浮动，本项目模拟按 700 万 / 12 万计（接近 2026 年第 076 期实际单注奖金）。
 */
export const PRICE = 2;
export const PRIZES = [0, 7_000_000, 120_000, 3000, 200, 10, 5] as const;
export const TIER_NAMES_ZH = ['', '一等', '二等', '三等', '四等', '五等', '六等'];
/** 官方资金构成（乐透型）：返奖 51%、公益金 36%、发行费 13% */
export const OFFICIAL_SPLIT = { prizes: 0.51, welfare: 0.36, operations: 0.13 };

export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** 恰好中 r 个红球、蓝球中/不中的精确概率 */
export function pMatch(r: number, blue: boolean): number {
  const pr = (comb(6, r) * comb(27, 6 - r)) / comb(33, 6);
  return pr * (blue ? 1 / 16 : 15 / 16);
}

export function tierOf(redHits: number, blueHit: boolean): number {
  if (redHits === 6) return blueHit ? 1 : 2;
  if (redHits === 5) return blueHit ? 3 : 4;
  if (redHits === 4) return blueHit ? 4 : 5;
  if (redHits === 3) return blueHit ? 5 : 0;
  return blueHit ? 6 : 0;
}

/** 各奖级的精确中奖概率，下标 1..6 */
export function tierProbabilities(): number[] {
  const p = [0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r <= 6; r++) for (const b of [true, false]) p[tierOf(r, b)] += pMatch(r, b);
  p[0] = 0;
  return p;
}

export interface Ticket { reds: number[]; blue: number }
export const quickPick = (rng: Rng): Ticket => ({ reds: sampleSorted(rng, 6, 33), blue: 1 + randInt(rng, 16) });

export function check(t: Ticket, draw: Ticket) {
  const redHits = t.reds.filter((r) => draw.reds.includes(r)).length;
  const blueHit = t.blue === draw.blue;
  const tier = tierOf(redHits, blueHit);
  return { redHits, blueHit, tier, prize: PRIZES[tier] };
}

/** 每注的期望返还（元），以及只算三到六等奖时的期望返还 */
export function expectedReturn() {
  const p = tierProbabilities();
  let all = 0, fixedOnly = 0;
  for (let t = 1; t <= 6; t++) {
    all += p[t] * PRIZES[t];
    if (t >= 3) fixedOnly += p[t] * PRIZES[t];
  }
  return { all, fixedOnly, allRate: all / PRICE, fixedOnlyRate: fixedOnly / PRICE };
}

/** Draw cadence and batch sizes from the prototype, not a live lottery calendar. */
export const LOTTERY_DRAWS_PER_WEEK = 3;
export const LOTTERY_DRAWS_PER_YEAR = 156;
export const LOTTERY_BATCH_YEARS = [1, 10] as const;
export const LOTTERY_BET_COUNTS = [1, 10, 100] as const;
const TIER_PROBABILITIES = tierProbabilities();
const EXPECTED_PRIZE = expectedReturn().all;

export interface CheckedTicket extends Ticket {
  redHits: number; blueHit: boolean; tier: number; prize: number; redMatches: boolean[];
}
export interface LotteryRound {
  draw: Ticket | null; tickets: CheckedTicket[];
  bets: number; cost: number; won: number; hits: number; tiers: number[];
  delta: number; expectedDelta: number;
}
export function settleTickets(tickets: Ticket[], draw: Ticket): LotteryRound {
  const checked = tickets.map(ticket => ({ ...ticket, ...check(ticket, draw), redMatches: ticket.reds.map(red => draw.reds.includes(red)) }));
  const tiers = Array<number>(PRIZES.length).fill(0);
  for (const result of checked) if (result.tier > 0) tiers[result.tier]++;
  const won = checked.reduce((sum, result) => sum + result.prize, 0), cost = tickets.length * PRICE;
  return { draw, tickets: checked, bets: tickets.length, cost, won, hits: checked.filter(t => t.tier > 0).length, tiers,
    delta: won - cost, expectedDelta: tickets.length * (EXPECTED_PRIZE - PRICE) };
}
export function drawLotteryRound(bets: number, rng: Rng): LotteryRound {
  const tickets = Array.from({ length: bets }, () => quickPick(rng));
  return settleTickets(tickets, quickPick(rng));
}
/** Exact categorical sampling replaces unseen ticket numbers in long batches, as in the design. */
export function sampleTier(rng: Rng): number {
  let u = rng();
  for (let tier = 1; tier <= 6; tier++) { if (u < TIER_PROBABILITIES[tier]) return tier; u -= TIER_PROBABILITIES[tier]; }
  return 0;
}
function sampleRound(bets: number, rng: Rng): LotteryRound {
  const tiers = Array<number>(PRIZES.length).fill(0);
  let won = 0, hits = 0;
  for (let i = 0; i < bets; i++) {
    const tier = sampleTier(rng);
    if (tier) { won += PRIZES[tier]; tiers[tier]++; hits++; }
  }
  const cost = bets * PRICE;
  return { draw: null, tickets: [], bets, cost, won, hits, tiers, delta: won - cost, expectedDelta: bets * (EXPECTED_PRIZE - PRICE) };
}

export interface LotterySession extends Session<LotteryRound> { spent: number; won: number; tiers: number[] }
export const newLotterySession = (): LotterySession => ({ ...newSession<LotteryRound>(), spent: 0, won: 0, tiers: Array<number>(PRIZES.length).fill(0) });
export function appendLotteryRound(session: LotterySession, round: LotteryRound): LotterySession {
  return { ...appendRound(session, round), spent: session.spent + round.cost, won: session.won + round.won,
    tiers: session.tiers.map((count, tier) => count + round.tiers[tier]) };
}
export function fastLottery(session: LotterySession, bets: number, draws: number, rng: Rng): LotterySession {
  if (!Number.isInteger(draws) || draws < 1) throw new Error('Expected a positive number of draws');
  let next = session;
  const history = session.history.slice(), every = Math.max(1, Math.floor(draws / LOTTERY_DRAWS_PER_YEAR));
  for (let i = 0; i < draws - 1; i++) {
    next = appendLotteryRound(next, sampleRound(bets, rng));
    if (i % every === 0) history.push({ p: next.pnl, e: next.expected });
  }
  // The last draw has real ticket numbers and the same settlement rules as an animated draw.
  const draw = quickPick(rng), tickets = Array.from({ length: bets }, () => quickPick(rng));
  next = appendLotteryRound(next, settleTickets(tickets, draw));
  history.push({ p: next.pnl, e: next.expected });
  return { ...next, history: history.slice(-400) };
}
export function lotteryElapsed(draws: number): { unit: 'weeks' | 'years'; amount: number } {
  const years = draws / LOTTERY_DRAWS_PER_YEAR;
  return years < 1 ? { unit: 'weeks', amount: Math.max(0, Math.round(draws / LOTTERY_DRAWS_PER_WEEK)) } : { unit: 'years', amount: years };
}

export function fastLotteryYears(session: LotterySession, bets: number, years: number, rng: Rng): LotterySession {
  return fastLottery(session, bets, years * LOTTERY_DRAWS_PER_YEAR, rng);
}
