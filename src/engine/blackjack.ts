import { type Rng, shuffle } from './rng';

/**
 * 二十一点：6 副牌、庄家软 17 停牌、可加倍、可分牌一次（含分 A 只发一张）、无投降、庄家先看底牌。
 * 剩 78 张（约 75% 渗透）时洗牌。
 */
export interface Card { r: string; s: string }
export type Strategy = 'basic' | 'mimic' | 'never';
export type Action = 'H' | 'S' | 'D' | 'P';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♣', '♦'];
export const DECKS = 6;
export const CUT = 78;
/** 模拟得到的庄家优势（见 research/compute_numbers.py，3:2 与 6:5 两种黑杰克赔率） */
export const BJ_EDGE: Record<Strategy, { '1.5': number; '1.2': number }> = {
  basic: { '1.5': 0.0046, '1.2': 0.0183 },
  mimic: { '1.5': 0.0565, '1.2': 0.0703 },
  never: { '1.5': 0.0604, '1.2': 0.0745 },
};

export const cardValue = (c: Card) => (c.r === 'A' ? 11 : ['10', 'J', 'Q', 'K'].includes(c.r) ? 10 : Number(c.r));
export function total(cards: Card[]): { t: number; soft: boolean } {
  let t = 0, aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    if (v === 11) { aces++; t += 1; } else t += v;
  }
  return aces > 0 && t + 10 <= 21 ? { t: t + 10, soft: true } : { t, soft: false };
}
export const hiLo = (c: Card) => { const v = cardValue(c); return v <= 6 ? 1 : v >= 10 ? -1 : 0; };
const isPair = (cards: Card[]) => cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);

export function basicStrategy(cards: Card[], up: Card, canDouble: boolean, canSplit: boolean): Action {
  const u = cardValue(up);
  if (canSplit && isPair(cards)) {
    const pv = cardValue(cards[0]);
    let sp = false;
    if (pv === 11 || pv === 8) sp = true;
    else if (pv === 9) sp = u <= 6 || u === 8 || u === 9;
    else if (pv === 7) sp = u <= 7;
    else if (pv === 6) sp = u <= 6;
    else if (pv === 4) sp = u === 5 || u === 6;
    else if (pv === 3 || pv === 2) sp = u <= 7;
    if (sp) return 'P';
  }
  const { t, soft } = total(cards);
  if (soft) {
    if (t >= 19) return 'S';
    if (t === 18) { if (u >= 3 && u <= 6) return canDouble ? 'D' : 'S'; return u <= 8 ? 'S' : 'H'; }
    if (t === 17) return u >= 3 && u <= 6 && canDouble ? 'D' : 'H';
    if (t >= 15) return u >= 4 && u <= 6 && canDouble ? 'D' : 'H';
    if (t >= 13) return u >= 5 && u <= 6 && canDouble ? 'D' : 'H';
    return 'H';
  }
  if (t >= 17) return 'S';
  if (t >= 13) return u <= 6 ? 'S' : 'H';
  if (t === 12) return u >= 4 && u <= 6 ? 'S' : 'H';
  if (t === 11) return u <= 10 && canDouble ? 'D' : 'H';
  if (t === 10) return u <= 9 && canDouble ? 'D' : 'H';
  if (t === 9) return u >= 3 && u <= 6 && canDouble ? 'D' : 'H';
  return 'H';
}

export function decide(strategy: Strategy, cards: Card[], up: Card, canDouble: boolean, canSplit: boolean): Action {
  if (strategy === 'basic') return basicStrategy(cards, up, canDouble, canSplit);
  const { t, soft } = total(cards);
  if (strategy === 'mimic') return t < 17 ? 'H' : 'S';
  if (soft) return t <= 17 ? 'H' : 'S';
  return t <= 11 ? 'H' : 'S';
}

export type Tag = 'bj' | 'win' | 'dbust' | 'lose' | 'bust' | 'push' | 'dbj';
export interface Hand { cards: Card[]; doubled: boolean; done: boolean; splitAces: boolean; net: number; tag: Tag | '' }
export interface Round { dealer: Card[]; hole: boolean; hands: Hand[]; active: number; phase: 'player' | 'dealer' | 'done'; dealerBJ: boolean; playerBJ: boolean; net: number }

