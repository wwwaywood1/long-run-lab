/**
 * 公平检测器：原假设 H0：押红胜率 p0 = 18/38。
 * - e 值检验：五个备择胜率的似然比乘积取平均（非负鞅的混合），越过 1/α 报警，误报率 ≤ α（Ville 不等式）。
 * - e-detector：同样五个备择的 Shiryaev–Roberts 统计量取平均，越过 c 报警，平均误报间隔 ≥ c（Shin, Ramdas & Rinaldo 2024）。
 * - 对照：从第 10 局起每局做一次单侧 z 检验（会因“反复偷看”而大量误报）。
 */
export const P0 = 18 / 38;
export const GRID = [0.3, 0.34, 0.38, 0.42, 0.45];
export const E_THRESHOLD = 20;
export const R_THRESHOLD = 1000;

export const likelihoodRatio = (p: number, win: 0 | 1) => (win ? p / P0 : (1 - p) / (1 - P0));

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
      this.L[k] *= l;
      this.R[k] = (this.R[k] + 1) * l;
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
