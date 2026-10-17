import type { Rng } from './rng';
import { appendRound, newSession, type Session } from './session';

/**
 * 返还率 97%：恰好 3% 的局被设定为起飞即爆（爆点 = 1.00），其余 97% 的局是公平的：
 * P(爆点 ≥ m | 不是起飞即爆) = 1 / m，合起来 P(爆点 ≥ m) = 0.97 / m（m > 1）。
 * 爆点本身是连续值；倍数按 0.01 显示和结算（floorX）。所以公平部分里爆点落在 (1.00, 1.01) 的局
 * （约 0.97 × (1 − 1/1.01) ≈ 0.96%）也会显示为 1.00× 爆掉：公平游戏同样会有，不是抽水。
 * 旧版先把爆点取整到 0.01，“设定为起飞即爆”的比例就变成了 1 − 0.97/1.01 ≈ 3.96%，和“3%”对不上。
 */
export const CRASH_RTP = 0.97;
export const CRASH_EDGE = 1 - CRASH_RTP;

export function crashPoint(rng: Rng): number {
  const m = CRASH_RTP / (1 - rng());
  return m < 1 ? 1 : m;
}

/** 显示用：向下取到 0.01，保证“显示的爆点 ≥ 目标”与“跳车成功”一致 */
export const floorX = (m: number) => Math.floor(m * 100 + 1e-9) / 100;

/** 自动在 target 倍跳车时，一注的净收益（注额单位） */
export function crashNet(target: number, crash: number): number {
  return target <= crash ? target - 1 : -1;
}

/** 在 target 倍跳车成功的概率 */
export const cashOutProbability = (target: number) => Math.min(1, CRASH_RTP / target);


export const CRASH_RATE = Math.LN2 / 2.2;
export const CRASH_TICK_MS = 50;
export const CRASH_DISPLAY_CAP = 20;
export const CRASH_PAUSE_MS = 900;
export const CRASH_ROUNDS_PER_HOUR = 180;
export const CRASH_NIGHT_HOURS = 8;
export const CRASH_FAST_ROUNDS = 100;
export const CRASH_TARGETS = [1.5, 2, 5, 10] as const;
export const multiplierAt = (seconds: number) => Math.exp(CRASH_RATE * seconds);
export const timeAtMultiplier = (multiplier: number) => Math.log(multiplier) / CRASH_RATE;
export interface FlightGame { crash: number; cash: number; done: boolean; bust: boolean; idle: boolean; net: number }
export interface Flight { games: FlightGame[]; running: boolean; t: number; m: number; target: number; stake: number }
export function newFlight(tables: number, target = 2, stake = 10): Flight {
  return { games: Array.from({ length: tables }, () => ({ crash: 0, cash: 0, done: false, bust: false, idle: true, net: 0 })), running: false, t: 0, m: 1, target, stake };
}
export function startFlight(tables: number, target: number, stake: number, rng: Rng): Flight {
  return { ...newFlight(tables, target, stake), running: true,
    games: Array.from({ length: tables }, () => ({ crash: crashPoint(rng), cash: 0, done: false, bust: false, idle: false, net: 0 })) };
}
function cashGame(game: FlightGame, cash: number, stake: number): FlightGame {
  return { ...game, cash, done: true, bust: false, net: crashNet(cash, game.crash) * stake };
}
/** Fixed-step progression follows the original design, including equality at the target. */
export function advanceFlight(flight: Flight, seconds = CRASH_TICK_MS / 1000): Flight {
  if (!flight.running) return flight;
  const t = flight.t + seconds, m = multiplierAt(t), shown = floorX(m);
  const games = flight.games.map(game => {
    if (game.done) return game;
    // 目标是 0.01 的整数倍，target ≤ m 与 target ≤ shown 等价
    if (flight.target <= shown && flight.target <= game.crash) return cashGame(game, flight.target, flight.stake);
    // 以显示的倍数为准：爆点低于当前显示倍数才算爆，所以“还在飞”的局，按显示倍数跳车一定成功
    if (game.crash < shown) return { ...game, cash: 0, done: true, bust: true, net: -flight.stake };
    return game;
  });
  const one = games.length === 1;
  const endAt = one ? Math.min(games[0].crash, CRASH_DISPLAY_CAP) : 0;
  const finished = games.every(game => game.done) && m >= endAt;
  return { ...flight, games, t, m: finished && one ? Math.max(1, Math.min(m, games[0].crash)) : m, running: !finished };
}
/** 起飞前（第一个计时步之前）不能跳车：否则在 1.00× 退回本金，就躲开了起飞即爆的那 3%。 */
export const canJump = (flight: Flight) => flight.running && flight.t > 0 && flight.games.some(game => !game.done);
/**
 * 手动跳车按屏幕上显示的倍数 c = floorX(m) 结算。还在飞的局，爆点 ≥ c，所以必定成功。
 * 任何只看“到现在还没爆”的手动策略，期望都恰好是 −3%：撑到显示 c 倍的概率是 0.97/c，赢回 c 倍。
 */
export function jumpFlight(flight: Flight): Flight {
  if (!canJump(flight)) return flight;
  const cash = floorX(flight.m);
  return { ...flight, games: flight.games.map(game => game.done ? game : cashGame(game, cash, flight.stake)) };
}
export function flightSummary(flight: Flight) {
  return { flying: flight.games.filter(g => !g.idle && !g.done).length,
    cashed: flight.games.filter(g => g.done && !g.bust).length,
    bust: flight.games.filter(g => g.bust).length };
}
export interface CrashRound { flight: Flight; delta: number; expectedDelta: number; bets: number; cashed: number; bust: number }
export function settleFlight(flight: Flight): CrashRound {
  if (flight.running || flight.games.some(g => !g.done)) throw new Error('Cannot settle an unfinished flight');
  const { cashed, bust } = flightSummary(flight);
  return { flight, delta: flight.games.reduce((sum, game) => sum + game.net, 0),
    expectedDelta: -flight.stake * flight.games.length * CRASH_EDGE, bets: flight.games.length, cashed, bust };
}
export function fastFlight(tables: number, target: number, stake: number, rng: Rng): Flight {
  const initial = startFlight(tables, target, stake, rng);
  const games = initial.games.map(game => target <= game.crash ? cashGame(game, target, stake) : { ...game, done: true, bust: true, net: -stake });
  const m = Math.min(games[0].crash, CRASH_DISPLAY_CAP);
  return { ...initial, games, running: false, m, t: timeAtMultiplier(m) };
}
export type CrashSession = Session<CrashRound> & { cashed: number; cashRate: number | null };
export const newCrashSession = (): CrashSession => ({ ...newSession<CrashRound>(), cashed: 0, cashRate: null });
export function appendCrashRound(session: CrashSession, round: CrashRound): CrashSession {
  const next = appendRound(session, round), cashed = session.cashed + round.cashed;
  return { ...next, cashed, cashRate: cashed / next.bets };
}
export function crashTargetTerms(target: number, stake: number) {
  return { probability: cashOutProbability(target), win: crashNet(target, target) * stake, loss: stake };
}
export function crashLossRates(tables: number, stake: number) {
  const perMinute = tables * stake * CRASH_ROUNDS_PER_HOUR * CRASH_EDGE / 60;
  return { perMinute, perNight: perMinute * 60 * CRASH_NIGHT_HOURS };
}