/** 一张桌子：牌靴 + Hi-Lo 流水计数 */
export class Table {
  shoe: Card[] = [];
  runningCount = 0;
  constructor(private rng: Rng) {}
  private reshuffle() {
    const s: Card[] = [];
    for (let d = 0; d < DECKS; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, s: su });
    this.shoe = shuffle(s, this.rng);
    this.runningCount = 0;
  }
  draw(counted = true): Card {
    const c = this.shoe.pop()!;
    if (counted) this.runningCount += hiLo(c);
    return c;
  }
  get decksLeft() { return this.shoe.length / 52; }
  get trueCount() { return this.shoe.length ? this.runningCount / this.decksLeft : 0; }

  start(): Round {
    if (this.shoe.length < CUT) this.reshuffle();
    const p1 = this.draw(), d1 = this.draw(), p2 = this.draw(), d2 = this.draw(false);
    const r: Round = {
      dealer: [d1, d2], hole: true,
      hands: [{ cards: [p1, p2], doubled: false, done: false, splitAces: false, net: 0, tag: '' }],
      active: 0, phase: 'player', dealerBJ: total([d1, d2]).t === 21, playerBJ: total([p1, p2]).t === 21, net: 0,
    };
    if (r.dealerBJ || r.playerBJ) { r.hands[0].done = true; r.phase = 'dealer'; }
    return r;
  }
  canDouble(r: Round) { const h = r.hands[r.active]; return r.phase === 'player' && h.cards.length === 2 && !h.splitAces; }
  canSplit(r: Round) { return r.phase === 'player' && r.hands.length < 2 && isPair(r.hands[r.active].cards); }

  act(r: Round, a: Action) {
    if (r.phase !== 'player') return;
    const h = r.hands[r.active];
    if (a === 'D' && !this.canDouble(r)) a = 'H';
    if (a === 'P' && !this.canSplit(r)) a = 'H';
    if (a === 'H') { h.cards.push(this.draw()); if (total(h.cards).t >= 21) h.done = true; }
    else if (a === 'S') h.done = true;
    else if (a === 'D') { h.doubled = true; h.cards.push(this.draw()); h.done = true; }
    else {
      const aces = cardValue(h.cards[0]) === 11;
      const h2: Hand = { cards: [h.cards.pop()!], doubled: false, done: false, splitAces: aces, net: 0, tag: '' };
      h.splitAces = aces;
      h.cards.push(this.draw());
      h2.cards.push(this.draw());
      r.hands.splice(r.active + 1, 0, h2);
      if (aces) { h.done = true; h2.done = true; } else if (total(h.cards).t === 21) h.done = true;
    }
    if (h.done) {
      const next = r.hands.findIndex((x) => !x.done);
      if (next >= 0) r.active = next; else r.phase = 'dealer';
    }
  }
  reveal(r: Round) { if (r.hole) { r.hole = false; this.runningCount += hiLo(r.dealer[1]); } }
  dealerNeedsCard(r: Round) {
    if (r.dealerBJ || r.playerBJ) return false;
    return r.hands.some((h) => total(h.cards).t <= 21) && total(r.dealer).t < 17;
  }
  settle(r: Round, bjPays: number): number {
    const d = total(r.dealer).t;
    let net = 0;
    for (const h of r.hands) {
      const m = h.doubled ? 2 : 1;
      const p = total(h.cards).t;
      if (r.dealerBJ) { h.net = r.playerBJ ? 0 : -1; h.tag = r.playerBJ ? 'push' : 'dbj'; }
      else if (r.playerBJ) { h.net = bjPays; h.tag = 'bj'; }
      else if (p > 21) { h.net = -m; h.tag = 'bust'; }
      else if (d > 21) { h.net = m; h.tag = 'dbust'; }
      else if (p > d) { h.net = m; h.tag = 'win'; }
      else if (p < d) { h.net = -m; h.tag = 'lose'; }
      else { h.net = 0; h.tag = 'push'; }
      net += h.net;
    }
    r.phase = 'done';
    r.net = net;
    return net;
  }
  /** 按策略自动打完一整局 */
  autoRound(strategy: Strategy, bjPays: number): Round {
    const r = this.start();
    while (r.phase === 'player') {
      const h = r.hands[r.active];
      this.act(r, decide(strategy, h.cards, r.dealer[0], this.canDouble(r), this.canSplit(r)));
    }
    this.reveal(r);
    while (this.dealerNeedsCard(r)) r.dealer.push(this.draw());
    this.settle(r, bjPays);
    return r;
  }
}
