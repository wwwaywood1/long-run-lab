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
