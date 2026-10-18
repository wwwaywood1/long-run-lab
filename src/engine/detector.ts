/**
 * 公平检测器：原假设 H0：押红胜率 p0 = 18/38。
 * - e 值检验：五个备择胜率的似然比乘积取平均（非负鞅的混合），越过 1/α 报警，误报率 ≤ α（Ville 不等式）。
 * - e-detector：同样五个备择的 Shiryaev–Roberts 统计量取平均，越过 c 报警，平均误报间隔 ≥ c（Shin, Ramdas & Rinaldo 2024）。
 * - 对照：从第 10 局起每局做一次单侧 z 检验（会因“反复偷看”而大量误报）。
 */
import type { Rng } from './rng';

export const P0 = 18 / 38;
export const GRID = [0.3, 0.34, 0.38, 0.42, 0.45];
export const E_THRESHOLD = 20;
export const R_THRESHOLD = 1000;

export const likelihoodRatio = (p: number, win: 0 | 1) => (win ? p / P0 : (1 - p) / (1 - P0));

/** 与 research/compute_numbers.py 相同的上限，避免极长的模拟溢出成 Infinity；远在两条报警线之上，不影响任何判定 */
const CAP = 1e300;

export class FairnessMonitor {
  t = 0;
  wins = 0;
  private L = GRID.map(() => 1);
  private R = GRID.map(() => 0);
  e = 1;
  r = 0;
  alarmE = 0;
  alarmR = 0;
  alarmNaive = 0;

  observe(win: 0 | 1) {
    this.t++;
    this.wins += win;
    let se = 0, sr = 0;
    for (let k = 0; k < GRID.length; k++) {
      const l = likelihoodRatio(GRID[k], win);
      this.L[k] = Math.min(this.L[k] * l, CAP);
      this.R[k] = Math.min((this.R[k] + 1) * l, CAP);
      se += this.L[k];
      sr += this.R[k];
    }
    this.e = se / GRID.length;
    this.r = sr / GRID.length;
    if (!this.alarmE && this.e >= E_THRESHOLD) this.alarmE = this.t;
    if (!this.alarmR && this.r >= R_THRESHOLD) this.alarmR = this.t;
    if (!this.alarmNaive && this.t >= 10) {
      const z = (this.wins / this.t - P0) / Math.sqrt((P0 * (1 - P0)) / this.t);
      if (z < -1.645) this.alarmNaive = this.t;
    }
  }
}

/* ───────── 检测器页的两块交互用到的桌子设定与模拟（Research-Detector） ───────── */


/** 动了手脚的胜率、先放水阶段的胜率、开始动手的局数（第 SHIFT_AT 局之后改用 RIGGED_P） */
export const RIGGED_P = 0.42;
export const LOOSE_P = 0.55;
export const SHIFT_AT = 100;
/** “不告诉我”时三种桌子的抽取概率 */
export const HIDDEN_ODDS = { fair: 0.4, rigged: 0.3, shift: 0.3 } as const;

export type Truth = 'fair' | 'rigged' | 'shift';

/** 第 t 局（从 1 数起）押红赢的概率 */
export function winProbability(truth: Truth, t: number): number {
  if (truth === 'fair') return P0;
  if (truth === 'rigged') return RIGGED_P;
  return t <= SHIFT_AT ? LOOSE_P : RIGGED_P;
}

/** 用一个 [0, 1) 的均匀数抽一张桌子：40% 公平、30% 动了手脚、30% 先放水再动手 */
export function hiddenTruth(u: number): Truth {
  if (u < HIDDEN_ODDS.fair) return 'fair';
  return u < HIDDEN_ODDS.fair + HIDDEN_ODDS.rigged ? 'rigged' : 'shift';
}

/** 走势图的纵轴是 log10；0 或极小的值画在 LOG_FLOOR */
export const LOG_FLOOR = -3;
const log10Floor = (v: number) => (v > 0 ? Math.max(LOG_FLOOR, Math.log10(v)) : LOG_FLOOR);

/** 一张桌子从第 0 局开始的完整记录：统计量、报警局数，以及两条统计量的 log10 走势（下标 = 局数） */
export class DetectorSession {
  readonly monitor = new FairnessMonitor();
  readonly logE: number[] = [0];
  readonly logR: number[] = [LOG_FLOOR];
  constructor(readonly truth: Truth) {}

  step(rng: Rng): 0 | 1 {
    const win: 0 | 1 = rng() < winProbability(this.truth, this.monitor.t + 1) ? 1 : 0;
    this.monitor.observe(win);
    this.logE.push(log10Floor(this.monitor.e));
    this.logR.push(log10Floor(this.monitor.r));
    return win;
  }
}

/** 误报方格：tables 张公平桌各玩 rounds 局，记下“每局看 p 值”和 e 值是否报过警 */
export function falseAlarmTables(tables: number, rounds: number, rng: Rng): { naive: boolean[]; e: boolean[] } {
  const naive: boolean[] = [], e: boolean[] = [];
  for (let i = 0; i < tables; i++) {
    const m = new FairnessMonitor();
    for (let t = 0; t < rounds; t++) m.observe(rng() < P0 ? 1 : 0);
    naive.push(m.alarmNaive > 0);
    e.push(m.alarmE > 0);
  }
  return { naive, e };
}
