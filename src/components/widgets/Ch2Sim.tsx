import { useMemo, useState } from 'preact/hooks';
import source from '../../../i18n/source/Ch2-LLN.json';
import { makeCopy } from '../../i18n/copy';
import { money, type Locale } from '../../i18n/site';
import { mulberry32 } from '../../engine/rng';
import { LLN_ROUNDS, LLN_DEFAULT_ROUNDS, LLN_DEFAULT_SEED, simulatePaths, runPopulation } from '../../engine/lln';
import './ch2-sim.css';

const T = makeCopy({ rounds: '局数', chart: '13 条资金曲线和 90% 区间，整体向下漂移', start: '起点', reset: '重来', run: '跑一万人',
  note: '蓝线是你，灰线是其他人。虚线是每局 −5.26% 的平均走势，灰带里装着 90% 的人。' }, source);
// NEW COPY: dynamic labels and whole-sentence results; source has only static snapshots.
export const NEW_COPY = {
  zh: { you: (amount: string) => `你 ${amount}`, round: (n: number) => `第 ${n} 局`,
    result: (r: ReturnType<typeof runPopulation>) => `10,000 人中，${r.ahead.toLocaleString('en-US')} 人还在赚钱（${r.percent.toFixed(2)}%）；精确概率 ${r.exactPercent.toPrecision(3)}%。打平 ${r.tied.toLocaleString('en-US')} 人，不计为赚钱。`,
    band: '灰带是每个时点的精确 5%–95% 分位区间；离散取值使覆盖率至少为 90%，不表示整条曲线都留在带内。每人每局押 1 元，显示累计净盈亏，不设本金或停手机制。' },
  en: { you: (amount: string) => `You ${amount}`, round: (n: number) => `Round ${n.toLocaleString('en-US')}`,
    result: (r: ReturnType<typeof runPopulation>) => `Of 10,000 people, ${r.ahead.toLocaleString('en-US')} ${r.ahead === 1 ? 'is' : 'are'} still ahead (${r.percent.toFixed(2)}%); exact probability ${r.exactPercent.toPrecision(3)}%. ${r.tied.toLocaleString('en-US')} broke even and do not count as ahead.`,
    band: 'The band shows exact 5th–95th percentiles at each point in time. Discrete outcomes give at least 90% coverage; whole paths need not stay inside it. Each person bets $1 per spin. This is cumulative net profit, with no bankroll limit or stopping rule.' },
};

export default function Ch2Sim({ locale }: { locale: Locale }) {
  const t = T[locale], copy = NEW_COPY[locale];
  const [rounds, setRounds] = useState<number>(LLN_DEFAULT_ROUNDS);
  const [seed, setSeed] = useState(LLN_DEFAULT_SEED);
  const [run, setRun] = useState(0);
  const [population, setPopulation] = useState<ReturnType<typeof runPopulation> | null>(null);
  const simulation = useMemo(() => simulatePaths(rounds, seed), [rounds, seed]);
  const { band, paths, you } = simulation;
  // Coordinate transforms only; all gambling math is in engine/lln.ts.
  const values = [...paths.flat(), ...band.flatMap(b => [b.low, b.high])];
  const low = Math.min(...values), high = Math.max(...values);
  const x = (i: number) => 42 + i / (band.length - 1) * 258;
  const y = (v: number) => 24 + (high - v) / (high - low || 1) * 158;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const upper = path(band.map(b => b.high));
  const lower = band.map((b, i) => `L${x(i).toFixed(2)},${y(b.low).toFixed(2)}`).reverse().join(' ');
  return <div class="ch2-sim">
    <div class="ch2-seg" role="group" aria-label={t.rounds}>{LLN_ROUNDS.map(n => <button type="button" aria-pressed={rounds === n} onClick={() => { setRounds(n); setPopulation(null); }}>{n}</button>)}</div>
    <svg viewBox="0 0 342 246" class="ch-figure" role="img" aria-label={`${t.chart}. ${copy.you(money(you, locale))}`}>
      <path data-band d={`${upper} ${lower} Z`} fill="var(--ink-deep)" fill-opacity="0.08" />
      <line x1="42" x2="300" y1={y(0)} y2={y(0)} stroke="var(--rule)" />
      {[high, 0, low].filter((v, i) => i === 1 || Math.abs(y(v) - y(0)) > 14).map(v => <text x="37" y={y(v) + 4} text-anchor="end" class="ch2-axis">{v}</text>)}
      {paths.map((values, i) => i > 0 && <path data-player d={path(values)} fill="none" stroke="var(--muted)" stroke-opacity="0.4" stroke-width="1" />)}
      <path data-expectation d={path(band.map(b => b.expected))} fill="none" stroke="var(--ink-deep)" stroke-width="1.4" stroke-dasharray="6 4" />
      <path data-player data-you d={path(paths[0])} fill="none" stroke="var(--you)" stroke-width="2.6" />
      <circle cx="300" cy={y(you)} r="4" fill="var(--you)" />
      <text x="42" y="14" class="ch2-axis">{t.start}</text>
      <text x="42" y="205" class="ch2-axis">{copy.round(0)}</text>
      <text x="300" y="205" text-anchor="end" class="ch2-axis">{copy.round(rounds)}</text>
      <text data-endpoint x="300" y="234" text-anchor="end" fill="var(--you)" font-size="14" font-weight="700">{copy.you(money(you, locale))}</text>
    </svg>
    <p class="ch2-note">{t.note}</p>
    <div class="ch2-actions">
      <button type="button" class="btn btn-outline" onClick={() => { setSeed(seed + 1); setPopulation(null); }}>{t.reset}</button>
      <button type="button" class="btn btn-primary" onClick={() => { setRun(run + 1); setPopulation(runPopulation(rounds, mulberry32(seed + 100000 + run))); }}>{t.run}</button>
    </div>
    <div class="ch2-result" role="status" aria-live="polite">{population ? copy.result(population) : copy.you(money(you, locale))}</div>
    <p class="ch-small ch-muted">{copy.band}</p>
  </div>;
}
