import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import { CHIPS, gamblersRuin, ruin, snapToBet } from '../ruin';

/** 逐状态求解 v(x) = p·v(x+1) + q·v(x−1)，用来独立核对公式 */
function bruteForce(i: number, n: number, p: number) {
  const v = new Array(n + 1).fill(0);
  const e = new Array(n + 1).fill(0);
  v[n] = 1;
  for (let sweep = 0; sweep < 200000; sweep++) {
    let delta = 0;
    for (let x = 1; x < n; x++) {
      const nv = p * v[x + 1] + (1 - p) * v[x - 1];
      const ne = 1 + p * e[x + 1] + (1 - p) * e[x - 1];
      delta = Math.max(delta, Math.abs(nv - v[x]), Math.abs(ne - e[x]) / Math.max(1, ne));
      v[x] = nv;
      e[x] = ne;
    }
    if (delta < 1e-14) break;
  }
  return { pWin: v[i], expectedRounds: e[i] };
}

describe('gambler’s ruin', () => {
  it('matches a state-by-state solve for p < 1/2, p = 1/2 and p > 1/2', () => {
    for (const p of [18 / 38, 0.3, 0.5, 0.6]) {
      for (const [i, n] of [[1, 2], [3, 10], [7, 12], [10, 20]]) {
        const exact = gamblersRuin(i, n, p);
        const brute = bruteForce(i, n, p);
        expect(exact.pWin).toBeCloseTo(brute.pWin, 10);
        expect(exact.expectedRounds).toBeCloseTo(brute.expectedRounds, 6);
      }
    }
  });

  it('reproduces the chapter 3 numbers in data/numbers.json', () => {
    const r = ruin(100, 200, 1);
    expect(r.pWin / numbers.roulette.ruin_100_to_200.value).toBeCloseTo(1, 12);
    expect(r.expectedRounds).toBeCloseTo(numbers.roulette.ruin_expected_duration.value, 8);
    expect(1 / r.pWin).toBeCloseTo(numbers.roulette.ruin_one_in.value, 6);
  });

  it('bold play (one bet of everything) is just the chance of one win', () => {
    expect(ruin(100, 200, 100).pWin).toBeCloseTo(18 / 38, 14);
  });

  it('stays finite and positive for long walks', () => {
    const r = ruin(10, 2000, 1);
    expect(r.pWin).toBeGreaterThan(0);
    expect(r.pWin).toBeLessThan(1e-80);
    expect(Number.isFinite(r.expectedRounds)).toBe(true);
  });

  it('bigger bets help but never reach a fair 50%', () => {
    const chances = CHIPS.map(b => ruin(100, 200, b).pWin);
    for (let k = 1; k < chances.length; k++) expect(chances[k]).toBeGreaterThan(chances[k - 1]);
    expect(Math.max(...chances)).toBeLessThan(0.5);
  });

  it('refuses amounts that are not multiples of the bet', () => {
    expect(() => ruin(110, 200, 25)).toThrow();
  });

  it('snaps amounts to the bet grid inside the slider range', () => {
    expect(snapToBet(110, 25, 10, 1000)).toBe(100);
    expect(snapToBet(5, 25, 10, 1000)).toBe(25);
    expect(snapToBet(1990, 100, 20, 2000)).toBe(2000);
    for (const b of CHIPS) {
      expect(1000 % b).toBe(0);
      expect(2000 % b).toBe(0);
    }
  });
});
