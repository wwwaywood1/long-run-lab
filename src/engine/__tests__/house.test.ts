import { describe, it, expect } from 'vitest';
import numbers from '../../../data/numbers.json';
import { HOUSE_GAMES, HOUSE_GAME_IDS, HOUSE_BETS, HOUSE_ASSUMPTIONS, houseNight, normalSurvival } from '../house';
import { REELS, STOPS, payout } from '../slots';
import { baccaratNet, BACCARAT_PROB } from '../baccarat';

describe('house calculator independent-round model', () => {
  it('enumerates slot net moments including jackpots and disguised losses', () => {
    let sum = 0, squared = 0;
    for (let i = 0; i < STOPS; i++) for (let j = 0; j < STOPS; j++) for (let k = 0; k < STOPS; k++) {
      const net = 1 - payout(REELS[0][i], REELS[1][j], REELS[2][k]);
      sum += net; squared += net * net;
    }
    const mean = sum / STOPS ** 3;
    expect(mean).toBeCloseTo(HOUSE_GAMES.slots.edge, 14);
    expect(squared / STOPS ** 3 - mean ** 2).toBeCloseTo(HOUSE_GAMES.slots.variance, 12);
  });
  it('includes Banker pushes and 5% commission in variance', () => {
    let mean = 0, second = 0;
    for (const side of ['B', 'P', 'T'] as const) {
      const net = -baccaratNet(side, 'B');
      mean += BACCARAT_PROB[side] * net;
      second += BACCARAT_PROB[side] * net ** 2;
    }
    // Independently rounded published constants differ by 0.00000085.
    expect(Math.abs(mean - HOUSE_GAMES.baccarat.edge)).toBeLessThan(1e-6);
    expect(HOUSE_GAMES.baccarat.variance).toBeCloseTo(second - mean ** 2, 14);
    expect(houseNight('baccarat', 100).lossProbability * 100).toBeCloseTo(0.34721, 4);
  });
  it('matches independently generated Python erfc tails for every game and bet', () => {
    for (const game of HOUSE_GAME_IDS) for (const bet of HOUSE_BETS) {
      const result = houseNight(game, bet);
      const reference = numbers.casino.house_loss_probability.value[game];
      expect(Math.abs(result.lossProbability / reference - 1)).toBeLessThan(2e-7);
      expect(result.rounds).toBe(HOUSE_ASSUMPTIONS.rounds_per_hour[game] * 800);
      expect(result.expected).toBeCloseTo(result.rounds * HOUSE_GAMES[game].edge * bet, 8);
      expect(result.perGuest * 100).toBeCloseTo(result.expected, 8);
      expect(result.standardDeviation ** 2).toBeCloseTo(result.rounds * HOUSE_GAMES[game].variance * bet ** 2, 2);
      expect(result.lossProbability).toBe(houseNight(game, 10).lossProbability);
    }
  });
  it('default amounts and scaling', () => {
    expect(houseNight('baccarat', 100).expected).toBeCloseTo(59242.4);
    expect(houseNight('baccarat', 100).perGuest).toBeCloseTo(592.424);
    for (const game of HOUSE_GAME_IDS) expect(houseNight(game, 1000).expected / houseNight(game, 10).expected).toBeCloseTo(100);
  });
  it('normal tails stay positive far below display threshold', () => {
    expect(normalSurvival(0)).toBe(0.5);
    expect(normalSurvival(1.96)).toBeCloseTo(0.024997895, 8);
    expect(Math.abs(normalSurvival(6) / 9.86587645e-10 - 1)).toBeLessThan(1.2e-7);
    expect(normalSurvival(12)).toBeGreaterThan(0);
    expect(normalSurvival(-1.96)).toBeCloseTo(1 - normalSurvival(1.96), 14);
    expect(normalSurvival(Infinity)).toBe(0);
    expect(normalSurvival(-Infinity)).toBe(1);
    expect(() => normalSurvival(NaN)).toThrow();
  });
  it('rejects invalid amounts and unknown games', () => {
    for (const bet of [0, -1, NaN, Infinity]) expect(() => houseNight('roulette', bet)).toThrow();
    expect(() => houseNight('unknown' as never, 100)).toThrow();
  });
});
