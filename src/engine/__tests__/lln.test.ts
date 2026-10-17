import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import { binomialMass, binomialQuantile, exactBand, simulatePaths, runPopulation, LLN_ROUNDS, LLN_DEFAULT_SEED, peopleShares } from '../lln';
import { mulberry32 } from '../rng';
import { EDGE_RED, P_WIN_RED } from '../roulette';

describe('LLN exact engine', () => {
  it('matches an independent Bernoulli convolution, including ties', () => {
    let dp = [1];
    for (let n = 0; n <= 20; n++) {
      const actual = binomialMass(n);
      dp.forEach((v, k) => expect(actual[k]).toBeCloseTo(v, 13));
      const next = Array(n + 2).fill(0);
      dp.forEach((v, k) => { next[k] += v * (1 - P_WIN_RED); next[k + 1] += v * P_WIN_RED; });
      dp = next;
    }
  });
  for (const n of LLN_ROUNDS) {
    it(`matches SciPy quantiles, tails and moments at ${n} spins`, () => {
      const mass = binomialMass(n), band = exactBand(n);
      expect([band.low, band.high]).toEqual(numbers.roulette.lln_pointwise_band.value[String(n) as '10']);
      expect(mass.reduce((a,b) => a+b,0)).toBeCloseTo(1, 12);
      const mean = mass.reduce((a,v,k) => a+v*(2*k-n),0);
      expect(mean).toBeCloseTo(-EDGE_RED*n, 9);
      const variance = mass.reduce((a,v,k) => a+v*(2*k-n-mean)**2,0);
      expect(variance).toBeCloseTo(4*n*P_WIN_RED*(1-P_WIN_RED), 7);
      const tail = mass.slice(Math.floor(n/2)+1).reduce((a,b)=>a+b,0);
      const reference = numbers.roulette.p_ahead_after_n.value[String(n) as '10'];
      expect(tail/reference).toBeCloseTo(1, 11);
      for (const q of [0.05,0.95]) {
        const k = binomialQuantile(mass,q);
        expect(mass.slice(0,k).reduce((a,b)=>a+b,0)).toBeLessThan(q);
        expect(mass.slice(0,k+1).reduce((a,b)=>a+b,0)).toBeGreaterThanOrEqual(q);
      }
      const result = runPopulation(n,mulberry32(987));
      expect(result.ahead+result.tied+result.lost).toBe(10000);
      expect(Math.abs(result.ahead - 10000*reference)).toBeLessThan(6*Math.sqrt(10000*reference*(1-reference))+1);
      expect(result).toEqual(runPopulation(n,mulberry32(987)));
      const sim=simulatePaths(n,LLN_DEFAULT_SEED);
      expect(sim.paths).toHaveLength(13);
      expect(sim).toEqual(simulatePaths(n,LLN_DEFAULT_SEED));
      for(const path of sim.paths) {
        expect(path[0]).toBe(0);
        path.forEach((v,i)=>{ expect(Math.abs(v)).toBeLessThanOrEqual(sim.band[i].round); expect((v+sim.band[i].round)%2).toBe(0); });
      }
    });
  }
  it('preserves the −66 default, resamples, and excludes ties from ahead', () => {
    expect(simulatePaths(1000,LLN_DEFAULT_SEED).you).toBe(-66);
    expect(simulatePaths(1000,LLN_DEFAULT_SEED+1).paths).not.toEqual(simulatePaths(1000,LLN_DEFAULT_SEED).paths);
    const mass=binomialMass(10);
    const middle=mass.slice(0,5).reduce((a,b)=>a+b,0)+mass[5]/2;
    expect(runPopulation(10,()=>middle)).toMatchObject({ahead:0,tied:10000,lost:0});
    expect(runPopulation(10,()=>0)).toMatchObject({ahead:0,lost:10000});
    expect(runPopulation(10,()=>1-Number.EPSILON)).toMatchObject({ahead:10000,lost:0});
    expect(peopleShares().reduce((a,b)=>a+b,0)).toBe(4.5);
  });
  it('handles degenerate distributions and rejects invalid input', () => {
    expect(exactBand(0)).toEqual({low:0,high:0,expected:-0});
    expect(binomialMass(3,0)).toEqual([1,0,0,0]);
    expect(binomialMass(3,1)).toEqual([0,0,0,1]);
    for(const n of [-1,1.5,10001,NaN]) expect(()=>binomialMass(n)).toThrow();
    expect(()=>simulatePaths(11,1)).toThrow();
  });
});
