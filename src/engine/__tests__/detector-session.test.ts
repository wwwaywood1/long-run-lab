import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import {
  DetectorSession, FairnessMonitor, LOG_FLOOR, LOOSE_P, P0, RIGGED_P, SHIFT_AT,
  falseAlarmTables, hiddenTruth, winProbability,
} from '../detector';

describe('检测器页的桌子设定', () => {
  it('先放水再动手：第 1–100 局 55%，第 101 局起 42%', () => {
    expect(winProbability('shift', 1)).toBe(LOOSE_P);
    expect(winProbability('shift', SHIFT_AT)).toBe(LOOSE_P);
    expect(winProbability('shift', SHIFT_AT + 1)).toBe(RIGGED_P);
    expect(winProbability('fair', 5000)).toBe(P0);
    expect(winProbability('rigged', 1)).toBe(RIGGED_P);
  });

  it('“不告诉我”按 40% / 30% / 30% 抽桌子', () => {
    expect([0, 0.399, 0.4, 0.699, 0.7, 0.999].map(hiddenTruth)).toEqual(['fair', 'fair', 'rigged', 'rigged', 'shift', 'shift']);
  });
});

describe('DetectorSession', () => {
  it('走势的下标就是局数，统计量和单独跑 FairnessMonitor 完全一样', () => {
    const a = new DetectorSession('rigged');
    const ref = new FairnessMonitor();
    const rngA = mulberry32(7), rngB = mulberry32(7);
    for (let t = 1; t <= 600; t++) {
      a.step(rngA);
      ref.observe(rngB() < RIGGED_P ? 1 : 0);
    }
    expect(a.logE.length).toBe(601);
    expect(a.logR.length).toBe(601);
    expect([a.monitor.e, a.monitor.r, a.monitor.alarmE, a.monitor.alarmR, a.monitor.alarmNaive])
      .toEqual([ref.e, ref.r, ref.alarmE, ref.alarmR, ref.alarmNaive]);
    expect(a.logE[600]).toBeCloseTo(Math.max(LOG_FLOOR, Math.log10(ref.e)), 12);
    // 报警那一局，走势已经在报警线上
    if (a.monitor.alarmE) expect(a.logE[a.monitor.alarmE]).toBeGreaterThanOrEqual(Math.log10(20) - 1e-12);
  });

  it('第 0 局：E = 1（log 0），R = 0（画在下限）', () => {
    const s = new DetectorSession('fair');
    expect(s.logE).toEqual([0]);
    expect(s.logR).toEqual([LOG_FLOOR]);
    expect([s.monitor.e, s.monitor.r]).toEqual([1, 0]);
  });

  it('玩很久也不会溢出成 Infinity 或 NaN', () => {
    const s = new DetectorSession('rigged');
    const rng = mulberry32(3);
    for (let t = 0; t < 150_000; t++) s.step(rng);
    expect(Number.isFinite(s.monitor.e)).toBe(true);
    expect(Number.isFinite(s.monitor.r)).toBe(true);
    expect(s.logE.every(Number.isFinite)).toBe(true);
  });
});

describe('falseAlarmTables', () => {
  it('100 张公平桌 × 1000 局：和 numbers.json 的量级一致（每局看 p 值约 38%，e 值约 4%）', () => {
    const rng = mulberry32(2026);
    let naive = 0, e = 0;
    const reps = 20;
    for (let i = 0; i < reps; i++) {
      const r = falseAlarmTables(100, 1000, rng);
      expect(r.naive.length).toBe(100);
      naive += r.naive.filter(Boolean).length;
      e += r.e.filter(Boolean).length;
    }
    // 2000 张桌子：标准误约 1.1 个百分点（38%）和 0.43 个百分点（4%）
    expect(naive / (reps * 100)).toBeGreaterThan(0.33);
    expect(naive / (reps * 100)).toBeLessThan(0.43);
    expect(e / (reps * 100)).toBeLessThan(0.06);
  });
});
