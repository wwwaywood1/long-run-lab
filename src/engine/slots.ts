import { type Rng, randInt } from './rng';
import { appendRound, newSession, type Session } from './session';

/**
 * 本项目设计的示例老虎机：3 个转轴，每轴 20 个停点，等概率。
 * 符号：7、B(BAR)、S(★)、D(◆)、C(●)、_(空白)。第三轴的 7 只有前两轴的一半，用来制造“差一点”。
 */
export const REELS = ['7C_BSDC_SBDC7_SCD_BC', '7C_BSDC_SBDC7_SCD_BC', 'C_BSD_C_SBDC_7_SCD_C'] as const;
export const STOPS = 20;
export const THREE_KIND: Record<string, number> = { '777': 200, BBB: 50, SSS: 25, DDD: 15 };
/** 按 ● 的个数赔付：1 个 0.5 倍（伪装成赢的输）、2 个 2 倍、3 个 5 倍 */
export const CHERRY_PAY = [0, 0.5, 2, 5];

/** 一次拉动的返还倍数（含本金，0 表示全输） */
export function payout(a: string, b: string, c: string): number {
  const t = a + b + c;
  if (THREE_KIND[t]) return THREE_KIND[t];
  const n = (a === 'C' ? 1 : 0) + (b === 'C' ? 1 : 0) + (c === 'C' ? 1 : 0);
  return CHERRY_PAY[n];
}

export interface Pull { stops: [number, number, number]; symbols: [string, string, string]; pay: number; nearMiss: boolean }

/** “差一点”：前两个转轴都是 7，第三个不是。它出现的次数是 777 的 19 倍（numbers.json 的 p_77x / p_777）。 */
export function isNearMiss(stops: [number, number, number]): boolean {
  return REELS[0][stops[0]] === '7' && REELS[1][stops[1]] === '7' && REELS[2][stops[2]] !== '7';
}

export function pull(rng: Rng): Pull {
  const stops: [number, number, number] = [randInt(rng, STOPS), randInt(rng, STOPS), randInt(rng, STOPS)];
  return pullAtStops(stops);
}

/** Evaluate known stops with exactly the same rules as a random pull. */
export function pullAtStops(stops: [number, number, number]): Pull {
  const symbols: [string, string, string] = [REELS[0][stops[0]], REELS[1][stops[1]], REELS[2][stops[2]]];
  return { stops, symbols, pay: payout(...symbols), nearMiss: isNearMiss(stops) };
}

/** 穷举 8000 种组合，得到精确的返还率、响铃率和“伪装成赢的输”比例 */
export function exactStats() {
  let total = 0, hits = 0, ldw = 0, real = 0;
  for (let i = 0; i < STOPS; i++) for (let j = 0; j < STOPS; j++) for (let k = 0; k < STOPS; k++) {
    const x = payout(REELS[0][i], REELS[1][j], REELS[2][k]);
    total += x;
    if (x > 0) hits++;
    if (x > 0 && x < 1) ldw++;
    if (x > 1) real++;
  }
  const n = STOPS ** 3;
  return { rtp: total / n, edge: 1 - total / n, hitRate: hits / n, ldwRate: ldw / n, realWinRate: real / n };
}

export const SLOTS_RTP = 0.9178125;


export const SLOTS_PULLS_PER_HOUR = 600;
export const SLOTS_NIGHT_HOURS = 8;
export const SLOTS_FAST_ROUNDS = 100;
export type SlotOutcome = 'win' | 'ldw' | 'miss';
export interface SettledPull extends Pull { gross: number; net: number; loss: number; outcome: SlotOutcome }
export interface SlotsRound {
  machines: SettledPull[]; stake: number; delta: number; expectedDelta: number;
  bets: number; rings: number; fakes: number; real: number;
}
export function settlePulls(pulls: Pull[], stake: number): SlotsRound {
  const machines = pulls.map(p => {
    const gross = p.pay * stake, net = gross - stake;
    const outcome: SlotOutcome = p.pay > 1 ? 'win' : p.pay > 0 ? 'ldw' : 'miss';
    return { ...p, gross, net, loss: Math.max(0, -net), outcome };
  });
  return { machines, stake, delta: machines.reduce((sum, p) => sum + p.net, 0),
    expectedDelta: -stake * machines.length * (1 - SLOTS_RTP), bets: machines.length,
    rings: machines.filter(p => p.pay > 0).length,
    fakes: machines.filter(p => p.outcome === 'ldw').length,
    real: machines.filter(p => p.outcome === 'win').length };
}
export function pullRound(tables: number, stake: number, rng: Rng): SlotsRound {
  return settlePulls(Array.from({ length: tables }, () => pull(rng)), stake);
}
export type SlotsSession = Session<SlotsRound> & { rings: number; fakes: number };
export const newSlotsSession = (): SlotsSession => ({ ...newSession<SlotsRound>(), rings: 0, fakes: 0 });
export function appendSlotsRound(session: SlotsSession, round: SlotsRound): SlotsSession {
  return { ...appendRound(session, round), rings: session.rings + round.rings, fakes: session.fakes + round.fakes };
}
export function slotsLossRates(tables: number, stake: number) {
  const perMinute = tables * stake * SLOTS_PULLS_PER_HOUR * (1 - SLOTS_RTP) / 60;
  return { perMinute, perNight: perMinute * 60 * SLOTS_NIGHT_HOURS };
}
