import type { Rng } from './rng';

/**
 * 示例卡池（参照手游常见保底设计，不对应具体游戏）：
 * 五星基础 0.6%，第 74 抽起每抽 +6 个百分点，第 90 抽必出；出五星时 50% 为限定，歪了之后下一个五星必为限定。
 * 四星 5.1%，每 10 抽至少一个四星或以上。
 */
export const PRICE_PER_PULL = 16; // 按 648 元约 40 抽折算

export function p5(k: number): number {
  return k <= 73 ? 0.006 : Math.min(1, 0.006 + 0.06 * (k - 73));
}

export interface Player { since5: number; since4: number; guaranteed: boolean; pulls: number; featured: number; off: number; fours: number }
export const newPlayer = (): Player => ({ since5: 0, since4: 0, guaranteed: false, pulls: 0, featured: 0, off: 0, fours: 0 });

/** 'F' 限定五星，'O' 歪了的五星，'4' 四星，'3' 三星 */
export function pull(pl: Player, rng: Rng): 'F' | 'O' | '4' | '3' {
  pl.pulls++;
  pl.since5++;
  pl.since4++;
  if (rng() < p5(pl.since5)) {
    const featured = pl.guaranteed || rng() < 0.5;
    pl.guaranteed = !featured;
    pl.since5 = 0;
    pl.since4 = 0;
    if (featured) pl.featured++; else pl.off++;
    return featured ? 'F' : 'O';
  }
  if (pl.since4 >= 10 || rng() < 0.051) { pl.since4 = 0; pl.fours++; return '4'; }
  return '3';
}

export function pullsUntilFeatured(pl: Player, rng: Rng): number {
  const start = pl.featured, before = pl.pulls;
  while (pl.featured === start) pull(pl, rng);
  return pl.pulls - before;
}

/** 精确分布：dist5[k] = 第 k 抽恰好出五星的概率；featured[k] = 第 k 抽恰好拿到限定的概率（k ≤ 180） */
export function exactDistributions() {
  const dist5 = new Array(91).fill(0);
  let surv = 1;
  for (let k = 1; k <= 90; k++) { const q = p5(k); dist5[k] = surv * q; surv *= 1 - q; }
  const featured = new Array(181).fill(0);
  for (let a = 1; a <= 90; a++) {
    featured[a] += 0.5 * dist5[a];
    for (let b = 1; b <= 90; b++) featured[a + b] += 0.5 * dist5[a] * dist5[b];
  }
  const mean5 = dist5.reduce((s, p, k) => s + k * p, 0);
  const meanFeatured = featured.reduce((s, p, k) => s + k * p, 0);
  return { dist5, featured, mean5, meanFeatured };
}
