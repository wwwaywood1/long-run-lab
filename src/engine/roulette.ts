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
