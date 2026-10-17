import { appendRound, newSession, type Session } from './session';
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

/** UI assumptions from the design; prices, prize distribution and ticket generation above are unchanged. */
export const SCRATCH_COUNTS = [1, 10, 100] as const;
export const SCRATCH_FAST_ROUNDS = 100;
export const SCRATCH_CELL_COUNT = 8;
const STATS = exactStats();
const PRIZE_VALUES = new Map(AMOUNTS.map(amount => [amountLabel(amount), amount]));
export interface PlayableScratchTicket { ticket: ScratchTicket; open: boolean[]; settled: boolean }
export const newScratchTicket = (rng: Rng): PlayableScratchTicket => ({ ticket: makeTicket(rng), open: Array<boolean>(SCRATCH_CELL_COUNT).fill(false), settled: false });
export const buyScratchTickets = (count: number, rng: Rng) => Array.from({ length: count }, () => newScratchTicket(rng));
export function scratchCell(ticket: PlayableScratchTicket, index: number): PlayableScratchTicket {
  if (ticket.settled || !Number.isInteger(index) || index < 0 || index >= SCRATCH_CELL_COUNT || ticket.open[index]) return ticket;
  const open = ticket.open.map((value, i) => value || i === index);
  return { ...ticket, open, settled: open.every(Boolean) };
}
export function revealScratchTicket(ticket: PlayableScratchTicket): PlayableScratchTicket {
  return ticket.settled ? ticket : { ...ticket, open: Array<boolean>(SCRATCH_CELL_COUNT).fill(true), settled: true };
}
export type ScratchOutcome = 'pending' | 'miss' | 'even' | 'win';
/** A covered value never reaches the rendering layer, including its accessible name. */
export function scratchView(play: PlayableScratchTicket) {
  const { ticket, open, settled } = play;
  const outcome: ScratchOutcome = !settled ? 'pending' : ticket.amount === 0 ? 'miss' : ticket.amount === PRICE ? 'even' : 'win';
  return {
    settled, outcome, amount: settled ? ticket.amount : null, net: settled ? ticket.amount - PRICE : null,
    remaining: open.filter(value => !value).length,
    winning: ticket.winning.map((number, i) => open[i] ? number : null),
    mine: ticket.mine.map((cell, i) => ({
      number: open[i + 2] ? cell.n : null,
      prize: open[i + 2] ? PRIZE_VALUES.get(cell.prize)! : null,
      hit: settled && open[i + 2] && cell.hit,
    })),
  };
}
export interface ScratchRound {
  tickets: PlayableScratchTicket[]; delta: number; expectedDelta: number; bets: number;
  paid: number; hits: number; evens: number; biggest: number;
}
export function settleScratchTickets(tickets: PlayableScratchTicket[]): ScratchRound {
  if (tickets.some(ticket => !ticket.settled)) throw new Error('Cannot record covered scratch tickets');
  const paid = tickets.reduce((sum, ticket) => sum + ticket.ticket.amount, 0);
  return { tickets, paid, bets: tickets.length, delta: paid - PRICE * tickets.length,
    expectedDelta: -PRICE * tickets.length * (1 - STATS.rtp),
    hits: tickets.filter(ticket => ticket.ticket.amount > 0).length,
    evens: tickets.filter(ticket => ticket.ticket.amount === PRICE).length,
    biggest: tickets.reduce((max, ticket) => Math.max(max, ticket.ticket.amount), 0),
  };
}

export interface ScratchSession extends Session<ScratchRound> { hits: number; evens: number }
export const newScratchSession = (): ScratchSession => ({ ...newSession<ScratchRound>(), hits: 0, evens: 0 });
export function appendScratchRound(session: ScratchSession, round: ScratchRound): ScratchSession {
  return { ...appendRound(session, round), hits: session.hits + round.hits, evens: session.evens + round.evens };
}
export function fastScratch(session: ScratchSession, count: number, rng: Rng): ScratchSession {
  let next = session;
  for (let i = 0; i < SCRATCH_FAST_ROUNDS; i++) next = appendScratchRound(next, settleScratchTickets(buyScratchTickets(count, rng).map(revealScratchTicket)));
  return next;
}
