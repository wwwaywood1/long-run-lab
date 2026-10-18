import { describe, expect, it } from 'vitest';
import source from '../../../i18n/source/Research-Detector.json';
import numbers from '../../../data/numbers.json';
import { pageText } from '../../i18n/page';
import { ALARM, NAIVE, statText } from '../../components/widgets/DetectorLab';
import { ROUNDS, TABLES } from '../../components/widgets/FalseAlarmGrid';
import { E_THRESHOLD, HIDDEN_ODDS, LOOSE_P, P0, RIGGED_P, R_THRESHOLD, SHIFT_AT } from '../../engine/detector';

/**
 * 研究层 · 公平检测器页。两块交互的文案里写着阈值、胜率和局数；
 * 这里核对它们和引擎常量、numbers.json 一致，带局数的句子和 JSON 碎片拼起来一致。
 */
const zh = pageText(source, 'zh').t;
const en = pageText(source, 'en').t;
const pct = (p: number) => `${Math.round(p * 1000) / 10}%`;

describe('Research-Detector copy ↔ engine', () => {
  it('alarm sentences equal the JSON fragments (071–073)', () => {
    expect(ALARM.zh.test('123')).toBe(`${zh(71)}123${zh(72)}`);
    expect(ALARM.zh.detect('123')).toBe(`${zh(71)}123${zh(73)}`);
    expect(ALARM.en.test('123')).toBe(`${en(71)}123${en(72)}`);
    expect(ALARM.en.detect('123')).toBe(`${en(71)}123${en(73)}`);
  });

  it('the “checked every round” add-on equals the JSON fragments (077–078)', () => {
    expect(NAIVE.zh('15')).toBe(`${zh(77)}15${zh(78)}`);
    // 078 的英文为空：句号由模板补上
    expect(NAIVE.en('15')).toBe(`${en(77)}15.`);
  });

  it('thresholds written in the copy match the engine', () => {
    expect(E_THRESHOLD).toBe(20);
    expect(R_THRESHOLD).toBe(1000);
    for (const s of [zh(75), zh(90), en(75), en(90)]) expect(s).toContain(String(E_THRESHOLD));
    for (const s of [zh(76), zh(91)]) expect(s).toContain('1000');
    for (const s of [en(76), en(91)]) expect(s).toContain('1,000');
    // 报警线 20 ⇔ 误报率 ≤ 1/20 = 5%（Ville 不等式）
    expect(1 / E_THRESHOLD).toBe(0.05);
    for (const s of [zh(80), zh(90), en(80), en(90)]) expect(s).toContain('5%');
  });

  it('table settings in the mode notes and the reveal match the engine', () => {
    expect(pct(P0)).toBe('47.4%');
    for (const s of [zh(65), en(65), zh(11), en(11)]) expect(s).toContain(pct(P0));
    for (const s of [zh(66), en(66), zh(82), en(82)]) expect(s).toContain(pct(RIGGED_P));
    for (const s of [zh(67), en(67), zh(84), en(84)]) {
      expect(s).toContain(pct(LOOSE_P));
      expect(s).toContain(pct(RIGGED_P));
      expect(s).toContain(String(SHIFT_AT));
    }
    expect(HIDDEN_ODDS.fair + HIDDEN_ODDS.rigged + HIDDEN_ODDS.shift).toBeCloseTo(1, 12);
  });

  it('the false-alarm grid runs what its button says, and “at most 5” is 100 × 1/20', () => {
    expect([TABLES, ROUNDS]).toEqual([100, 1000]);
    expect(zh(29)).toBe(`跑 ${TABLES} 张公平的桌子，各 ${ROUNDS} 局`);
    expect(en(29)).toBe(`Run ${TABLES} fair tables, ${ROUNDS.toLocaleString('en-US')} rounds each`);
    expect(TABLES / E_THRESHOLD).toBe(5);
    expect(zh(33)).toContain('不超过 5');
    expect(en(33)).toContain('at most 5');
  });

  it('“nearly 3,000 rounds” for 45% is the simulated median rounded up, not past it', () => {
    const median45 = numbers.detector.rigged_median_alarm.value['45'].median;
    expect(median45).toBeGreaterThanOrEqual(2800);
    expect(median45).toBeLessThan(3000);
    expect(zh(49)).toContain('将近 3000 局');
    expect(en(49)).toContain('nearly 3,000 rounds');
  });

  it('formats the big readout like the design', () => {
    expect(statText(1)).toBe('1.00');
    expect(statText(0)).toBe('0');
    expect(statText(0.004)).toBe('< 0.01');
    expect(statText(19.987)).toBe('20.0');
    expect(statText(1234.6)).toBe('1,235');
  });
});
