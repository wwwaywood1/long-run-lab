import { type Rng, randInt } from './rng';

/** 示例赔率：每场返还 92%（即赔率 = 0.92 / 真实概率，四舍五入到 0.01） */
export const RETURN_PER_LEG = 0.92;
export const TEAMS = ['北岸', '南港', '东林', '西川', '金城', '银湾', '铁山', '白河', '青石', '海风', '云峰', '长桥', '星野', '雪原', '火鸟', '黑岩'];
export type Outcome = 0 | 1 | 2; // 主胜 / 平 / 客胜

export interface Match { home: string; away: string; p: [number, number, number]; odds: [number, number, number]; result: Outcome; score: string; pick: Outcome | -1 }

export function makeMatch(rng: Rng): Match {
  const a = randInt(rng, TEAMS.length);
  let b = randInt(rng, TEAMS.length - 1);
  if (b >= a) b++;
  const pD = 0.22 + rng() * 0.08;
  const rest = 1 - pD;
  const pH = rest * (0.25 + rng() * 0.5);
  const p: [number, number, number] = [pH, pD, rest - pH];
  const odds = p.map((x) => Math.max(1.01, Math.round((RETURN_PER_LEG / x) * 100) / 100)) as [number, number, number];
  const u = rng();
  const result: Outcome = u < p[0] ? 0 : u < p[0] + p[1] ? 1 : 2;
  const g = randInt(rng, 3), extra = rng() < 0.35 ? 1 : 0;
  const score = result === 0 ? `${g + 1 + extra} : ${g}` : result === 1 ? `${g} : ${g}` : `${g} : ${g + 1 + extra}`;
  return { home: TEAMS[a], away: TEAMS[b], p, odds, result, score, pick: -1 };
}

export const favourite = (m: Match): Outcome => (m.p[0] >= m.p[2] ? 0 : 2);

/** 串关：总赔率、全中与否、精确期望返还（真实概率 × 赔率的连乘） */
export function evaluate(slip: Match[]) {
  let odds = 1, ev = 1, hit = true;
  for (const m of slip) {
    if (m.pick === -1) throw new Error('unpicked match');
    odds *= m.odds[m.pick];
    ev *= m.p[m.pick] * m.odds[m.pick];
    if (m.result !== m.pick) hit = false;
  }
  return { odds, ev, hit };
}

/** 赔率换算的隐含概率之和（> 1 的部分就是抽水） */
export const overround = (odds: number[]) => odds.reduce((s, o) => s + 1 / o, 0);
