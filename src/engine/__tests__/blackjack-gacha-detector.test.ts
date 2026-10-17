import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../rng';
import * as bj from '../blackjack';
import * as gacha from '../gacha';
import { FairnessMonitor, P0 } from '../detector';
import { withinSE } from './helpers';

describe('二十一点', () => {
  it('黑杰克出现率约 4.75%，基本策略优势约 0.46%', () => {
    const table = new bj.Table(mulberry32(7));
    const n = 400_000;
    let net = 0, bjs = 0;
    for (let i = 0; i < n; i++) { const r = table.autoRound('basic', 1.5); net += r.net; if (r.playerBJ) bjs++; }
    expect(withinSE(bjs / n, 0.0475, 0.213, n)).toBe(true);
    expect(withinSE(-net / n, bj.BJ_EDGE.basic['1.5'], 1.15, n)).toBe(true);
  });
  it('学庄家打法的劣势远大于基本策略', () => {
    const table = new bj.Table(mulberry32(8));
    const n = 200_000;
    let net = 0;
    for (let i = 0; i < n; i++) net += table.autoRound('mimic', 1.5).net;
    expect(withinSE(-net / n, bj.BJ_EDGE.mimic['1.5'], 1.0, n)).toBe(true);
  });
});

describe('抽卡', () => {
  it('精确：每个五星平均 62.3 抽，限定卡平均 93.4 抽', () => {
    const d = gacha.exactDistributions();
    expect(d.mean5).toBeCloseTo(62.297, 2);
    expect(d.meanFeatured).toBeCloseTo(93.446, 2);
    expect(d.featured.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('模拟与精确值一致，最多 180 抽', () => {
    const rng = mulberry32(9);
    const n = 50_000;
    let s = 0, mx = 0;
    for (let i = 0; i < n; i++) { const k = gacha.pullsUntilFeatured(gacha.newPlayer(), rng); s += k; mx = Math.max(mx, k); }
    expect(withinSE(s / n, 93.446, 40, n)).toBe(true);
    expect(mx).toBeLessThanOrEqual(180);
  });
});

describe('公平检测器', () => {
  it('公平桌 1000 局内：e 值误报 ≤ 5%，每局看 p 值误报远超 5%', () => {
    const rng = mulberry32(10);
    const tables = 2000;
    let fe = 0, fn = 0;
    for (let i = 0; i < tables; i++) {
      const m = new FairnessMonitor();
      for (let t = 0; t < 1000; t++) m.observe(rng() < P0 ? 1 : 0);
      if (m.alarmE) fe++;
      if (m.alarmNaive) fn++;
    }
    expect(fe / tables).toBeLessThan(0.065);
    expect(fn / tables).toBeGreaterThan(0.25);
  });
  it('胜率被调到 42% 时，e 值最终会报警', () => {
    const rng = mulberry32(11);
    let alarms = 0;
    for (let i = 0; i < 200; i++) {
      const m = new FairnessMonitor();
      for (let t = 0; t < 5000 && !m.alarmE; t++) m.observe(rng() < 0.42 ? 1 : 0);
      if (m.alarmE) alarms++;
    }
    expect(alarms).toBeGreaterThanOrEqual(195);
  });
});
