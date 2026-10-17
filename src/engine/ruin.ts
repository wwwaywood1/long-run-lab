import { P_WIN_RED } from './roulette';

export interface RuinResult {
  /** 先到达目标（成功）的概率 */
  pWin: number;
  /** 先输光的概率 */
  pRuin: number;
  /** 结束前的期望局数 */
  expectedRounds: number;
}

/**
 * 经典赌徒破产：从 i 出发，每步 +1（概率 p）或 −1，先到 n 还是先到 0。
 * r = q/p。p ≠ 1/2 时 P(先到 n) = (rⁱ − 1)/(rⁿ − 1)，期望步数 = i/(q−p) − n/(q−p)·P。
 * 用 r 的对数和 expm1 计算，n 到几千也不会溢出，很小的概率也不会被舍入成 0。
 */
export function gamblersRuin(i: number, n: number, p: number): { pWin: number; expectedRounds: number } {
  if (!Number.isInteger(i) || !Number.isInteger(n)) throw new Error('i and n must be integers');
  if (i <= 0) return { pWin: 0, expectedRounds: 0 };
  if (i >= n) return { pWin: 1, expectedRounds: 0 };
  const q = 1 - p;
  if (p <= 0) return { pWin: 0, expectedRounds: i };
  if (q <= 0) return { pWin: 1, expectedRounds: n - i };
  if (Math.abs(p - q) < 1e-12) return { pWin: i / n, expectedRounds: i * (n - i) };
  const lr = Math.log(q / p);
  const pWin = p < q
    // r > 1：P = r^(i−n) · (1 − r^−i)/(1 − r^−n)
    ? Math.exp((i - n) * lr) * Math.expm1(-i * lr) / Math.expm1(-n * lr)
    // r < 1：P = (1 − rⁱ)/(1 − rⁿ)
    : Math.expm1(i * lr) / Math.expm1(n * lr);
  return { pWin, expectedRounds: (i - n * pWin) / (q - p) };
}

/** 计算器可选的每注金额（常见筹码面值）。1000、2000 都是它们的整数倍。 */
export const CHIPS = [1, 2, 5, 10, 20, 25, 50, 100] as const;

/** 把金额对齐到每注的整数倍，并限制在 [min, max] 之内 */
export function snapToBet(amount: number, bet: number, min: number, max: number): number {
  const lo = Math.ceil(min / bet) * bet;
  const hi = Math.floor(max / bet) * bet;
  return Math.min(hi, Math.max(lo, Math.round(amount / bet) * bet));
}

/**
 * 破产计算器：带 bankroll 进场，每局押红 bet，赢到 goal 就走，输光为止（默认美式轮盘押红，p = 18/38）。
 * bankroll 和 goal 必须是 bet 的整数倍，这时它恰好是经典赌徒破产，结果是精确值。
 * （不是整数倍时，最后一注要押零头，状态会跳出等距格点，公式不再适用，所以直接拒绝。）
 */
export function ruin(bankroll: number, goal: number, bet: number, p = P_WIN_RED): RuinResult {
  if (!(bet > 0)) throw new Error('bet must be positive');
  const i = bankroll / bet;
  const n = goal / bet;
  if (!Number.isInteger(i) || !Number.isInteger(n)) throw new Error('bankroll and goal must be multiples of bet');
  const { pWin, expectedRounds } = gamblersRuin(i, n, p);
  return { pWin, pRuin: 1 - pWin, expectedRounds };
}
