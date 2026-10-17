import { useMemo, useRef, useState } from 'preact/hooks';
import source from '../../../i18n/source/Prologue.json';
import { makeCopy } from '../../i18n/copy';
import { money, type Locale } from '../../i18n/site';
import { mulberry32 } from '../../engine/rng';
import { DEFAULT_LEDGER_SEED, LEDGER, runLedgerNight, runLedgerNights, ledgerSeries, type LedgerView } from '../../engine/house-ledger';
import './house-ledger.css';

const T = makeCopy({ view: '视角', guest: '赌徒视角', house: '庄家视角', made: '今晚你赚了',
  another: '再开一晚', many: '连开 1000 晚', zero: '第 0 局', band: '灰带：95% 的夜晚落在这里' }, source);
// NEW COPY — complete sentences, pending editorial review; no source JSON changes.
export const LEDGER_COPY = {
  zh: { lost: '今晚你亏了', even: '今晚不赚不亏', total: (n: string) => `${n} 晚累计净收入`,
    round: (n: string) => `第 ${n} 局`, night: (n: string) => `第 ${n} 晚`,
    chart: (who: string, n: string) => `${who}：${n}的累计净收入与逐点 95% 区间`,
    pointwise: '灰带是每个时点的精确二项中央 95% 区间，不保证整条曲线都在其中。虚线为期望。',
    guestNote: '赌徒视角只看其中第 1 位客人；切换视角不会重抽结果。',
    model: '每位客人的赌局相互独立；固定押红，不因本金或输赢提前停手。每次按钮都开始一批新的实验。',
    fixture: '第一次显示的是固定的一晚示例；之后每点一次，都是新的随机结果。',
    illustrated: '示意图：14 位客人的资金曲线，不随上面的模拟变化。',
  },
  en: { lost: 'Tonight you lost', even: 'Tonight you broke even', total: (n: string) => `Net income over ${n} nights`,
    round: (n: string) => `Round ${n}`, night: (n: string) => `Night ${n}`,
    chart: (who: string, n: string) => `${who}: cumulative net income through ${n}, with pointwise 95% intervals`,
    pointwise: 'The grey band is an exact central 95% binomial interval at each point, not a guarantee for the entire path. The dashed line is the expectation.',
    guestNote: 'Gambler view follows guest 1 only. Switching views keeps the same results.',
    model: 'Guests play independent rounds, always betting red, with no early stops due to bankroll or results. Each button starts a fresh experiment.',
    fixture: 'The first night shown is a fixed example; every click after that is a fresh random draw.',
    illustrated: 'Illustration: bankroll paths for 14 guests. It does not change with the simulation above.',
  },
};
export default function HouseLedger({ locale, seed = DEFAULT_LEDGER_SEED }: { locale: Locale; seed?: number }) {
  const rng = useRef(mulberry32(seed));
  const [run, setRun] = useState(() => runLedgerNight(rng.current));
  const [view, setView] = useState<LedgerView>('house');
  const t = T[locale], copy = LEDGER_COPY[locale];
  const series = useMemo(() => ledgerSeries(run, view), [run, view]);
  const chart = useMemo(() => {
    const all = [...series.values, ...series.expected, ...series.bands.flat(), 0];
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max(1, (hi - lo) * .08); lo -= pad; hi += pad;
    const x = (i: number) => 8 + i / (series.values.length - 1) * 302;
    const y = (v: number) => 8 + (hi - v) / (hi - lo) * 128;
    const coord = (v: number, i: number) => `${x(i).toFixed(2)} ${y(v).toFixed(2)}`;
    const line = (a: number[]) => 'M' + a.map(coord).join(' L');
    const lower = series.bands.map(b => b[0]), upper = series.bands.map(b => b[1]);
    return { path: line(series.values), expected: line(series.expected), zero: y(0),
      band: `${line(upper)} L${lower.map(coord).reverse().join(' L')} Z`, end: y(series.total) };
  }, [series]);
  const many = run.mode === 'many';
  const endLabel = many ? copy.night(LEDGER.nights.toLocaleString('en-US')) : copy.round(series.rounds.toLocaleString('en-US'));
  const heading = many ? copy.total(LEDGER.nights.toLocaleString('en-US')) : series.total > 0 ? t.made : series.total < 0 ? copy.lost : copy.even;
  return <div class="pl-widget" data-testid="house-ledger" data-mode={run.mode} data-view={view}>
    <div class="pl-tabs" role="group" aria-label={t.view}>
      {(['guest', 'house'] as const).map(v => <button class={`pl-tab ${view === v ? 'is-on' : ''}`} type="button" data-view={v} aria-pressed={view === v} onClick={() => setView(v)}>{t[v]}</button>)}
    </div>
    <div class="ch-panel pl-ledger">
      <div class="pl-amount" aria-live="polite" aria-atomic="true">
        <span class="pl-amount-label">{heading}</span>
        <span class={`pl-amount-value ${series.total < 0 ? 'loss' : ''}`} data-value={series.total}>{money(series.total, locale, many)}</span>
      </div>
      <svg class="ch-figure" viewBox="0 0 318 170" role="img" aria-label={copy.chart(t[view], endLabel)}>
        <path class="pl-band" d={chart.band} fill="var(--ink)" fill-opacity="0.09" />
        <line x1="8" y1={chart.zero} x2="310" y2={chart.zero} stroke="var(--muted)" stroke-width="1" />
        <path d={chart.expected} fill="none" stroke="var(--muted)" stroke-dasharray="4 4" />
        <path class="pl-path" d={chart.path} fill="none" stroke={view === 'house' ? 'var(--house)' : 'var(--you)'} stroke-width="2.4" stroke-linejoin="round" />
        <circle cx="310" cy={chart.end} r="4" fill={view === 'house' ? 'var(--house)' : 'var(--you)'} />
        <text x="8" y="162">{many ? copy.night('0') : t.zero}</text>
        <text x="310" y="162" text-anchor="end">{endLabel}</text>
      </svg>
      <span class="pl-band-note">{many ? copy.pointwise : t.band}</span>
      {!many && <span class="pl-band-note">{copy.pointwise}</span>}
      {view === 'guest' && <span class="pl-band-note">{copy.guestNote}</span>}
    </div>
    <div class="pl-actions">
      <button type="button" class="pl-button" data-action="night" onClick={() => setRun(runLedgerNight(rng.current))}>{t.another}</button>
      <button type="button" class="pl-button pl-button-solid" data-action="many" onClick={() => setRun(runLedgerNights(rng.current))}>{t.many}</button>
    </div>
    <p class="pl-band-note">{copy.model} {copy.fixture}</p>
  </div>;
}
