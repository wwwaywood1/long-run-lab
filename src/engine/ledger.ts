/**
 * 同一笔钱的两种算法（第四部分 · 真实世界的账本；WIDGETS W7）。
 * 玩家把现金换成筹码，筹码在桌上被反复押注。监管报告里的“赢率”是 庄家赢走 ÷ 换成筹码的现金，
 * 庄家优势是 庄家赢走 ÷ 总下注额。筹码平均被押 n 次，两者就差 n 倍。
 */
export interface TurnoverLedger {
  /** 换成筹码的现金 */
  cash: number;
  /** 每个筹码平均被押几次 */
  timesBet: number;
  /** 总下注额 = 现金 × 次数 */
  totalBet: number;
  /** 庄家赢走 = 总下注额 × 庄家优势（期望值） */
  houseWin: number;
  /** 庄家优势（分母是总下注额） */
  edge: number;
  /** 报告里的“赢率”（分母是现金）= 优势 × 次数 */
  holdOnCash: number;
}

export function turnoverLedger(cash: number, timesBet: number, edge: number): TurnoverLedger {
  if (!(cash > 0) || !(timesBet > 0)) throw new Error('cash and timesBet must be positive');
  const totalBet = cash * timesBet;
  const houseWin = totalBet * edge;
  return { cash, timesBet, totalBet, houseWin, edge, holdOnCash: houseWin / cash };
}
