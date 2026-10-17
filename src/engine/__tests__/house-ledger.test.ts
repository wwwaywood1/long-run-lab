import { describe, expect, it } from 'vitest';
import numbers from '../../../data/numbers.json';
import { binomialSampler, DEFAULT_LEDGER_SEED, guestNet, houseNet, initialLedger, LEDGER, LEDGER_ROUNDS, ledgerSeries, PROLOGUE_CHANCE, PROLOGUE_COMPARISON, runLedgerNight, runLedgerNights } from '../house-ledger';
import { mulberry32 } from '../rng';
import { EDGE_RED, P_WIN_RED } from '../roulette';

describe('exact binomial inverse sampling', () => {
  it('matches every atom of a small binomial against independent combinatorics', () => {
    const n = 12, p = .3, sample = binomialSampler(n, p);
    let cdf = 0, choose = 1;
    for (let k = 0; k <= n; k++) {
      if (k) choose *= (n - k + 1) / k;
      const mass = choose * p ** k * (1 - p) ** (n - k);
      expect(sample(() => cdf + mass / 2)).toBe(k);
      cdf += mass;
      if (k < n) {
        expect(sample(() => cdf - 1e-10)).toBe(k);
        expect(sample(() => cdf + 1e-10)).toBe(k + 1);
      }
    }
  });
  it('handles deterministic distributions, p near 1, and invalid input', () => {
    expect(binomialSampler(0, .4)(() => .5)).toBe(0);
    expect(binomialSampler(100, 0)(() => .5)).toBe(0);
    expect(binomialSampler(100, 1)(() => .5)).toBe(100);
    expect(binomialSampler(10, .99)(() => .5)).toBe(10);
    for (const [n, p] of [[-1,.5], [1.2,.5], [2,-.1], [2,1.1], [2,NaN]]) expect(() => binomialSampler(n,p)).toThrow();
    for (const u of [-.1, 1, NaN]) expect(() => binomialSampler(2,.5)(() => u)).toThrow();
  });
  it('matches exact Python quantiles for 100,000 trials without a normal approximation', () => {
    const sample = binomialSampler(LEDGER_ROUNDS, P_WIN_RED);
    const [low, high] = numbers.prologue.bands.value.night_house.at(-1)!;
    expect(houseNet(LEDGER_ROUNDS, sample(() => .975))).toBe(low);
    expect(houseNet(LEDGER_ROUNDS, sample(() => .025))).toBe(high);
  });
});

describe('shared house and guest experiments', () => {
  it('reproduces the design amount with a real seeded sample, not an overwritten balance', () => {
    const run = initialLedger();
    expect(run).toEqual(runLedgerNight(mulberry32(DEFAULT_LEDGER_SEED)));
    expect(run.house.at(-1)).toBe(numbers.prologue.design_reference.value.default_house_profit);
    expect(run.house).toHaveLength(101);
    for (let i=1;i<run.guest.length;i++) {
      const first = run.guest[i] - run.guest[i-1];
      expect(Math.abs(first)).toBe(LEDGER.bet);
      const othersNet = -(run.house[i] - run.house[i-1]) - first;
      const otherWins = (othersNet / LEDGER.bet + LEDGER.guests - 1) / 2;
      expect(Number.isInteger(otherWins)).toBe(true);
      expect(otherWins).toBeGreaterThanOrEqual(0);
      expect(otherWins).toBeLessThanOrEqual(LEDGER.guests - 1);
    }
  });
  it('keeps identical runs when switching views; 1,000 nights use the right cumulative scales', () => {
    const run = runLedgerNights(mulberry32(42));
    expect(run).toEqual(runLedgerNights(mulberry32(42)));
    expect(run.house).toHaveLength(1001);
    expect(run.guest).toHaveLength(1001);
    const h=ledgerSeries(run,'house'), g=ledgerSeries(run,'guest');
    expect(h.rounds).toBe(100_000_000); expect(g.rounds).toBe(100_000);
    expect(h.values).toBe(run.house); expect(g.values).toBe(run.guest);
    expect(h.expected.at(-1)).toBeCloseTo(100_000_000 * 10 * EDGE_RED);
    expect(g.expected.at(-1)).toBeCloseTo(-100_000 * 10 * EDGE_RED);
    expect(h.bands).toHaveLength(h.values.length);
  });
  it('seeded Monte Carlo agrees with analytic mean, variance and guest ahead probability', () => {
    const rng=mulberry32(20261017), count=20000;
    let sum=0, squares=0, ahead=0;
    for(let i=0;i<count;i++) {
      const run=runLedgerNight(rng), h=run.house.at(-1)!;
      sum+=h; squares+=h*h; ahead+=Number(run.guest.at(-1)!>0);
    }
    const mean=LEDGER_ROUNDS*LEDGER.bet*EDGE_RED;
    const variance=4*LEDGER.bet**2*LEDGER_ROUNDS*P_WIN_RED*(1-P_WIN_RED);
    expect(Math.abs(sum/count-mean)).toBeLessThan(5*Math.sqrt(variance/count));
    expect(Math.abs((squares/count-(sum/count)**2)/variance-1)).toBeLessThan(.04);
    const pa=numbers.roulette.p_ahead_after_n.value['100'];
    expect(Math.abs(ahead/count-pa)).toBeLessThan(5*Math.sqrt(pa*(1-pa)/count));
  });
  it('uses exact pointwise quantiles for both views and modes', () => {
    const sample=binomialSampler(100,P_WIN_RED);
    const bands=numbers.prologue.bands.value;
    expect(bands.night_guest.at(-1)).toEqual([guestNet(100,sample(()=>.025)),guestNet(100,sample(()=>.975))]);
    expect(bands.many_guest.at(-1)).toEqual(bands.night_house.at(-1)!.map(x=>-x).reverse());
    expect(bands.many_house.at(-1)).toEqual([52435860,52827300]);
    for(const rows of Object.values(bands)) {
      expect(rows[0]).toEqual([0,0]);
      for(const [lo,hi] of rows) {expect(lo).toBeLessThanOrEqual(hi);expect(Math.abs(lo%10)).toBe(0);expect(Math.abs(hi%10)).toBe(0);}
    }
  });
  it('strict house loss tail matches an independent log-PMF recurrence', () => {
    const n=LEDGER_ROUNDS,k=n/2+1,p=P_WIN_RED;
    let logChoose=0;
    for(let i=1;i<=k;i++)logChoose+=Math.log((n-k+i)/i);
    let mass=Math.exp(logChoose+k*Math.log(p)+(n-k)*Math.log1p(-p)), tail=mass;
    for(let j=k;j<n;j++){mass*=((n-j)/(j+1))*p/(1-p);tail+=mass;}
    expect(Math.abs(tail/numbers.prologue.house_loss_probability.value-1)).toBeLessThan(1e-7);
    const ratio=(1/numbers.lottery.jackpot_one_in.value)**LEDGER.lottery_draws/tail;
    expect(ratio).toBeCloseTo(numbers.prologue.lottery_comparison.value,2);
    expect(PROLOGUE_COMPARISON).toBe(7800);
    expect(PROLOGUE_CHANCE).toEqual({prefix:'0.'+'0'.repeat(61),digits:'13',coefficient:'1.3',exponent:-62,zeros:61});
  });
});
