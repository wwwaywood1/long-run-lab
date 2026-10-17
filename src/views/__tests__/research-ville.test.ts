import { describe, expect, it } from 'vitest';
import { gamblersRuin } from '../../engine/ruin';
import page from '../ResearchVille.astro?raw';

/**
 * 研究层 · Ville 页的表格和图是照设计稿写死的数字。
 * 这里用引擎独立重算，确保页面上的每个数都对得上。
 */
const P_RED = 18 / 38;
const BANKROLL = 100; // 平注：本金 100 单位，每局押 1 单位红（Research-Ville.027）

/**
 * 平注到达 k 倍本金的概率取 log10。
 * P = (rⁱ − 1)/(rⁿ − 1) = r^(i−n) · (1 − r^−i)/(1 − r^−n)，r = q/p。
 * k = 64 时 P ≈ 5e−289，直接算接近 double 下限，所以用对数。
 */
const flatLog10 = (k: number) => {
  const r = (1 - P_RED) / P_RED;
  const i = BANKROLL;
  const n = BANKROLL * k;
  return (i - n) * Math.log10(r) + Math.log10(1 - r ** -i) - Math.log10(1 - r ** -n);
};

/** 页面写法：一位小数的尾数 + e + 真正的减号，例如 1.9e−14 */
const sciFromLog10 = (l: number) => {
  let e = Math.floor(l);
  let m = 10 ** (l - e);
  if (Number(m.toFixed(1)) >= 10) { m /= 10; e += 1; }
  return `${m.toFixed(1)}e${e < 0 ? '−' : ''}${Math.abs(e)}`;
};

describe('Research-Ville numbers', () => {
  it('table rows match the Ville bound, all-in and flat betting', () => {
    for (const k of [2, 4, 16, 64]) {
      const bound = (1 / k).toFixed(3);
      const allIn = (P_RED ** Math.log2(k)).toFixed(3);
      const flat = sciFromLog10(flatLog10(k));
      expect(page).toContain(`<tr><th scope="row">${k}</th><td>${bound}</td><td>${allIn}</td><td>${flat}</td></tr>`);
    }
  });

  it('the log-space formula agrees with the engine where the engine does not underflow', () => {
    for (const k of [2, 4, 16]) {
      const { pWin } = gamblersRuin(BANKROLL, BANKROLL * k, P_RED);
      expect(Math.log10(pWin)).toBeCloseTo(flatLog10(k), 9);
    }
  });

  it('chart points sit at y = 10 + 75 · (−log10 P) on the 1 … 0.01 axis', () => {
    const y = (v: number) => (10 + 75 * -Math.log10(v)).toFixed(1);
    const xs = [40, 92, 144, 196, 248, 300];
    const ks = [2, 4, 8, 16, 32, 64];
    const path = (f: (k: number) => number) => 'M' + ks.map((k, i) => `${xs[i]} ${y(f(k))}`).join(' L');
    expect(page).toContain(`d="${path((k) => 1 / k)}"`);
    expect(page).toContain(`d="${path((k) => P_RED ** Math.log2(k))}"`);
  });

  it('“≤ 1%” for turning 1,000 into 100,000 is Ville with k = 100', () => {
    expect(1_000 / 100_000).toBe(0.01);
  });
});
