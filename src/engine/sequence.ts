/**
 * 红黑序列的随机性检测（第三部分 · 赌徒谬误；WIDGETS W6）。
 *
 * 读者自己编一串红黑，引擎在“公平硬币、每局独立”的假设下精确计算两个统计量的分布：
 * - 换色次数：n 局有 n − 1 个相邻位置，每个位置换色的概率都是 1/2 且相互独立，所以 ~ Binomial(n − 1, 1/2)；
 * - 最长同色连串：用动态规划精确计数（不做模拟）。
 * 判定：两个统计量各做双侧检验，每一侧的阈值是 1.25%（总共四个尾部，Bonferroni 校正），
 * 保证一串真随机的结果被误判为“不像随机”的概率不超过 5%（测试里对 20 局逐一枚举 2²⁰ 种序列核对）。
 */

export const ALPHA = 0.05;
const TAIL = ALPHA / 4;

/** 相邻两局颜色不同的次数 */
export function countSwitches(seq: readonly boolean[]): number {
  let s = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) s++;
  return s;
}

/** 最长同色连串的长度（空序列为 0） */
export function longestRun(seq: readonly boolean[]): number {
  let best = 0;
  let cur = 0;
  for (let i = 0; i < seq.length; i++) {
    cur = i > 0 && seq[i] === seq[i - 1] ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

/** 换色次数的分布：下标 k 是 P(恰好换色 k 次)，k = 0 … n − 1 */
export function switchPmf(n: number): number[] {
  if (n < 2) return [1];
  const m = n - 1;
  const pmf = new Array(m + 1).fill(0);
  let c = 1; // C(m, k)
  for (let k = 0; k <= m; k++) {
    pmf[k] = c / 2 ** m;
    c = (c * (m - k)) / (k + 1);
  }
  return pmf;
}

/**
 * P(最长连串 ≤ L)。最长连串 ≤ L 的序列 = 先选第一种颜色（2 种）× 把 n 拆成每段 ≤ L 的有序段数（相邻段颜色交替）。
 * 拆分数 c(0) = 1，c(m) = c(m − 1) + … + c(m − L)。
 */
export function longestRunCdf(n: number, L: number): number {
  if (n === 0) return 1;
  if (L <= 0) return 0;
  if (L >= n) return 1;
  const c = new Array(n + 1).fill(0);
  c[0] = 1;
  for (let m = 1; m <= n; m++) {
    let s = 0;
    for (let j = 1; j <= Math.min(L, m); j++) s += c[m - j];
    c[m] = s;
  }
  return (2 * c[n]) / 2 ** n;
}

/** 最长连串的分布：下标 L 是 P(最长连串恰好为 L)，L = 1 … n（下标 0 为 0） */
export function longestRunPmf(n: number): number[] {
  const pmf = new Array(n + 1).fill(0);
  for (let L = 1; L <= n; L++) pmf[L] = longestRunCdf(n, L) - longestRunCdf(n, L - 1);
  return pmf;
}

export type Verdict = 'random' | 'too-even' | 'too-streaky';

export interface SequenceReport {
  n: number;
  switches: number;
  longest: number;
  /** 公平硬币下的平均换色次数 (n − 1)/2 */
  expectedSwitches: number;
  /** 换色次数“这么少或更少”/“这么多或更多”的概率 */
  pSwitchesLow: number;
  pSwitchesHigh: number;
  /** 最长连串“这么短或更短”/“这么长或更长”的概率 */
  pRunLow: number;
  pRunHigh: number;
  /**
   * random：两项都在正常范围；
   * too-even：换得太勤或连串太短，像人编的“太均匀”；
   * too-streaky：换得太少或连串太长。
   * 两种迹象同时出现时按 too-even 处理（人编序列最常见的特征）。
   */
  verdict: Verdict;
}

export function assessSequence(seq: readonly boolean[]): SequenceReport {
  const n = seq.length;
  if (n < 2) throw new Error('need at least 2 rounds');
  const switches = countSwitches(seq);
  const longest = longestRun(seq);
  const sp = switchPmf(n);
  const pSwitchesLow = sp.slice(0, switches + 1).reduce((a, b) => a + b, 0);
  const pSwitchesHigh = sp.slice(switches).reduce((a, b) => a + b, 0);
  const pRunLow = longestRunCdf(n, longest);
  const pRunHigh = 1 - longestRunCdf(n, longest - 1);
  const even = pSwitchesHigh < TAIL || pRunLow < TAIL;
  const streaky = pSwitchesLow < TAIL || pRunHigh < TAIL;
  return {
    n, switches, longest, expectedSwitches: (n - 1) / 2,
    pSwitchesLow, pSwitchesHigh, pRunLow, pRunHigh,
    verdict: even ? 'too-even' : streaky ? 'too-streaky' : 'random',
  };
}
