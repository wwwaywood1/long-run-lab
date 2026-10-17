import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../rng';
import * as roulette from '../roulette';
import * as sicbo from '../sicbo';
import * as baccarat from '../baccarat';
import * as slots from '../slots';
import * as crash from '../crash';
import * as lottery from '../lottery';
import * as scratch from '../scratch';
import * as sports from '../sports';
import { withinSE } from './helpers';

describe('轮盘', () => {
  it('38 格里恰好 18 格红、2 格庄家', () => {
    const kinds = Array.from({ length: 38 }, (_, i) => roulette.pocketKind(i));
    expect(kinds.filter((k) => k === 'win')).toHaveLength(18);
    expect(kinds.filter((k) => k === 'house')).toHaveLength(2);
    expect(roulette.EDGE_RED).toBeCloseTo(0.0526316, 6);
  });
  it('模拟押红的胜率吻合 18/38', () => {
    const rng = mulberry32(1);
    const n = 200_000;
    let w = 0;
    for (let i = 0; i < n; i++) w += roulette.spinRed(rng).win ? 1 : 0;
    expect(withinSE(w / n, 18 / 38, 0.5, n)).toBe(true);
  });
});

describe('骰宝', () => {
  it('216 种结果：105 大、105 小、6 豹子', () => {
    expect(sicbo.outcomeCounts()).toEqual({ big: 105, small: 105, triple: 6 });
  });
  it('押大与任意豹子的模拟期望吻合精确优势', () => {
    const rng = mulberry32(2);
    const n = 300_000;
    let big = 0, tri = 0;
    for (let i = 0; i < n; i++) { const d = sicbo.rollDice(rng); big += sicbo.sicboNet(d, 'big'); tri += sicbo.sicboNet(d, 'triple'); }
    expect(withinSE(big / n, -sicbo.SICBO_EDGE.big, 1, n)).toBe(true);
    expect(withinSE(tri / n, -sicbo.SICBO_EDGE.triple, 5.1, n)).toBe(true);
  });
});

describe('百家乐', () => {
  it('8 副牌模拟的庄/闲/和频率吻合公认值', () => {
    const shoe = new baccarat.Shoe(mulberry32(3));
    const n = 300_000;
    const c = { B: 0, P: 0, T: 0 };
    for (let i = 0; i < n; i++) c[baccarat.playHand(shoe).win]++;
    for (const k of ['B', 'P', 'T'] as const) {
      const p = baccarat.BACCARAT_PROB[k];
      expect(withinSE(c[k] / n, p, Math.sqrt(p * (1 - p)), n)).toBe(true);
    }
  });
  it('押庄净收益：赢 0.95，和局退回', () => {
    expect(baccarat.baccaratNet('B', 'B')).toBe(0.95);
    expect(baccarat.baccaratNet('T', 'B')).toBe(0);
    expect(baccarat.baccaratNet('T', 'T')).toBe(8);
  });
});

describe('老虎机', () => {
  it('精确返还率 91.78%，42.19% 的拉动是“伪装成赢的输”', () => {
    const s = slots.exactStats();
    expect(s.rtp).toBeCloseTo(slots.SLOTS_RTP, 10);
    expect(s.ldwRate).toBeCloseTo(0.421875, 10);
    expect(s.hitRate).toBeCloseTo(0.587625, 10);
  });
});

describe('爆点', () => {
  it('任意跳车点的期望都是 −3%', () => {
    const rng = mulberry32(4);
    const n = 300_000;
    for (const target of [1.5, 2, 5]) {
      let s = 0, s2 = 0;
      for (let i = 0; i < n; i++) { const x = crash.crashNet(target, crash.crashPoint(rng)); s += x; s2 += x * x; }
      const sd = Math.sqrt(s2 / n - (s / n) ** 2);
      expect(withinSE(s / n, -crash.CRASH_EDGE, sd, n)).toBe(true);
    }
  });
});

describe('双色球', () => {
  it('一等奖概率 1/17,721,088，任意中奖约 1/14.9', () => {
    const p = lottery.tierProbabilities();
    expect(1 / p[1]).toBeCloseTo(17_721_088, 0);
    const any = p.slice(1).reduce((a, b) => a + b, 0);
    expect(1 / any).toBeCloseTo(14.9, 1);
  });
  it('三到六等奖只返还约 24.3%', () => {
    expect(lottery.expectedReturn().fixedOnlyRate).toBeCloseTo(0.2431552, 6);
  });
});

describe('刮刮乐', () => {
  it('示例票精确配平到 65% 返奖率，中奖率 29.6%，57% 的中奖只是拿回本钱', () => {
    const s = scratch.exactStats();
    expect(s.rtp).toBeCloseTo(0.65, 10);
    expect(s.winRate).toBeCloseTo(0.2963112, 6);
    expect(s.breakEvenShareOfWins).toBeCloseTo(0.5737, 3);
  });
  it('票面与结果一致：中奖时恰有一个号码相同', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 20_000; i++) {
      const t = scratch.makeTicket(rng);
      const hits = t.mine.filter((m) => t.winning.includes(m.n)).length;
      expect(hits).toBe(t.amount > 0 ? 1 : 0);
    }
  });
});

describe('足球竞猜', () => {
  it('每场返还约 92%，8 串 1 约 51%', () => {
    const rng = mulberry32(6);
    for (const legs of [1, 8]) {
      let ev = 0;
      const n = 50_000;
      for (let i = 0; i < n; i++) {
        const slip = Array.from({ length: legs }, () => { const m = sports.makeMatch(rng); m.pick = sports.favourite(m); return m; });
        ev += sports.evaluate(slip).ev;
      }
      expect(ev / n).toBeCloseTo(0.92 ** legs, 2);
    }
  });
});
