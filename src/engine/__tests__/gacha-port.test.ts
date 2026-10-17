import { describe, expect, it } from 'vitest';
import {
  COST_BANDS, drawGacha, exactDistributions, FIVE_STAR_PITY, GACHA_PLAYERS, gachaCostBand,
  gachaPlayerView, MAX_FEATURED_PULLS, newPlayer, p5, PRICE_PER_PULL, pull, simulateGachaGroup, TEN_PULL,
} from '../gacha';
import { mulberry32 } from '../rng';
import numbers from '../../../data/numbers.json';

describe('G8 抽卡移植接口', () => {
  it('单抽保留原规则且不改输入，帧和最终玩家独立', () => {
    const before = newPlayer(), run = drawGacha(before, 1, () => 0);
    expect(before).toEqual(newPlayer());
    expect(run.count).toBe(1); expect(run.cost).toBe(PRICE_PER_PULL);
    expect(run.frames[0].kind).toBe('F'); expect(run.player.featured).toBe(1);
    run.frames[0].player.pulls = 999;
    expect(run.player.pulls).toBe(1); expect(run.beforeDisplay.pulls).toBe(0);
  });
  it('同随机流十连等同十次原始抽取，并保留逐张快照', () => {
    const rng1 = mulberry32(821), rng2 = mulberry32(821), player = newPlayer();
    const run = drawGacha(player, 10, rng1), expected = [];
    for (let i = 0; i < 10; i++) expected.push(pull(player, rng2));
    expect(run.frames.map(f => f.kind)).toEqual(expected);
    expect(run.player).toEqual(player); expect(run.count).toBe(10); expect(run.cost).toBe(160);
    expect(run.frames.map(f => f.player.pulls)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('一直抽会停在下一张限定，已有的限定不造成提前结束', () => {
    const player = { ...newPlayer(), featured: 3, pulls: 20 };
    const run = drawGacha(player, 'until', () => 0);
    expect(run.count).toBe(1); expect(run.player.featured).toBe(4); expect(run.player.pulls).toBe(21);
    expect(run.cost).toBe(16); expect(run.banner).toBe('until');
  });
  it('最坏 180 抽并只显示最后十张，前置进度不漏记', () => {
    const run = drawGacha(newPlayer(), 'until', () => .999999);
    expect(run.count).toBe(MAX_FEATURED_PULLS); expect(run.cost).toBe(2880);
    expect(run.player.off).toBe(1); expect(run.player.featured).toBe(1);
    expect(run.frames).toHaveLength(TEN_PULL); expect(run.beforeDisplay.pulls).toBe(170);
    expect(run.frames[0].player.pulls).toBe(171); expect(run.frames.at(-1)?.kind).toBe('F');
    expect(run.player.guaranteed).toBe(false);
  });
  it('大保底继承到下一次操作，五星会重置四星和五星垫抽', () => {
    const values = [0, .9];
    const off = drawGacha(newPlayer(), 1, () => values.shift()!);
    expect(off.banner).toBe('off'); expect(off.player.guaranteed).toBe(true);
    const guaranteed = drawGacha({ ...off.player, since5: 89, since4: 9 }, 1, () => .999999);
    expect(guaranteed.frames[0].kind).toBe('F');
    expect(guaranteed.player).toMatchObject({ since5: 0, since4: 0, guaranteed: false, off: 1, featured: 1 });
  });
  it('十抽至少一个四星或以上，保底不多消耗随机数', () => {
    let calls = 0;
    const run = drawGacha(newPlayer(), 10, () => { calls++; return .99; });
    expect(run.frames.map(f => f.kind)).toEqual([...Array(9).fill('3'), '4']);
    expect(run.player.fours).toBe(1); expect(run.player.since4).toBe(0);
    expect(calls).toBe(19);
    const fiveStars = drawGacha(newPlayer(), 10, () => 0);
    expect(fiveStars.frames.every(frame => frame.kind === 'F')).toBe(true);
    expect(fiveStars.player.fours).toBe(0); // "四星或以上"，不是必须另出一张四星。
  });
  it('同时出现限定和歪时横幅按原稿优先显示限定', () => {
    const values = [0, 0, 0, .9];
    const run = drawGacha(newPlayer(), 10, () => values.shift() ?? .99);
    expect(run.frames.slice(0, 2).map(f => f.kind)).toEqual(['F', 'O']);
    expect(run.banner).toBe('featured'); expect(run.player.guaranteed).toBe(true);
  });
  it('保底和支出视图不把四星或限定折成现金返还', () => {
    const view = gachaPlayerView({ ...newPlayer(), pulls: 76, since5: 76, featured: 1, fours: 7 });
    expect(view).toMatchObject({ spent: 1216, net: -1216, remaining: 14, softPity: true, guaranteed: false });
    expect(view.pityPercent).toBeCloseTo(76 / 90 * 100);
    expect(gachaPlayerView({ ...newPlayer(), since5: 73 }).softPity).toBe(false);
    expect(gachaPlayerView(newPlayer()).remaining).toBe(FIVE_STAR_PITY);
  });
  it.each([0, 16, 992, 1000, 1008, 2000, 2001, 2880])('成本 %s 分档按原稿严格大于阈值', cost => {
    expect(gachaCostBand(cost)).toBe(cost > 2000 ? 'high' : cost > 1000 ? 'middle' : 'low');
  });
  it.each([10, 100] as const)('%s 人独立从零抽到第一张限定，全部高成本统计正确', count => {
    const group = simulateGachaGroup(count, () => .999999);
    expect(group.players).toHaveLength(count); expect(group.average).toBe(2880);
    expect(group.min).toBe(2880); expect(group.max).toBe(2880); expect(group.over2k).toBe(count);
    for (const entry of group.players) expect(entry).toMatchObject({ cost: 2880, width: 100, band: 'high', player: { featured: 1, off: 1, pulls: 180 } });
  });
  it('低成本组和混合组不共享玩家或积累上批结果', () => {
    const low = simulateGachaGroup(10, () => 0), mixed = simulateGachaGroup(100, mulberry32(834));
    expect(low).toMatchObject({ average: 16, min: 16, max: 16, over2k: 0 });
    low.players[0].player.pulls = 42; expect(low.players[1].player.pulls).toBe(1);
    expect(mixed.average).toBe(mixed.players.reduce((s, entry) => s + entry.cost, 0) / 100);
    expect(mixed.over2k).toBe(mixed.players.filter(entry => entry.cost > COST_BANDS[1]).length);
    expect(mixed.players.every(entry => entry.player.featured === 1)).toBe(true);
    expect(new Set(mixed.players.map(entry => entry.band)).size).toBe(3);
  });
  it('研究数据、展示成本和所有既有概率相互一致', () => {
    const data = numbers.gacha, d = exactDistributions(), p = data.presentation.value;
    expect(d.mean5).toBeCloseTo(data.mean_pulls_per_5star.value, 12);
    expect(d.meanFeatured).toBeCloseTo(data.mean_pulls_featured.value, 12);
    expect(data.mean_cost_featured_yuan.value).toBeCloseTo(d.meanFeatured * PRICE_PER_PULL, 10);
    expect(p.price_per_pull_yuan).toBe(PRICE_PER_PULL);
    expect(p.median_cost_featured_yuan).toBe(data.median_pulls_featured.value * PRICE_PER_PULL);
    expect(p.p90_cost_featured_yuan).toBe(data.p90_pulls_featured.value * PRICE_PER_PULL);
    expect(p.max_cost_featured_yuan).toBe(MAX_FEATURED_PULLS * PRICE_PER_PULL);
    expect(p.pity_example).toEqual({ banked: 76, remaining: 14, spent_yuan: 1216, remaining_cost_yuan: 224, progress: 76 / 90 });
    expect(p.cash_payout_rate).toBe(0); expect(p5(73)).toBe(.006); expect(p5(74)).toBe(.066); expect(p5(90)).toBe(1);
    expect(GACHA_PLAYERS).toEqual([1, 10, 100]);
    for (const [range, value] of Object.entries(data.histogram_featured_20.value)) {
      const [a, b] = range.split('-').map(Number);
      expect(d.featured.slice(a, b + 1).reduce((sum, p) => sum + p, 0)).toBeCloseTo(value, 12);
    }
  });
});
