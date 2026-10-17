import { type Rng, randInt } from './rng';

/** 美式轮盘的 38 个格子，按轮盘上的实际顺序排列 */
export const WHEEL_ORDER = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
  '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2',
] as const;

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const POCKETS = 38;
/** 押红：18 格赢，20 格输（含 0 和 00） */
export const P_WIN_RED = 18 / 38;
/** 押红的庄家优势 = 2/38 ≈ 5.26% */
export const EDGE_RED = 2 / 38;

export type PocketKind = 'win' | 'lose' | 'house';

/** 按“押红”视角给每个格子分类：赢、输、或 0/00（庄家） */
export function pocketKind(index: number): PocketKind {
  const label = WHEEL_ORDER[index];
  if (label === '0' || label === '00') return 'house';
  return RED_NUMBERS.has(Number(label)) ? 'win' : 'lose';
}

export interface Spin {
  index: number;
  label: string;
  win: boolean;
}

export function spinRed(rng: Rng): Spin {
  const index = randInt(rng, POCKETS);
  return { index, label: WHEEL_ORDER[index], win: pocketKind(index) === 'win' };
}

/** 每分钟平均亏损 = 桌数 × 每注 × 每小时局数 × 优势 / 60 */
export function expectedLossPerMinute(tables: number, bet: number, spinsPerHour: number, edge = EDGE_RED): number {
  return (tables * bet * spinsPerHour * edge) / 60;
}

export interface RouletteRound {
  indices: number[]; delta: number; expectedDelta: number; bets: number;
  wins: number; losses: number; label: string;
}
export function settleRed(indices: number[], bet: number): RouletteRound {
  const wins = indices.filter(index => pocketKind(index) === 'win').length;
  return { indices, delta: (wins * 2 - indices.length) * bet,
    expectedDelta: -bet * indices.length * EDGE_RED, bets: indices.length,
    wins, losses: indices.length - wins, label: indices.length === 1 ? WHEEL_ORDER[indices[0]] : '' };
}
export function redLossRates(tables: number, bet: number, spinsPerHour: number) {
  const perMinute = expectedLossPerMinute(tables, bet, spinsPerHour);
  return { perMinute, perHour: perMinute * 60, perNight: perMinute * 480 };
}

/* ───────── 押法拆解（第二部分 · 换押法，不换税率；WIDGETS W5） ───────── */

export type BetKey = 'straight' | 'split' | 'street' | 'corner' | 'five' | 'line' | 'dozen' | 'red';

/** 美式轮盘的八种押法：覆盖格数 covers，实际赔率 pays（押 1 赢 pays，另退本金） */
export const ROULETTE_BETS: readonly { key: BetKey; covers: number; pays: number }[] = [
  { key: 'straight', covers: 1, pays: 35 }, // 单号
  { key: 'split', covers: 2, pays: 17 },    // 两号
  { key: 'street', covers: 3, pays: 11 },   // 三号
  { key: 'corner', covers: 4, pays: 8 },    // 四号
  { key: 'five', covers: 5, pays: 6 },      // 五号注：0、00、1、2、3
  { key: 'line', covers: 6, pays: 5 },      // 六号
  { key: 'dozen', covers: 12, pays: 2 },    // 一打
  { key: 'red', covers: 18, pays: 1 },      // 红 / 黑
];

export interface PayoutBreakdown {
  key: BetKey;
  covers: number;
  /** 实际赔率（赔几倍） */
  pays: number;
  /** 公平赔率 = 38 / covers − 1：按这个赔，长期刚好不输不赢 */
  fair: number;
  /** 庄家少付的倍数 = fair − pays */
  shortfall: number;
  /** 实际赔率占公平赔率的比例（赔率条蓝色那一截的宽度） */
  paidShare: number;
  /** 庄家优势 = 1 − (covers / 38) · (pays + 1) = shortfall · covers / 38 */
  edge: number;
}

export function payoutBreakdown(key: BetKey): PayoutBreakdown {
  const bet = ROULETTE_BETS.find(b => b.key === key);
  if (!bet) throw new Error(`unknown bet ${key}`);
  const fair = POCKETS / bet.covers - 1;
  return {
    key, covers: bet.covers, pays: bet.pays, fair,
    shortfall: fair - bet.pays,
    paidShare: bet.pays / fair,
    edge: 1 - (bet.covers / POCKETS) * (bet.pays + 1),
  };
}
