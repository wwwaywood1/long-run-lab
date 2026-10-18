/**
 * 第 4 章“选一种下注方法”（WIDGETS W4）。四种常见的下注方法都押美式轮盘的红色：
 * - flat     平注：每局 10 元，押 100 局。
 * - double   倍投：每轮从 10 元押起，输了加倍、赢了收手，一轮净赚 10 元；连输 7 次（10 + 20 + … + 640 = 1,270）
 *            就撞上限红 640 元，这一轮亏掉 1,270 元。最多玩 100 轮；手里的钱不够倍投一整轮就停。
 * - stops    止盈止损：每局 10 元，赢到 +100 元或输到 −300 元就收手（最多 2,000 局）。
 * - pattern  看路：连开 3 次同色（红或黑）之后押另一种颜色 10 元，其他时候不押；看 200 局。
 *
 * 不管用哪一种，每一注本身都是“押 1 元平均亏 2/38 元”。停手规则只改变输赢的形状，不改变这个比例：
 * 期望盈亏 = −(2/38) × 期望总下注（Wald 等式；每种方法的局数都有上限）。测试用大样本验证这一点。
 */
import { type Rng } from './rng';

export const MG = { base: 10, limit: 640, bankroll: 1270, steps: 7, rounds: 100, spins: 100, patternSpins: 200, streak: 3, stopWin: 100, stopLoss: 300, maxStopSpins: 2000 } as const;
export const P_RED = 18 / 38;
export const P_GREEN = 2 / 38;
export const EDGE = 2 / 38;

export type Strategy = 'flat' | 'double' | 'stops' | 'pattern';
export const STRATEGIES: readonly Strategy[] = ['flat', 'double', 'stops', 'pattern'];

type Color = 'red' | 'black' | 'green';
const spin = (rng: Rng): Color => {
  const u = rng();
  return u < P_RED ? 'red' : u < 2 * P_RED ? 'black' : 'green';
};

export interface Session {
  strategy: Strategy;
  /** 横轴单位：倍投按“轮”（一轮 = 直到赢一次或连输 7 次），其他按“局”（转一次轮盘） */
  unit: 'round' | 'spin';
  /** 每一步结束时手里的钱，path[0] = 本金 1,270 */
  path: number[];
  /** 一共押了多少钱（每一注的金额之和） */
  wagered: number;
  /** 下了几注 */
  bets: number;
  /** 最终盈亏 = 最后手里的钱 − 本金 */
  net: number;
}

function finish(strategy: Strategy, unit: Session['unit'], path: number[], wagered: number, bets: number): Session {
  return { strategy, unit, path, wagered, bets, net: path[path.length - 1] - MG.bankroll };
}

/** 一轮倍投：返回这一轮的盈亏、押了多少钱、几注。连输 7 次后第 8 注 1,280 超过限红，这一轮结束。 */
export function doublingRound(rng: Rng) {
  let bet = MG.base;
  let wagered = 0;
  let lost = 0;
  for (let k = 0; k < MG.steps; k++) {
    wagered += bet;
    if (spin(rng) === 'red') return { delta: bet - lost, wagered, bets: k + 1, bust: false };
    lost += bet;
    bet *= 2;
  }
  return { delta: -lost, wagered, bets: MG.steps, bust: true };
}

/** 一轮倍投需要的本金：10 + 20 + … + 640 = 1,270 */
export const LADDER = Array.from({ length: MG.steps }, (_, k) => MG.base * 2 ** k).reduce((a, b) => a + b, 0);

export function simulate(strategy: Strategy, rng: Rng): Session {
  let money: number = MG.bankroll;
  const path: number[] = [money];
  let wagered = 0;
  let bets = 0;

  if (strategy === 'double') {
    for (let r = 0; r < MG.rounds && money >= LADDER; r++) {
      const round = doublingRound(rng);
      money += round.delta;
      wagered += round.wagered;
      bets += round.bets;
      path.push(money);
    }
    return finish(strategy, 'round', path, wagered, bets);
  }

  if (strategy === 'flat') {
    for (let s = 0; s < MG.spins; s++) {
      money += spin(rng) === 'red' ? MG.base : -MG.base;
      wagered += MG.base;
      bets++;
      path.push(money);
    }
    return finish(strategy, 'spin', path, wagered, bets);
  }

  if (strategy === 'stops') {
    for (let s = 0; s < MG.maxStopSpins; s++) {
      const net = money - MG.bankroll;
      if (net >= MG.stopWin || net <= -MG.stopLoss) break;
      money += spin(rng) === 'red' ? MG.base : -MG.base;
      wagered += MG.base;
      bets++;
      path.push(money);
    }
    return finish(strategy, 'spin', path, wagered, bets);
  }

  // pattern：连开 3 次同色（不含 0 / 00）后押另一种颜色
  let last: Color | null = null;
  let run = 0;
  for (let s = 0; s < MG.patternSpins; s++) {
    const target: Color | null = run >= MG.streak && last !== 'green' && last !== null ? (last === 'red' ? 'black' : 'red') : null;
    const c = spin(rng);
    if (target) {
      money += c === target ? MG.base : -MG.base;
      wagered += MG.base;
      bets++;
    }
    run = c === last ? run + 1 : 1;
    last = c;
    path.push(money);
  }
  return finish(strategy, 'spin', path, wagered, bets);
}

/**
 * 设计稿的默认画面：倍投连赢 82 轮（每轮 +10），第 83 轮连输 7 次（−1,270）。
 * 这是讲故事用的一个例子，不是随机抽出来的；第一次连输 7 次平均出现在第 1/0.0112 ≈ 89 轮，83 轮很典型。
 */
export const STORY = { wins: 82 } as const;
export function storySession(): Session {
  const path: number[] = [MG.bankroll];
  for (let r = 1; r <= STORY.wins; r++) path.push(MG.bankroll + r * MG.base);
  path.push(path[path.length - 1] - LADDER);
  return finish('double', 'round', path, STORY.wins * MG.base + LADDER, STORY.wins + MG.steps);
}

export interface Summary {
  n: number;
  /** 最后赚钱（net > 0）的比例 */
  ahead: number;
  meanNet: number;
  meanWagered: number;
  /** 每押 1 元平均亏多少 = −Σnet / Σwagered；理论值 2/38 */
  lossPerUnit: number;
}

export function summarize(strategy: Strategy, n: number, rng: Rng): Summary {
  let ahead = 0;
  let net = 0;
  let wagered = 0;
  for (let i = 0; i < n; i++) {
    const s = simulate(strategy, rng);
    if (s.net > 0) ahead++;
    net += s.net;
    wagered += s.wagered;
  }
  return { n, ahead: ahead / n, meanNet: net / n, meanWagered: wagered / n, lossPerUnit: -net / wagered };
}

/** 一轮倍投里连输 7 次的概率 (20/38)^7 */
export const BUST = (1 - P_RED) ** MG.steps;
/** 每轮平均盈亏 = 10 × (1 − b) − 1,270 × b */
export const EV_PER_ROUND = MG.base * (1 - BUST) - LADDER * BUST;
/** 玩 100 轮，至少撞上一次连输 7 次的概率 */
export const BUST_IN_ROUNDS = (rounds: number) => 1 - (1 - BUST) ** rounds;
