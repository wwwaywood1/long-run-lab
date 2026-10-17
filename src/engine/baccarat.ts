import { type Rng, shuffle } from './rng';

export type Side = 'B' | 'P' | 'T';
export interface Card { r: string; s: string }

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♣', '♦'];
export const DECKS = 8;
/** 8 副牌标准规则下公认的庄家优势（押庄已含 5% 抽水；押和 8 赔 1） */
export const BACCARAT_EDGE: Record<Side, number> = { B: 0.010579, P: 0.012351, T: 0.143596 };
/** 8 副牌的结果概率（公认值，引擎模拟应与之吻合） */
export const BACCARAT_PROB: Record<Side, number> = { B: 0.458597, P: 0.446247, T: 0.095156 };

export const cardValue = (c: Card) => {
  const i = RANKS.indexOf(c.r);
  return i >= 9 ? 0 : i + 1;
};
export const handTotal = (cards: Card[]) => cards.reduce((s, c) => s + cardValue(c), 0) % 10;

export function bankerDraws(banker: number, playerThird: number | null): boolean {
  if (playerThird === null) return banker <= 5;
  if (banker <= 2) return true;
  if (banker === 3) return playerThird !== 8;
  if (banker === 4) return playerThird >= 2 && playerThird <= 7;
  if (banker === 5) return playerThird >= 4 && playerThird <= 7;
  if (banker === 6) return playerThird === 6 || playerThird === 7;
  return false;
}

/** 一注的净收益（注额单位）：押庄赢 +0.95，押闲赢 +1，押和赢 +8；和局时庄/闲退回 */
export function baccaratNet(win: Side, pick: Side): number {
  if (pick === 'T') return win === 'T' ? 8 : -1;
  if (win === 'T') return 0;
  if (pick === 'B') return win === 'B' ? 0.95 : -1;
  return win === 'P' ? 1 : -1;
}

/** 8 副牌牌靴。剩不到 1 副时，在下一局开始前重新洗牌（和赌场的切牌一样，不会在一局中途洗牌）。 */
export class Shoe {
  private cards: Card[] = [];
  constructor(private rng: Rng, private decks = DECKS) { this.reshuffle(); }
  reshuffle() {
    const cards: Card[] = [];
    for (let d = 0; d < this.decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
    this.cards = shuffle(cards, this.rng);
  }
  get remaining() { return this.cards.length; }
  /** 每局开始前调用：一局最多 6 张，剩 52 张以上就够用 */
  startHand() { if (this.cards.length < 52) this.reshuffle(); }
  draw(): Card {
    if (this.cards.length === 0) this.reshuffle();
    return this.cards.pop()!;
  }
}

export interface BaccaratHand { player: Card[]; banker: Card[]; pt: number; bt: number; win: Side }

export function playHand(shoe: Shoe): BaccaratHand {
  shoe.startHand();
  const player = [shoe.draw()];
  const banker = [shoe.draw()];
  player.push(shoe.draw());
  banker.push(shoe.draw());
  let pt = handTotal(player), bt = handTotal(banker);
  if (pt < 8 && bt < 8) {
    let p3: number | null = null;
    if (pt <= 5) {
      const c = shoe.draw();
      player.push(c);
      p3 = cardValue(c);
      pt = handTotal(player);
    }
    if (bankerDraws(bt, p3)) {
      banker.push(shoe.draw());
      bt = handTotal(banker);
    }
  }
  const win: Side = bt > pt ? 'B' : pt > bt ? 'P' : 'T';
  return { player, banker, pt, bt, win };
}

/** Design assumptions; these are not estimates of the current shoe. */
export const BACCARAT_ROUNDS_PER_HOUR = 70;
export const BACCARAT_NIGHT_HOURS = 8;
export const BACCARAT_FAST_ROUNDS = 100;
export type BetOutcome = 'win' | 'loss' | 'push';
export interface SettledHand extends BaccaratHand { net: number; outcome: BetOutcome }
export interface BaccaratRound {
  hands: SettledHand[]; pick: Side; bet: number; delta: number; expectedDelta: number;
  wins: number; losses: number; pushes: number;
}
export interface BaccaratSession {
  pnl: number; expected: number; rounds: number; bets: number;
  history: { p: number; e: number }[]; road: Side[]; last: BaccaratRound | null;
}
export const newSession = (): BaccaratSession => ({
  pnl: 0, expected: 0, rounds: 0, bets: 0,
  history: [{ p: 0, e: 0 }], road: [], last: null,
});

export function settleHands(hands: BaccaratHand[], pick: Side, bet: number): BaccaratRound {
  const settled = hands.map(hand => {
    const net = baccaratNet(hand.win, pick) * bet;
    const outcome: BetOutcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
    return { ...hand, net, outcome };
  });
  return {
    hands: settled, pick, bet, delta: settled.reduce((sum, hand) => sum + hand.net, 0),
    expectedDelta: -bet * hands.length * BACCARAT_EDGE[pick],
    wins: settled.filter(h => h.outcome === 'win').length,
    losses: settled.filter(h => h.outcome === 'loss').length,
    pushes: settled.filter(h => h.outcome === 'push').length,
  };
}

/** Each table retains its own shoe across rounds and mode changes. */
export function dealRound(shoes: Shoe[], tables: number, pick: Side, bet: number, rng: Rng): BaccaratRound {
  const hands = Array.from({ length: tables }, (_, i) => {
    shoes[i] ??= new Shoe(rng);
    return playHand(shoes[i]);
  });
  return settleHands(hands, pick, bet);
}

export function appendRound(session: BaccaratSession, round: BaccaratRound): BaccaratSession {
  const pnl = session.pnl + round.delta;
  const expected = session.expected + round.expectedDelta;
  return {
    pnl, expected, rounds: session.rounds + 1, bets: session.bets + round.hands.length,
    history: [...session.history, { p: pnl, e: expected }].slice(-400),
    road: [...session.road, round.hands[0].win].slice(-600), last: round,
  };
}

export function lossRates(tables: number, bet: number, pick: Side) {
  const perMinute = tables * bet * BACCARAT_ROUNDS_PER_HOUR * BACCARAT_EDGE[pick] / 60;
  return { perMinute, perNight: perMinute * 60 * BACCARAT_NIGHT_HOURS };
}
export const sessionLoss = (session: BaccaratSession) => Math.max(0, -session.pnl);

/** Deal order and visible totals live beside the rules, never in the UI. */
export function visibleHand(hand: BaccaratHand, side: 'player' | 'banker', revealed: number) {
  const cards = hand[side].filter((_, k) => {
    const order = k < 2 ? 2 * k + (side === 'banker' ? 1 : 0)
      : side === 'player' ? 4 : hand.player.length === 3 ? 5 : 4;
    return order < revealed;
  });
  return { cards, total: cards.length ? handTotal(cards) : null };
}
