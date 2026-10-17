import { mulberry32, type Rng } from './rng';
import { EDGE_RED, P_WIN_RED } from './roulette';
import numbers from '../../data/numbers.json';

export const LLN_ROUNDS = [10, 100, 1000, 10000] as const;
export const LLN_PLAYERS = 13;
export const LLN_POPULATION = 10000;
export const LLN_DEFAULT_ROUNDS = 1000;
export const LLN_DEFAULT_SEED = 14; // Reproducible design default: you finish at −66.
export const LLN_COVERAGE = 0.9;
export const aheadProbabilities = numbers.roulette.p_ahead_after_n.value;
export const aheadPerHundred = (n: number) => 100 * aheadProbabilities[String(n) as keyof typeof aheadProbabilities];
export const rareAheadMillions = Math.round(numbers.roulette.one_in_x_ahead_after_10000.value / 1e6);

/** Exact binomial law, to floating point precision. Start at the mode to avoid
 * underflow at n=10,000, recur in both directions, then normalize. No normal approximation. */
export function binomialMass(n: number, p = P_WIN_RED): number[] {
  if (!Number.isInteger(n) || n < 0 || n > 10000 || !Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('Invalid binomial parameters');
  const mass = Array(n + 1).fill(0);
  if (p === 0 || p === 1) { mass[p === 0 ? 0 : n] = 1; return mass; }
  const mode = Math.floor((n + 1) * p);
  mass[mode] = 1;
  for (let k = mode; k > 0; k--) mass[k - 1] = mass[k] * k / (n - k + 1) * (1 - p) / p;
  for (let k = mode; k < n; k++) mass[k + 1] = mass[k] * (n - k) / (k + 1) * p / (1 - p);
  const total = mass.reduce((a, b) => a + b, 0);
  return mass.map(v => v / total);
}

export function binomialQuantile(mass: number[], q: number): number {
  if (!(q >= 0 && q <= 1)) throw new RangeError('Invalid quantile');
  let sum = 0;
  for (let k = 0; k < mass.length; k++) { sum += mass[k]; if (sum >= q) return k; }
  return mass.length - 1;
}

export function exactBand(n: number) {
  const mass = binomialMass(n);
  return { low: 2 * binomialQuantile(mass, 0.05) - n, high: 2 * binomialQuantile(mass, 0.95) - n, expected: -EDGE_RED * n };
}

function validateRounds(n: number) {
  if (!(LLN_ROUNDS as readonly number[]).includes(n)) throw new RangeError('Unsupported round count');
}
const bands = new Map<number, ReturnType<typeof makeBand>>();
function makeBand(n: number) {
  const step = Math.max(1, Math.ceil(n / 200));
  return Array.from({ length: n / step + 1 }, (_, k) => ({ round: k * step, ...exactBand(k * step) }));
}
export function simulatePaths(n: number, seed: number) {
  validateRounds(n);
  if (!bands.has(n)) bands.set(n, makeBand(n));
  const band = bands.get(n)!;
  const rng = mulberry32(seed);
  const paths = Array.from({ length: LLN_PLAYERS }, () => {
    let net = 0;
    const points = [0];
    let next = 1;
    for (let round = 1; round <= n; round++) {
      net += rng() < P_WIN_RED ? 1 : -1;
      if (round === band[next]?.round) { points.push(net); next++; }
    }
    return points;
  });
  return { rounds: n, band, paths, you: paths[0].at(-1)! };
}

/** Inverse-CDF sampling of complete n-spin outcomes: exactly the same law as
 * n independent spins per person, without blocking the UI on 100 million spins. */
export function runPopulation(n: number, rng: Rng) {
  validateRounds(n);
  let sum = 0;
  const cdf = binomialMass(n).map(v => (sum += v));
  cdf[n] = 1;
  let ahead = 0, tied = 0;
  for (let i = 0; i < LLN_POPULATION; i++) {
    const u = rng();
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (u < cdf[mid]) hi = mid; else lo = mid + 1; }
    if (2 * lo > n) ahead++;
    else if (2 * lo === n) tied++;
  }
  return { ahead, tied, lost: LLN_POPULATION - ahead - tied, total: LLN_POPULATION,
    percent: ahead / LLN_POPULATION * 100, exactPercent: aheadPerHundred(n) };
}

/** Fractional icon fill, rounded to the same one decimal place as the caption. */
export function peopleShares() {
  const count = Math.round(aheadPerHundred(1000) * 10) / 10;
  const order = [6, 23, 47, 71, 88, ...Array.from({ length: 100 }, (_, i) => i).filter(i => ![6,23,47,71,88].includes(i))];
  return Array.from({ length: 100 }, (_, i) => Math.min(1, Math.max(0, count - order.indexOf(i))));
}
