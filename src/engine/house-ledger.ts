import numbers from '../../data/numbers.json';
import { P_WIN_RED, EDGE_RED } from './roulette';
import { mulberry32, type Rng } from './rng';

export const LEDGER = numbers.prologue.assumptions.value;
export const LEDGER_ROUNDS = LEDGER.guests * LEDGER.rounds;
export type LedgerView = 'house' | 'guest';
export interface LedgerRun { mode: 'night' | 'many'; house: number[]; guest: number[] }

/** Inverse binomial sampling from a mode-centred PMF recurrence.
 * No normal approximation or tail cut-off. Relative weights avoid p^n underflow;
 * normalization and CDF accumulation use IEEE doubles (remote tails can underflow).
 * O(n) setup, O(log n) draws, cached for the fixed experiment sizes.
 */
export function binomialSampler(n: number, p: number): (rng: Rng) => number {
  if (!Number.isSafeInteger(n) || n < 0 || !Number.isFinite(p) || p < 0 || p > 1) throw new Error('Invalid binomial parameters');
  if (n === 0 || p === 0) return () => 0;
  if (p === 1) return () => n;
  const mass = new Float64Array(n + 1), mode = Math.floor((n + 1) * p), q = 1 - p;
  mass[mode] = 1;
  for (let k = mode; k > 0; k--) mass[k - 1] = mass[k] * k * q / ((n - k + 1) * p);
  for (let k = mode; k < n; k++) mass[k + 1] = mass[k] * (n - k) * p / ((k + 1) * q);
  let sum = 0;
  for (const v of mass) sum += v;
  let cumulative = 0;
  for (let k = 0; k <= n; k++) { cumulative += mass[k] / sum; mass[k] = cumulative; }
  // Roundoff may put the last CDF a few ulps from one. Normalize it once more.
  for (let k = 0; k <= n; k++) mass[k] /= cumulative;
  return rng => {
    const u = rng();
    if (!(u >= 0 && u < 1)) throw new Error('RNG must return [0,1)');
    let lo = 0, hi = n;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (mass[mid] > u) hi = mid; else lo = mid + 1; }
    return lo;
  };
}
const samplers = new Map<number, ReturnType<typeof binomialSampler>>();
function wins(n: number, rng: Rng) {
  if (!samplers.has(n)) samplers.set(n, binomialSampler(n, P_WIN_RED));
  return samplers.get(n)!(rng);
}
export const guestNet = (n: number, won: number) => LEDGER.bet * (2 * won - n);
export const houseNet = (n: number, won: number) => -guestNet(n, won);

/** Each point settles one round for every guest. Guest 1 is included in the house ledger. */
export function runLedgerNight(rng: Rng): LedgerRun {
  const house = [0], guest = [0];
  for (let r = 1; r <= LEDGER.rounds; r++) {
    const first = rng() < P_WIN_RED ? 1 : 0;
    const others = wins(LEDGER.guests - 1, rng);
    house.push(house[r - 1] + houseNet(LEDGER.guests, first + others));
    guest.push(guest[r - 1] + guestNet(1, first));
  }
  return { mode: 'night', house, guest };
}
/** A fresh experiment: 1,000 independent nights, fixed bets, no stopping/bankroll limit. */
export function runLedgerNights(rng: Rng): LedgerRun {
  const house = [0], guest = [0];
  for (let i = 1; i <= LEDGER.nights; i++) {
    const first = wins(LEDGER.rounds, rng), others = wins(LEDGER_ROUNDS - LEDGER.rounds, rng);
    house.push(house[i - 1] + houseNet(LEDGER_ROUNDS, first + others));
    guest.push(guest[i - 1] + guestNet(LEDGER.rounds, first));
  }
  return { mode: 'many', house, guest };
}
export const DEFAULT_LEDGER_SEED = 7044; // Selected only for the initial design fixture (46,900); later draws are unconditioned.
export const initialLedger = () => runLedgerNight(mulberry32(DEFAULT_LEDGER_SEED));
export function ledgerSeries(run: LedgerRun, view: LedgerView) {
  const values = run[view];
  const bands = numbers.prologue.bands.value[`${run.mode}_${view}`];
  const roundsPerPoint = run.mode === 'night' ? (view === 'house' ? LEDGER.guests : 1) : (view === 'house' ? LEDGER_ROUNDS : LEDGER.rounds);
  return { values, bands, total: values[values.length - 1],
    expected: values.map((_, i) => i * roundsPerPoint * LEDGER.bet * EDGE_RED * (view === 'house' ? 1 : -1)),
    rounds: (values.length - 1) * roundsPerPoint };
}
/** A display representation of the exact probability; 2 significant figures, no percent. */
export function rareProbability(p: number) {
  if (!(p > 0 && p < 1)) throw new Error('Probability must lie in (0,1)');
  const [coefficient, exponent] = p.toExponential(1).split('e');
  const zeros = -Number(exponent) - 1;
  return { prefix: `0.${'0'.repeat(zeros)}`, digits: coefficient.replace('.', ''), coefficient, exponent: Number(exponent), zeros };
}
export const PROLOGUE_CHANCE = rareProbability(numbers.prologue.house_loss_probability.value);
export const PROLOGUE_COMPARISON = Math.round(numbers.prologue.lottery_comparison.value / 100) * 100;
