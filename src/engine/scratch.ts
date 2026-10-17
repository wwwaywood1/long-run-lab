import { type Rng, randInt } from './rng';

/** 本项目设计的 10 元示例刮刮乐，按即开型彩票 65% 返奖率精确配平 */
export const PRICE = 10;
export const AMOUNTS = [10, 20, 50, 100, 500, 1000, 10_000, 100_000, 1_000_000] as const;
/** 每 100 万张中各奖级张数 */
export const PER_MILLION = [170_000, 92_500, 25_000, 8000, 600, 200, 10, 1, 0.2] as const;
export const OFFICIAL_SPLIT = { prizes: 0.65, welfare: 0.2, operations: 0.15 };

export function drawAmount(rng: Rng): number {
  let u = rng() * 1_000_000;
  for (let i = 0; i < AMOUNTS.length; i++) {
    if (u < PER_MILLION[i]) return AMOUNTS[i];
    u -= PER_MILLION[i];
  }
  return 0;
}

export function exactStats() {
  let paid = 0, wins = 0;
  for (let i = 0; i < AMOUNTS.length; i++) { paid += AMOUNTS[i] * PER_MILLION[i]; wins += PER_MILLION[i]; }
  return {
    rtp: paid / (PRICE * 1_000_000),
    winRate: wins / 1_000_000,
    breakEvenShareOfWins: PER_MILLION[0] / wins,
  };
}

const DECOYS = ['10元', '20元', '50元', '100元', '1000元', '10万', '100万', '100万', '10万', '1000元'];

export const amountLabel = (a: number) => (a >= 10_000 ? `${a / 10_000}万` : `${a}元`);

export interface ScratchTicket { winning: [number, number]; mine: { n: number; prize: string; hit: boolean }[]; amount: number }

/** 生成一张票面与结果一致的票：中奖时恰有一个号码与中奖号码相同 */
export function makeTicket(rng: Rng): ScratchTicket {
  const amount = drawAmount(rng);
  const pool = Array.from({ length: 30 }, (_, i) => i + 1);
  for (let j = 0; j < 8; j++) {
    const k = j + randInt(rng, 30 - j);
    [pool[j], pool[k]] = [pool[k], pool[j]];
  }
  const winning: [number, number] = [pool[0], pool[1]];
  const mine = Array.from({ length: 6 }, (_, m) => ({ n: pool[2 + m], prize: DECOYS[randInt(rng, DECOYS.length)], hit: false }));
  if (amount > 0) mine[randInt(rng, 6)] = { n: winning[randInt(rng, 2)], prize: amountLabel(amount), hit: true };
  return { winning, mine, amount };
}
